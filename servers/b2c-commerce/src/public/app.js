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

  fetch('/api/me')
    .then(function (res) { return res.json(); })
    .then(function (data) { renderUserBar(data.user); })
    .catch(function () { renderUserBar(null); });
})();
