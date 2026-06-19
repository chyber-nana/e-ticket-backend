const API_BASE = 'https://e-ticket-backend-2eb3.onrender.com';
let siteConfig = {};

const $ = (selector) => document.querySelector(selector);

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function setMessage(el, text, type) {
  el.textContent = text || '';
  el.className = `form-message ${type || ''}`.trim();
}

function money(amount) {
  return `${siteConfig.currency || 'GHS'} ${Number(amount || 0).toFixed(2)}`;
}

async function loadConfig() {
  const res = await fetch(`${API_BASE}/api/config`);
  siteConfig = await res.json();
  $('#programName').textContent = siteConfig.programName;
  $('#programDate').textContent = siteConfig.programDate;
  $('#programVenue').textContent = siteConfig.programVenue;
  $('#ticketType').textContent = siteConfig.ticketType;
  $('#ticketPrice').textContent = Number(siteConfig.ticketPrice).toFixed(2);
  $('#currency').textContent = siteConfig.currency;
  $('#paymentInstruction').textContent = siteConfig.paymentInstruction;
  $('#momoNumber').textContent = siteConfig.momoNumber;
  $('#momoName').textContent = siteConfig.momoName;
  $('#bankAccount').textContent = siteConfig.bankAccount;
  $('#bankName').textContent = siteConfig.bankName;
  $('#bankAccountName').textContent = siteConfig.bankAccountName;
}

async function fetchAccount() {
  const token = localStorage.getItem('ticketUserToken');
  const output = $('#accountOutput');
  if (!token) return;

  const res = await fetch(`${API_BASE}/api/my-account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    localStorage.removeItem('ticketUserToken');
    return;
  }

  const data = await res.json();
  output.innerHTML = data.tickets.map((ticket) => `
    <article class="status-card">
      <span class="status-pill ${ticket.status}">${ticket.status}</span>
      <h3>${ticket.program_name}</h3>
      <p class="muted">${ticket.ticket_type} — Quantity: ${ticket.quantity} — ${money(ticket.amount)}</p>
      <p class="muted">Payment reference: ${ticket.payment_reference}</p>
      ${ticket.status === 'approved'
        ? `<div class="ticket-code">
      ${ticket.ticket_code}
    </div>

    <div class="ticket-qr">
      <img src="${ticket.qr_code}" alt="Ticket QR Code">
    </div><p class="muted small">Present this code at check-in.</p>`
        : ''}
      ${ticket.status === 'pending' ? '<p class="muted small">Awaiting payment confirmation.</p>' : ''}
      ${ticket.status === 'rejected' ? `<p class="muted small">${ticket.admin_note || 'Request rejected.'}</p>` : ''}
    </article>
  `).join('') || '<p class="muted">No ticket requests found.</p>';
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig().then(fetchAccount);

  $('#openPaymentBtn').addEventListener('click', () => openModal('paymentModal'));
  $('#continueDetailsBtn').addEventListener('click', () => {
    closeModal('paymentModal');
    openModal('detailsModal');
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });

  $('#ticketForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('#formMessage');
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.quantity = Number(payload.quantity);

    setMessage(message, 'Submitting your request...', '');
    const res = await fetch(`${API_BASE}/api/register-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(message, data.message || 'Could not submit request.', 'error');
      return;
    }

    localStorage.setItem('ticketUserToken', data.token);
    setMessage(message, data.message, 'success');
    form.reset();
    setTimeout(() => {
      closeModal('detailsModal');
      window.location.hash = 'account';
      fetchAccount();
    }, 900);
  });

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const output = $('#accountOutput');
    output.innerHTML = '<p class="muted">Signing in...</p>';

    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      output.innerHTML = `<p class="form-message error">${data.message || 'Could not sign in.'}</p>`;
      return;
    }

    localStorage.setItem('ticketUserToken', data.token);
    fetchAccount();
  });
});
