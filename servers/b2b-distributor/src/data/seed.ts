import type Database from 'better-sqlite3';
import { seedTableRaw } from '@mcp-demos/shared';

export function seedB2BData(db: Database.Database): void {
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
      open_orders INTEGER DEFAULT 0
    )
  `, [{
    account_id: 'ACME-ACC-00441',
    name: 'Hargreaves Engineering Ltd',
    credit_limit: 50000,
    balance: 12340,
    payment_terms: 'Net 30',
    currency: 'GBP',
    rep_name: 'James Whitfield',
    rep_email: 'j.whitfield@acmeindustrial.co.uk',
    open_orders: 2,
  }]);

  // ── Products / SKUs ──────────────────────────────────────────
  const products = [
    { sku: 'BRG-6205-ZZ',    name: 'Deep Groove Ball Bearing 6205-ZZ',   category: 'bearings',   list_price: 8.40,  unit: 'each', lead_time_days: 1 },
    { sku: 'BRG-6205-2RS',   name: 'Deep Groove Ball Bearing 6205-2RS',  category: 'bearings',   list_price: 9.10,  unit: 'each', lead_time_days: 1 },
    { sku: 'BRG-6304-2RS',   name: 'Deep Groove Ball Bearing 6304-2RS',  category: 'bearings',   list_price: 7.80,  unit: 'each', lead_time_days: 1 },
    { sku: 'BRG-6308-ZZ',    name: 'Deep Groove Ball Bearing 6308-ZZ',   category: 'bearings',   list_price: 14.50, unit: 'each', lead_time_days: 2 },
    { sku: 'BRG-NU210-ECJ',  name: 'Cylindrical Roller Bearing NU210',   category: 'bearings',   list_price: 34.60, unit: 'each', lead_time_days: 3 },
    { sku: 'BRG-22212-E1',   name: 'Spherical Roller Bearing 22212',     category: 'bearings',   list_price: 84.00, unit: 'each', lead_time_days: 5 },
    { sku: 'SEAL-V-25x42',   name: 'V-Ring Seal 25×42 mm',               category: 'seals',      list_price: 2.40,  unit: 'each', lead_time_days: 1 },
    { sku: 'SEAL-V-30x47',   name: 'V-Ring Seal 30×47 mm',               category: 'seals',      list_price: 2.80,  unit: 'each', lead_time_days: 1 },
    { sku: 'SEAL-TC-40x62',  name: 'TC Oil Seal 40×62×8 mm',             category: 'seals',      list_price: 4.20,  unit: 'each', lead_time_days: 2 },
    { sku: 'BELT-A-1250',    name: 'Classical V-Belt A1250',              category: 'belts',      list_price: 12.60, unit: 'each', lead_time_days: 1 },
    { sku: 'BELT-A-1250-GATES', name: 'Gates V-Belt A1250 Hi-Power',     category: 'belts',      list_price: 18.90, unit: 'each', lead_time_days: 2 },
    { sku: 'FAST-M10x30-A2', name: 'Hex Bolt M10×30 A2 Stainless (50pk)',category: 'fasteners',  list_price: 14.20, unit: 'pack', lead_time_days: 1 },
    { sku: 'FAST-M8x25-A2',  name: 'Hex Bolt M8×25 A2 Stainless (100pk)',category: 'fasteners',  list_price: 18.50, unit: 'pack', lead_time_days: 1 },
    { sku: 'LUB-EP2-400G',   name: 'EP2 Lithium Grease Cartridge 400 g', category: 'lubricants', list_price: 6.80,  unit: 'each', lead_time_days: 1 },
    { sku: 'LUB-HYD-ISO46-5L', name: 'Hydraulic Oil ISO 46 — 5 L',      category: 'lubricants', list_price: 22.40, unit: 'each', lead_time_days: 1 },
    { sku: 'FILT-HYD-10M',   name: 'Hydraulic Return Filter 10 µm',      category: 'filters',    list_price: 38.50, unit: 'each', lead_time_days: 3 },
  ];

  seedTableRaw(db, 'products', `
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      list_price REAL NOT NULL,
      unit TEXT DEFAULT 'each',
      lead_time_days INTEGER DEFAULT 1
    )
  `, products);

  // ── Contract Pricing (Tier 2) ────────────────────────────────
  const contractPricing = [
    { account_id: 'ACME-ACC-00441', category: 'bearings', discount_pct: 8,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'seals',    discount_pct: 5,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'belts',    discount_pct: 3,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'fasteners',discount_pct: 0,  tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'lubricants',discount_pct: 0, tier: 'Tier 2' },
    { account_id: 'ACME-ACC-00441', category: 'filters',  discount_pct: 0,  tier: 'Tier 2' },
  ];

  seedTableRaw(db, 'contract_pricing', `
    CREATE TABLE IF NOT EXISTS contract_pricing (
      account_id TEXT NOT NULL,
      category TEXT NOT NULL,
      discount_pct REAL NOT NULL,
      tier TEXT NOT NULL,
      PRIMARY KEY (account_id, category)
    )
  `, contractPricing);

  // ── Warehouse Stock ──────────────────────────────────────────
  const warehouseStock = [
    { sku: 'BRG-6205-ZZ',    warehouse: 'Manchester', qty: 540 },
    { sku: 'BRG-6205-ZZ',    warehouse: 'Birmingham', qty: 220 },
    { sku: 'BRG-6205-ZZ',    warehouse: 'Glasgow',    qty: 85 },
    { sku: 'BRG-6205-2RS',   warehouse: 'Manchester', qty: 310 },
    { sku: 'BRG-6205-2RS',   warehouse: 'Birmingham', qty: 0 },
    { sku: 'BRG-6205-2RS',   warehouse: 'Glasgow',    qty: 45 },
    { sku: 'BRG-6304-2RS',   warehouse: 'Manchester', qty: 420 },
    { sku: 'BRG-6304-2RS',   warehouse: 'Birmingham', qty: 180 },
    { sku: 'BRG-6304-2RS',   warehouse: 'Glasgow',    qty: 0 },
    { sku: 'BRG-6308-ZZ',    warehouse: 'Manchester', qty: 75 },
    { sku: 'BRG-6308-ZZ',    warehouse: 'Birmingham', qty: 30 },
    { sku: 'BRG-6308-ZZ',    warehouse: 'Glasgow',    qty: 0 },
    { sku: 'BRG-NU210-ECJ',  warehouse: 'Manchester', qty: 24 },
    { sku: 'BRG-NU210-ECJ',  warehouse: 'Birmingham', qty: 8 },
    { sku: 'BRG-NU210-ECJ',  warehouse: 'Glasgow',    qty: 0 },
    { sku: 'BRG-22212-E1',   warehouse: 'Manchester', qty: 6 },
    { sku: 'BRG-22212-E1',   warehouse: 'Birmingham', qty: 0 },
    { sku: 'BRG-22212-E1',   warehouse: 'Glasgow',    qty: 0 },
    { sku: 'SEAL-V-25x42',   warehouse: 'Manchester', qty: 1200 },
    { sku: 'SEAL-V-25x42',   warehouse: 'Birmingham', qty: 600 },
    { sku: 'SEAL-V-25x42',   warehouse: 'Glasgow',    qty: 300 },
    { sku: 'SEAL-V-30x47',   warehouse: 'Manchester', qty: 880 },
    { sku: 'SEAL-V-30x47',   warehouse: 'Birmingham', qty: 410 },
    { sku: 'SEAL-V-30x47',   warehouse: 'Glasgow',    qty: 120 },
    { sku: 'SEAL-TC-40x62',  warehouse: 'Manchester', qty: 150 },
    { sku: 'SEAL-TC-40x62',  warehouse: 'Birmingham', qty: 60 },
    { sku: 'SEAL-TC-40x62',  warehouse: 'Glasgow',    qty: 0 },
    { sku: 'BELT-A-1250',    warehouse: 'Manchester', qty: 95 },
    { sku: 'BELT-A-1250',    warehouse: 'Birmingham', qty: 40 },
    { sku: 'BELT-A-1250',    warehouse: 'Glasgow',    qty: 0 },
    { sku: 'BELT-A-1250-GATES', warehouse: 'Manchester', qty: 30 },
    { sku: 'BELT-A-1250-GATES', warehouse: 'Birmingham', qty: 12 },
    { sku: 'BELT-A-1250-GATES', warehouse: 'Glasgow',    qty: 0 },
    { sku: 'FAST-M10x30-A2', warehouse: 'Manchester', qty: 200 },
    { sku: 'FAST-M10x30-A2', warehouse: 'Birmingham', qty: 80 },
    { sku: 'FAST-M10x30-A2', warehouse: 'Glasgow',    qty: 50 },
    { sku: 'FAST-M8x25-A2',  warehouse: 'Manchester', qty: 340 },
    { sku: 'FAST-M8x25-A2',  warehouse: 'Birmingham', qty: 120 },
    { sku: 'FAST-M8x25-A2',  warehouse: 'Glasgow',    qty: 90 },
    { sku: 'LUB-EP2-400G',   warehouse: 'Manchester', qty: 500 },
    { sku: 'LUB-EP2-400G',   warehouse: 'Birmingham', qty: 200 },
    { sku: 'LUB-EP2-400G',   warehouse: 'Glasgow',    qty: 100 },
    { sku: 'LUB-HYD-ISO46-5L', warehouse: 'Manchester', qty: 60 },
    { sku: 'LUB-HYD-ISO46-5L', warehouse: 'Birmingham', qty: 20 },
    { sku: 'LUB-HYD-ISO46-5L', warehouse: 'Glasgow',    qty: 0 },
    { sku: 'FILT-HYD-10M',   warehouse: 'Manchester', qty: 18 },
    { sku: 'FILT-HYD-10M',   warehouse: 'Birmingham', qty: 5 },
    { sku: 'FILT-HYD-10M',   warehouse: 'Glasgow',    qty: 0 },
  ];

  seedTableRaw(db, 'warehouse_stock', `
    CREATE TABLE IF NOT EXISTS warehouse_stock (
      sku TEXT NOT NULL,
      warehouse TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (sku, warehouse)
    )
  `, warehouseStock);

  // ── Substitute Parts ─────────────────────────────────────────
  const substitutes = [
    { sku: 'BRG-6205-ZZ',       substitute_sku: 'BRG-6205-2RS',      notes: 'Rubber-sealed variant, suitable for dusty environments' },
    { sku: 'BRG-6205-2RS',      substitute_sku: 'BRG-6205-ZZ',       notes: 'Metal-shielded variant, higher speed rating' },
    { sku: 'BELT-A-1250',       substitute_sku: 'BELT-A-1250-GATES', notes: 'Gates Hi-Power equivalent, longer service life' },
    { sku: 'BELT-A-1250-GATES', substitute_sku: 'BELT-A-1250',       notes: 'Standard classical belt, cost-effective replacement' },
    { sku: 'SEAL-V-25x42',      substitute_sku: 'SEAL-V-30x47',      notes: 'Larger ring, suitable for 30 mm shafts' },
  ];

  seedTableRaw(db, 'substitutes', `
    CREATE TABLE IF NOT EXISTS substitutes (
      sku TEXT NOT NULL,
      substitute_sku TEXT NOT NULL,
      notes TEXT,
      PRIMARY KEY (sku, substitute_sku)
    )
  `, substitutes);

  // ── Orders ───────────────────────────────────────────────────
  const orders = [
    {
      order_id: 'ORD-44109',
      account_id: 'ACME-ACC-00441',
      status: 'delivered',
      order_date: '2026-04-11',
      delivery_date: '2026-04-14',
      total: 1284.60,
      currency: 'GBP',
      items: JSON.stringify([
        { sku: 'BRG-6205-ZZ', name: 'Deep Groove Ball Bearing 6205-ZZ', qty: 100, unit_price: 7.73 },
        { sku: 'SEAL-V-25x42', name: 'V-Ring Seal 25×42 mm', qty: 200, unit_price: 2.28 },
        { sku: 'LUB-EP2-400G', name: 'EP2 Lithium Grease Cartridge 400 g', qty: 10, unit_price: 6.80 },
      ]),
    },
    {
      order_id: 'ORD-43021',
      account_id: 'ACME-ACC-00441',
      status: 'delivered',
      order_date: '2026-03-05',
      delivery_date: '2026-03-08',
      total: 826.40,
      currency: 'GBP',
      items: JSON.stringify([
        { sku: 'BRG-6304-2RS', name: 'Deep Groove Ball Bearing 6304-2RS', qty: 50, unit_price: 7.18 },
        { sku: 'FAST-M10x30-A2', name: 'Hex Bolt M10×30 A2 Stainless (50pk)', qty: 10, unit_price: 14.20 },
        { sku: 'BELT-A-1250', name: 'Classical V-Belt A1250', qty: 20, unit_price: 12.22 },
      ]),
    },
    {
      order_id: 'ORD-42887',
      account_id: 'ACME-ACC-00441',
      status: 'delivered',
      order_date: '2026-02-18',
      delivery_date: '2026-02-21',
      total: 2194.00,
      currency: 'GBP',
      items: JSON.stringify([
        { sku: 'BRG-22212-E1', name: 'Spherical Roller Bearing 22212', qty: 20, unit_price: 77.28 },
        { sku: 'FILT-HYD-10M', name: 'Hydraulic Return Filter 10 µm', qty: 12, unit_price: 38.50 },
        { sku: 'LUB-HYD-ISO46-5L', name: 'Hydraulic Oil ISO 46 — 5 L', qty: 6, unit_price: 22.40 },
      ]),
    },
    {
      order_id: 'ORD-45001',
      account_id: 'ACME-ACC-00441',
      status: 'processing',
      order_date: '2026-05-19',
      delivery_date: null,
      total: 543.80,
      currency: 'GBP',
      items: JSON.stringify([
        { sku: 'BRG-NU210-ECJ', name: 'Cylindrical Roller Bearing NU210', qty: 10, unit_price: 31.83 },
        { sku: 'SEAL-TC-40x62', name: 'TC Oil Seal 40×62×8 mm', qty: 50, unit_price: 3.99 },
        { sku: 'FAST-M8x25-A2', name: 'Hex Bolt M8×25 A2 Stainless (100pk)', qty: 2, unit_price: 18.50 },
      ]),
    },
  ];

  seedTableRaw(db, 'orders', `
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      order_date TEXT NOT NULL,
      delivery_date TEXT,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      items TEXT NOT NULL
    )
  `, orders);

  // ── Quotes (created at runtime) ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      quote_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      items TEXT NOT NULL,
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
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      session_id TEXT
    )
  `);
}
