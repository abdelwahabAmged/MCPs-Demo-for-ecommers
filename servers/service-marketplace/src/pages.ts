import type Database from 'better-sqlite3';

const BRAND_COLOR = '#0d6e6e';
const BRAND_DARK = '#094d4d';
const ACCENT_COLOR = '#f59e0b';
const SUCCESS_COLOR = '#059669';
const MUTED_COLOR = '#6b7280';

function baseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; background: #f9fafb; line-height: 1.6; }
    a { color: ${BRAND_COLOR}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .site-header { background: ${BRAND_COLOR}; color: white; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
    .site-header-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; height: 60px; gap: 32px; }
    .site-header .logo { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: white; text-decoration: none; display: flex; align-items: center; gap: 10px; }
    .site-header .logo:hover { text-decoration: none; opacity: 0.9; }
    .site-header .logo svg { width: 26px; height: 26px; }
    .site-nav { display: flex; gap: 4px; flex: 1; }
    .site-nav a { color: rgba(255,255,255,0.75); font-size: 14px; font-weight: 500; padding: 8px 16px; border-radius: 6px; text-decoration: none; transition: all 0.15s; }
    .site-nav a:hover { color: white; background: rgba(255,255,255,0.1); text-decoration: none; }
    .site-nav a.active { color: white; background: rgba(255,255,255,0.18); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #111827; }
    .page-subtitle { font-size: 14px; color: ${MUTED_COLOR}; margin-bottom: 24px; }
    .card { background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 24px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .card h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #111827; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-confirmed { background: #d1fae5; color: ${SUCCESS_COLOR}; }
    .badge-completed { background: #dbeafe; color: #1d4ed8; }
    .badge-cancelled { background: #fee2e2; color: #dc2626; }
    .badge-inprogress { background: #fef3c7; color: #d97706; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .stat-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e5e7eb; text-align: center; }
    .stat-card .stat-value { font-size: 28px; font-weight: 700; color: ${BRAND_COLOR}; }
    .stat-card .stat-label { font-size: 13px; color: ${MUTED_COLOR}; margin-top: 4px; }
    .provider-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e5e7eb; transition: all 0.15s; display: block; color: inherit; text-decoration: none; }
    .provider-card:hover { border-color: ${BRAND_COLOR}; box-shadow: 0 4px 12px rgba(13,110,110,0.1); text-decoration: none; }
    .provider-card .prov-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }
    .provider-card .prov-trade { font-size: 13px; color: ${MUTED_COLOR}; text-transform: capitalize; }
    .provider-card .prov-rating { margin-top: 8px; font-size: 14px; color: ${ACCENT_COLOR}; }
    .provider-card .prov-meta { margin-top: 8px; font-size: 13px; color: #4b5563; }
    .provider-card .prov-tags { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
    .provider-card .tag { font-size: 11px; background: #f3f4f6; padding: 3px 8px; border-radius: 4px; color: #4b5563; }
    .provider-card .tag.avail { background: #d1fae5; color: ${SUCCESS_COLOR}; }
    .category-card { background: white; border-radius: 10px; padding: 24px; border: 1px solid #e5e7eb; text-align: center; transition: all 0.15s; display: block; color: inherit; text-decoration: none; }
    .category-card:hover { border-color: ${BRAND_COLOR}; box-shadow: 0 4px 12px rgba(13,110,110,0.1); text-decoration: none; }
    .category-card .cat-icon { font-size: 32px; margin-bottom: 8px; }
    .category-card .cat-name { font-size: 15px; font-weight: 700; color: #111827; text-transform: capitalize; }
    .category-card .cat-meta { font-size: 12px; color: ${MUTED_COLOR}; margin-top: 4px; }
    .stars { color: ${ACCENT_COLOR}; }
    .review-card { border-bottom: 1px solid #f3f4f6; padding: 16px 0; }
    .review-card:last-child { border-bottom: none; }
    .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .review-name { font-weight: 600; font-size: 14px; }
    .review-date { font-size: 12px; color: ${MUTED_COLOR}; }
    .review-comment { font-size: 14px; color: #4b5563; font-style: italic; }
    .hero { background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_DARK} 100%); color: white; padding: 48px; border-radius: 12px; margin-bottom: 32px; }
    .hero h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
    .hero p { font-size: 16px; opacity: 0.85; max-width: 600px; }
    .breadcrumb { font-size: 13px; color: ${MUTED_COLOR}; margin-bottom: 16px; }
    .breadcrumb a { color: ${BRAND_COLOR}; }
    .avail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .avail-day { background: #f9fafb; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb; }
    .avail-day .day-name { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px; }
    .avail-day .slots { display: flex; gap: 6px; flex-wrap: wrap; }
    .avail-day .slot { font-size: 12px; background: ${BRAND_COLOR}; color: white; padding: 3px 8px; border-radius: 4px; }
    .demo-badge { position: fixed; bottom: 16px; right: 16px; background: ${BRAND_COLOR}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; opacity: 0.8; z-index: 200; }
    @media print { .site-header, .demo-badge { display: none !important; } body { background: white; } }
    @media (max-width: 768px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } .site-nav { display: none; } .hero { padding: 24px; } .hero h1 { font-size: 22px; } }
  `;
}

type ActivePage = 'home' | 'providers' | 'categories' | 'none';

const LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

function siteHeader(active: ActivePage): string {
  const nav = (href: string, label: string, page: ActivePage) =>
    `<a href="${href}" class="${active === page ? 'active' : ''}">${label}</a>`;

  return `
  <div class="site-header">
    <div class="site-header-inner">
      <a href="/" class="logo">${LOGO_SVG} Acme Home Services</a>
      <nav class="site-nav">
        ${nav('/', 'Home', 'home')}
        ${nav('/providers', 'Providers', 'providers')}
        ${nav('/categories', 'Categories', 'categories')}
      </nav>
    </div>
  </div>`;
}

function starHtml(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return `<span class="stars">${'★'.repeat(full)}${half ? '½' : ''}${'☆'.repeat(5 - full - half)}</span> ${rating}/5`;
}

function getDayName(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

const CATEGORY_ICONS: Record<string, string> = {
  'plumbing': '🔧',
  'electrical': '⚡',
  'boiler/heating': '🔥',
  'general building': '🏗️',
  'painting/decorating': '🎨',
  'roofing': '🏠',
  'locksmith': '🔑',
  'window cleaning': '🪟',
};

// ═══════════════════════════════════════════════════════════════
// Home Page
// ═══════════════════════════════════════════════════════════════
export function renderHomePage(db: Database.Database): string {
  const providerCount = (db.prepare('SELECT COUNT(*) as c FROM providers').get() as any).c;
  const reviewCount = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as any).c;
  const avgRating = (db.prepare('SELECT AVG(rating) as avg FROM providers').get() as any).avg;
  const completedBookings = (db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'completed'").get() as any).c;

  const categories = db.prepare(
    'SELECT job_type, COUNT(*) as cnt, AVG(hourly_rate) as avg_rate FROM providers GROUP BY job_type ORDER BY cnt DESC'
  ).all() as any[];

  const featured = db.prepare('SELECT * FROM providers ORDER BY rating DESC LIMIT 3').all() as any[];

  const categoryCards = categories.map((c: any) => `
    <a href="/providers?category=${encodeURIComponent(c.job_type)}" class="category-card">
      <div class="cat-icon">${CATEGORY_ICONS[c.job_type] || '🛠️'}</div>
      <div class="cat-name">${c.job_type}</div>
      <div class="cat-meta">${c.cnt} provider${c.cnt > 1 ? 's' : ''} · from £${Math.round(c.avg_rate)}/hr</div>
    </a>
  `).join('');

  const featuredCards = featured.map((p: any) => {
    const topReview = db.prepare('SELECT comment, reviewer_name FROM reviews WHERE provider_id = ? ORDER BY rating DESC LIMIT 1').get(p.id) as any;
    return `
    <a href="/provider/${p.id}" class="provider-card">
      <div class="prov-name">${p.name}</div>
      <div class="prov-trade">${p.job_type}</div>
      <div class="prov-rating">${starHtml(p.rating)} (${p.review_count} reviews)</div>
      <div class="prov-meta">£${p.hourly_rate}/hr · ${p.response_time}</div>
      ${topReview ? `<div class="prov-meta" style="margin-top: 8px; font-style: italic;">"${topReview.comment.substring(0, 60)}..."</div>` : ''}
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acme Home Services — Book a local tradesperson</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('home')}
  <div class="container">
    <div class="hero">
      <h1>Find trusted tradespeople, book in seconds</h1>
      <p>Search by trade, check availability, and book — all without filling in a single form. Rated, reviewed, and ready to work.</p>
    </div>

    <div class="grid-4">
      <div class="stat-card"><div class="stat-value">${providerCount}</div><div class="stat-label">Verified Providers</div></div>
      <div class="stat-card"><div class="stat-value">${avgRating.toFixed(1)}</div><div class="stat-label">Average Rating</div></div>
      <div class="stat-card"><div class="stat-value">${reviewCount}</div><div class="stat-label">Reviews</div></div>
      <div class="stat-card"><div class="stat-value">${completedBookings}+</div><div class="stat-label">Jobs Completed</div></div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <h2>Browse by Category</h2>
      <div class="grid-4">${categoryCards}</div>
    </div>

    <div class="card">
      <h2>Top Rated Providers</h2>
      <div class="grid-3">${featuredCards}</div>
    </div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Providers Listing Page
// ═══════════════════════════════════════════════════════════════
export function renderProvidersPage(db: Database.Database, category?: string): string {
  let providers: any[];
  if (category) {
    providers = db.prepare('SELECT * FROM providers WHERE job_type = ? ORDER BY rating DESC').all(category) as any[];
  } else {
    providers = db.prepare('SELECT * FROM providers ORDER BY rating DESC').all() as any[];
  }

  const categories = db.prepare('SELECT DISTINCT job_type FROM providers ORDER BY job_type').all() as { job_type: string }[];

  const categoryPills = categories.map(c => {
    const active = c.job_type === category ? ' active' : '';
    return `<a href="/providers?category=${encodeURIComponent(c.job_type)}" class="tag${active}" style="padding: 6px 14px; border-radius: 20px; font-size: 13px; ${c.job_type === category ? `background: ${BRAND_COLOR}; color: white;` : ''}">${c.job_type}</a>`;
  }).join(' ');

  const cards = providers.map((p: any) => {
    const weekendSlots = (db.prepare(
      'SELECT COUNT(*) as c FROM availability WHERE provider_id = ? AND available = 1 AND day_offset IN (5, 6)'
    ).get(p.id) as any).c;

    const certs = p.certifications ? p.certifications.split(',').slice(0, 2) : [];

    return `
    <a href="/provider/${p.id}" class="provider-card">
      <div class="prov-name">${p.name}</div>
      <div class="prov-trade">${p.job_type}</div>
      <div class="prov-rating">${starHtml(p.rating)} (${p.review_count} reviews)</div>
      <div class="prov-meta">£${p.hourly_rate}/hr${p.callout_fee ? ` + £${p.callout_fee} call-out` : ''} · ${p.response_time}</div>
      <div class="prov-meta">📍 ${p.location.replace(/,/g, ', ')}</div>
      <div class="prov-tags">
        ${certs.map((c: string) => `<span class="tag">${c.trim()}</span>`).join('')}
        ${weekendSlots > 0 ? '<span class="tag avail">Weekend slots</span>' : ''}
      </div>
    </a>`;
  }).join('');

  const title = category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Providers` : 'All Providers';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Acme Home Services</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('providers')}
  <div class="container">
    <h1 class="page-title">${title}</h1>
    <p class="page-subtitle">${providers.length} provider${providers.length !== 1 ? 's' : ''} available</p>

    <div style="margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
      <a href="/providers" class="tag" style="padding: 6px 14px; border-radius: 20px; font-size: 13px; ${!category ? `background: ${BRAND_COLOR}; color: white;` : ''}">All</a>
      ${categoryPills}
    </div>

    <div class="grid-2">${cards}</div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Provider Detail Page
// ═══════════════════════════════════════════════════════════════
export function renderProviderDetailPage(db: Database.Database, providerId: string): string | null {
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(providerId) as any;
  if (!provider) return null;

  const reviews = db.prepare('SELECT * FROM reviews WHERE provider_id = ? ORDER BY date DESC').all(providerId) as any[];
  const slots = db.prepare(
    'SELECT * FROM availability WHERE provider_id = ? AND available = 1 ORDER BY day_offset, time_slot'
  ).all(providerId) as any[];

  const specialisms = provider.specialisms.split(',').map((s: string) => `<span class="tag">${s.trim()}</span>`).join(' ');
  const certs = provider.certifications.split(',').map((s: string) => `<li style="margin-bottom: 4px;">✓ ${s.trim()}</li>`).join('');
  const sampleJobs = provider.sample_jobs.split(',').map((s: string) => `<li style="margin-bottom: 6px;">${s.trim()}</li>`).join('');

  const grouped = new Map<number, string[]>();
  for (const slot of slots) {
    const existing = grouped.get(slot.day_offset) ?? [];
    existing.push(slot.time_slot);
    grouped.set(slot.day_offset, existing);
  }

  const availHtml = grouped.size > 0
    ? Array.from(grouped.entries()).map(([offset, times]) => `
        <div class="avail-day">
          <div class="day-name">${getDayName(offset)}</div>
          <div class="slots">${times.map(t => `<span class="slot">${t}</span>`).join('')}</div>
        </div>
      `).join('')
    : '<p style="color: #6b7280;">No slots available in the next 7 days.</p>';

  const reviewHtml = reviews.length > 0
    ? reviews.map((r: any) => `
        <div class="review-card">
          <div class="review-header">
            <span class="review-name">${r.reviewer_name} · <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></span>
            <span class="review-date">${r.date} · ${r.job_type}</span>
          </div>
          <div class="review-comment">"${r.comment}"</div>
        </div>
      `).join('')
    : '<p style="color: #6b7280;">No reviews yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${provider.name} — Acme Home Services</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('providers')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/providers">Providers</a> &rsaquo; ${provider.name}</div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 class="page-title">${provider.name}</h1>
          <div style="margin-top: 4px;">${starHtml(provider.rating)} (${provider.review_count} reviews) · ${provider.years_in_business} years experience</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 700; color: ${BRAND_COLOR};">£${provider.hourly_rate}/hr</div>
          <div style="font-size: 13px; color: ${MUTED_COLOR};">${provider.callout_fee ? `+ £${provider.callout_fee} call-out` : 'No call-out fee'}</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>About</h2>
        <p style="color: #4b5563;">${provider.bio}</p>
        <h3 style="margin-top: 16px; font-size: 14px; font-weight: 600;">Specialisms</h3>
        <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">${specialisms}</div>
      </div>
      <div class="card">
        <h2>Details</h2>
        <table>
          <tr><td style="font-weight: 600; width: 40%;">Trade</td><td>${provider.job_type}</td></tr>
          <tr><td style="font-weight: 600;">Areas</td><td>${provider.location.replace(/,/g, ', ')} (${provider.coverage_radius_miles} mi)</td></tr>
          <tr><td style="font-weight: 600;">Response</td><td>${provider.response_time}</td></tr>
          <tr><td style="font-weight: 600;">Insurance</td><td>${provider.insurance}</td></tr>
          <tr><td style="font-weight: 600;">Phone</td><td>${provider.phone}</td></tr>
          <tr><td style="font-weight: 600;">Website</td><td>${provider.website}</td></tr>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Certifications</h2>
      <ul style="list-style: none; columns: 2;">${certs}</ul>
    </div>

    <div class="card">
      <h2>Availability (Next 7 Days)</h2>
      <div class="avail-grid">${availHtml}</div>
    </div>

    <div class="card">
      <h2>Sample Completed Jobs</h2>
      <ul style="list-style: none; color: #4b5563;">${sampleJobs}</ul>
    </div>

    <div class="card">
      <h2>Reviews (${reviews.length})</h2>
      ${reviewHtml}
    </div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Booking Page
// ═══════════════════════════════════════════════════════════════
export function renderBookingPage(db: Database.Database, bookingRef: string): string | null {
  const booking = db.prepare('SELECT * FROM bookings WHERE booking_ref = ?').get(bookingRef) as any;
  if (!booking) return null;

  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(booking.provider_id) as any;

  const statusBadge = {
    confirmed: '<span class="badge badge-confirmed">Confirmed</span>',
    completed: '<span class="badge badge-completed">Completed</span>',
    cancelled: '<span class="badge badge-cancelled">Cancelled</span>',
    in_progress: '<span class="badge badge-inprogress">In Progress</span>',
  }[booking.status] || `<span class="badge">${booking.status}</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking ${booking.booking_ref} — Acme Home Services</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('none')}
  <div class="container">
    <div class="breadcrumb"><a href="/">Home</a> &rsaquo; Booking</div>
    <h1 class="page-title">Booking: ${booking.booking_ref}</h1>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0;">Booking Details</h2>
        ${statusBadge}
      </div>
      <table>
        <tr><td style="font-weight: 600; width: 35%;">Reference</td><td><code>${booking.booking_ref}</code></td></tr>
        <tr><td style="font-weight: 600;">Provider</td><td>${provider ? `<a href="/provider/${provider.id}">${booking.provider_name}</a>` : booking.provider_name}</td></tr>
        <tr><td style="font-weight: 600;">Date & Time</td><td>${booking.date} at ${booking.time}</td></tr>
        <tr><td style="font-weight: 600;">Job</td><td>${booking.job_description}</td></tr>
        <tr><td style="font-weight: 600;">Estimated Cost</td><td><strong>£${booking.estimated_cost}</strong></td></tr>
        ${booking.customer_name ? `<tr><td style="font-weight: 600;">Customer</td><td>${booking.customer_name}</td></tr>` : ''}
        ${booking.address ? `<tr><td style="font-weight: 600;">Address</td><td>${booking.address}</td></tr>` : ''}
      </table>
      ${booking.notes ? `<div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 13px; color: #4b5563;"><strong>Notes:</strong> ${booking.notes}</div>` : ''}
    </div>

    ${provider ? `
    <div class="card">
      <h2>Provider Contact</h2>
      <table>
        <tr><td style="font-weight: 600; width: 35%;">Name</td><td><a href="/provider/${provider.id}">${provider.name}</a></td></tr>
        <tr><td style="font-weight: 600;">Phone</td><td>${provider.phone}</td></tr>
        <tr><td style="font-weight: 600;">Response Time</td><td>${provider.response_time}</td></tr>
        <tr><td style="font-weight: 600;">Rating</td><td>${starHtml(provider.rating)} (${provider.review_count} reviews)</td></tr>
      </table>
    </div>` : ''}
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// Categories Page
// ═══════════════════════════════════════════════════════════════
export function renderCategoriesPage(db: Database.Database): string {
  const categories = db.prepare(`
    SELECT job_type, COUNT(*) as cnt, AVG(rating) as avg_rating,
           MIN(hourly_rate) as min_rate, MAX(hourly_rate) as max_rate,
           AVG(hourly_rate) as avg_rate
    FROM providers GROUP BY job_type ORDER BY cnt DESC
  `).all() as any[];

  const cards = categories.map((c: any) => {
    const providerNames = (db.prepare('SELECT name FROM providers WHERE job_type = ? ORDER BY rating DESC LIMIT 3').all(c.job_type) as any[]).map((p: any) => p.name);

    return `
    <div class="card">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <span style="font-size: 28px;">${CATEGORY_ICONS[c.job_type] || '🛠️'}</span>
        <div>
          <h2 style="margin: 0; text-transform: capitalize;">${c.job_type}</h2>
          <div style="font-size: 13px; color: ${MUTED_COLOR};">${c.cnt} provider${c.cnt > 1 ? 's' : ''} · Avg rating ${c.avg_rating.toFixed(1)}/5</div>
        </div>
      </div>
      <table>
        <tr><td style="font-weight: 600;">Price range</td><td>£${Math.round(c.min_rate)} – £${Math.round(c.max_rate)}/hr</td></tr>
        <tr><td style="font-weight: 600;">Top providers</td><td>${providerNames.join(', ')}</td></tr>
      </table>
      <div style="margin-top: 12px;"><a href="/providers?category=${encodeURIComponent(c.job_type)}" style="font-size: 13px; font-weight: 600;">View all ${c.job_type} providers →</a></div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Categories — Acme Home Services</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader('categories')}
  <div class="container">
    <h1 class="page-title">Service Categories</h1>
    <p class="page-subtitle">${categories.length} categories available across Greater Manchester</p>
    <div class="grid-2">${cards}</div>
  </div>
  <div class="demo-badge">Preview Environment</div>
</body>
</html>`;
}
