(function () {
  const CART_ID = document.documentElement.dataset.cartId;
  const API = "/api/cart/" + CART_ID;

  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () {
      t.classList.remove("show");
    }, 2000);
  }

  function renderCart(data) {
    var el = document.getElementById("cart");

    if (!data.items.length) {
      el.innerHTML =
        '<div class="empty">' +
        '<div class="empty-icon">\uD83D\uDED2</div>' +
        "<h2>Your cart is empty</h2>" +
        "<p>Add items through your AI assistant to see them here.</p>" +
        "</div>";
      return;
    }

    var rows = data.items
      .map(function (item) {
        var sub = (item.unit_price * item.quantity).toFixed(2);
        var img = item.image_url
          ? '<img class="item-img" src="' +
            item.image_url +
            '" alt="' +
            item.name +
            '">'
          : '<div class="item-img"></div>';
        var sizeTxt = item.size ? " \u00b7 Size " + item.size : "";

        return (
          '<div class="item-row" data-id="' +
          item.id +
          '">' +
          img +
          '<div class="item-info">' +
          '<div class="item-name">' +
          item.name +
          "</div>" +
          '<div class="item-meta">SKU: ' +
          item.sku +
          "</div>" +
          '<div class="item-meta">' +
          (item.color || "") +
          sizeTxt +
          "</div>" +
          '<button class="remove-btn" onclick="Cart.removeItem(\'' +
          item.id +
          "')\">" +
          "Remove</button>" +
          "</div>" +
          '<div class="qty-control">' +
          '<button class="qty-btn" onclick="Cart.updateQty(\'' +
          item.id +
          "'," +
          (item.quantity - 1) +
          ')">&#8722;</button>' +
          '<input class="qty-val" value="' +
          item.quantity +
          '" readonly>' +
          '<button class="qty-btn" onclick="Cart.updateQty(\'' +
          item.id +
          "'," +
          (item.quantity + 1) +
          ')">+</button>' +
          "</div>" +
          '<div class="item-price">' +
          '<div class="item-unit">\u20ac' +
          item.unit_price.toFixed(2) +
          " each</div>" +
          '<div class="item-subtotal">\u20ac' +
          sub +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    el.innerHTML =
      rows +
      '<div class="trust-bar">' +
      '<div class="trust-item">' +
      '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>' +
      "Secure Checkout</div>" +
      '<div class="trust-item">' +
      '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>' +
      "SSL Encrypted</div>" +
      '<div class="payment-logos">' +
      '<span class="payment-logo">VISA</span>' +
      '<span class="payment-logo">MC</span>' +
      '<span class="payment-logo">AMEX</span>' +
      '<span class="payment-logo">PayPal</span>' +
      "</div></div>" +
      '<div class="delivery-promise">\uD83D\uDE9A Order before 2pm for next-day delivery</div>' +
      '<div class="summary">' +
      '<div><span class="count">' +
      data.totalItems +
      " item" +
      (data.totalItems !== 1 ? "s" : "") +
      " in cart</span>" +
      '<div class="total">\u20ac' +
      data.totalPrice.toFixed(2) +
      "</div></div>" +
      '<button class="checkout-btn" onclick="alert(\'This is a demo \\u2014 checkout would happen here!\')">Proceed to Checkout</button>' +
      "</div>" +
      '<div class="post-cta">' +
      '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' +
      "Free returns \u00b7 30-day guarantee</div>";
  }

  function loadCart() {
    fetch(API)
      .then(function (res) {
        return res.json();
      })
      .then(renderCart);
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
      body: JSON.stringify({ quantity: qty }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        renderCart(data);
        document.getElementById("cart").classList.remove("refreshing");
        showToast("Cart updated");
      });
  }

  function removeItem(itemId) {
    document.getElementById("cart").classList.add("refreshing");
    fetch(API + "/item/" + itemId, { method: "DELETE" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        renderCart(data);
        document.getElementById("cart").classList.remove("refreshing");
        showToast("Item removed");
      });
  }

  // Expose to inline onclick handlers
  window.Cart = { updateQty: updateQty, removeItem: removeItem };

  loadCart();
  setInterval(loadCart, 5000);
})();
