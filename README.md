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

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

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

3. Run:

```bash
npm start
```

4. Visit:

```text
http://localhost:3000
http://localhost:3000/admin-access-2026
```

## Render deployment

1. Create a PostgreSQL database on Render.
2. Copy the Internal Database URL or External Database URL into `DATABASE_URL`.
3. Create a new Web Service and connect this project.
4. Build command:

```bash
npm install
```

5. Start command:

```bash
npm start
```

6. Add the environment variables from the `.env` example.
7. Set `INIT_DB=true` for first deployment. After tables are created, you may change it to `false`.

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
- For production, consider adding email notifications and rate limiting.
