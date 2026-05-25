import { createServerApp } from '@mcp-demos/shared';
import { seedB2BData } from './data/seed.js';
import { registerB2BTools } from './tools.js';
import {
  renderQuotePage,
  renderTrackingPage,
  renderDashboardPage,
  renderCatalogPage,
  renderInvoicePage,
} from './pages.js';

const PORT = parseInt(process.env['PORT'] || '3002', 10);

const { app, db, start } = createServerApp(
  (server, db, getSessionId) => {
    registerB2BTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Industrial Supply — B2B reorder and quotes',
    serverVersion: '2.0.0',
    port: PORT,
  },
);

seedB2BData(db);

// ── UI Routes ──────────────────────────────────────────────────

app.get('/dashboard', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDashboardPage(db));
});

app.get('/quote/:quoteId', (req, res) => {
  const html = renderQuotePage(db, req.params.quoteId);
  if (!html) { res.status(404).send('Quote not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/track/:orderId', (req, res) => {
  const html = renderTrackingPage(db, req.params.orderId);
  if (!html) { res.status(404).send('Order not found'); return; }
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

app.get('/invoice/:invoiceId', (req, res) => {
  const html = renderInvoicePage(db, req.params.invoiceId);
  if (!html) { res.status(404).send('Invoice not found'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

start();
