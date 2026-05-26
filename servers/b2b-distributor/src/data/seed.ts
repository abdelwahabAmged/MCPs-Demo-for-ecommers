import type Database from 'better-sqlite3';
import { seedTableRaw } from '@mcp-demos/shared';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJSON<T>(filename: string): T {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

interface ProductRow {
  sku: string; name: string; brand: string; category: string;
  description: string; list_price: number; unit: string;
  lead_time_days: number; min_order_qty: number; weight_kg: number;
  specifications: Record<string, unknown>;
}

interface OrderRow {
  order_id: string; account_id: string; status: string;
  order_date: string; delivery_date: string | null; total: number;
  currency: string; po_number: string; carrier: string | null;
  tracking_number: string | null; delivery_address_id: string;
  items: Array<{ sku: string; name: string; qty: number; unit_price: number }>;
  tracking_milestones: Array<{ status: string; timestamp: string; note: string }>;
}

interface InvoiceRow {
  invoice_id: string; order_id: string; account_id: string;
  issue_date: string; due_date: string; paid_date: string | null;
  amount: number; vat: number; total_inc_vat: number;
  currency: string; status: string;
}

interface AddressRow {
  address_id: string; account_id: string; label: string;
  line1: string; line2: string; city: string; postcode: string;
  country: string; contact_name: string; contact_phone: string;
  is_default: boolean;
}

export function seedB2BData(db: Database.Database): void {
  const products = loadJSON<ProductRow[]>('products.json');
  const orders = loadJSON<OrderRow[]>('orders.json');
  const invoices = loadJSON<InvoiceRow[]>('invoices.json');
  const addresses = loadJSON<AddressRow[]>('addresses.json');

  // ── Account ──────────────────────────────────────────────────
  seedTableRaw(db, 'accounts', `
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      credit_limit REAL NOT NULL,
      balance REAL NOT NULL,
      payment_terms TEXT NOT NULL,
      currency TEXT DEFAULT 'GBP',
      rep_name TEXT NOT NULL,
      rep_email TEXT NOT NULL,
      open_orders INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'Tier 2',
      ytd_spend REAL DEFAULT 0,
      last_order_date TEXT
    )
  `, [{
    account_id: 'ACME-ACC-00441',
    name: 'Hargreaves Engineering Ltd',
    credit_limit: 50000,
    balance: 12340,
    payment_terms: 'Net 30',
    currency: 'GBP',
    rep_name: 'James Whitfield',
    rep_email: 'j.whitfield@acmeindustrial.com',
    open_orders: 5,
    tier: 'Tier 2',
    ytd_spend: 10880.76,
    last_order_date: '2026-05-23',
  }]);

  // ── Products / SKUs ──────────────────────────────────────────
  seedTableRaw(db, 'products', `
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      list_price REAL NOT NULL,
      unit TEXT DEFAULT 'each',
      lead_time_days INTEGER DEFAULT 1,
      min_order_qty INTEGER DEFAULT 1,
      weight_kg REAL DEFAULT 0,
      specifications TEXT DEFAULT '{}'
    )
  `, products.map(p => ({
    ...p,
    specifications: JSON.stringify(p.specifications),
  })));

  // ── Contract Pricing ─────────────────────────────────────────
  seedTableRaw(db, 'contract_pricing', `
    CREATE TABLE IF NOT EXISTS contract_pricing (
      account_id TEXT NOT NULL,
      category TEXT NOT NULL,
      discount_pct REAL NOT NULL,
      tier TEXT NOT NULL,
      PRIMARY KEY (account_id, category)
    )
  `, [
    { account_id: 'ACME-ACC-00441', category: 'bearings',    discount_pct: 8,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'seals',       discount_pct: 5,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'belts',       discount_pct: 3,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'fasteners',   discount_pct: 0,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'lubricants',  discount_pct: 0,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'filters',     discount_pct: 0,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'pneumatics',  discount_pct: 6,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'electrical',  discount_pct: 4,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'abrasives',   discount_pct: 0,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'safety',      discount_pct: 0,  tier: 'Tier 2' },
  ]);

  // ── Warehouse Stock ──────────────────────────────────────────
  const warehouses = ['Manchester', 'Birmingham', 'Glasgow'];
  const stockRows: Array<{ sku: string; warehouse: string; qty: number }> = [];

  for (const p of products) {
    const base = getBaseStock(p.category, p.list_price);
    stockRows.push({ sku: p.sku, warehouse: 'Manchester', qty: base });
    stockRows.push({ sku: p.sku, warehouse: 'Birmingham', qty: Math.floor(base * 0.4) });
    stockRows.push({ sku: p.sku, warehouse: 'Glasgow',    qty: Math.floor(base * 0.15) });
  }

  // BRG-6205-ZZ: low in Manchester (60), plentiful in Birmingham (120) for split-fulfillment demo
  setStock(stockRows, 'BRG-6205-ZZ', 'Manchester', 60);
  setStock(stockRows, 'BRG-6205-ZZ', 'Birmingham', 120);

  // Deliberately set some SKUs low/zero for demo flows
  setStock(stockRows, 'FILT-DUST-CART', 'Manchester', 2);
  setStock(stockRows, 'FILT-DUST-CART', 'Birmingham', 0);
  setStock(stockRows, 'FILT-DUST-CART', 'Glasgow', 0);
  setStock(stockRows, 'ELEC-VFD-2-2', 'Manchester', 3);
  setStock(stockRows, 'ELEC-VFD-2-2', 'Birmingham', 0);
  setStock(stockRows, 'ELEC-VFD-2-2', 'Glasgow', 0);
  setStock(stockRows, 'PNEU-CYL-63x200', 'Manchester', 4);
  setStock(stockRows, 'PNEU-CYL-63x200', 'Birmingham', 1);
  setStock(stockRows, 'PNEU-CYL-63x200', 'Glasgow', 0);
  setStock(stockRows, 'BRG-22212-E1', 'Manchester', 6);
  setStock(stockRows, 'BRG-22212-E1', 'Birmingham', 0);
  setStock(stockRows, 'BRG-22212-E1', 'Glasgow', 0);
  setStock(stockRows, 'LUB-SYNTH-ISO68-20L', 'Manchester', 8);
  setStock(stockRows, 'LUB-SYNTH-ISO68-20L', 'Birmingham', 2);
  setStock(stockRows, 'LUB-SYNTH-ISO68-20L', 'Glasgow', 0);

  seedTableRaw(db, 'warehouse_stock', `
    CREATE TABLE IF NOT EXISTS warehouse_stock (
      sku TEXT NOT NULL,
      warehouse TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (sku, warehouse)
    )
  `, stockRows);

  // ── Substitute Parts ─────────────────────────────────────────
  seedTableRaw(db, 'substitutes', `
    CREATE TABLE IF NOT EXISTS substitutes (
      sku TEXT NOT NULL,
      substitute_sku TEXT NOT NULL,
      notes TEXT,
      PRIMARY KEY (sku, substitute_sku)
    )
  `, [
    { sku: 'BRG-6205-ZZ',      substitute_sku: 'BRG-6205-2RS',     notes: 'Rubber-sealed variant, suitable for dusty environments' },
    { sku: 'BRG-6205-2RS',     substitute_sku: 'BRG-6205-ZZ',      notes: 'Metal-shielded variant, higher speed rating' },
    { sku: 'BELT-A-1250',      substitute_sku: 'BELT-A-1250-GATES', notes: 'Gates Hi-Power equivalent, longer service life' },
    { sku: 'BELT-A-1250-GATES', substitute_sku: 'BELT-A-1250',     notes: 'Standard classical belt, cost-effective replacement' },
    { sku: 'SEAL-V-25x42',     substitute_sku: 'SEAL-V-30x47',     notes: 'Larger ring, suitable for 30 mm shafts' },
    { sku: 'ABRA-CUT-230',     substitute_sku: 'ABRA-CUT-125',     notes: 'Smaller disc for 125 mm angle grinders' },
    { sku: 'ABRA-FLAP-P60',    substitute_sku: 'ABRA-FLAP-P120',   notes: 'Finer grit for finishing passes' },
    { sku: 'ABRA-FLAP-P120',   substitute_sku: 'ABRA-FLAP-P60',    notes: 'Coarser grit for heavy material removal' },
    { sku: 'ELEC-CONT-9A',     substitute_sku: 'ELEC-CONT-25A',    notes: 'Higher-rated contactor, fits same DIN rail' },
    { sku: 'LUB-EP2-400G',     substitute_sku: 'LUB-CHAIN-SPRAY',  notes: 'Spray alternative for chain/cable lubrication only' },
    { sku: 'PNEU-CYL-32x100',  substitute_sku: 'PNEU-CYL-63x200', notes: 'Larger bore/stroke for higher force applications' },
    { sku: 'FILT-HYD-10M',     substitute_sku: 'FILT-OIL-W940',    notes: 'Oil filter alternative for engine applications' },
    { sku: 'SAFE-GLOVE-CUT5',  substitute_sku: 'SAFE-GLOVE-NITR',  notes: 'Chemical-resistant alternative, lower cut protection' },
    { sku: 'SAFE-GLOVE-NITR',  substitute_sku: 'SAFE-GLOVE-CUT5',  notes: 'Cut-resistant alternative for sharp material handling' },
    { sku: 'FAST-M10x30-A2',   substitute_sku: 'FAST-M12x50-88',   notes: 'Larger high-tensile bolt for structural applications' },
    { sku: 'BRG-7206-BEP',     substitute_sku: 'BRG-30205-J2',     notes: 'Tapered roller bearing for combined load applications' },
  ]);

  // ── Orders ───────────────────────────────────────────────────
  seedTableRaw(db, 'orders', `
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      order_date TEXT NOT NULL,
      delivery_date TEXT,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      po_number TEXT,
      carrier TEXT,
      tracking_number TEXT,
      delivery_address_id TEXT,
      items TEXT NOT NULL,
      tracking_milestones TEXT DEFAULT '[]'
    )
  `, orders.map(o => ({
    ...o,
    items: JSON.stringify(o.items),
    tracking_milestones: JSON.stringify(o.tracking_milestones),
  })));

  // ── Invoices ─────────────────────────────────────────────────
  seedTableRaw(db, 'invoices', `
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      amount REAL NOT NULL,
      vat REAL NOT NULL DEFAULT 0,
      total_inc_vat REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      status TEXT NOT NULL DEFAULT 'open'
    )
  `, invoices as unknown as Record<string, unknown>[]);

  // ── Delivery Addresses ───────────────────────────────────────
  seedTableRaw(db, 'delivery_addresses', `
    CREATE TABLE IF NOT EXISTS delivery_addresses (
      address_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      label TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT NOT NULL,
      postcode TEXT NOT NULL,
      country TEXT DEFAULT 'GB',
      contact_name TEXT,
      contact_phone TEXT,
      is_default INTEGER DEFAULT 0
    )
  `, addresses.map(a => ({ ...a, is_default: a.is_default ? 1 : 0 })));

  // ── Reorder Patterns (pre-computed consumption data) ─────────
  seedTableRaw(db, 'reorder_patterns', `
    CREATE TABLE IF NOT EXISTS reorder_patterns (
      sku TEXT PRIMARY KEY,
      avg_order_qty INTEGER NOT NULL,
      avg_interval_days INTEGER NOT NULL,
      last_ordered TEXT NOT NULL,
      next_predicted TEXT NOT NULL,
      times_ordered INTEGER NOT NULL
    )
  `, [
    { sku: 'BRG-6205-ZZ',   avg_order_qty: 75,  avg_interval_days: 60,  last_ordered: '2026-04-11', next_predicted: '2026-06-10', times_ordered: 8 },
    { sku: 'SEAL-V-25x42',  avg_order_qty: 150, avg_interval_days: 60,  last_ordered: '2026-04-11', next_predicted: '2026-06-10', times_ordered: 7 },
    { sku: 'LUB-EP2-400G',  avg_order_qty: 12,  avg_interval_days: 45,  last_ordered: '2026-05-20', next_predicted: '2026-07-04', times_ordered: 6 },
    { sku: 'BRG-22212-E1',  avg_order_qty: 15,  avg_interval_days: 90,  last_ordered: '2026-01-15', next_predicted: '2026-04-15', times_ordered: 3 },
    { sku: 'FILT-HYD-10M',  avg_order_qty: 10,  avg_interval_days: 90,  last_ordered: '2026-01-15', next_predicted: '2026-04-15', times_ordered: 3 },
    { sku: 'BRG-6304-2RS',  avg_order_qty: 40,  avg_interval_days: 75,  last_ordered: '2026-02-10', next_predicted: '2026-04-26', times_ordered: 4 },
    { sku: 'FAST-M10x30-A2', avg_order_qty: 8,  avg_interval_days: 120, last_ordered: '2026-02-10', next_predicted: '2026-06-10', times_ordered: 3 },
    { sku: 'ABRA-CUT-125',  avg_order_qty: 5,   avg_interval_days: 90,  last_ordered: '2026-05-16', next_predicted: '2026-08-14', times_ordered: 3 },
    { sku: 'SAFE-GLOVE-CUT5', avg_order_qty: 6, avg_interval_days: 90,  last_ordered: '2026-05-16', next_predicted: '2026-08-14', times_ordered: 3 },
    { sku: 'LUB-HYD-ISO46-5L', avg_order_qty: 8, avg_interval_days: 90, last_ordered: '2026-01-15', next_predicted: '2026-04-15', times_ordered: 3 },
    { sku: 'BELT-A-1250',   avg_order_qty: 15,  avg_interval_days: 120, last_ordered: '2026-02-10', next_predicted: '2026-06-10', times_ordered: 2 },
  ]);

  // ── Quotes (created at runtime) ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      quote_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      items TEXT NOT NULL,
      delivery_address_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      session_id TEXT
    )
  `);

  // ── Rep Escalations (created at runtime) ─────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS rep_escalations (
      escalation_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      rep_name TEXT NOT NULL,
      message TEXT NOT NULL,
      urgency TEXT DEFAULT 'medium',
      topic TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      session_id TEXT
    )
  `);

  // ── Backorders (created at runtime) ──────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS backorders (
      backorder_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      expected_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      session_id TEXT
    )
  `);
}

function getBaseStock(category: string, price: number): number {
  const stockMap: Record<string, number> = {
    bearings: 300, seals: 800, belts: 80, fasteners: 200,
    lubricants: 120, filters: 30, pneumatics: 25,
    electrical: 50, abrasives: 150, safety: 60,
  };
  const base = stockMap[category] ?? 50;
  if (price > 100) return Math.max(3, Math.floor(base * 0.1));
  if (price > 50)  return Math.max(8, Math.floor(base * 0.25));
  return base;
}

function setStock(rows: Array<{ sku: string; warehouse: string; qty: number }>, sku: string, warehouse: string, qty: number): void {
  const row = rows.find(r => r.sku === sku && r.warehouse === warehouse);
  if (row) row.qty = qty;
}
