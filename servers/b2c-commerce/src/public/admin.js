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

  function currentPathId() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  function loadJson(url) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    var query = adminQuery.replace(/^\?/, "");
    return fetch(url + sep + query, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    });
  }

  function postJson(url) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    var query = adminQuery.replace(/^\?/, "");
    return fetch(url + sep + query, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    });
  }

  function showNotice(message, type) {
    var existing = document.querySelector(".admin-notice");
    if (existing) existing.remove();
    var notice = document.createElement("div");
    notice.className = "admin-notice admin-notice-" + (type || "info");
    notice.textContent = message;
    document.querySelector(".admin-shell").prepend(notice);
    setTimeout(function () {
      notice.remove();
    }, 4000);
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
          ? '<a class="admin-reorder-row admin-row-link" href="/admin/suppliers/' + esc(reorder.reorder_id) + '?admin=1"><span class="' + statusClass(reorder.status) + '">' + esc(reorder.status) + '</span><strong>' + esc(reorder.quantity) + ' units incoming</strong><span>ETA ' + esc(reorder.expected_arrival || "TBD") + '</span><span>' + esc(reorder.supplier_email) + '</span></a>'
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
      if (!emailsByTicket[email.related_id]) emailsByTicket[email.related_id] = email;
    });

    var tickets = (data.tickets || []).map(function (t) {
      var email = emailsByTicket[t.ticket_id];
      return '<a class="admin-ticket admin-row-link" href="/admin/support/' + esc(t.ticket_id) + '?admin=1">' +
        '<div class="admin-ticket-main">' +
          '<div class="admin-flag-top"><span>' + esc(t.ticket_id) + '</span><b>' + esc(t.priority) + '</b></div>' +
          '<h2>' + esc(t.issue_type).replace(/_/g, " ") + '</h2>' +
          '<p>' + esc(t.description || "") + '</p>' +
          '<small>Order ' + esc(t.order_id) + ' · Created ' + esc(t.created_at) + '</small>' +
        '</div>' +
        '<div class="admin-ticket-side"><span class="' + statusClass(t.status) + '">' + esc(t.status).replace(/_/g, " ") + '</span>' +
          (email ? '<small>Reply logged: ' + esc(email.created_at) + '</small>' : '<small>No reply logged</small>') +
        '</div>' +
      '</a>';
    }).join("");

    content.innerHTML =
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Inbox</h2><span>' + (data.tickets || []).length + ' tickets</span></div><div class="admin-tickets">' + tickets + '</div></section>';
  }

  function renderMessages(messages) {
    if (!messages.length) return '<div class="admin-empty">No messages logged yet.</div>';
    return '<div class="admin-conversation">' + messages.map(function (message) {
      return '<article class="admin-message admin-message-' + esc(message.direction) + '">' +
        '<div class="admin-message-meta">' +
          '<strong>' + esc(message.label) + '</strong>' +
          '<span>' + esc(message.timestamp || "") + '</span>' +
        '</div>' +
        (message.subject ? '<h3>' + esc(message.subject) + '</h3>' : '') +
        '<p>' + esc(message.body || "").replace(/\n/g, "<br>") + '</p>' +
      '</article>';
    }).join("") + '</div>';
  }

  function renderSupportDetail(data) {
    var t = data.ticket;
    var emails = data.emails || [];
    var messages = [{
      direction: "inbound",
      label: "Customer",
      timestamp: t.created_at,
      subject: esc(t.issue_type).replace(/_/g, " "),
      body: t.description || ""
    }].concat(emails.map(function (email) {
      return {
        direction: "outbound",
        label: email.from_email + " to " + email.to_email,
        timestamp: email.created_at,
        subject: email.subject,
        body: email.body
      };
    }));

    content.innerHTML =
      '<div class="admin-detail-actions"><a href="/admin/support?admin=1">Back to inbox</a><span>Auto-refreshes every 4 seconds while visible</span></div>' +
      '<section class="admin-panel">' +
        '<div class="admin-detail-head">' +
          '<div><div class="admin-kicker">' + esc(t.ticket_id) + '</div><h2>' + esc(t.issue_type).replace(/_/g, " ") + '</h2><p>Order ' + esc(t.order_id) + (t.order_date ? ' · Ordered ' + esc(t.order_date) : '') + '</p></div>' +
          '<div class="admin-ticket-side"><span class="' + statusClass(t.status) + '">' + esc(t.status).replace(/_/g, " ") + '</span><small>Priority ' + esc(t.priority) + '</small></div>' +
        '</div>' +
        (t.resolution ? '<div class="admin-resolution"><strong>Latest resolution</strong><p>' + esc(t.resolution).replace(/\n/g, "<br>") + '</p></div>' : '') +
      '</section>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Conversation</h2><span>' + messages.length + ' messages</span></div>' + renderMessages(messages) + '</section>';
  }

  function renderSuppliers(data) {
    var reorders = (data.reorders || []).map(function (r) {
      return '<a class="admin-ticket admin-row-link" href="/admin/suppliers/' + esc(r.reorder_id) + '?admin=1">' +
        '<div class="admin-ticket-main">' +
          '<div class="admin-flag-top"><span>' + esc(r.reorder_id) + '</span><b>' + esc(r.sku) + '</b></div>' +
          '<h2>' + esc(r.product_name || r.sku) + '</h2>' +
          '<p>' + esc(r.quantity) + ' units requested from ' + esc(r.supplier_name) + ' · ETA ' + esc(r.expected_arrival || "TBD") + '</p>' +
          '<small>' + esc(r.supplier_email) + ' · Created ' + esc(r.created_at) + '</small>' +
        '</div>' +
        '<div class="admin-ticket-side"><span class="' + statusClass(r.status) + '">' + esc(r.status).replace(/_/g, " ") + '</span>' +
          (r.email_id ? '<small>Email ' + esc(r.email_id) + '</small>' : '<small>No email logged</small>') +
        '</div>' +
      '</a>';
    }).join("");

    content.innerHTML =
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Supplier Reorders</h2><span>' + (data.reorders || []).length + ' conversations</span></div>' +
        (reorders ? '<div class="admin-tickets">' + reorders + '</div>' : '<div class="admin-empty">No supplier reorder communication has been logged yet.</div>') +
      '</section>';
  }

  function renderSupplierDetail(data) {
    var r = data.reorder;
    var emails = data.emails || [];
    var messages = emails.map(function (email) {
      return {
        direction: "outbound",
        label: email.from_email + " to " + email.to_email,
        timestamp: email.created_at,
        subject: email.subject,
        body: email.body
      };
    });

    content.innerHTML =
      '<div class="admin-detail-actions"><a href="/admin/suppliers?admin=1">Back to suppliers</a><span>Auto-refreshes every 4 seconds while visible</span></div>' +
      '<section class="admin-product-head">' +
        '<img src="' + esc(r.image_url || "") + '" alt="">' +
        '<div><div class="admin-kicker">' + esc(r.reorder_id) + '</div><h2>' + esc(r.product_name || r.sku) + '</h2><p>' + esc(r.sku) + ' · ' + esc(r.quantity) + ' units · Supplier ' + esc(r.supplier_name) + '</p></div>' +
        '<div class="admin-stock-card"><span>Reorder status</span><strong>' + esc(r.status).replace(/_/g, " ") + '</strong><small>ETA ' + esc(r.expected_arrival || "TBD") + '</small></div>' +
      '</section>' +
      '<section class="admin-panel"><div class="admin-panel-title"><h2>Communication</h2><span>' + messages.length + ' messages</span></div>' + renderMessages(messages) + '</section>';
  }

  function startPolling(loader) {
    loader();
    var intervalId = window.setInterval(function () {
      if (document.visibilityState === "visible") loader();
    }, 4000);
    window.addEventListener("pagehide", function () {
      window.clearInterval(intervalId);
    });
  }

  if (!content) return;

  var resetBtn = document.getElementById("admin-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (!window.confirm("Reset demo data so the MCP flow can be repeated?")) return;
      resetBtn.disabled = true;
      resetBtn.textContent = "Resetting...";
      postJson("/api/admin/reset-demo")
        .then(function () {
          showNotice("Demo data reset. Reorders and logged emails were cleared; ticket is open again.", "success");
          if (view === "analytics") {
            var sku = new URLSearchParams(window.location.search).get("sku") || TARGET_SKU;
            return loadJson("/api/admin/products/" + encodeURIComponent(sku) + "/performance").then(renderAnalytics);
          }
          if (view === "support") return loadJson("/api/admin/support").then(renderSupport);
          if (view === "support-detail") return loadJson("/api/admin/support/" + encodeURIComponent(currentPathId())).then(renderSupportDetail);
          if (view === "suppliers") return loadJson("/api/admin/reorders").then(renderSuppliers);
          if (view === "supplier-detail") return loadJson("/api/admin/reorders/" + encodeURIComponent(currentPathId())).then(renderSupplierDetail);
          return loadJson("/api/admin/attention").then(renderDashboard);
        })
        .catch(function (error) {
          showNotice("Reset failed: " + error.message, "error");
        })
        .finally(function () {
          resetBtn.disabled = false;
          resetBtn.textContent = "Reset Demo";
        });
    });
  }

  if (view === "analytics") {
    var sku = new URLSearchParams(window.location.search).get("sku") || TARGET_SKU;
    loadJson("/api/admin/products/" + encodeURIComponent(sku) + "/performance").then(renderAnalytics).catch(renderError);
  } else if (view === "support") {
    loadJson("/api/admin/support").then(renderSupport).catch(renderError);
  } else if (view === "support-detail") {
    startPolling(function () {
      loadJson("/api/admin/support/" + encodeURIComponent(currentPathId())).then(renderSupportDetail).catch(renderError);
    });
  } else if (view === "suppliers") {
    startPolling(function () {
      loadJson("/api/admin/reorders").then(renderSuppliers).catch(renderError);
    });
  } else if (view === "supplier-detail") {
    startPolling(function () {
      loadJson("/api/admin/reorders/" + encodeURIComponent(currentPathId())).then(renderSupplierDetail).catch(renderError);
    });
  } else {
    loadJson("/api/admin/attention").then(renderDashboard).catch(renderError);
  }
})();
