(function () {
  var PAY_ICONS = {
    visa: '<svg viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#fff"/><path d="M19.5 21h-2.7l1.7-10.5h2.7L19.5 21zm11.4-10.2c-.5-.2-1.4-.4-2.4-.4-2.6 0-4.5 1.4-4.5 3.4 0 1.5 1.3 2.3 2.3 2.8 1 .5 1.4.8 1.4 1.3 0 .7-.8 1-1.6 1-1.1 0-1.6-.2-2.5-.5l-.3-.2-.4 2.2c.6.3 1.8.5 3 .5 2.8 0 4.6-1.4 4.6-3.5 0-1.2-.7-2-2.2-2.8-.9-.5-1.5-.8-1.5-1.2 0-.4.5-.8 1.5-.8.9 0 1.5.2 2 .4l.2.1.4-2.3zm6.8-.3h-2c-.6 0-1.1.2-1.4.8l-3.9 9.7h2.8l.6-1.5h3.4l.3 1.5H40l-2.3-10.5zm-3.3 6.8l1.4-3.9.4-1 .2 1 .8 3.9h-2.8zM16 10.5l-2.5 7.2-.3-1.3c-.5-1.6-2-3.4-3.7-4.3l2.4 9h2.8l4.2-10.5H16z" fill="#1a1f71"/><path d="M10.5 10.5H6.4l-.1.3c3.3.9 5.5 2.9 6.4 5.4l-.9-4.8c-.2-.6-.7-.8-1.3-.9z" fill="#f9a533"/></svg>',
    mastercard: '<svg viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#fff"/><circle cx="19" cy="16" r="8" fill="#eb001b"/><circle cx="29" cy="16" r="8" fill="#f79e1b"/><path d="M24 10.3a8 8 0 0 1 0 11.4 8 8 0 0 1 0-11.4z" fill="#ff5f00"/></svg>',
    paypal: '<svg viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="#fff"/><path d="M18.5 22.5h-2.1c-.2 0-.3.1-.3.3l.8-5.3c0-.1.1-.2.3-.2h3c1.6 0 2.8.7 2.5 2.3-.3 2-2 2.9-3.8 2.9h-.7c-.2 0-.3.1-.3.3l-.4 2.3c0 .1-.1.2-.3.2h-1.5c-.2 0-.2-.1-.2-.3l1-5.2" fill="#003087"/><path d="M31.5 17.3h-3c-.1 0-.3.1-.3.2l-.8 5.3c0 .2 0 .3.2.3h1.6c.1 0 .2-.1.2-.2l.2-1.5c0-.2.2-.3.3-.3h.8c1.8 0 3.4-1 3.7-2.9.3-1.6-1-2.3-2.5-2.3-.2 0-.3 0-.4-.1v.2z" fill="#009cde"/><path d="M22 17.3h-3c-.1 0-.3.1-.3.2l-.8 5.3c0 .2 0 .3.2.3h1.5c.2 0 .3-.1.3-.3l.2-1.4c0-.2.2-.3.3-.3h.8c1.8 0 3.4-1 3.7-2.9.3-1.6-1-2.3-2.5-2.3-.1 0-.3 0-.4.1v.3z" fill="#003087"/></svg>'
  };

  var ICONS = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
  };

  var state = { user: null, cart: null, paymentMethod: 'credit_card' };

  function loadData() {
    Promise.all([
      fetch('/api/me', { credentials: 'include' }).then(function (r) { return r.json(); }),
      fetch('/api/cart', { credentials: 'include' }).then(function (r) {
        if (r.status === 401) { window.location.href = '/login'; return null; }
        return r.json();
      })
    ]).then(function (results) {
      state.user = results[0].user;
      state.cart = results[1];
      if (!state.cart || !state.cart.items || state.cart.items.length === 0) {
        window.location.href = '/cart';
        return;
      }
      renderForm();
      renderSummary();
    });
  }

  function renderForm() {
    var el = document.getElementById('checkout-form');
    if (!el) return;
    var u = state.user || {};

    el.innerHTML =
      '<div class="form-section">' +
        '<div class="form-section-title"><span class="step-num">1</span> Contact Information</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Full Name</label><input type="text" id="f-name" value="' + (u.name || '') + '" readonly></div>' +
          '<div class="form-group"><label>Email</label><input type="email" id="f-email" value="' + (u.email || '') + '" readonly></div>' +
        '</div>' +
        '<div class="form-row full">' +
          '<div class="form-group"><label>Phone</label><input type="tel" id="f-phone" value="+31 20 123 4567"></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title"><span class="step-num">2</span> Shipping Address</div>' +
        '<div class="form-row full">' +
          '<div class="form-group"><label>Street Address</label><input type="text" id="f-address" value="123 Demo Street"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>City</label><input type="text" id="f-city" value="Amsterdam"></div>' +
          '<div class="form-group"><label>ZIP / Postal Code</label><input type="text" id="f-zip" value="1012 AB"></div>' +
        '</div>' +
        '<div class="form-row full">' +
          '<div class="form-group"><label>Country</label>' +
            '<select id="f-country"><option selected>Netherlands</option><option>Germany</option><option>Belgium</option><option>France</option><option>United Kingdom</option></select>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title"><span class="step-num">3</span> Payment Method</div>' +
        '<div class="payment-options" id="payment-options">' +
          paymentOption('credit_card', 'Credit Card', 'Visa ending in 4242', PAY_ICONS.visa, true) +
          paymentOption('debit_card', 'Debit Card', 'Mastercard ending in 8888', PAY_ICONS.mastercard, false) +
          paymentOption('paypal', 'PayPal', 'demo@example.com', PAY_ICONS.paypal, false) +
        '</div>' +
        '<div class="card-details" id="card-details">' +
          '<div class="card-number-display">4242 \u00b7\u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\u00b7 4242</div>' +
          '<div class="card-row">' +
            '<span><span class="card-label">Expires</span>12/28</span>' +
            '<span><span class="card-label">CVV</span>\u2022\u2022\u2022</span>' +
            '<span><span class="card-label">Name</span>' + (u.name || 'Cardholder') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.querySelectorAll('.payment-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        document.querySelectorAll('.payment-option').forEach(function (o) { o.classList.remove('selected'); });
        this.classList.add('selected');
        state.paymentMethod = this.dataset.method;
        var cardEl = document.getElementById('card-details');
        if (cardEl) cardEl.style.display = state.paymentMethod === 'credit_card' || state.paymentMethod === 'debit_card' ? '' : 'none';
      });
    });
  }

  function paymentOption(method, name, desc, icon, selected) {
    return '<div class="payment-option' + (selected ? ' selected' : '') + '" data-method="' + method + '">' +
      '<div class="payment-radio"></div>' +
      '<div class="payment-option-info">' +
        '<div class="payment-option-name">' + name + '</div>' +
        '<div class="payment-option-desc">' + desc + '</div>' +
      '</div>' +
      '<div class="pay-icon">' + icon + '</div>' +
    '</div>';
  }

  function renderSummary() {
    var el = document.getElementById('checkout-sidebar');
    if (!el || !state.cart) return;
    var cart = state.cart;

    var itemsHtml = cart.items.map(function (item) {
      var img = item.image_url
        ? '<img class="checkout-item-img" src="' + item.image_url + '" alt="">'
        : '<div class="checkout-item-img"></div>';
      return '<div class="checkout-item">' +
        img +
        '<div class="checkout-item-info">' +
          '<div class="checkout-item-name">' + item.name + '</div>' +
          '<div class="checkout-item-qty">Qty: ' + item.quantity + '</div>' +
        '</div>' +
        '<div class="checkout-item-price">$' + (item.unit_price * item.quantity).toFixed(2) + '</div>' +
      '</div>';
    }).join('');

    var shipping = cart.totalPrice >= 50 ? 0 : 4.99;
    var tax = +(cart.totalPrice * 0.21).toFixed(2);
    var grandTotal = +(cart.totalPrice + shipping + tax).toFixed(2);

    el.innerHTML =
      '<div class="checkout-summary">' +
        '<div class="checkout-summary-header"><h2>Order Summary</h2></div>' +
        '<div class="checkout-summary-items">' + itemsHtml + '</div>' +
        '<div class="checkout-totals">' +
          '<div class="checkout-total-row"><span>Subtotal</span><span>$' + cart.totalPrice.toFixed(2) + '</span></div>' +
          '<div class="checkout-total-row"><span>Shipping</span><span>' + (shipping === 0 ? '<span style="color:#34c759">Free</span>' : '$' + shipping.toFixed(2)) + '</span></div>' +
          '<div class="checkout-total-row"><span>Tax (21%)</span><span>$' + tax.toFixed(2) + '</span></div>' +
          '<div class="checkout-total-row grand"><span>Total</span><span>$' + grandTotal.toFixed(2) + '</span></div>' +
        '</div>' +
        '<div class="place-order-section">' +
          '<button class="place-order-btn" id="place-order-btn" onclick="Checkout.placeOrder()">' +
            ICONS.lock + ' Place Order \u2014 $' + grandTotal.toFixed(2) +
          '</button>' +
          '<div style="text-align:center;margin-top:12px;font-size:12px;color:#8e8e93">' +
            ICONS.shield + ' Your payment info is secure and encrypted' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function placeOrder() {
    var btn = document.getElementById('place-order-btn');
    if (btn) btn.disabled = true;

    var overlay = document.createElement('div');
    overlay.className = 'processing-overlay';
    overlay.innerHTML =
      '<div class="processing-card">' +
        '<div class="processing-spinner"></div>' +
        '<h2>Processing Payment...</h2>' +
        '<p>Please wait while we confirm your order.</p>' +
      '</div>';
    document.body.appendChild(overlay);

    var body = {
      shipping_address: document.getElementById('f-address').value,
      city: document.getElementById('f-city').value,
      zip: document.getElementById('f-zip').value,
      country: document.getElementById('f-country').value,
      phone: document.getElementById('f-phone').value,
      payment_method: state.paymentMethod
    };

    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    .then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error); });
      return res.json();
    })
    .then(function (data) {
      window.location.href = '/orders/' + data.order_id;
    })
    .catch(function (err) {
      overlay.remove();
      if (btn) btn.disabled = false;
      alert('Checkout failed: ' + err.message);
    });
  }

  window.Checkout = { placeOrder: placeOrder };

  loadData();
})();
