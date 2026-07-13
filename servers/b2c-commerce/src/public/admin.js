(function () {
  var TARGET_SKU = "ACM-CSJ-033";
  var content = document.getElementById("admin-content");
  var view = document.body.dataset.adminView || "dashboard";
  var adminQuery = window.location.search || "?admin=1";

  function esc(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function money(value) {
    return "$" + Number(value || 0).toFixed(2);
  }

  function pct(value) {
    return (Number(value || 0) * 100).toFixed(1) + "%";
  }

  function statusClass(status) {
    return "admin-status admin-status-" + String(status || "unknown").replace(/_/g, "-");
  }

  function loadJson(url) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    var query = adminQuery.replace(/^\?/, "");
    return fetch(url + sep + query, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    });
  }

  function renderError(error) {
    content.innerHTML = '<div class="admin-empty">Could not load admin data: ' + esc(error.message) + "</div>";
  }

  function metric(label, value, hint) {
    return '<div class="admin-metric"><span>' + esc(label) + "</span><strong>" + esc(value) + "</strong>" + (hint ? "<small>" + esc(hint) + "</small>" : "") + "</div>";
  }

  function renderDashboard(data) {
    var primary = data.primary || {};
    var metrics = primary.metrics || {};
    var reorder = primary.reorder;
    var flags = (data.flags || []).map(function (flag) {
      var badge = flag.severity === "critical" ? "Critical" : flag.severity === "high" ? "High" : flag.severity === "handled" ? "Handled" : "Watch";
      return '<article class="admin-flag admin-flag-' + esc(flag.severity) + '">' +
        '<div class="admin-flag-main">' +
          '<div class="admin-flag-top"><span>' + esc(flag.type).replace(/_/g, " ") + '</span><b>' + esc(badge) + '</b></div>' +
          '<h2>' + esc(flag.title) + '</h2>' +
          '<p>' + esc(flag.summary || "") + '</p>' +
        '</div>' +
        '<a href="' + esc(flag.admin_url || "/admin?admin=1") + '">Open</a>' +
      '</article>';
    }).join("");

    content.innerHTML =
      '<div class="admin-grid admin-grid-4">' +
        metric("Traffic", (metrics.latest_sessions || 0).toLocaleString(), (metrics.traffic_change_pct || 0) + "% vs start") +
        metric("Conversion", pct(metrics.latest_conversion_rate), "-" + (metrics.conversion_drop_pct || 0) + "%") +
        metric("Units sold", metrics.latest_units_sold || 0, "-" + (metrics.units_drop_pct || 0) + "%") +
        metric("Stock", metrics.latest_stock_qty || 0, reorder ? "Incoming order active" : "No incoming order") +
      '</div>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Flagged This Week</h2><span>' + esc(data.week) + '</span></div><div class="admin-flags">' + flags + '</div></section>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Current Reorder State</h2></div>' +
        (reorder
          ? '<div class="admin-reorder-row"><span class="' + statusClass(reorder.status) + '">' + esc(reorder.status) + '</span><strong>' + esc(reorder.quantity) + ' units incoming</strong><span>ETA ' + esc(reorder.expected_arrival || "TBD") + '</span><span>' + esc(reorder.supplier_email) + '</span></div>'
          : '<div class="admin-empty">No supplier reorder has been placed yet.</div>') +
      '</section>';
  }

  function renderSparkline(rows, field, formatter) {
    var max = rows.reduce(function (m, r) { return Math.max(m, Number(r[field] || 0)); }, 0) || 1;
    return '<div class="admin-sparkline">' + rows.map(function (r) {
      var value = Number(r[field] || 0);
      var height = Math.max(8, Math.round((value / max) * 96));
      return '<div class="admin-bar-wrap"><div class="admin-bar" style="height:' + height + 'px"></div><small>' + esc(formatter ? formatter(value) : value) + '</small><span>' + esc(r.date.slice(5)) + '</span></div>';
    }).join("") + "</div>";
  }

  function renderAnalytics(data) {
    var p = data.product;
    var rows = data.performance || [];
    var m = data.metrics || {};
    var reorder = data.reorder;

    content.innerHTML =
      '<section class="admin-product-head">' +
        '<img src="' + esc(p.image_url || "") + '" alt="">' +
        '<div><div class="admin-kicker">' + esc(p.sku) + '</div><h2>' + esc(p.name) + '</h2><p>' + esc(p.category) + ' · ' + money(p.price) + ' · Rating ' + esc(p.rating) + ' from ' + esc(p.review_count) + ' reviews</p></div>' +
        '<div class="admin-stock-card"><span>Current stock</span><strong>' + esc(m.latest_stock_qty || p.stock_qty) + '</strong>' + (reorder ? '<small>' + esc(reorder.quantity) + ' incoming by ' + esc(reorder.expected_arrival || "TBD") + '</small>' : '<small>No incoming reorder</small>') + '</div>' +
      '</section>' +
      '<div class="admin-grid admin-grid-4">' +
        metric("Traffic change", (m.traffic_change_pct || 0) + "%", "flat signal") +
        metric("Conversion drop", (m.conversion_drop_pct || 0) + "%", pct(m.first_conversion_rate) + " to " + pct(m.latest_conversion_rate)) +
        metric("Units drop", (m.units_drop_pct || 0) + "%", (m.first_units_sold || 0) + " to " + (m.latest_units_sold || 0)) +
        metric("Stock drop", m.stock_drop || 0, (m.first_stock_qty || 0) + " to " + (m.latest_stock_qty || 0)) +
      '</div>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Traffic</h2><span>Sessions stay flat</span></div>' + renderSparkline(rows, "sessions") + '</section>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Conversion</h2><span>Drop tracks inventory pressure</span></div>' + renderSparkline(rows, "conversion_rate", function (v) { return pct(v); }) + '</section>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Daily Rows</h2></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Sessions</th><th>Views</th><th>Conversion</th><th>Units</th><th>Revenue</th><th>Stock</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.sessions) + '</td><td>' + esc(r.product_views) + '</td><td>' + pct(r.conversion_rate) + '</td><td>' + esc(r.units_sold) + '</td><td>' + money(r.revenue) + '</td><td>' + esc(r.stock_qty) + '</td></tr>';
        }).join("") +
      '</tbody></table></div></section>';
  }

  function renderSupport(data) {
    var emailsByTicket = {};
    (data.emails || []).forEach(function (email) {
      emailsByTicket[email.related_id] = email;
    });

    var tickets = (data.tickets || []).map(function (t) {
      var email = emailsByTicket[t.ticket_id];
      return '<article class="admin-ticket">' +
        '<div class="admin-ticket-main">' +
          '<div class="admin-flag-top"><span>' + esc(t.ticket_id) + '</span><b>' + esc(t.priority) + '</b></div>' +
          '<h2>' + esc(t.issue_type).replace(/_/g, " ") + '</h2>' +
          '<p>' + esc(t.description || "") + '</p>' +
          '<small>Order ' + esc(t.order_id) + ' · Created ' + esc(t.created_at) + '</small>' +
        '</div>' +
        '<div class="admin-ticket-side"><span class="' + statusClass(t.status) + '">' + esc(t.status).replace(/_/g, " ") + '</span>' +
          (email ? '<small>Reply logged: ' + esc(email.created_at) + '</small>' : '<small>No reply logged</small>') +
        '</div>' +
      '</article>';
    }).join("");

    content.innerHTML =
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Inbox</h2><span>' + (data.tickets || []).length + ' tickets</span></div><div class="admin-tickets">' + tickets + '</div></section>';
  }

  if (!content) return;

  if (view === "analytics") {
    var sku = new URLSearchParams(window.location.search).get("sku") || TARGET_SKU;
    loadJson("/api/admin/products/" + encodeURIComponent(sku) + "/performance").then(renderAnalytics).catch(renderError);
  } else if (view === "support") {
    loadJson("/api/admin/support").then(renderSupport).catch(renderError);
  } else {
    loadJson("/api/admin/attention").then(renderDashboard).catch(renderError);
  }
})();
