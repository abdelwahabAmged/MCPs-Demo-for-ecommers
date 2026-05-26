import type Database from 'better-sqlite3';

const ACCOUNT_ID = 'ACME-ACC-00441';

const BRAND_COLOR = '#1a365d';
const ACCENT_COLOR = '#2b6cb0';
const SUCCESS_COLOR = '#276749';
const WARNING_COLOR = '#c05621';
const DANGER_COLOR = '#c53030';

function baseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a202c; background: #f7fafc; line-height: 1.6; }
    a { color: ${ACCENT_COLOR}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .site-header { background: ${BRAND_COLOR}; color: white; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    .site-header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; height: 56px; gap: 32px; }
    .site-header .logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; color: white; text-decoration: none; white-space: nowrap; }
    .site-header .logo:hover { text-decoration: none; opacity: 0.9; }
    .site-nav { display: flex; gap: 4px; flex: 1; }
    .site-nav a { color: rgba(255,255,255,0.75); font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; text-decoration: none; transition: all 0.15s; }
    .site-nav a:hover { color: white; background: rgba(255,255,255,0.1); text-decoration: none; }
    .site-nav a.active { color: white; background: rgba(255,255,255,0.18); }
    .site-header-right { display: flex; align-items: center; gap: 12px; }
    .site-header-right .account-pill { font-size: 12px; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 12px; }
    .site-header-right .print-btn { background: rgba(255,255,255,0.15); color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .site-header-right .print-btn:hover { background: rgba(255,255,255,0.25); }
    .breadcrumb { max-width: 1100px; margin: 0 auto; padding: 12px 24px 0; font-size: 13px; color: #718096; }
    .breadcrumb a { color: ${ACCENT_COLOR}; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb span { margin: 0 6px; color: #cbd5e0; }
    .container { max-width: 1100px; margin: 0 auto; padding: 20px 24px 40px; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 20px; }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: ${BRAND_COLOR}; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f7fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #4a5568; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f7fafc; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-paid { background: #c6f6d5; color: ${SUCCESS_COLOR}; }
    .badge-open { background: #bee3f8; color: ${ACCENT_COLOR}; }
    .badge-overdue { background: #fed7d7; color: ${DANGER_COLOR}; }
    .badge-processing { background: #fefcbf; color: #975a16; }
    .badge-shipped { background: #bee3f8; color: ${ACCENT_COLOR}; }
    .badge-delivered { background: #c6f6d5; color: ${SUCCESS_COLOR}; }
    .badge-cancelled { background: #e2e8f0; color: #718096; }
    .badge-draft { background: #e9d8fd; color: #553c9a; }
    .text-right { text-align: right; }
    .text-muted { color: #718096; font-size: 13px; }
    .text-bold { font-weight: 600; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .mt-2 { margin-top: 16px; }
    .mb-2 { margin-bottom: 16px; }
    .demo-badge { position: fixed; bottom: 16px; right: 16px; background: ${BRAND_COLOR}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; opacity: 0.8; z-index: 200; }
    @media print { .no-print, .site-header, .demo-badge, .breadcrumb { display: none !important; } body { background: white; } .card { box-shadow: none; } .container { padding: 0; max-width: 100%; } }
    @media (max-width: 768px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } .site-nav { display: none; } }
  `;
}

type ActivePage = 'dashboard' | 'orders' | 'catalog' | 'invoices' | 'none';

function siteHeader(active: ActivePage): string {
  const nav = (href: string, label: string, page: ActivePage) =>
    `<a href="${href}" class="${active === page ? 'active' : ''}">${label}</a>`;

  return `
  <div class="site-header no-print">
    <div class="site-header-inner">
      <a href="/dashboard" class="logo">ACME Industrial Supply</a>
      <nav class="site-nav">
        ${nav('/dashboard', 'Dashboard', 'dashboard')}
        ${nav('/orders', 'Orders', 'orders')}
        ${nav('/invoices', 'Invoices', 'invoices')}
        ${nav('/catalog', 'Catalog', 'catalog')}
      </nav>
      <div class="site-header-right">
        <span class="account-pill">Hargreaves Engineering · Tier 2</span>
        <button class="print-btn" onclick="window.print()">Print</button>
      </div>
    </div>
  </div>`;
}

function breadcrumb(...crumbs: Array<{ label: string; href?: string }>): string {
  return `<div class="breadcrumb no-print">${crumbs.map((c, i) =>
    i < crumbs.length - 1
      ? `<a href="${c.href}">${c.label}</a><span>/</span>`
      : `<strong style="color:#2d3748;">${c.label}</strong>`
  ).join('')}</div>`;
}

function pageShell(title: string, active: ActivePage, content: string, crumbs?: Array<{ label: string; href?: string }>): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Acme Industrial Supply</title>
<style>${baseStyles()}</style>
</head><body>
${siteHeader(active)}
${crumbs ? breadcrumb(...crumbs) : ''}
<div class="container">${content}</div>
<div class="demo-badge no-print">Preview Environment</div>
</body></html>`;
}

// ── Account Dashboard ──────────────────────────────────────────

export function renderDashboardPage(db: Database.Database): string {
  const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as {
    name: string; account_id: string; credit_limit: number; balance: number;
    payment_terms: string; rep_name: string; rep_email: string;
    open_orders: number; tier: string; ytd_spend: number; last_order_date: string;
  };

  const available = account.credit_limit - account.balance;
  const creditUsedPct = Math.round(account.balance / account.credit_limit * 100);

  const recentOrders = db.prepare('SELECT * FROM orders WHERE account_id = ? ORDER BY order_date DESC LIMIT 5').all(ACCOUNT_ID) as Array<{
    order_id: string; status: string; order_date: string; total: number; po_number: string;
  }>;

  const openInvoices = db.prepare("SELECT * FROM invoices WHERE account_id = ? AND status = 'open' ORDER BY due_date ASC").all(ACCOUNT_ID) as Array<{
    invoice_id: string; order_id: string; due_date: string; total_inc_vat: number;
  }>;
  const totalOutstanding = openInvoices.reduce((s, i) => s + i.total_inc_vat, 0);

  const orders = db.prepare("SELECT * FROM orders WHERE account_id = ? AND status != 'cancelled'").all(ACCOUNT_ID) as Array<{ items: string; total: number }>;
  const catSpend = new Map<string, number>();
  for (const o of orders) {
    const items = JSON.parse(o.items) as Array<{ sku: string; qty: number; unit_price: number }>;
    for (const item of items) {
      const prod = db.prepare('SELECT category FROM products WHERE sku = ?').get(item.sku) as { category: string } | undefined;
      if (prod) catSpend.set(prod.category, (catSpend.get(prod.category) ?? 0) + item.qty * item.unit_price);
    }
  }
  const totalCatSpend = Array.from(catSpend.values()).reduce((a, b) => a + b, 0);
  const catBars = Array.from(catSpend.entries()).sort((a, b) => b[1] - a[1]).map(([cat, spend]) => {
    const pct = totalCatSpend > 0 ? Math.round(spend / totalCatSpend * 100) : 0;
    return `<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;"><a href="/catalog/${cat}" style="text-transform:capitalize;">${cat}</a><span>£${spend.toFixed(0)} (${pct}%)</span></div>
      <div style="background:#e2e8f0;border-radius:4px;height:8px;"><div style="background:${ACCENT_COLOR};height:8px;border-radius:4px;width:${pct}%;"></div></div>
    </div>`;
  }).join('');

  const orderRows = recentOrders.map(o =>
    `<tr>
      <td><a href="/track/${o.order_id}" style="font-weight:500;">${o.order_id}</a></td>
      <td>${o.po_number}</td><td>${o.order_date}</td>
      <td class="text-right">£${o.total.toFixed(2)}</td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
    </tr>`
  ).join('');

  const invoiceRows = openInvoices.map(i =>
    `<tr>
      <td><a href="/invoice/${i.invoice_id}">${i.invoice_id}</a></td>
      <td><a href="/track/${i.order_id}">${i.order_id}</a></td><td>${i.due_date}</td>
      <td class="text-right text-bold">£${i.total_inc_vat.toFixed(2)}</td>
    </tr>`
  ).join('');

  const creditBarColor = creditUsedPct > 80 ? DANGER_COLOR : creditUsedPct > 60 ? WARNING_COLOR : SUCCESS_COLOR;

  const content = `
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
      <div><h2 style="font-size:22px;color:${BRAND_COLOR};">${account.name}</h2><div class="text-muted">${account.account_id} · ${account.tier} · ${account.payment_terms}</div></div>
      <div class="text-muted text-right">Rep: <strong>${account.rep_name}</strong><br>${account.rep_email}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;">
      ${[
        { label: 'Credit Available', value: `£${available.toLocaleString('en-GB')}`, sub: `of £${account.credit_limit.toLocaleString('en-GB')}` },
        { label: 'YTD Spend', value: `£${account.ytd_spend.toLocaleString('en-GB')}`, sub: `${recentOrders.length > 0 ? recentOrders.length : 0} recent orders` },
        { label: 'Open Orders', value: `${account.open_orders}`, sub: `Last: ${account.last_order_date}` },
        { label: 'Outstanding', value: `£${totalOutstanding.toFixed(2)}`, sub: `<a href="/invoices">${openInvoices.length} open invoices</a>` },
      ].map(k => `<div class="card" style="text-align:center;padding:20px;">
        <div class="text-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${k.label}</div>
        <div style="font-size:24px;font-weight:700;color:${BRAND_COLOR};margin:4px 0;">${k.value}</div>
        <div class="text-muted">${k.sub}</div>
      </div>`).join('')}
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Credit Usage</h2>
        <div style="text-align:center;margin:16px 0;">
          <div style="font-size:36px;font-weight:700;color:${creditBarColor};">${creditUsedPct}%</div>
          <div class="text-muted">of credit limit used</div>
        </div>
        <div style="background:#e2e8f0;border-radius:6px;height:16px;margin:8px 0;">
          <div style="background:${creditBarColor};height:16px;border-radius:6px;width:${creditUsedPct}%;transition:width 0.5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#718096;">
          <span>Balance: £${account.balance.toLocaleString('en-GB')}</span>
          <span>Limit: £${account.credit_limit.toLocaleString('en-GB')}</span>
        </div>
      </div>
      <div class="card">
        <h2>Spend by Category</h2>
        ${catBars || '<p class="text-muted">No spend data yet.</p>'}
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
        <h2 style="border:none;padding:0;margin:0;">Recent Orders</h2>
        <a href="/orders" style="font-size:13px;font-weight:500;">View all orders &rarr;</a>
      </div>
      <table>
        <thead><tr><th>Order</th><th>PO Number</th><th>Date</th><th class="text-right">Total</th><th>Status</th></tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
        <h2 style="border:none;padding:0;margin:0;">Open Invoices</h2>
        <a href="/invoices" style="font-size:13px;font-weight:500;">View all invoices &rarr;</a>
      </div>
      ${openInvoices.length > 0 ? `<table>
        <thead><tr><th>Invoice</th><th>Order</th><th>Due Date</th><th class="text-right">Total (inc VAT)</th></tr></thead>
        <tbody>${invoiceRows}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px;font-size:16px;font-weight:700;">Total Outstanding: £${totalOutstanding.toFixed(2)}</div>`
      : '<p class="text-muted">No open invoices.</p>'}
    </div>`;

  return pageShell('Account Dashboard', 'dashboard', content);
}

// ── Orders List Page ────────────────────────────────────────────

export function renderOrdersPage(db: Database.Database): string {
  const allOrders = db.prepare('SELECT * FROM orders WHERE account_id = ? ORDER BY order_date DESC').all(ACCOUNT_ID) as Array<{
    order_id: string; status: string; order_date: string; delivery_date: string | null;
    total: number; po_number: string; carrier: string | null; items: string;
  }>;

  const stats = {
    total: allOrders.length,
    processing: allOrders.filter(o => o.status === 'processing').length,
    shipped: allOrders.filter(o => o.status === 'shipped').length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
  };

  const orderRows = allOrders.map(o => {
    const items = JSON.parse(o.items) as Array<{ qty: number }>;
    const lineCount = items.length;
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    return `<tr>
      <td><a href="/track/${o.order_id}" style="font-weight:500;">${o.order_id}</a></td>
      <td>${o.po_number}</td>
      <td>${o.order_date}</td>
      <td>${lineCount} lines · ${totalQty} units</td>
      <td class="text-right">£${o.total.toFixed(2)}</td>
      <td>${o.delivery_date ?? '—'}</td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
    </tr>`;
  }).join('');

  const content = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;">
      ${[
        { label: 'Total Orders', value: `${stats.total}`, color: BRAND_COLOR },
        { label: 'Processing', value: `${stats.processing}`, color: WARNING_COLOR },
        { label: 'Shipped', value: `${stats.shipped}`, color: ACCENT_COLOR },
        { label: 'Delivered', value: `${stats.delivered}`, color: SUCCESS_COLOR },
      ].map(k => `<div class="card" style="text-align:center;padding:16px;">
        <div class="text-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${k.label}</div>
        <div style="font-size:28px;font-weight:700;color:${k.color};margin:4px 0;">${k.value}</div>
      </div>`).join('')}
    </div>

    <div class="card">
      <h2>All Orders</h2>
      <table>
        <thead><tr><th>Order</th><th>PO Number</th><th>Date</th><th>Items</th><th class="text-right">Total</th><th>Delivered</th><th>Status</th></tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>`;

  return pageShell('Orders', 'orders', content, [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders' },
  ]);
}

// ── Order Tracking Page ─────────────────────────────────────────

export function renderTrackingPage(db: Database.Database, orderId: string): string | null {
  const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND account_id = ?').get(orderId, ACCOUNT_ID) as {
    order_id: string; status: string; order_date: string; delivery_date: string | null;
    total: number; po_number: string; carrier: string | null; tracking_number: string | null;
    delivery_address_id: string; items: string; tracking_milestones: string;
  } | undefined;

  if (!order) return null;

  const milestones = JSON.parse(order.tracking_milestones) as Array<{ status: string; timestamp: string; note: string }>;
  const items = JSON.parse(order.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }>;

  const allSteps = ['order_placed', 'picked', 'dispatched', 'in_transit', 'delivered'];
  const completedStatuses = new Set(milestones.map(m => m.status));
  const isCancelled = order.status === 'cancelled';

  let addr = null as { label: string; line1: string; city: string; postcode: string } | null;
  if (order.delivery_address_id) {
    addr = db.prepare('SELECT * FROM delivery_addresses WHERE address_id = ?').get(order.delivery_address_id) as typeof addr;
  }

  const stepHtml = allSteps.map((step, idx) => {
    const done = completedStatuses.has(step);
    const isCurrent = done && !completedStatuses.has(allSteps[idx + 1] ?? '');
    const milestone = milestones.find(m => m.status === step);
    const dt = milestone ? new Date(milestone.timestamp) : null;

    const circleStyle = done
      ? `background:${isCurrent ? ACCENT_COLOR : SUCCESS_COLOR};color:white;`
      : `background:#e2e8f0;color:#a0aec0;`;
    const label = step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const lineColor = done ? SUCCESS_COLOR : '#e2e8f0';

    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;position:relative;">
      ${idx > 0 ? `<div style="position:absolute;top:16px;right:50%;width:100%;height:3px;background:${lineColor};z-index:0;"></div>` : ''}
      <div style="width:34px;height:34px;border-radius:50%;${circleStyle}display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;z-index:1;border:3px solid ${done ? (isCurrent ? ACCENT_COLOR : SUCCESS_COLOR) : '#e2e8f0'};">
        ${done ? '&#10003;' : idx + 1}
      </div>
      <div style="font-size:12px;font-weight:600;margin-top:8px;color:${done ? '#1a202c' : '#a0aec0'};">${label}</div>
      ${dt ? `<div style="font-size:11px;color:#718096;">${dt.toLocaleDateString('en-GB')}<br>${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
      ${milestone ? `<div style="font-size:11px;color:#718096;max-width:120px;text-align:center;">${milestone.note}</div>` : ''}
    </div>`;
  }).join('');

  const itemRows = items.map(i =>
    `<tr><td><a href="/catalog">${i.sku}</a></td><td>${i.name}</td><td class="text-right">${i.qty}</td><td class="text-right">£${i.unit_price.toFixed(2)}</td><td class="text-right">£${(i.qty * i.unit_price).toFixed(2)}</td></tr>`
  ).join('');

  const invoiceLink = db.prepare('SELECT invoice_id FROM invoices WHERE order_id = ? AND account_id = ?').get(order.order_id, ACCOUNT_ID) as { invoice_id: string } | undefined;

  const content = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 style="border:none;padding:0;margin:0;font-size:20px;">Order ${order.order_id}</h2>
          <div class="text-muted">PO: ${order.po_number} · Ordered: ${order.order_date}${invoiceLink ? ` · <a href="/invoice/${invoiceLink.invoice_id}">View Invoice</a>` : ''}</div>
        </div>
        <span class="badge badge-${order.status}">${order.status.toUpperCase()}</span>
      </div>
    </div>

    ${!isCancelled ? `<div class="card">
      <h2>Shipment Progress</h2>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:16px 0;">${stepHtml}</div>
    </div>` : `<div class="card" style="border-left:4px solid ${DANGER_COLOR};">
      <h2 style="color:${DANGER_COLOR};">Order Cancelled</h2>
      <p class="text-muted">${milestones.find(m => m.status === 'cancelled')?.note ?? 'Cancelled'}</p>
    </div>`}

    <div class="grid-2">
      <div class="card">
        <h2>Shipping Details</h2>
        <table>
          ${order.carrier ? `<tr><td class="text-muted">Carrier</td><td class="text-bold">${order.carrier}</td></tr>` : ''}
          ${order.tracking_number ? `<tr><td class="text-muted">Tracking</td><td class="text-bold">${order.tracking_number}</td></tr>` : ''}
          ${addr ? `<tr><td class="text-muted">Deliver to</td><td>${addr.label}<br><span class="text-muted">${addr.line1}, ${addr.city} ${addr.postcode}</span></td></tr>` : ''}
          ${order.delivery_date ? `<tr><td class="text-muted">Delivered</td><td class="text-bold" style="color:${SUCCESS_COLOR};">${order.delivery_date}</td></tr>` : ''}
        </table>
      </div>
      <div class="card">
        <h2>Order Summary</h2>
        <table>
          <tr><td class="text-muted">Items</td><td class="text-bold">${items.length} line items</td></tr>
          <tr><td class="text-muted">Subtotal</td><td>£${order.total.toFixed(2)}</td></tr>
          <tr><td class="text-muted">VAT (20%)</td><td>£${(order.total * 0.2).toFixed(2)}</td></tr>
          <tr><td class="text-bold">Total</td><td class="text-bold">£${(order.total * 1.2).toFixed(2)}</td></tr>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Line Items</h2>
      <table>
        <thead><tr><th>SKU</th><th>Product</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Timeline</h2>
      ${milestones.map(m => {
        const dt = new Date(m.timestamp);
        return `<div style="display:flex;gap:16px;padding:8px 0;border-bottom:1px solid #edf2f7;">
          <div style="min-width:140px;font-size:13px;color:#718096;">${dt.toLocaleDateString('en-GB')} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
          <div><strong style="font-size:13px;">${m.status.replace(/_/g, ' ').toUpperCase()}</strong><br><span class="text-muted">${m.note}</span></div>
        </div>`;
      }).join('')}
    </div>`;

  return pageShell(`Order ${order.order_id}`, 'orders', content, [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders', href: '/orders' },
    { label: order.order_id },
  ]);
}

// ── Invoices List Page ──────────────────────────────────────────

export function renderInvoicesPage(db: Database.Database): string {
  const allInvoices = db.prepare('SELECT * FROM invoices WHERE account_id = ? ORDER BY issue_date DESC').all(ACCOUNT_ID) as Array<{
    invoice_id: string; order_id: string; issue_date: string; due_date: string;
    paid_date: string | null; amount: number; vat: number; total_inc_vat: number; status: string;
  }>;

  const totalOpen = allInvoices.filter(i => i.status === 'open').reduce((s, i) => s + i.total_inc_vat, 0);
  const totalPaid = allInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_inc_vat, 0);

  const rows = allInvoices.map(inv => {
    const badgeClass = inv.status === 'paid' ? 'badge-paid' : inv.status === 'overdue' ? 'badge-overdue' : 'badge-open';
    return `<tr>
      <td><a href="/invoice/${inv.invoice_id}" style="font-weight:500;">${inv.invoice_id}</a></td>
      <td><a href="/track/${inv.order_id}">${inv.order_id}</a></td>
      <td>${inv.issue_date}</td>
      <td>${inv.due_date}</td>
      <td class="text-right">£${inv.amount.toFixed(2)}</td>
      <td class="text-right">£${inv.total_inc_vat.toFixed(2)}</td>
      <td><span class="badge ${badgeClass}">${inv.status}</span></td>
    </tr>`;
  }).join('');

  const content = `
    <div class="grid-3" style="margin-bottom:20px;">
      ${[
        { label: 'Total Invoices', value: `${allInvoices.length}`, color: BRAND_COLOR },
        { label: 'Outstanding', value: `£${totalOpen.toFixed(2)}`, color: WARNING_COLOR },
        { label: 'Paid', value: `£${totalPaid.toFixed(2)}`, color: SUCCESS_COLOR },
      ].map(k => `<div class="card" style="text-align:center;padding:16px;">
        <div class="text-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${k.label}</div>
        <div style="font-size:28px;font-weight:700;color:${k.color};margin:4px 0;">${k.value}</div>
      </div>`).join('')}
    </div>

    <div class="card">
      <h2>All Invoices</h2>
      <table>
        <thead><tr><th>Invoice</th><th>Order</th><th>Issued</th><th>Due</th><th class="text-right">Subtotal</th><th class="text-right">Total (inc VAT)</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  return pageShell('Invoices', 'invoices', content, [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Invoices' },
  ]);
}

// ── Invoice Detail Page ─────────────────────────────────────────

export function renderInvoicePage(db: Database.Database, invoiceId: string): string | null {
  const invoice = db.prepare('SELECT * FROM invoices WHERE invoice_id = ? AND account_id = ?').get(invoiceId, ACCOUNT_ID) as {
    invoice_id: string; order_id: string; issue_date: string; due_date: string;
    paid_date: string | null; amount: number; vat: number; total_inc_vat: number; status: string;
  } | undefined;

  if (!invoice) return null;

  const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(invoice.order_id) as {
    order_id: string; po_number: string; delivery_address_id: string; items: string;
  } | undefined;

  const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as {
    name: string; payment_terms: string; rep_name: string; rep_email: string;
  };

  const items = order ? JSON.parse(order.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }> : [];

  let addrHtml = '';
  if (order?.delivery_address_id) {
    const addr = db.prepare('SELECT * FROM delivery_addresses WHERE address_id = ?').get(order.delivery_address_id) as {
      label: string; line1: string; line2: string; city: string; postcode: string;
    } | undefined;
    if (addr) {
      addrHtml = `<div><h3 style="font-size:13px;color:#718096;margin-bottom:4px;">SHIP TO</h3>
        ${addr.label}<br>${addr.line1}<br>${addr.line2}<br>${addr.city}, ${addr.postcode}</div>`;
    }
  }

  const badgeClass = invoice.status === 'paid' ? 'badge-paid' : invoice.status === 'overdue' ? 'badge-overdue' : 'badge-open';

  const itemRows = items.map(i =>
    `<tr><td><a href="/catalog">${i.sku}</a></td><td>${i.name}</td><td class="text-right">${i.qty}</td><td class="text-right">£${i.unit_price.toFixed(2)}</td><td class="text-right">£${(i.qty * i.unit_price).toFixed(2)}</td></tr>`
  ).join('');

  const amountPaid = invoice.status === 'paid' ? invoice.total_inc_vat : 0;
  const balanceDue = invoice.total_inc_vat - amountPaid;

  const content = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <h2 style="border:none;padding:0;margin:0;font-size:22px;">INVOICE</h2>
          <div class="text-muted" style="margin-top:4px;">${invoice.invoice_id}${order ? ` · <a href="/track/${order.order_id}">View Order ${order.order_id}</a>` : ''}</div>
        </div>
        <div style="text-align:right;">
          <span class="badge ${badgeClass}" style="font-size:14px;padding:4px 14px;">${invoice.status.toUpperCase()}</span>
          <div class="text-muted" style="margin-top:8px;">Issue date: ${invoice.issue_date}</div>
          <div class="text-muted">Due date: <strong>${invoice.due_date}</strong></div>
          ${invoice.paid_date ? `<div style="color:${SUCCESS_COLOR};font-size:13px;margin-top:4px;">Paid: ${invoice.paid_date}</div>` : ''}
        </div>
      </div>

      <div class="grid-2 mb-2">
        <div>
          <h3 style="font-size:13px;color:#718096;margin-bottom:4px;">BILL TO</h3>
          <strong>${account.name}</strong><br>Account: ${ACCOUNT_ID}<br>Terms: ${account.payment_terms}
          ${order ? `<br>PO: ${order.po_number}` : ''}
        </div>
        ${addrHtml || `<div><h3 style="font-size:13px;color:#718096;margin-bottom:4px;">FROM</h3>Acme Industrial Supply Ltd<br>Unit 4 Trafford Park<br>Manchester, M17 1SL</div>`}
      </div>

      ${items.length > 0 ? `<table>
        <thead><tr><th>SKU</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}

      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <table style="width:300px;">
          <tr><td class="text-muted">Subtotal</td><td class="text-right">£${invoice.amount.toFixed(2)}</td></tr>
          <tr><td class="text-muted">VAT (20%)</td><td class="text-right">£${invoice.vat.toFixed(2)}</td></tr>
          <tr style="font-weight:700;font-size:16px;"><td>Total</td><td class="text-right">£${invoice.total_inc_vat.toFixed(2)}</td></tr>
          ${invoice.status === 'paid' ? `<tr><td class="text-muted">Amount Paid</td><td class="text-right" style="color:${SUCCESS_COLOR};">£${amountPaid.toFixed(2)}</td></tr>` : ''}
          <tr style="font-weight:700;${balanceDue > 0 ? `color:${DANGER_COLOR};` : `color:${SUCCESS_COLOR};`}"><td>Balance Due</td><td class="text-right">£${balanceDue.toFixed(2)}</td></tr>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Payment Information</h2>
      <div class="grid-2">
        <div>
          <p class="text-muted">Payment terms: <strong>${account.payment_terms}</strong></p>
          <p class="text-muted">Please reference invoice <strong>${invoice.invoice_id}</strong> with payment.</p>
        </div>
        <div>
          <p class="text-muted">Bank: Barclays Business</p>
          <p class="text-muted">Sort Code: <strong>20-45-18</strong></p>
          <p class="text-muted">Account: <strong>43819274</strong></p>
          <p class="text-muted">Ref: ${invoice.invoice_id}</p>
        </div>
      </div>
    </div>`;

  return pageShell(`Invoice ${invoice.invoice_id}`, 'invoices', content, [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Invoices', href: '/invoices' },
    { label: invoice.invoice_id },
  ]);
}

// ── Quote Page ──────────────────────────────────────────────────

export function renderQuotePage(db: Database.Database, quoteId: string): string | null {
  const quote = db.prepare('SELECT * FROM quotes WHERE quote_id = ?').get(quoteId) as {
    quote_id: string; account_id: string; status: string; total: number;
    items: string; delivery_address_id: string | null; notes: string | null; created_at: string;
  } | undefined;

  if (!quote) return null;

  const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(quote.account_id) as {
    name: string; rep_name: string; rep_email: string; payment_terms: string;
  };

  const items = JSON.parse(quote.items) as Array<{
    sku: string; name: string; qty: number; list_price: number;
    contract_price: number; discount_pct: number; line_total: number; unit: string;
  }>;

  const vat = Math.round(quote.total * 0.2 * 100) / 100;
  const grandTotal = quote.total + vat;
  const validUntil = new Date(quote.created_at);
  validUntil.setDate(validUntil.getDate() + 30);

  let addressHtml = '';
  if (quote.delivery_address_id) {
    const addr = db.prepare('SELECT * FROM delivery_addresses WHERE address_id = ?').get(quote.delivery_address_id) as {
      label: string; line1: string; line2: string; city: string; postcode: string; contact_name: string;
    } | undefined;
    if (addr) {
      addressHtml = `<div><h3 style="font-size:13px;color:#718096;margin-bottom:4px;">DELIVER TO</h3>
        <strong>${addr.label}</strong><br>${addr.line1}<br>${addr.line2}<br>${addr.city}, ${addr.postcode}<br>Attn: ${addr.contact_name}</div>`;
    }
  }

  const itemRows = items.map(i => `<tr>
    <td><a href="/catalog">${i.sku}</a></td><td>${i.name}</td><td class="text-right">${i.qty}</td>
    <td class="text-right">£${i.list_price.toFixed(2)}</td>
    <td class="text-right">${i.discount_pct > 0 ? `${i.discount_pct}%` : '—'}</td>
    <td class="text-right">£${i.contract_price.toFixed(2)}</td>
    <td class="text-right text-bold">£${i.line_total.toFixed(2)}</td>
  </tr>`).join('');

  const content = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <h2 style="border:none;padding:0;margin:0;font-size:22px;">QUOTATION</h2>
          <div class="text-muted" style="margin-top:4px;">Ref: ${quote.quote_id}</div>
        </div>
        <div style="text-align:right;">
          <div class="text-muted">Date: ${new Date(quote.created_at).toLocaleDateString('en-GB')}</div>
          <div class="text-muted">Valid until: ${validUntil.toLocaleDateString('en-GB')}</div>
          <span class="badge badge-${quote.status === 'draft' ? 'draft' : 'paid'}" style="margin-top:4px;">${quote.status.toUpperCase()}</span>
        </div>
      </div>

      <div class="grid-2 mb-2">
        <div>
          <h3 style="font-size:13px;color:#718096;margin-bottom:4px;">QUOTED TO</h3>
          <strong>${account.name}</strong><br>Account: ${quote.account_id}<br>Terms: ${account.payment_terms}
        </div>
        ${addressHtml || '<div></div>'}
      </div>

      ${quote.notes ? `<div style="background:#fffff0;border-left:3px solid #ecc94b;padding:12px;margin-bottom:16px;font-size:14px;"><strong>Notes:</strong> ${quote.notes}</div>` : ''}

      <table>
        <thead><tr>
          <th>SKU</th><th>Product</th><th class="text-right">Qty</th>
          <th class="text-right">List Price</th><th class="text-right">Discount</th>
          <th class="text-right">Contract Price</th><th class="text-right">Line Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <table style="width:280px;">
          <tr><td class="text-muted">Subtotal</td><td class="text-right">£${quote.total.toFixed(2)}</td></tr>
          <tr><td class="text-muted">VAT (20%)</td><td class="text-right">£${vat.toFixed(2)}</td></tr>
          <tr style="font-size:16px;font-weight:700;"><td>Total</td><td class="text-right">£${grandTotal.toFixed(2)}</td></tr>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Terms & Contact</h2>
      <div class="grid-2">
        <div>
          <p class="text-muted">Payment terms: <strong>${account.payment_terms}</strong></p>
          <p class="text-muted">Prices exclude VAT unless stated.</p>
          <p class="text-muted">Subject to stock availability at time of order.</p>
        </div>
        <div>
          <p class="text-muted">Your sales representative:</p>
          <p><strong>${account.rep_name}</strong></p>
          <p class="text-muted">${account.rep_email}</p>
        </div>
      </div>
    </div>`;

  return pageShell(`Quote ${quote.quote_id}`, 'none', content, [
    { label: 'Dashboard', href: '/dashboard' },
    { label: `Quote ${quote.quote_id}` },
  ]);
}

// ── Product Catalog Page ───────────────────────────────────────

export function renderCatalogPage(db: Database.Database, category?: string): string {
  const categories = db.prepare('SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY category').all() as Array<{ category: string; count: number }>;
  const totalProducts = categories.reduce((s, c) => s + c.count, 0);

  let products: Array<{
    sku: string; name: string; brand: string; category: string; description: string;
    list_price: number; unit: string; lead_time_days: number; min_order_qty: number;
    weight_kg: number; specifications: string;
  }>;

  if (category) {
    products = db.prepare('SELECT * FROM products WHERE category = ? ORDER BY name').all(category) as typeof products;
  } else {
    products = db.prepare('SELECT * FROM products ORDER BY category, name').all() as typeof products;
  }

  const catTabs = categories.map(c => {
    const active = c.category === category;
    return `<a href="/catalog/${c.category}" style="
      display:inline-block;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;
      text-decoration:none;margin:0 4px 4px 0;
      background:${active ? ACCENT_COLOR : '#edf2f7'};color:${active ? 'white' : '#4a5568'};
    ">${c.category} (${c.count})</a>`;
  }).join('');

  const productCards = products.map(p => {
    const contract = db.prepare('SELECT * FROM contract_pricing WHERE account_id = ? AND category = ?').get(ACCOUNT_ID, p.category) as { discount_pct: number } | undefined;
    const discount = contract?.discount_pct ?? 0;
    const contractPrice = Math.round(p.list_price * (1 - discount / 100) * 100) / 100;
    const stock = (db.prepare('SELECT SUM(qty) as total FROM warehouse_stock WHERE sku = ?').get(p.sku) as { total: number | null }).total ?? 0;

    const stockDot = stock > 20 ? SUCCESS_COLOR : stock > 0 ? WARNING_COLOR : DANGER_COLOR;
    const stockLabel = stock > 20 ? 'In Stock' : stock > 0 ? `Low (${stock})` : 'Out of Stock';

    return `<div class="card" style="padding:16px;cursor:pointer;" onclick="this.querySelector('.detail').style.display=this.querySelector('.detail').style.display==='none'?'block':'none'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:600;font-size:15px;">${p.name}</div>
          <div class="text-muted">${p.sku} · ${p.brand}</div>
        </div>
        <div style="text-align:right;">
          ${discount > 0 ? `<div style="text-decoration:line-through;color:#a0aec0;font-size:13px;">£${p.list_price.toFixed(2)}</div>` : ''}
          <div style="font-size:18px;font-weight:700;color:${BRAND_COLOR};">£${contractPrice.toFixed(2)}</div>
          <div class="text-muted">per ${p.unit}${discount > 0 ? ` · ${discount}% off` : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;align-items:center;">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${stockDot};display:inline-block;"></span>${stockLabel}</span>
        <span class="text-muted" style="font-size:12px;">Lead: ${p.lead_time_days}d</span>
        <span class="text-muted" style="font-size:12px;">Min: ${p.min_order_qty}</span>
        <a href="/catalog/${p.category}" class="badge badge-open" style="font-size:11px;text-decoration:none;">${p.category}</a>
      </div>
      <div class="detail" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <p style="font-size:13px;color:#4a5568;margin-bottom:8px;">${p.description}</p>
        <div style="font-size:12px;color:#718096;">Weight: ${p.weight_kg} kg</div>
      </div>
    </div>`;
  }).join('');

  const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Dashboard', href: '/dashboard' }];
  if (category) {
    crumbs.push({ label: 'Catalog', href: '/catalog' });
    crumbs.push({ label: category.charAt(0).toUpperCase() + category.slice(1) });
  } else {
    crumbs.push({ label: 'Catalog' });
  }

  const content = `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:22px;color:${BRAND_COLOR};margin-bottom:12px;">Product Catalog${category ? ` — ${category.charAt(0).toUpperCase() + category.slice(1)}` : ''}</h2>
      <div style="margin-bottom:16px;">
        <a href="/catalog" style="display:inline-block;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;text-decoration:none;margin:0 4px 4px 0;background:${!category ? ACCENT_COLOR : '#edf2f7'};color:${!category ? 'white' : '#4a5568'};">All (${totalProducts})</a>
        ${catTabs}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr;gap:12px;">
      ${productCards}
    </div>
    <div class="text-muted" style="text-align:center;margin-top:24px;padding:16px;">
      Showing ${products.length} product${products.length !== 1 ? 's' : ''}. Contract pricing applied for Hargreaves Engineering (Tier 2).
    </div>`;

  return pageShell('Product Catalog', 'catalog', content, crumbs);
}
