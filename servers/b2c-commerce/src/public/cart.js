(function () {
  var API = "/api/cart";

  /* ── SVG icons ──────────────────────────────────────────── */

  var ICONS = {
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    cartEmpty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    packageIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
  };

  /* ── Payment brand SVGs ─────────────────────────────────── */

  var PAY = {
    visa: '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" rx="4" fill="#fff"/><path d="M19.5 21h-2.7l1.7-10.5h2.7L19.5 21zm11.4-10.2c-.5-.2-1.4-.4-2.4-.4-2.6 0-4.5 1.4-4.5 3.4 0 1.5 1.3 2.3 2.3 2.8 1 .5 1.4.8 1.4 1.3 0 .7-.8 1-1.6 1-1.1 0-1.6-.2-2.5-.5l-.3-.2-.4 2.2c.6.3 1.8.5 3 .5 2.8 0 4.6-1.4 4.6-3.5 0-1.2-.7-2-2.2-2.8-.9-.5-1.5-.8-1.5-1.2 0-.4.5-.8 1.5-.8.9 0 1.5.2 2 .4l.2.1.4-2.3zm6.8-.3h-2c-.6 0-1.1.2-1.4.8l-3.9 9.7h2.8l.6-1.5h3.4l.3 1.5H40l-2.3-10.5zm-3.3 6.8l1.4-3.9.4-1 .2 1 .8 3.9h-2.8zM16 10.5l-2.5 7.2-.3-1.3c-.5-1.6-2-3.4-3.7-4.3l2.4 9h2.8l4.2-10.5H16z" fill="#1a1f71"/><path d="M10.5 10.5H6.4l-.1.3c3.3.9 5.5 2.9 6.4 5.4l-.9-4.8c-.2-.6-.7-.8-1.3-.9z" fill="#f9a533"/></svg>',

    mastercard: '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" rx="4" fill="#fff"/><circle cx="19" cy="16" r="8" fill="#eb001b"/><circle cx="29" cy="16" r="8" fill="#f79e1b"/><path d="M24 10.3a8 8 0 0 1 0 11.4 8 8 0 0 1 0-11.4z" fill="#ff5f00"/></svg>',

    amex: '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" rx="4" fill="#2e77bc"/><path d="M6 16.8h2.3l1.1-2.7 1.1 2.7H13l-1.8-2 1.8-2H10.6l-1.1 2.5-1.1-2.5H6l1.8 2L6 16.8zm14.7-4h5.6l1 1.2 1.1-1.2h2l-2.1 2 2.1 2h-2l-1.1-1.2-1 1.2h-5.6v-4zm1.8 1.2v.5h3.2v1h-3.2v.5h3.6l1-1-.9-1h-3.7zm-7.7-1.2L12.4 18h2l.4-1h2.6l.4 1h2l-2.5-5.2h-2.3zm1.1 1.6l.7 1.5h-1.4l.7-1.5zM33 12.8v4h1.8l2.2-2.6v2.6h1.5v-4h-1.7l-2.2 2.6v-2.6H33z" fill="#fff"/></svg>',

    paypal: '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" rx="4" fill="#fff"/><path d="M18.5 22.5h-2.1c-.2 0-.3.1-.3.3l.8-5.3c0-.1.1-.2.3-.2h3c1.6 0 2.8.7 2.5 2.3-.3 2-2 2.9-3.8 2.9h-.7c-.2 0-.3.1-.3.3l-.4 2.3c0 .1-.1.2-.3.2h-1.5c-.2 0-.2-.1-.2-.3l1-5.2" fill="#003087"/><path d="M31.5 17.3h-3c-.1 0-.3.1-.3.2l-.8 5.3c0 .2 0 .3.2.3h1.6c.1 0 .2-.1.2-.2l.2-1.5c0-.2.2-.3.3-.3h.8c1.8 0 3.4-1 3.7-2.9.3-1.6-1-2.3-2.5-2.3-.2 0-.3 0-.4-.1v.2z" fill="#009cde"/><path d="M22 17.3h-3c-.1 0-.3.1-.3.2l-.8 5.3c0 .2 0 .3.2.3h1.5c.2 0 .3-.1.3-.3l.2-1.4c0-.2.2-.3.3-.3h.8c1.8 0 3.4-1 3.7-2.9.3-1.6-1-2.3-2.5-2.3-.1 0-.3 0-.4.1v.3z" fill="#003087"/></svg>',

    applepay: '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" rx="4" fill="#000"/><path d="M15.2 11.8c-.4.5-1 .8-1.6.8-.1-.6.2-1.3.6-1.7.4-.5 1-.8 1.5-.8.1.6-.2 1.3-.5 1.7zm.5.9c-.9-.1-1.6.5-2 .5s-1.1-.5-1.7-.5c-.9 0-1.7.5-2.2 1.3-.9 1.6-.2 4 .7 5.3.5.6 1 1.4 1.7 1.3.7 0 1-.4 1.7-.4.8 0 1 .4 1.7.4.7 0 1.2-.7 1.6-1.3.5-.7.7-1.5.7-1.5-1.5-.6-1.7-2.6-.2-3.8-.5-.7-1.3-1.1-2-1.3z" fill="#fff"/><path d="M23.6 11c1.7 0 2.8 1.2 2.8 2.9h-1.2c-.1-1.2-.8-1.8-1.7-1.8-.9 0-1.6.7-1.6 1.9v.2c0 1.3.7 2 1.6 2 .9 0 1.5-.5 1.7-1.5h1.2c-.1 1.6-1.2 2.6-2.9 2.6-1.8 0-2.9-1.2-2.9-3v-.2c0-1.8 1.1-3.1 3-3.1zm7.7 0c1.5 0 2.6.9 2.7 2.2h-1.2c-.1-.7-.7-1.1-1.5-1.1-.8 0-1.4.4-1.4 1.1 0 .5.4.8 1.2 1l1 .3c1.3.3 1.9.9 1.9 1.9 0 1.3-1.2 2.2-2.8 2.2-1.6 0-2.7-.8-2.8-2.2h1.2c.2.8.8 1.2 1.7 1.2s1.5-.4 1.5-1.1c0-.5-.3-.8-1.1-1l-1.1-.3c-1.2-.3-1.9-1-1.9-2 0-1.2 1.1-2.1 2.6-2.1zm5 4.1v-1c0-.7.6-1.2 1.6-1.2.9 0 1.5.4 1.5 1.1v.5l-1.7.1c-1.6.1-2.5.8-2.5 2s1 1.9 2.2 1.9c.9 0 1.6-.4 2-.9h.1v.9H40v-3.4zm.2.9c0 .8-.7 1.4-1.6 1.4-.7 0-1.1-.3-1.1-.9 0-.6.4-.9 1.3-1l1.4-.1v.6z" fill="#fff"/></svg>'
  };

  /* ── Toast ──────────────────────────────────────────────── */

  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ── Render functions ───────────────────────────────────── */

  function renderEmpty() {
    return (
      '<div class="cart-empty">' +
        '<div class="cart-empty-icon">' + ICONS.cartEmpty + '</div>' +
        '<h2>Your cart is empty</h2>' +
        '<p>Browse products and add items via your AI assistant.</p>' +
        '<a href="/" class="cart-empty-action">Start shopping ' + ICONS.arrowRight + '</a>' +
      '</div>'
    );
  }

  function renderTrust() {
    return (
      '<div class="trust-section">' +
        '<div class="trust-items">' +
          '<span class="trust-chip">' + ICONS.lock + ' Secure</span>' +
          '<span class="trust-chip">' + ICONS.shield + ' Encrypted</span>' +
          '<span class="trust-chip">' + ICONS.check + ' Verified</span>' +
        '</div>' +
        '<div class="payment-methods">' +
          '<span class="pm-label">We accept</span>' +
          '<span class="pay-icon">' + PAY.visa + '</span>' +
          '<span class="pay-icon">' + PAY.mastercard + '</span>' +
          '<span class="pay-icon">' + PAY.amex + '</span>' +
          '<span class="pay-icon">' + PAY.paypal + '</span>' +
          '<span class="pay-icon">' + PAY.applepay + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="reassurance">' +
        ICONS.refresh +
        ' Free returns \u00b7 30-day money-back guarantee' +
      '</div>'
    );
  }

  function renderSummary(data) {
    var shipping = data.totalPrice >= 50 ? 0 : 4.99;
    var grandTotal = data.totalPrice + shipping;

    return (
      '<div class="order-summary">' +
        '<div class="order-summary-header"><h2>Order Summary</h2></div>' +
        '<div class="order-summary-body">' +
          '<div class="summary-row">' +
            '<span class="label">Subtotal (' + data.totalItems + ' item' + (data.totalItems !== 1 ? 's' : '') + ')</span>' +
            '<span class="value">\u20ac' + data.totalPrice.toFixed(2) + '</span>' +
          '</div>' +
          '<div class="summary-row">' +
            '<span class="label">Shipping</span>' +
            '<span class="value">' + (shipping === 0 ? '<span style="color:#34c759;font-weight:600">Free</span>' : '\u20ac' + shipping.toFixed(2)) + '</span>' +
          '</div>' +
          '<div class="summary-row">' +
            '<span class="label">Tax (estimated)</span>' +
            '<span class="value">\u20ac' + (data.totalPrice * 0.21).toFixed(2) + '</span>' +
          '</div>' +
          '<div class="summary-row total">' +
            '<span class="label">Total</span>' +
            '<span class="value">\u20ac' + (grandTotal + data.totalPrice * 0.21).toFixed(2) + '</span>' +
          '</div>' +
          '<button class="checkout-btn" onclick="alert(\'This is a demo \u2014 checkout would happen here!\')">' +
            ICONS.lock + ' Checkout' +
          '</button>' +
          '<div class="delivery-badge">' +
            ICONS.truck +
            'Order before 2 PM for next-day delivery' +
          '</div>' +
        '</div>' +
        renderTrust() +
      '</div>'
    );
  }

  function renderCart(data) {
    var el = document.getElementById("cart");
    var titleEl = document.getElementById("cart-title-count");

    if (!data.items.length) {
      el.innerHTML = renderEmpty();
      if (titleEl) titleEl.textContent = '(0 items)';
      var summaryEl = document.getElementById("cart-summary");
      if (summaryEl) summaryEl.style.display = "none";
      return;
    }

    if (titleEl) titleEl.textContent = '(' + data.totalItems + ' item' + (data.totalItems !== 1 ? 's' : '') + ')';

    var rows = data.items.map(function (item) {
      var sub = (item.unit_price * item.quantity).toFixed(2);

      var imgHtml = item.image_url
        ? '<div class="item-img-wrap"><img class="item-img" src="' + item.image_url + '" alt="' + item.name.replace(/"/g, '&quot;') + '"></div>'
        : '<div class="item-img-wrap"><div class="item-img-placeholder">' + ICONS.packageIcon + '</div></div>';

      var colorHtml = item.color
        ? '<span class="item-color-dot" style="background:' + (item.color_hex || '#999') + '"></span>' + item.color
        : '';
      var sizeHtml = item.size ? ' \u00b7 Size ' + item.size : '';
      var variantLine = (colorHtml || sizeHtml)
        ? '<div class="item-meta">' + colorHtml + sizeHtml + '</div>'
        : '';

      return (
        '<div class="item-row" data-id="' + item.id + '">' +
          imgHtml +
          '<div class="item-info">' +
            '<div class="item-name">' + item.name + '</div>' +
            '<div class="item-meta"><span class="item-sku">' + item.sku + '</span></div>' +
            variantLine +
            '<div class="item-actions">' +
              '<button class="remove-btn" onclick="Cart.removeItem(\'' + item.id + '\')">' +
                ICONS.trash + ' Remove' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="qty-control">' +
            '<button class="qty-btn" onclick="Cart.updateQty(\'' + item.id + '\',' + (item.quantity - 1) + ')"' + (item.quantity <= 1 ? ' disabled' : '') + '>' + ICONS.minus + '</button>' +
            '<input class="qty-val" value="' + item.quantity + '" readonly>' +
            '<button class="qty-btn" onclick="Cart.updateQty(\'' + item.id + '\',' + (item.quantity + 1) + ')">' + ICONS.plus + '</button>' +
          '</div>' +
          '<div class="item-price">' +
            '<div class="item-unit">\u20ac' + item.unit_price.toFixed(2) + ' each</div>' +
            '<div class="item-subtotal">\u20ac' + sub + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    el.innerHTML =
      '<div class="cart-items-header">' +
        '<h2>Cart Items</h2>' +
        '<span class="cart-items-count">' + data.totalItems + ' item' + (data.totalItems !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      rows;

    var summaryEl = document.getElementById("cart-summary");
    if (summaryEl) {
      summaryEl.style.display = "";
      summaryEl.innerHTML = renderSummary(data);
    }
  }

  /* ── API calls ──────────────────────────────────────────── */

  function handleResponse(res) {
    if (res.status === 401) {
      window.location.href = "/login";
      return null;
    }
    return res.json();
  }

  function loadCart() {
    fetch(API, { credentials: "include" })
      .then(handleResponse)
      .then(function (data) { if (data) renderCart(data); });
  }

  function updateQty(itemId, qty) {
    document.getElementById("cart").classList.add("refreshing");
    if (qty <= 0) {
      removeItem(itemId);
      return;
    }
    fetch(API + "/item/" + itemId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantity: qty }),
    })
    .then(handleResponse)
    .then(function (data) {
      if (!data) return;
      renderCart(data);
      document.getElementById("cart").classList.remove("refreshing");
      showToast("\u2713 Cart updated");
    });
  }

  function removeItem(itemId) {
    document.getElementById("cart").classList.add("refreshing");
    fetch(API + "/item/" + itemId, { method: "DELETE", credentials: "include" })
    .then(handleResponse)
    .then(function (data) {
      if (!data) return;
      renderCart(data);
      document.getElementById("cart").classList.remove("refreshing");
      showToast("\u2713 Item removed");
    });
  }

  window.Cart = { updateQty: updateQty, removeItem: removeItem };

  loadCart();
  setInterval(loadCart, 5000);
})();
