(function () {
  var ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    packageIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  var STATUS_STEPS = ['processing', 'shipped', 'delivered'];

  // Neutral grey placeholder shown when a snapshotted product image URL no
  // longer resolves (e.g. external CDN rotated/blocked the URL). Keeps order
  // history readable instead of rendering a broken-image icon.
  var PLACEHOLDER_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23f2f2f7'/%3E%3Cpath d='M20 26h24v16H20z' fill='none' stroke='%23c7c7cc' stroke-width='2'/%3E%3Ccircle cx='27' cy='32' r='3' fill='%23c7c7cc'/%3E%3Cpath d='M22 40l7-6 5 4 6-5 4 3' fill='none' stroke='%23c7c7cc' stroke-width='2'/%3E%3C/svg%3E";
  var IMG_FALLBACK = " onerror=\"this.onerror=null;this.src='" + PLACEHOLDER_IMG + "'\"";

  var isDetailPage = window.location.pathname.match(/^\/orders\/(.+)$/);

  function statusClass(s) { return 'status-' + s; }

  function formatDate(d) {
    if (!d) return '';
    var date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ── Orders List ─────────────────────────────────────── */

  function renderOrdersList(orders) {
    var el = document.getElementById('orders-content');
    if (!el) return;

    var titleEl = document.getElementById('orders-count');
    if (titleEl) titleEl.textContent = '(' + orders.length + ')';

    if (!orders.length) {
      el.innerHTML =
        '<div class="orders-empty">' +
          '<div class="orders-empty-icon">' + ICONS.bag + '</div>' +
          '<h2>No orders yet</h2>' +
          '<p>When you place an order, it will appear here.</p>' +
          '<a href="/" class="orders-empty-action">Start shopping ' + ICONS.arrowRight + '</a>' +
        '</div>';
      return;
    }

    el.innerHTML = '<div class="orders-list">' + orders.map(function (o) {
      var items = o.items || [];
      var images = items.slice(0, 3).map(function (item) {
        return item.image_url
          ? '<img src="' + item.image_url + '" alt=""' + IMG_FALLBACK + '>'
          : '';
      }).filter(Boolean).join('');
      var moreCount = items.length > 3 ? items.length - 3 : 0;
      var names = items.map(function (i) { return i.name; }).join(', ');
      var totalQty = items.reduce(function (s, i) { return s + i.quantity; }, 0);

      return '<a href="/orders/' + o.order_id + '" class="order-card">' +
        '<div class="order-card-header">' +
          '<span class="order-card-id">' + o.order_id + '</span>' +
          '<span class="status-badge ' + statusClass(o.status) + '">' + o.status + '</span>' +
          '<span class="order-card-date">' + formatDate(o.order_date) + '</span>' +
          '<button type="button" class="order-delete-btn" data-order-id="' + o.order_id + '" title="Delete order" aria-label="Delete order">' + ICONS.close + '</button>' +
        '</div>' +
        '<div class="order-card-body">' +
          '<div class="order-card-items-preview">' + images +
            (moreCount > 0 ? '<div class="more-items">+' + moreCount + '</div>' : '') +
          '</div>' +
          '<div class="order-card-info">' +
            '<div class="order-card-item-names">' + names + '</div>' +
            '<div class="order-card-item-count">' + totalQty + ' item' + (totalQty !== 1 ? 's' : '') + '</div>' +
          '</div>' +
          '<div class="order-card-right">' +
            '<div class="order-card-total">$' + o.total.toFixed(2) + '</div>' +
          '</div>' +
          '<span class="order-card-arrow">' + ICONS.arrowRight + '</span>' +
        '</div>' +
      '</a>';
    }).join('') + '</div>';
  }

  /* ── Order Detail ────────────────────────────────────── */

  function getTimelineState(orderStatus, step) {
    var oi = STATUS_STEPS.indexOf(orderStatus);
    var si = STATUS_STEPS.indexOf(step);
    if (orderStatus === 'cancelled' || orderStatus === 'returned') {
      return si === 0 ? 'completed' : 'future';
    }
    if (si < oi) return 'completed';
    if (si === oi) return 'active';
    return 'future';
  }

  function renderOrderDetail(order) {
    var el = document.getElementById('orders-content');
    if (!el) return;
    var items = order.items || [];

    var itemsHtml = items.map(function (item) {
      var img = item.image_url
        ? '<img class="order-detail-item-img" src="' + item.image_url + '" alt=""' + IMG_FALLBACK + '>'
        : '<div class="order-detail-item-img" style="display:flex;align-items:center;justify-content:center;color:#c7c7cc">' + ICONS.packageIcon + '</div>';
      return '<div class="order-detail-item">' +
        img +
        '<div class="order-detail-item-info">' +
          '<div class="order-detail-item-name">' + item.name + '</div>' +
          '<div class="order-detail-item-variant">Qty ' + item.quantity + '</div>' +
        '</div>' +
        '<div class="order-detail-item-price">' +
          '<div class="order-detail-item-unit">$' + item.price.toFixed(2) + ' each</div>' +
          '<div class="order-detail-item-total">$' + (item.price * item.quantity).toFixed(2) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var timelineSteps = [
      { key: 'processing', label: 'Order Placed', desc: formatDate(order.order_date) },
      { key: 'shipped', label: 'Shipped', desc: order.carrier ? 'via ' + order.carrier : 'Pending' },
      { key: 'delivered', label: 'Delivered', desc: order.delivery_estimate ? formatDate(order.delivery_estimate) : 'Estimated' }
    ];

    if (order.status === 'cancelled') {
      timelineSteps = [
        { key: 'processing', label: 'Order Placed', desc: formatDate(order.order_date) },
        { key: 'cancelled', label: 'Cancelled', desc: 'Order was cancelled' }
      ];
    }

    var timelineHtml = timelineSteps.map(function (step) {
      var s = getTimelineState(order.status, step.key);
      if (step.key === 'cancelled') s = 'active';
      var dotContent = s === 'completed' ? ICONS.check : '';
      return '<div class="timeline-step ' + s + '">' +
        '<div class="timeline-dot">' + dotContent + '</div>' +
        '<div class="timeline-info">' +
          '<h4>' + step.label + '</h4>' +
          '<p>' + step.desc + '</p>' +
        '</div>' +
      '</div>';
    }).join('');

    var trackingHtml = '';
    if (order.tracking_number) {
      trackingHtml = '<div class="info-row"><span class="info-label">Tracking</span><span class="info-value">' + order.tracking_number + '</span></div>';
    }
    if (order.carrier) {
      trackingHtml += '<div class="info-row"><span class="info-label">Carrier</span><span class="info-value">' + order.carrier + '</span></div>';
    }

    var returnHtml = '';
    if (order.eligible_for_return && order.return_deadline) {
      returnHtml = '<div class="info-row"><span class="info-label">Return By</span><span class="info-value">' + formatDate(order.return_deadline) + '</span></div>';
    }

    el.innerHTML =
      '<a href="/orders" class="back-link">' + ICONS.arrowLeft + ' All Orders</a>' +
      '<div class="order-detail-layout">' +
        '<div class="order-detail-card">' +
          '<div class="order-detail-header">' +
            '<button type="button" class="order-delete-btn order-delete-btn-detail" data-order-id="' + order.order_id + '" data-redirect="1" title="Delete order" aria-label="Delete order">' + ICONS.close + '</button>' +
            '<h1>Order ' + order.order_id + '</h1>' +
            '<div class="order-detail-meta">' +
              '<span class="status-badge ' + statusClass(order.status) + '">' + order.status + '</span>' +
              '<span>' + formatDate(order.order_date) + '</span>' +
              '<span>$' + order.total.toFixed(2) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="order-items-list">' + itemsHtml + '</div>' +
        '</div>' +
        '<div class="order-sidebar">' +
          '<div class="timeline-card">' +
            '<div class="timeline-card-header"><h3>Order Timeline</h3></div>' +
            '<div class="timeline">' + timelineHtml + '</div>' +
          '</div>' +
          '<div class="info-card">' +
            '<div class="info-card-header"><h3>Order Details</h3></div>' +
            '<div class="info-card-body">' +
              '<div class="info-row"><span class="info-label">Order ID</span><span class="info-value">' + order.order_id + '</span></div>' +
              '<div class="info-row"><span class="info-label">Date</span><span class="info-value">' + formatDate(order.order_date) + '</span></div>' +
              '<div class="info-row"><span class="info-label">Delivery</span><span class="info-value">' + (order.delivery_estimate || 'TBD') + '</span></div>' +
              trackingHtml +
              returnHtml +
              '<div class="info-row total-row"><span class="info-label">Total</span><span class="info-value">$' + order.total.toFixed(2) + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ── Delete order ────────────────────────────────────── */

  function deleteOrder(orderId, btn) {
    if (!window.confirm('Delete order ' + orderId + '? This cannot be undone.')) return;
    if (btn) btn.disabled = true;
    fetch('/api/orders/' + orderId, { method: 'DELETE', credentials: 'include' })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/login'; return null; }
        if (!res.ok) throw new Error('Failed to delete order');
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (btn && btn.dataset.redirect) {
          window.location.href = '/orders';
          return;
        }
        var card = btn && btn.closest('.order-card');
        if (card) card.remove();
        var remaining = document.querySelectorAll('.order-card').length;
        var titleEl = document.getElementById('orders-count');
        if (titleEl) titleEl.textContent = '(' + remaining + ')';
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        window.alert('Could not delete the order. Please try again.');
      });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.order-delete-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    deleteOrder(btn.dataset.orderId, btn);
  });

  /* ── Load data ───────────────────────────────────────── */

  if (isDetailPage) {
    var orderId = isDetailPage[1];
    fetch('/api/orders/' + orderId, { credentials: 'include' })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/login'; return null; }
        if (res.status === 404) { window.location.href = '/orders'; return null; }
        return res.json();
      })
      .then(function (data) { if (data) renderOrderDetail(data); });
  } else {
    fetch('/api/orders', { credentials: 'include' })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/login'; return null; }
        return res.json();
      })
      .then(function (data) { if (data) renderOrdersList(data.orders); });
  }
})();
