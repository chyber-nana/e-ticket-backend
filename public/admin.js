const $ = (selector) => document.querySelector(selector);

function adminToken() {
  return localStorage.getItem('ticketAdminToken');
}

function adminHeaders() {
  return { Authorization: `Bearer ${adminToken()}` };
}

function showAdminPanel() {
  $('#adminLoginPanel').classList.add('hidden');
  $('#adminPanel').classList.remove('hidden');
  loadRequests();
}

function money(amount) {
  return `GHS ${Number(amount || 0).toFixed(2)}`;
}

async function loadRequests() {
  const status = $('#statusFilter').value;
  const output = $('#requestsOutput');
  output.innerHTML = '<p class="muted">Loading requests...</p>';

  const res = await fetch(`/api/admin/requests?status=${encodeURIComponent(status)}`, {
    headers: adminHeaders(),
  });
  const data = await res.json();

  if (!res.ok) {
    output.innerHTML = `<p class="form-message error">${data.message || 'Could not load requests.'}</p>`;
    return;
  }

  output.innerHTML = data.requests.map((request) => `
    <article class="request-card">
      <span class="status-pill ${request.status}">${request.status}</span>
      <h3>${request.full_name}</h3>
      <p class="muted">${request.email} — ${request.phone}</p>
      <p>${request.program_name} — ${request.ticket_type}</p>
      <p class="muted">Quantity: ${request.quantity} — Amount: ${money(request.amount)}</p>
      <p class="muted">${request.payment_method}: ${request.payment_reference}</p>
      ${request.ticket_code ? `<div class="ticket-code">${request.ticket_code}</div>` : ''}
      ${request.admin_note ? `<p class="muted small">Note: ${request.admin_note}</p>` : ''}
      ${request.status === 'pending' ? `
        <div class="card-actions">
          <button class="secondary-btn" data-approve="${request.id}">Approve</button>
          <button class="danger-btn" data-reject="${request.id}">Reject</button>
        </div>` : ''}
    </article>
  `).join('') || '<p class="muted">No requests found.</p>';
}

async function updateRequest(id, action) {
  const note = action === 'reject'
    ? prompt('Reason for rejection:', 'Payment could not be confirmed.')
    : prompt('Optional admin note:', 'Payment confirmed.');

  if (note === null) return;

  const res = await fetch(`/api/admin/requests/${id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ note }),
  });
  const data = await res.json();
  if (!res.ok) alert(data.message || 'Action failed.');
  loadRequests();
}

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken()) showAdminPanel();

  $('#adminLoginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    $('#adminLoginMessage').textContent = 'Signing in...';

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      $('#adminLoginMessage').textContent = data.message || 'Could not sign in.';
      $('#adminLoginMessage').className = 'form-message error';
      return;
    }

    localStorage.setItem('ticketAdminToken', data.token);
    showAdminPanel();
  });

  $('#statusFilter').addEventListener('change', loadRequests);

  $('#requestsOutput').addEventListener('click', (event) => {
    const approveId = event.target.dataset.approve;
    const rejectId = event.target.dataset.reject;
    if (approveId) updateRequest(approveId, 'approve');
    if (rejectId) updateRequest(rejectId, 'reject');
  });

  $('#verifyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('code').trim();
    const output = $('#verifyOutput');
    output.innerHTML = '<p class="muted">Checking code...</p>';

    const res = await fetch(`/api/admin/verify/${encodeURIComponent(code)}`, {
      headers: adminHeaders(),
    });
    const data = await res.json();

    if (!res.ok) {
      output.innerHTML = `<article class="status-card"><span class="status-pill rejected">Invalid</span><p>${data.message || 'Code not found.'}</p></article>`;
      return;
    }

    const ticket = data.ticket;
    output.innerHTML = `
      <article class="status-card">
        <span class="status-pill ${data.valid ? 'approved' : 'rejected'}">${data.valid ? 'Valid' : 'Not valid'}</span>
        <h3>${ticket.full_name}</h3>
        <p class="muted">${ticket.email} — ${ticket.phone}</p>
        <p>${ticket.program_name} — ${ticket.ticket_type}</p>
        <p class="muted">Quantity: ${ticket.quantity} — Status: ${ticket.status}</p>
        <div class="ticket-code">${ticket.ticket_code}</div>
      </article>`;
  });
});
