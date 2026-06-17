require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const ADMIN_SECRET_PATH = process.env.ADMIN_SECRET_PATH || 'admin-access-2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function requireUser(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'user') return res.status(403).json({ message: 'Access denied.' });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session.' });
  }
}

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Admin sign in required.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ message: 'Access denied.' });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired admin session.' });
  }
}

function cleanEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateTicketCode() {
  const year = new Date().getFullYear();
  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TKT-${year}-${token}`;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ticket_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      program_name TEXT NOT NULL,
      ticket_type TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      amount NUMERIC(12,2) NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      ticket_code TEXT UNIQUE,
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );
  `);
}

if (process.env.INIT_DB === 'true') {
  initDb().catch((err) => {
    console.error('Database initialisation failed:', err);
    process.exit(1);
  });
}

app.get('/api/config', (req, res) => {
  res.json({
    programName: process.env.PROGRAM_NAME || 'Annual Leadership Program',
    programDate: process.env.PROGRAM_DATE || 'Saturday, 20 July 2026',
    programVenue: process.env.PROGRAM_VENUE || 'Main Auditorium',
    ticketType: process.env.TICKET_TYPE || 'General Admission',
    ticketPrice: Number(process.env.TICKET_PRICE || 100),
    currency: process.env.CURRENCY || 'GHS',
    paymentName: process.env.PAYMENT_NAME || 'Program Tickets',
    momoNumber: process.env.MOMO_NUMBER || '000 000 0000',
    momoName: process.env.MOMO_NAME || 'Account Name',
    bankName: process.env.BANK_NAME || 'Bank Name',
    bankAccount: process.env.BANK_ACCOUNT || '0000000000',
    bankAccountName: process.env.BANK_ACCOUNT_NAME || 'Account Name',
    paymentInstruction: process.env.PAYMENT_INSTRUCTION || 'Use your full name as the payment reference. Your ticket will be issued after admin approval.',
  });
});

app.post('/api/register-ticket', async (req, res) => {
  const {
    fullName,
    email,
    phone,
    password,
    quantity,
    paymentMethod,
    paymentReference,
  } = req.body;

  const normalizedEmail = cleanEmail(email);
  const qty = Number(quantity || 1);
  const ticketPrice = Number(process.env.TICKET_PRICE || 100);

  if (!fullName || !normalizedEmail || !phone || !password || !paymentMethod || !paymentReference) {
    return res.status(400).json({ message: 'Please complete all required fields.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
    return res.status(400).json({ message: 'Quantity must be between 1 and 10.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id, password_hash FROM users WHERE email = $1', [normalizedEmail]);
    let userId;
    let passwordHash;

    if (existing.rowCount) {
      userId = existing.rows[0].id;
      passwordHash = existing.rows[0].password_hash;
      const passwordOk = await bcrypt.compare(password, passwordHash);
      if (!passwordOk) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'An account with this email already exists. Use the correct password or sign in.' });
      }
      await client.query('UPDATE users SET full_name = $1, phone = $2 WHERE id = $3', [fullName.trim(), phone.trim(), userId]);
    } else {
      passwordHash = await bcrypt.hash(password, 12);
      const created = await client.query(
        'INSERT INTO users (full_name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
        [fullName.trim(), normalizedEmail, phone.trim(), passwordHash]
      );
      userId = created.rows[0].id;
    }

    const amount = qty * ticketPrice;
    await client.query(
      `INSERT INTO ticket_requests
       (user_id, program_name, ticket_type, quantity, amount, payment_method, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        process.env.PROGRAM_NAME || 'Annual Leadership Program',
        process.env.TICKET_TYPE || 'General Admission',
        qty,
        amount,
        paymentMethod,
        paymentReference.trim(),
      ]
    );

    await client.query('COMMIT');
    const token = signToken({ id: userId, role: 'user', email: normalizedEmail });
    res.status(201).json({
      message: 'Your payment details have been submitted. Your ticket will appear after approval.',
      token,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Could not submit ticket request.' });
  } finally {
    client.release();
  }
});

app.post('/api/login', async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  if (!result.rowCount) return res.status(401).json({ message: 'Invalid email or password.' });

  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

  res.json({ token: signToken({ id: result.rows[0].id, role: 'user', email }) });
});

app.get('/api/my-account', requireUser, async (req, res) => {
  const user = await pool.query('SELECT full_name, email, phone, created_at FROM users WHERE id = $1', [req.user.id]);
  const tickets = await pool.query(
    `SELECT id, program_name, ticket_type, quantity, amount, payment_method, payment_reference,
            status, ticket_code, admin_note, created_at, approved_at
     FROM ticket_requests
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ user: user.rows[0], tickets: tickets.rows });
});

app.post('/api/admin/login', async (req, res) => {
  const password = String(req.body.password || '');
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  let valid = false;
  if (configuredHash) valid = await bcrypt.compare(password, configuredHash);
  else if (configuredPassword) valid = password === configuredPassword;

  if (!valid) return res.status(401).json({ message: 'Invalid admin password.' });
  res.json({ token: signToken({ role: 'admin' }) });
});

app.get('/api/admin/requests', requireAdmin, async (req, res) => {
  const status = req.query.status || 'pending';
  const allowed = ['pending', 'approved', 'rejected', 'all'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status filter.' });

  const where = status === 'all' ? '' : 'WHERE tr.status = $1';
  const params = status === 'all' ? [] : [status];
  const result = await pool.query(
    `SELECT tr.id, tr.program_name, tr.ticket_type, tr.quantity, tr.amount, tr.payment_method,
            tr.payment_reference, tr.status, tr.ticket_code, tr.admin_note, tr.created_at, tr.approved_at,
            u.full_name, u.email, u.phone
     FROM ticket_requests tr
     JOIN users u ON u.id = tr.user_id
     ${where}
     ORDER BY tr.created_at DESC`,
    params
  );
  res.json({ requests: result.rows });
});

app.post('/api/admin/requests/:id/approve', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid request ID.' });

  for (let tries = 0; tries < 5; tries += 1) {
    try {
      const code = generateTicketCode();
      const result = await pool.query(
        `UPDATE ticket_requests
         SET status = 'approved', ticket_code = COALESCE(ticket_code, $1), approved_at = COALESCE(approved_at, NOW()), admin_note = $2
         WHERE id = $3
         RETURNING id, status, ticket_code`,
        [code, req.body.note || null, id]
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Request not found.' });
      return res.json({ message: 'Ticket approved.', request: result.rows[0] });
    } catch (err) {
      if (err.code !== '23505') {
        console.error(err);
        return res.status(500).json({ message: 'Could not approve request.' });
      }
    }
  }
  res.status(500).json({ message: 'Could not generate a unique ticket code.' });
});

app.post('/api/admin/requests/:id/reject', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid request ID.' });

  const result = await pool.query(
    `UPDATE ticket_requests
     SET status = 'rejected', admin_note = $1
     WHERE id = $2
     RETURNING id, status`,
    [req.body.note || 'Payment could not be confirmed.', id]
  );
  if (!result.rowCount) return res.status(404).json({ message: 'Request not found.' });
  res.json({ message: 'Request rejected.', request: result.rows[0] });
});

app.get('/api/admin/verify/:code', requireAdmin, async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const result = await pool.query(
    `SELECT tr.ticket_code, tr.status, tr.program_name, tr.ticket_type, tr.quantity, tr.amount, tr.approved_at,
            u.full_name, u.email, u.phone
     FROM ticket_requests tr
     JOIN users u ON u.id = tr.user_id
     WHERE tr.ticket_code = $1`,
    [code]
  );

  if (!result.rowCount) return res.status(404).json({ valid: false, message: 'Ticket code not found.' });
  const row = result.rows[0];
  res.json({ valid: row.status === 'approved', ticket: row });
});

app.get(`/${ADMIN_SECRET_PATH}`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => res.redirect(`/${ADMIN_SECRET_PATH}`));

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => console.log(`Ticket site running on port ${PORT}`));
