# Manual Payment Ticket Website

A clean one-page ticket purchase site with manual payment instructions, user account/status view, admin approval, and ticket-code verification.

## Features

- Public one-page ticket registration.
- Manual payment modal with Mobile Money and bank details.
- User submits personal details and payment reference after paying.
- A user account is created automatically.
- Ticket remains pending until admin approval.
- Admin page is accessed by direct link, not a homepage button.
- Admin can approve, reject, and verify ticket codes.
- Approved requests receive a unique e-ticket code.
- Responsive layout for small phones, tablets, and desktop screens.

## Why you saw ECONNREFUSED

Your `.env` file was pointing to this local PostgreSQL database:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ticketdb
```

That only works if PostgreSQL is installed, running, and has a database called `ticketdb` on your computer. The error happened because Node tried to connect to `127.0.0.1:5432`, but no PostgreSQL server was listening there.

This version no longer crashes the whole site when the database is unavailable. The public page will still open, and database actions will show a clear message. To actually submit/approve tickets, connect a real PostgreSQL database.

## Local setup option A: Use Render PostgreSQL

1. Create a PostgreSQL database on Render.
2. Copy the External Database URL.
3. Paste it into your local `.env` file as `DATABASE_URL`.
4. Keep:

```env
NODE_ENV=development
INIT_DB=true
```

5. Run:

```bash
npm install
npm start
```

6. Visit:

```text
http://localhost:3000
http://localhost:3000/admin-access-2026
```

## Local setup option B: Use local PostgreSQL

1. Install PostgreSQL.
2. Create a database named `ticketdb`.
3. Make sure PostgreSQL is running on port `5432`.
4. Update your `.env` username/password to match your local PostgreSQL login.
5. Run:

```bash
npm install
npm start
```

## Render deployment

1. Create a PostgreSQL database on Render.
2. Copy the Internal Database URL into `DATABASE_URL` for the deployed web service.
3. Create a new Web Service and connect this project.
4. Build command:

```bash
npm install
```

5. Start command:

```bash
npm start
```

6. Add the environment variables from `.env` or `.env.example`.
7. Set `INIT_DB=true` for the first deployment. After the tables are created, you may change it to `false`.

## Environment variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/ticketdb
INIT_DB=true
JWT_SECRET=replace-this-with-a-long-random-string
ADMIN_PASSWORD=change-this-admin-password
ADMIN_SECRET_PATH=admin-access-2026

PROGRAM_NAME=Annual Leadership Program
PROGRAM_DATE=Saturday, 20 July 2026
PROGRAM_VENUE=Main Auditorium
TICKET_TYPE=General Admission
TICKET_PRICE=100
CURRENCY=GHS

MOMO_NUMBER=000 000 0000
MOMO_NAME=Account Name
BANK_NAME=Bank Name
BANK_ACCOUNT=0000000000
BANK_ACCOUNT_NAME=Account Name
PAYMENT_INSTRUCTION=Use your full name as the payment reference. Your ticket will be issued after admin approval.
```

## Admin page

The admin route is controlled by:

```env
ADMIN_SECRET_PATH=admin-access-2026
```

Change it to a private path before deployment.

## Security notes

- Use a long random `JWT_SECRET`.
- Use a strong `ADMIN_PASSWORD`.
- Do not expose the admin link publicly.
- Do not commit your real `.env` file to GitHub.
- For production, consider adding email notifications, rate limiting, and server-side logging.
