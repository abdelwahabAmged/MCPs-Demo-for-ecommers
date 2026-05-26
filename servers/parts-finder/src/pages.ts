import type Database from 'better-sqlite3';

const BRAND_COLOR = '#1a2e4a';
const ACCENT_COLOR = '#e63946';
const SUCCESS_COLOR = '#2d6a4f';
const WARNING_COLOR = '#e07c00';
const MUTED_COLOR = '#6b7280';

function baseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a202c; background: #f8fafc; line-height: 1.6; }
    a { color: ${ACCENT_COLOR}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .site-header { background: ${BRAND_COLOR}; color: white; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    .site-header-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; height: 60px; gap: 32px; }
    .site-header .logo { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: white; text-decoration: none; white-space: nowrap; display: flex; align-items: center; gap: 10px; }
    .site-header .logo:hover { text-decoration: none; opacity: 0.9; }
    .site-header .logo svg { width: 28px; height: 28px; }
    .site-nav { display: flex; gap: 4px; flex: 1; }
    .site-nav a { color: rgba(255,255,255,0.75); font-size: 14px; font-weight: 500; padding: 8px 16px; border-radius: 6px; text-decoration: none; transition: all 0.15s; }
    .site-nav a:hover { color: white; background: rgba(255,255,255,0.1); text-decoration: none; }
    .site-nav a.active { color: white; background: rgba(255,255,255,0.18); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: ${BRAND_COLOR}; }
    .page-subtitle { font-size: 14px; color: ${MUTED_COLOR}; margin-bottom: 24px; }
    .card { background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .card h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: ${BRAND_COLOR}; }
    .card h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-oem { background: #dbeafe; color: #1e40af; }
    .badge-aftermarket { background: #fef3c7; color: #92400e; }
    .badge-instock { background: #d1fae5; color: ${SUCCESS_COLOR}; }
    .badge-lowstock { background: #fef3c7; color: ${WARNING_COLOR}; }
    .badge-outofstock { background: #fee2e2; color: #991b1b; }
    .stock-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .stock-dot.green { background: #10b981; }
    .stock-dot.amber { background: #f59e0b; }
    .stock-dot.red { background: #ef4444; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .stat-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e5e7eb; text-align: center; }
    .stat-card .stat-value { font-size: 28px; font-weight: 700; color: ${BRAND_COLOR}; }
    .stat-card .stat-label { font-size: 13px; color: ${MUTED_COLOR}; margin-top: 4px; }
    .vehicle-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e5e7eb; transition: all 0.15s; display: block; color: inherit; text-decoration: none; }
    .vehicle-card:hover { border-color: ${ACCENT_COLOR}; box-shadow: 0 4px 12px rgba(230,57,70,0.1); text-decoration: none; }
    .vehicle-card .vehicle-title { font-size: 16px; font-weight: 700; color: ${BRAND_COLOR}; margin-bottom: 4px; }
    .vehicle-card .vehicle-subtitle { font-size: 13px; color: ${MUTED_COLOR}; }
    .vehicle-card .vehicle-specs { margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap; }
    .vehicle-card .spec-tag { font-size: 11px; background: #f3f4f6; padding: 3px 8px; border-radius: 4px; color: #4b5563; }
    .branch-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e5e7eb; }
    .branch-card .branch-name { font-size: 16px; font-weight: 700; color: ${BRAND_COLOR}; margin-bottom: 8px; }
    .branch-card .branch-detail { font-size: 13px; color: #4b5563; margin-bottom: 4px; display: flex; align-items: flex-start; gap: 8px; }
    .branch-card .branch-detail svg { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; color: ${MUTED_COLOR}; }
    .part-detail-header { display: flex; gap: 24px; align-items: flex-start; }
    .part-detail-info { flex: 1; }
    .part-detail-price { font-size: 28px; font-weight: 700; color: ${BRAND_COLOR}; }
    .part-detail-meta { font-size: 13px; color: ${MUTED_COLOR}; margin-top: 4px; }
    .breadcrumb { font-size: 13px; color: ${MUTED_COLOR}; margin-bottom: 16px; }
    .breadcrumb a { color: ${ACCENT_COLOR}; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .category-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
    .category-pill { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; background: #f3f4f6; color: #4b5563; text-decoration: none; transition: all 0.15s; }
    .category-pill:hover { background: #e5e7eb; text-decoration: none; }
    .category-pill.active { background: ${ACCENT_COLOR}; color: white; }
    .cart-summary { background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .cart-total { font-size: 24px; font-weight: 700; color: ${BRAND_COLOR}; }
    .hero { background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #2d4a73 100%); color: white; padding: 48px; border-radius: 12px; margin-bottom: 32px; }
    .hero h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
    .hero p { font-size: 16px; opacity: 0.85; max-width: 600px; }
    .demo-badge { position: fixed; bottom: 16px; right: 16px; background: ${BRAND_COLOR}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; opacity: 0.8; z-index: 200; }
    @media print { .site-header, .demo-badge { display: none !important; } body { background: white; } .card { box-shadow: none; border: 1px solid #ddd; } }
    @media (max-width: 768px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } .site-nav { display: none; } .hero { padding: 24px; } .hero h1 { font-size: 22px; } }
  `;
}

type ActivePage = 'dashboard' | 'catalog' | 'branches' | 'none';

const LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;

function siteHeader(active: ActivePage): string {
  const nav = (href: string, label: string, page: ActivePage) =>
    `<a href="${href}" class="${active === page ? 'active' : ''}">${label}</a>`;

  return `
  <div class="site-header">
    <div class="site-header-inner">
      <a href="/" class="logo">${LOGO_SVG} Acme Parts Co</a>
      <nav class="site-nav">
        ${nav('/', 'Dashboard', 'dashboard')}
        ${nav('/catalog', 'Catalog', 'catalog')}
        ${nav('/branches', 'Branches', 'branches')}
      </nav>
    </div>
  </div>`;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

function stockBadge(qty: number): string {
  if (qty > 5) return `<span class="badge badge-instock"><span class="stock-dot green"></span>In Stock (${qty})</span>`;
  if (qty > 0) return `<span class="badge badge-lowstock"><span class="stock-dot amber"></span>Low Stock (${qty})</span>`;
  return `<span class="badge badge-outofstock"><span class="stock-dot red"></span>Out of Stock</span>`;
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Page
// ═══════════════════════════════════════════════════════════════
export function renderDashboardPage(db: Database.Database): string {
  const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY make').all() as any[];
  const partCount = (db.prepare('SELECT COUNT(*) as c FROM parts').get() as any).c;
  const brandCount = (db.prepare('SELECT COUNT(DISTINCT brand) as c FROM parts').get() as any).c;
  const categoryCount = (db.prepare('SELECT COUNT(DISTINCT category) as c FROM parts').get() as any).c;
  const branchCount = (db.prepare('SELECT COUNT(*) as c FROM branches').get() as any).c;

  const vehicleCards = vehicles.map(v => `
    <a href="/vehicle/${v.id}" class="vehicle-card">
      <div class="vehicle-title">${v.year} ${v.make} ${v.model}</div>
      <div class="vehicle-subtitle">${v.variant}</div>
      <div class="vehicle-specs">
        <span class="spec-tag">${v.engine_code}</span>
        <span class="spec-tag">${v.fuel_type}</span>
        <span class="spec-tag">${v.power_hp}hp</span>
        <span class="spec-tag">${v.transmission}</span>
      </div>
    </a>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acme Parts Co — Find the right part for your vehicle</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('dashboard')}
  <div class="container">
    <div class="hero">
      <h1>Find the right part, first time</h1>
      <p>Search by vehicle, symptom, or part number. OEM and aftermarket options with real-time stock across ${branchCount} branches.</p>
    </div>

    <div class="grid-4">
      <div class="stat-card">
        <div class="stat-value">${partCount}</div>
        <div class="stat-label">Parts in Catalogue</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${brandCount}</div>
        <div class="stat-label">Brands</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${categoryCount}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${branchCount}</div>
        <div class="stat-label">Branches</div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <h2>Supported Vehicles</h2>
      <div class="grid-3">
        ${vehicleCards}
      </div>
    </div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Vehicle Detail Page
// ═══════════════════════════════════════════════════════════════
export function renderVehiclePage(db: Database.Database, vehicleId: string): string | null {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as any;
  if (!vehicle) return null;

  const jobTypes = db.prepare(
    'SELECT DISTINCT job_type FROM vehicle_parts WHERE vehicle_id = ? ORDER BY job_type'
  ).all(vehicle.id) as { job_type: string }[];

  const sections = jobTypes.map(({ job_type }) => {
    const parts = db.prepare(`
      SELECT p.* FROM parts p
      JOIN vehicle_parts vp ON p.part_number = vp.part_number
      WHERE vp.vehicle_id = ? AND vp.job_type = ?
      ORDER BY p.type ASC, p.fitment_confidence DESC
    `).all(vehicle.id, job_type) as any[];

    const rows = parts.map((p: any) => {
      const typeBadge = p.type === 'oem'
        ? '<span class="badge badge-oem">OEM</span>'
        : '<span class="badge badge-aftermarket">Aftermarket</span>';
      return `<tr>
        <td>${typeBadge}</td>
        <td><a href="/part/${p.part_number}">${p.brand} ${p.name}</a></td>
        <td><code>${p.part_number}</code></td>
        <td><strong>${formatPrice(p.price)}</strong></td>
        <td>${p.fitment_confidence}%</td>
      </tr>`;
    }).join('');

    return `
      <div class="card">
        <h2>${job_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</h2>
        <table>
          <thead><tr><th>Type</th><th>Part</th><th>Part #</th><th>Price</th><th>Fitment</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${vehicle.year} ${vehicle.make} ${vehicle.model} — Acme Parts Co</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('none')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Dashboard</a> &rsaquo; Vehicle</div>
    <h1 class="page-title">${vehicle.year} ${vehicle.make} ${vehicle.model}</h1>
    <p class="page-subtitle">${vehicle.variant} — Engine: ${vehicle.engine_code}</p>

    <div class="card">
      <h2>Vehicle Specifications</h2>
      <div class="grid-3">
        <div><strong>Engine Code:</strong> ${vehicle.engine_code}</div>
        <div><strong>Fuel Type:</strong> ${vehicle.fuel_type}</div>
        <div><strong>Power:</strong> ${vehicle.power_hp} hp</div>
        <div><strong>Transmission:</strong> ${vehicle.transmission}</div>
        <div><strong>Body Type:</strong> ${vehicle.body_type}</div>
        <div><strong>Front Brakes:</strong> ${vehicle.front_disc_mm}mm ${vehicle.front_brake_type}</div>
        <div><strong>Rear Brakes:</strong> ${vehicle.rear_disc_mm}mm ${vehicle.rear_brake_type}</div>
      </div>
    </div>

    ${sections}
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Part Detail Page
// ═══════════════════════════════════════════════════════════════
export function renderPartPage(db: Database.Database, partNumber: string): string | null {
  const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(partNumber) as any;
  if (!part) return null;

  const vehicles = db.prepare(`
    SELECT v.*, vp.job_type FROM vehicles v
    JOIN vehicle_parts vp ON v.id = vp.vehicle_id
    WHERE vp.part_number = ?
  `).all(partNumber) as any[];

  const stock = db.prepare(`
    SELECT bs.*, b.address, b.phone, b.opening_hours
    FROM branch_stock bs
    JOIN branches b ON bs.branch = b.name
    WHERE bs.part_number = ?
    ORDER BY bs.qty DESC
  `).all(partNumber) as any[];

  const substitutes = db.prepare(`
    SELECT s.*, p.name, p.brand, p.price, p.currency
    FROM substitutes s
    JOIN parts p ON s.substitute_part = p.part_number
    WHERE s.original_part = ?
    ORDER BY s.fitment_confidence DESC
  `).all(partNumber) as any[];

  const reverseSubstitutes = db.prepare(`
    SELECT s.*, p.name, p.brand, p.price, p.currency
    FROM substitutes s
    JOIN parts p ON s.original_part = p.part_number
    WHERE s.substitute_part = ?
  `).all(partNumber) as any[];

  const typeBadge = part.type === 'oem'
    ? '<span class="badge badge-oem">OEM</span>'
    : '<span class="badge badge-aftermarket">Aftermarket</span>';

  const vehicleRows = vehicles.map((v: any) => `
    <tr>
      <td><a href="/vehicle/${v.id}">${v.year} ${v.make} ${v.model}</a></td>
      <td>${v.variant}</td>
      <td>${v.job_type.replace(/_/g, ' ')}</td>
    </tr>
  `).join('');

  const stockRows = stock.map((s: any) => `
    <tr>
      <td><a href="/branch/${encodeURIComponent(s.branch)}">${s.branch}</a></td>
      <td>${stockBadge(s.qty)}</td>
      <td>${s.qty > 0 && s.click_collect ? '✓ Ready in 30 min' : '—'}</td>
      <td>${s.next_day_delivery ? '✓' : '—'}</td>
    </tr>
  `).join('');

  const subRows = substitutes.map((s: any) => `
    <tr>
      <td><a href="/part/${s.substitute_part}">${s.brand} ${s.name}</a></td>
      <td><code>${s.substitute_part}</code></td>
      <td>${formatPrice(s.price)}</td>
      <td><strong>${s.fitment_confidence}%</strong></td>
      <td>${s.notes}</td>
    </tr>
  `).join('');

  const reverseSubRows = reverseSubstitutes.map((s: any) => `
    <tr>
      <td><a href="/part/${s.original_part}">${s.brand} ${s.name}</a></td>
      <td><code>${s.original_part}</code></td>
      <td>${formatPrice(s.price)}</td>
      <td>${s.fitment_confidence}%</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${part.brand} ${part.name} — Acme Parts Co</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('catalog')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Dashboard</a> &rsaquo; <a href="/catalog">Catalog</a> &rsaquo; <a href="/catalog/${part.category}">${part.category.replace(/_/g, ' ')}</a> &rsaquo; ${part.part_number}</div>

    <div class="card">
      <div class="part-detail-header">
        <div class="part-detail-info">
          <h1 class="page-title">${part.brand} ${part.name}</h1>
          <div class="part-detail-meta">
            ${typeBadge} &nbsp; <code>${part.part_number}</code>
            ${part.oem_ref ? ` &nbsp; OEM Ref: <code>${part.oem_ref}</code>` : ''}
            ${part.position ? ` &nbsp; Position: ${part.position}` : ''}
          </div>
          <p style="margin-top: 12px; color: #4b5563;">${part.description}</p>
        </div>
        <div style="text-align: right;">
          <div class="part-detail-price">${formatPrice(part.price)}</div>
          <div class="part-detail-meta">${part.currency} incl. VAT</div>
          <div class="part-detail-meta" style="margin-top: 8px;">Weight: ${part.weight_kg} kg</div>
          <div class="part-detail-meta">Fitment: ${part.fitment_confidence}%</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Compatible Vehicles</h2>
        ${vehicleRows ? `
          <table>
            <thead><tr><th>Vehicle</th><th>Variant</th><th>Job Type</th></tr></thead>
            <tbody>${vehicleRows}</tbody>
          </table>
        ` : '<p style="color: #6b7280;">No vehicle fitment data.</p>'}
      </div>

      <div class="card">
        <h2>Stock Availability</h2>
        ${stockRows ? `
          <table>
            <thead><tr><th>Branch</th><th>Status</th><th>Click & Collect</th><th>Next-Day</th></tr></thead>
            <tbody>${stockRows}</tbody>
          </table>
        ` : '<p style="color: #6b7280;">Not currently stocked.</p>'}
      </div>
    </div>

    ${subRows ? `
      <div class="card">
        <h2>Aftermarket Substitutes</h2>
        <table>
          <thead><tr><th>Part</th><th>Part #</th><th>Price</th><th>Fitment</th><th>Notes</th></tr></thead>
          <tbody>${subRows}</tbody>
        </table>
      </div>
    ` : ''}

    ${reverseSubRows ? `
      <div class="card">
        <h2>OEM Original</h2>
        <table>
          <thead><tr><th>Part</th><th>Part #</th><th>Price</th><th>Fitment</th></tr></thead>
          <tbody>${reverseSubRows}</tbody>
        </table>
      </div>
    ` : ''}
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Catalog Page
// ═══════════════════════════════════════════════════════════════
export function renderCatalogPage(db: Database.Database, category?: string): string {
  const categories = db.prepare('SELECT DISTINCT category FROM parts ORDER BY category').all() as { category: string }[];

  let parts: any[];
  if (category) {
    parts = db.prepare('SELECT * FROM parts WHERE category = ? ORDER BY type ASC, brand, name').all(category) as any[];
  } else {
    parts = db.prepare('SELECT * FROM parts ORDER BY category, type ASC, brand, name').all() as any[];
  }

  const categoryPills = categories.map(c => {
    const active = c.category === category ? ' active' : '';
    const label = c.category.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
    return `<a href="/catalog/${c.category}" class="category-pill${active}">${label}</a>`;
  }).join('');

  const rows = parts.map((p: any) => {
    const typeBadge = p.type === 'oem'
      ? '<span class="badge badge-oem">OEM</span>'
      : '<span class="badge badge-aftermarket">Aftermarket</span>';
    return `<tr>
      <td>${typeBadge}</td>
      <td><a href="/part/${p.part_number}">${p.brand} ${p.name}</a></td>
      <td><code>${p.part_number}</code></td>
      <td>${p.category.replace(/_/g, ' ')}</td>
      <td><strong>${formatPrice(p.price)}</strong></td>
      <td>${p.fitment_confidence}%</td>
    </tr>`;
  }).join('');

  const title = category
    ? category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : 'All Parts';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catalog: ${title} — Acme Parts Co</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('catalog')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Dashboard</a> &rsaquo; Catalog${category ? ` &rsaquo; ${title}` : ''}</div>
    <h1 class="page-title">${title}</h1>
    <p class="page-subtitle">${parts.length} parts found</p>

    <div class="category-pills">
      <a href="/catalog" class="category-pill${!category ? ' active' : ''}">All</a>
      ${categoryPills}
    </div>

    <div class="card">
      <table>
        <thead><tr><th>Type</th><th>Part</th><th>Part #</th><th>Category</th><th>Price</th><th>Fitment</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Branches Page
// ═══════════════════════════════════════════════════════════════
export function renderBranchesPage(db: Database.Database): string {
  const branches = db.prepare('SELECT * FROM branches ORDER BY name').all() as any[];

  const branchCards = branches.map((b: any) => {
    const stockCount = (db.prepare(
      'SELECT COUNT(DISTINCT part_number) as c FROM branch_stock WHERE branch = ? AND qty > 0'
    ).get(b.name) as any).c;

    return `
      <a href="/branch/${encodeURIComponent(b.name)}" class="vehicle-card">
        <div class="vehicle-title">${b.name}</div>
        <div class="branch-detail"><span>${b.address}</span></div>
        <div class="branch-detail" style="margin-top: 8px;"><span>📞 ${b.phone}</span></div>
        <div class="branch-detail"><span>🕐 ${b.opening_hours}</span></div>
        <div class="vehicle-specs">
          <span class="spec-tag">${stockCount} parts in stock</span>
        </div>
      </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Branches — Acme Parts Co</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('branches')}
  <div class="container">
    <h1 class="page-title">Our Branches</h1>
    <p class="page-subtitle">Click & Collect available at all locations</p>
    <div class="grid-2">
      ${branchCards}
    </div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Branch Detail Page
// ═══════════════════════════════════════════════════════════════
export function renderBranchDetailPage(db: Database.Database, branchName: string): string | null {
  const branch = db.prepare('SELECT * FROM branches WHERE name = ?').get(branchName) as any;
  if (!branch) return null;

  const stock = db.prepare(`
    SELECT bs.*, p.name, p.brand, p.category, p.price, p.currency, p.type
    FROM branch_stock bs
    JOIN parts p ON bs.part_number = p.part_number
    WHERE bs.branch = ?
    ORDER BY p.category, p.brand, p.name
  `).all(branchName) as any[];

  const inStock = stock.filter((s: any) => s.qty > 0);
  const outOfStock = stock.filter((s: any) => s.qty === 0);

  const rows = stock.map((s: any) => {
    const typeBadge = s.type === 'oem'
      ? '<span class="badge badge-oem">OEM</span>'
      : '<span class="badge badge-aftermarket">AM</span>';
    return `<tr>
      <td>${typeBadge}</td>
      <td><a href="/part/${s.part_number}">${s.brand} ${s.name}</a></td>
      <td><code>${s.part_number}</code></td>
      <td>${s.category.replace(/_/g, ' ')}</td>
      <td>${stockBadge(s.qty)}</td>
      <td>${formatPrice(s.price)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${branch.name} Branch — Acme Parts Co</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('branches')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Dashboard</a> &rsaquo; <a href="/branches">Branches</a> &rsaquo; ${branch.name}</div>
    <h1 class="page-title">${branch.name} Branch</h1>

    <div class="card">
      <div class="grid-2">
        <div>
          <h3>Contact</h3>
          <p style="margin-top: 8px;">📍 ${branch.address}</p>
          <p>📞 ${branch.phone}</p>
          <p>✉️ ${branch.email}</p>
        </div>
        <div>
          <h3>Hours</h3>
          <p style="margin-top: 8px;">🕐 ${branch.opening_hours}</p>
          <p>🏪 Collection: ${branch.click_collect_hours}</p>
        </div>
      </div>
    </div>

    <div class="grid-3" style="margin-bottom: 20px;">
      <div class="stat-card">
        <div class="stat-value">${stock.length}</div>
        <div class="stat-label">Parts Listed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: ${SUCCESS_COLOR};">${inStock.length}</div>
        <div class="stat-label">In Stock</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: ${WARNING_COLOR};">${outOfStock.length}</div>
        <div class="stat-label">Out of Stock</div>
      </div>
    </div>

    <div class="card">
      <h2>Stock Levels</h2>
      <table>
        <thead><tr><th>Type</th><th>Part</th><th>Part #</th><th>Category</th><th>Stock</th><th>Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Cart Page
// ═══════════════════════════════════════════════════════════════
export function renderCartPage(db: Database.Database, cartId: string): string | null {
  const cart = db.prepare('SELECT * FROM carts WHERE cart_id = ?').get(cartId) as any;
  if (!cart) return null;

  const items = db.prepare(`
    SELECT ci.*, p.name, p.brand, p.price, p.currency, p.weight_kg, p.category
    FROM cart_items ci
    JOIN parts p ON ci.part_number = p.part_number
    WHERE ci.cart_id = ?
  `).all(cartId) as any[];

  let total = 0;
  let totalWeight = 0;
  const rows = items.map((item: any) => {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;
    totalWeight += item.weight_kg * item.quantity;
    return `<tr>
      <td><a href="/part/${item.part_number}">${item.brand} ${item.name}</a></td>
      <td><code>${item.part_number}</code></td>
      <td>${item.category.replace(/_/g, ' ')}</td>
      <td>${item.quantity}</td>
      <td>${formatPrice(item.price)}</td>
      <td><strong>${formatPrice(lineTotal)}</strong></td>
    </tr>`;
  }).join('');

  const branchName = items[0]?.branch;
  let branchInfo = '';
  if (branchName) {
    const branch = db.prepare('SELECT * FROM branches WHERE name = ?').get(branchName) as any;
    if (branch) {
      branchInfo = `
        <div class="card">
          <h2>Collection Branch: ${branch.name}</h2>
          <p>📍 ${branch.address}</p>
          <p>📞 ${branch.phone}</p>
          <p>🏪 Collection hours: ${branch.click_collect_hours}</p>
        </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cart ${cartId} — Acme Parts Co</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('none')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Dashboard</a> &rsaquo; Cart</div>
    <h1 class="page-title">Cart: ${cartId}</h1>
    <p class="page-subtitle">Created ${cart.created_at}${cart.job_name ? ` — ${cart.job_name}` : ''}</p>

    <div class="card">
      <h2>Items (${items.length})</h2>
      <table>
        <thead><tr><th>Part</th><th>Part #</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="cart-summary">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; color: ${MUTED_COLOR};">${items.reduce((s: number, i: any) => s + i.quantity, 0)} items · ${totalWeight.toFixed(1)} kg total weight</div>
          </div>
          <div class="cart-total">${formatPrice(total)}</div>
        </div>
      </div>
    </div>

    ${branchInfo}
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}
