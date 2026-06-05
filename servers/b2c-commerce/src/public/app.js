(function () {
  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  }

  function renderUserBar(user) {
    var bar = document.getElementById('user-bar');
    if (!bar) return;

    if (user) {
      var avatar = user.image
        ? '<img src="' + user.image + '" alt="">'
        : '<span class="user-initials">' + getInitials(user.name) + '</span>';
      bar.innerHTML =
        '<a href="/login" class="user-pill">' +
          avatar +
          '<span class="pill-name">' + (user.name || 'Account') + '</span>' +
        '</a>';
    } else {
      bar.innerHTML =
        '<a href="/login" class="sign-in-btn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
            '<circle cx="12" cy="7" r="4"/>' +
          '</svg>' +
          'Sign in' +
        '</a>';
    }
  }

  function updateCartBadge(count) {
    var link = document.querySelector('.header-cart-link');
    if (!link) return;
    var badge = link.querySelector('.cart-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        link.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
    } else if (badge) {
      badge.remove();
    }
  }

  window.updateCartBadge = updateCartBadge;

  fetch('/api/me')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      renderUserBar(data.user);
      if (data.user) {
        fetch('/api/cart', { credentials: 'include' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (cart) { if (cart) updateCartBadge(cart.totalItems); })
          .catch(function () {});
      }
    })
    .catch(function () { renderUserBar(null); });
})();
