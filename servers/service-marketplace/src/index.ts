import { createServerApp } from '@mcp-demos/shared';
import { seedServiceMarketplaceData } from './data/seed.js';
import { registerServiceMarketplaceTools } from './tools.js';
import {
  renderHomePage,
  renderProvidersPage,
  renderProviderDetailPage,
  renderBookingPage,
  renderCategoriesPage,
} from './pages.js';

const PORT = parseInt(process.env['PORT'] || '3004', 10);

const { app, db, start } = createServerApp(
  (server, db, getSessionId) => {
    registerServiceMarketplaceTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Home Services — Book a local tradesperson',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

seedServiceMarketplaceData(db);

// ── HTML Pages ───────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderHomePage(db));
});

app.get('/providers', (req, res) => {
  const category = req.query.category as string | undefined;
  res.setHeader('Content-Type', 'text/html');
  res.send(renderProvidersPage(db, category));
});

app.get('/provider/:id', (req, res) => {
  const html = renderProviderDetailPage(db, req.params.id);
  if (!html) { res.status(404).send('Provider not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/booking/:ref', (req, res) => {
  const html = renderBookingPage(db, req.params.ref);
  if (!html) { res.status(404).send('Booking not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/categories', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderCategoriesPage(db));
});

// ── REST API ─────────────────────────────────────────────────

app.get('/api/providers', (req, res) => {
  const category = req.query.category as string | undefined;
  let providers;
  if (category) {
    providers = db.prepare('SELECT * FROM providers WHERE job_type = ? ORDER BY rating DESC').all(category);
  } else {
    providers = db.prepare('SELECT * FROM providers ORDER BY rating DESC').all();
  }
  res.json({ providers });
});

app.get('/api/providers/:id', (req, res) => {
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  if (!provider) { res.status(404).json({ error: 'Provider not found' }); return; }
  res.json(provider);
});

app.get('/api/providers/:id/reviews', (req, res) => {
  const reviews = db.prepare('SELECT * FROM reviews WHERE provider_id = ? ORDER BY date DESC').all(req.params.id);
  res.json({ reviews });
});

app.get('/api/providers/:id/availability', (req, res) => {
  const slots = db.prepare(
    'SELECT * FROM availability WHERE provider_id = ? AND available = 1 ORDER BY day_offset, time_slot'
  ).all(req.params.id);
  res.json({ slots });
});

app.get('/api/bookings/:ref', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE booking_ref = ?').get(req.params.ref);
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
  res.json(booking);
});

app.get('/api/categories', (_req, res) => {
  const categories = db.prepare(
    'SELECT job_type, COUNT(*) as provider_count, AVG(rating) as avg_rating, MIN(hourly_rate) as min_rate, MAX(hourly_rate) as max_rate FROM providers GROUP BY job_type ORDER BY provider_count DESC'
  ).all();
  res.json({ categories });
});

start();
