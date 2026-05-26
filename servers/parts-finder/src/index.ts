import { createServerApp } from '@mcp-demos/shared';
import { seedPartsData } from './data/seed.js';
import { registerPartsTools } from './tools.js';
import {
  renderDashboardPage,
  renderVehiclePage,
  renderPartPage,
  renderCatalogPage,
  renderBranchesPage,
  renderBranchDetailPage,
  renderCartPage,
} from './pages.js';

const PORT = parseInt(process.env['PORT'] || '3003', 10);

const { app, db, start } = createServerApp(
  (server, db, getSessionId) => {
    registerPartsTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Parts Co — Find the right part for your vehicle',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

seedPartsData(db);

// ── HTML Pages ───────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDashboardPage(db));
});

app.get('/vehicle/:vehicleId', (req, res) => {
  const html = renderVehiclePage(db, req.params.vehicleId);
  if (!html) { res.status(404).send('Vehicle not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/part/:partNumber', (req, res) => {
  const html = renderPartPage(db, req.params.partNumber);
  if (!html) { res.status(404).send('Part not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/catalog', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderCatalogPage(db));
});

app.get('/catalog/:category', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderCatalogPage(db, req.params.category));
});

app.get('/branches', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderBranchesPage(db));
});

app.get('/branch/:branchName', (req, res) => {
  const html = renderBranchDetailPage(db, decodeURIComponent(req.params.branchName));
  if (!html) { res.status(404).send('Branch not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/cart/:cartId', (req, res) => {
  const html = renderCartPage(db, req.params.cartId);
  if (!html) { res.status(404).send('Cart not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ── REST API ─────────────────────────────────────────────────

app.get('/api/vehicles', (_req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY make, model').all();
  res.json({ vehicles });
});

app.get('/api/vehicles/:id', (req, res) => {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
  if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return; }
  res.json(vehicle);
});

app.get('/api/parts', (req, res) => {
  const category = req.query.category as string | undefined;
  let parts;
  if (category) {
    parts = db.prepare('SELECT * FROM parts WHERE category = ? ORDER BY type, brand').all(category);
  } else {
    parts = db.prepare('SELECT * FROM parts ORDER BY category, type, brand').all();
  }
  res.json({ parts });
});

app.get('/api/parts/:partNumber', (req, res) => {
  const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(req.params.partNumber);
  if (!part) { res.status(404).json({ error: 'Part not found' }); return; }
  res.json(part);
});

app.get('/api/branches', (_req, res) => {
  const branches = db.prepare('SELECT * FROM branches ORDER BY name').all();
  res.json({ branches });
});

app.get('/api/branches/:name/stock', (req, res) => {
  const branchName = decodeURIComponent(req.params.name);
  const stock = db.prepare(`
    SELECT bs.*, p.name, p.brand, p.category, p.price, p.type
    FROM branch_stock bs
    JOIN parts p ON bs.part_number = p.part_number
    WHERE bs.branch = ?
    ORDER BY p.category, p.brand
  `).all(branchName);
  res.json({ branch: branchName, stock });
});

start();
