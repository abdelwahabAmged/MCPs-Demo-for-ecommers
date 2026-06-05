(function () {
  var ICONS = {
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
  };

  var isDetailPage = window.location.pathname.match(/^\/support\/(.+)$/);
  var isNewForm = false;

  function formatDate(d) {
    if (!d) return '';
    var date = new Date(d.includes('T') ? d : d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function issueLabel(type) {
    return (type || '').replace(/_/g, ' ');
  }

  /* ── Tickets list ────────────────────────────────────── */

  function renderTicketsList(tickets) {
    var el = document.getElementById('tickets-content');
    if (!el) return;

    var countEl = document.getElementById('tickets-count');
    if (countEl) countEl.textContent = '(' + tickets.length + ')';

    if (!tickets.length && !isNewForm) {
      el.innerHTML =
        '<div class="tickets-empty">' +
          '<div class="tickets-empty-icon">' + ICONS.ticket + '</div>' +
          '<h2>No support tickets</h2>' +
          '<p>If you have an issue with an order, you can create a ticket here.</p>' +
        '</div>';
      return;
    }

    var listHtml = tickets.map(function (t) {
      var iconClass = t.priority === 'high' ? 'priority-high' : 'priority-normal';
      var statusClass = 'ticket-status-' + t.status;

      return '<a href="/support/' + t.ticket_id + '" class="ticket-card">' +
        '<div class="ticket-card-inner">' +
          '<div class="ticket-icon ' + iconClass + '">' + ICONS.alert + '</div>' +
          '<div class="ticket-card-info">' +
            '<div class="ticket-card-top">' +
              '<span class="ticket-card-id">' + t.ticket_id + '</span>' +
              '<span class="ticket-card-type">' + issueLabel(t.issue_type) + '</span>' +
            '</div>' +
            '<div class="ticket-card-desc">' + (t.description || 'No description') + '</div>' +
            '<div class="ticket-card-meta">Order ' + t.order_id + ' \u00b7 ' + formatDate(t.created_at) + '</div>' +
          '</div>' +
          '<div class="ticket-card-right">' +
            '<span class="ticket-status ' + statusClass + '">' + t.status.replace(/_/g, ' ') + '</span>' +
            '<span class="ticket-priority ' + iconClass + '">' + t.priority + '</span>' +
          '</div>' +
          '<span class="ticket-card-arrow">' + ICONS.arrowRight + '</span>' +
        '</div>' +
      '</a>';
    }).join('');

    var formHtml = '';
    if (isNewForm) {
      formHtml = renderNewTicketForm();
    }

    el.innerHTML = formHtml +
      '<div class="tickets-list">' + listHtml + '</div>';

    if (isNewForm) bindFormEvents();
  }

  /* ── New ticket form ─────────────────────────────────── */

  function renderNewTicketForm() {
    return '<div class="new-ticket-form" id="new-ticket-form">' +
      '<h2>Create Support Ticket</h2>' +
      '<div class="nt-group">' +
        '<label>Order ID</label>' +
        '<input type="text" id="nt-order" placeholder="e.g. ACM-2026-XXXXX">' +
      '</div>' +
      '<div class="nt-group">' +
        '<label>Issue Type</label>' +
        '<select id="nt-type">' +
          '<option value="">Select an issue...</option>' +
          '<option value="damaged">Damaged item</option>' +
          '<option value="wrong_item">Wrong item received</option>' +
          '<option value="missing_item">Missing item</option>' +
          '<option value="late_delivery">Late delivery</option>' +
          '<option value="other">Other</option>' +
        '</select>' +
      '</div>' +
      '<div class="nt-group">' +
        '<label>Description</label>' +
        '<textarea id="nt-desc" placeholder="Describe your issue in detail..."></textarea>' +
      '</div>' +
      '<button class="nt-submit" id="nt-submit">' + ICONS.send + ' Submit Ticket</button>' +
    '</div>';
  }

  function bindFormEvents() {
    var btn = document.getElementById('nt-submit');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var orderId = document.getElementById('nt-order').value.trim();
      var issueType = document.getElementById('nt-type').value;
      var desc = document.getElementById('nt-desc').value.trim();

      if (!orderId || !issueType || !desc) {
        alert('Please fill in all fields.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Submitting...';

      fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: orderId, issue_type: issueType, description: desc })
      })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error); });
        return res.json();
      })
      .then(function (data) {
        window.location.href = '/support/' + data.ticket_id;
      })
      .catch(function (err) {
        alert('Error: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = ICONS.send + ' Submit Ticket';
      });
    });
  }

  /* ── Ticket detail ───────────────────────────────────── */

  function renderTicketDetail(data) {
    var el = document.getElementById('tickets-content');
    if (!el) return;
    var t = data;

    var resHtml = '';
    if (t.resolution) {
      resHtml = '<div class="ticket-resolution">' +
        '<h3>Resolution</h3>' +
        '<p>' + t.resolution + '</p>' +
      '</div>';
    }

    var statusClass = 'ticket-status-' + t.status;
    var prioClass = t.priority === 'high' ? 'priority-high' : 'priority-normal';

    var orderHtml = '';
    if (t.order) {
      orderHtml = '<div class="ticket-info-card">' +
        '<div class="ticket-info-header"><h3>Related Order</h3></div>' +
        '<div class="ticket-info-body">' +
          '<div class="ticket-info-row"><span class="t-label">Order</span><span class="t-value">' + t.order.order_id + '</span></div>' +
          '<div class="ticket-info-row"><span class="t-label">Status</span><span class="t-value" style="text-transform:capitalize">' + t.order.status + '</span></div>' +
          '<div class="ticket-info-row"><span class="t-label">Date</span><span class="t-value">' + formatDate(t.order.order_date) + '</span></div>' +
          '<div class="ticket-info-row"><span class="t-label">Total</span><span class="t-value">$' + t.order.total.toFixed(2) + '</span></div>' +
        '</div>' +
        '<a href="/orders/' + t.order.order_id + '" class="ticket-order-link">View order details ' + ICONS.link + '</a>' +
      '</div>';
    }

    var resTime = t.priority === 'high' ? '24\u201348 hours' : '3\u20135 business days';

    el.innerHTML =
      '<a href="/support" class="back-link">' + ICONS.arrowLeft + ' All Tickets</a>' +
      '<div class="ticket-detail-layout">' +
        '<div class="ticket-detail-card">' +
          '<div class="ticket-detail-header">' +
            '<h1>' + t.ticket_id + '</h1>' +
            '<div class="ticket-detail-badges">' +
              '<span class="ticket-status ' + statusClass + '">' + t.status.replace(/_/g, ' ') + '</span>' +
              '<span class="ticket-priority ' + prioClass + '">' + t.priority + ' priority</span>' +
              '<span style="font-size:12px;color:#8e8e93">' + issueLabel(t.issue_type) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="ticket-detail-body">' +
            '<h3>Description</h3>' +
            '<div class="ticket-description">' + (t.description || 'No description provided.') + '</div>' +
            resHtml +
          '</div>' +
        '</div>' +
        '<div class="ticket-sidebar">' +
          '<div class="ticket-info-card">' +
            '<div class="ticket-info-header"><h3>Ticket Details</h3></div>' +
            '<div class="ticket-info-body">' +
              '<div class="ticket-info-row"><span class="t-label">Ticket ID</span><span class="t-value">' + t.ticket_id + '</span></div>' +
              '<div class="ticket-info-row"><span class="t-label">Order</span><span class="t-value">' + t.order_id + '</span></div>' +
              '<div class="ticket-info-row"><span class="t-label">Issue</span><span class="t-value" style="text-transform:capitalize">' + issueLabel(t.issue_type) + '</span></div>' +
              '<div class="ticket-info-row"><span class="t-label">Priority</span><span class="t-value ' + prioClass + '">' + t.priority + '</span></div>' +
              '<div class="ticket-info-row"><span class="t-label">Status</span><span class="t-value">' + t.status.replace(/_/g, ' ') + '</span></div>' +
              '<div class="ticket-info-row"><span class="t-label">Created</span><span class="t-value">' + formatDate(t.created_at) + '</span></div>' +
              '<div class="ticket-info-row"><span class="t-label">Est. Response</span><span class="t-value">' + resTime + '</span></div>' +
            '</div>' +
          '</div>' +
          orderHtml +
        '</div>' +
      '</div>';
  }

  /* ── Toggle new ticket form ──────────────────────────── */

  var newBtn = document.getElementById('new-ticket-btn');
  if (newBtn) {
    newBtn.addEventListener('click', function (e) {
      e.preventDefault();
      isNewForm = !isNewForm;
      loadTickets();
    });
  }

  /* ── Load data ───────────────────────────────────────── */

  function loadTickets() {
    fetch('/api/tickets', { credentials: 'include' })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/login'; return null; }
        return res.json();
      })
      .then(function (data) { if (data) renderTicketsList(data.tickets); });
  }

  if (isDetailPage) {
    var ticketId = isDetailPage[1];
    fetch('/api/tickets/' + ticketId, { credentials: 'include' })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/login'; return null; }
        if (res.status === 404) { window.location.href = '/support'; return null; }
        return res.json();
      })
      .then(function (data) { if (data) renderTicketDetail(data); });
  } else {
    loadTickets();
  }
})();
