import type Database from 'better-sqlite3';
import { seedTableRaw } from '@mcp-demos/shared';

export function seedInternalSalesData(db: Database.Database): void {

  // ── Rep ──────────────────────────────────────────────────────────
  seedTableRaw(db, 'reps', `
    CREATE TABLE IF NOT EXISTS reps (
      rep_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      email TEXT NOT NULL,
      region TEXT NOT NULL
    )
  `, [
    { rep_id: 'REP-JW-001', name: 'James Whitfield', title: 'Account Manager', email: 'j.whitfield@acmeindustrial.com', region: 'North & Midlands' },
  ]);

  // ── Accounts ─────────────────────────────────────────────────────
  seedTableRaw(db, 'accounts', `
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      credit_limit REAL NOT NULL,
      credit_balance REAL NOT NULL,
      payment_terms TEXT NOT NULL,
      last_payment_date TEXT,
      last_payment_amount REAL,
      key_contact_name TEXT NOT NULL,
      key_contact_role TEXT NOT NULL,
      key_contact_email TEXT NOT NULL,
      key_contact_phone TEXT,
      assigned_rep_id TEXT NOT NULL,
      notes TEXT
    )
  `, [
    {
      account_id: 'ACME-ACC-00441', name: 'Hargreaves Engineering Ltd', tier: 'Tier 2',
      credit_limit: 50000, credit_balance: 12340, payment_terms: 'Net 30',
      last_payment_date: '2026-04-28', last_payment_amount: 6200,
      key_contact_name: 'Sarah Hargreaves', key_contact_role: 'Procurement Manager',
      key_contact_email: 's.hargreaves@hargreaves-eng.co.uk', key_contact_phone: '+44 114 555 0012',
      assigned_rep_id: 'REP-JW-001', notes: 'Long-standing account. Prefers email quotes. 4 orders this year.',
    },
    {
      account_id: 'ACME-ACC-00512', name: 'Northgate Fabrications Ltd', tier: 'Tier 1',
      credit_limit: 30000, credit_balance: 4100, payment_terms: 'Net 45',
      last_payment_date: '2026-05-10', last_payment_amount: 3200,
      key_contact_name: 'Tom Bradley', key_contact_role: 'Operations Director',
      key_contact_email: 't.bradley@northgatefab.co.uk', key_contact_phone: '+44 161 555 0034',
      assigned_rep_id: 'REP-JW-001', notes: 'Growing account. 2 orders this year. Interested in framework agreements.',
    },
    {
      account_id: 'ACME-ACC-00389', name: 'Peak Industrial Services', tier: 'Standard',
      credit_limit: 20000, credit_balance: 0, payment_terms: 'Net 30',
      last_payment_date: '2026-03-15', last_payment_amount: 1340,
      key_contact_name: 'Mohammed Al-Rashid', key_contact_role: 'Facilities Manager',
      key_contact_email: 'm.alrashid@peakindustrial.co.uk', key_contact_phone: '+44 133 555 0078',
      assigned_rep_id: 'REP-JW-001', notes: 'Standard pricing. 1 order this year. Potential for upsell on maintenance contracts.',
    },
  ]);

  // ── Products (industrial catalogue) ──────────────────────────────
  seedTableRaw(db, 'products', `
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      list_price REAL NOT NULL,
      tier1_price REAL NOT NULL,
      tier2_price REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      unit TEXT DEFAULT 'each',
      stock_qty INTEGER DEFAULT 0,
      warehouse TEXT DEFAULT 'Sheffield',
      lead_time_days INTEGER DEFAULT 1,
      substitute_sku TEXT
    )
  `, [
    { sku: 'BRG-6205-2RS', name: 'Deep Groove Ball Bearing 6205-2RS', category: 'Bearings', description: 'Sealed deep groove ball bearing, 25×52×15 mm, 2RS rubber seal both sides', list_price: 8.40, tier1_price: 7.14, tier2_price: 7.56, unit: 'each', stock_qty: 1200, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'BRG-6205-ZZ' },
    { sku: 'BRG-6205-ZZ', name: 'Deep Groove Ball Bearing 6205-ZZ', category: 'Bearings', description: 'Shielded deep groove ball bearing, 25×52×15 mm, ZZ metal shield both sides', list_price: 7.80, tier1_price: 6.63, tier2_price: 7.02, unit: 'each', stock_qty: 850, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'BRG-6205-2RS' },
    { sku: 'BRG-6308-2RS', name: 'Deep Groove Ball Bearing 6308-2RS', category: 'Bearings', description: 'Sealed deep groove ball bearing, 40×90×23 mm', list_price: 14.50, tier1_price: 12.33, tier2_price: 13.05, unit: 'each', stock_qty: 420, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: null },
    { sku: 'BRG-NU210-ECJ', name: 'Cylindrical Roller Bearing NU210 ECJ', category: 'Bearings', description: 'Cylindrical roller bearing, 50×90×20 mm, polyamide cage', list_price: 32.00, tier1_price: 27.20, tier2_price: 28.80, unit: 'each', stock_qty: 180, warehouse: 'Sheffield', lead_time_days: 2, substitute_sku: null },
    { sku: 'SEAL-TC-40X62X8', name: 'TC Oil Seal 40×62×8 mm', category: 'Seals', description: 'Double lip TC oil seal, nitrile rubber, 40mm shaft', list_price: 3.20, tier1_price: 2.72, tier2_price: 2.88, unit: 'each', stock_qty: 3000, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'SEAL-SC-40X62X8' },
    { sku: 'SEAL-SC-40X62X8', name: 'SC Oil Seal 40×62×8 mm', category: 'Seals', description: 'Single lip SC oil seal, nitrile rubber, 40mm shaft', list_price: 2.60, tier1_price: 2.21, tier2_price: 2.34, unit: 'each', stock_qty: 2200, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'SEAL-TC-40X62X8' },
    { sku: 'SEAL-ORING-50X3', name: 'Nitrile O-Ring 50×3 mm', category: 'Seals', description: 'NBR 70 Shore A O-ring, 50mm ID, 3mm cross section', list_price: 0.45, tier1_price: 0.38, tier2_price: 0.41, unit: 'each', stock_qty: 15000, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: null },
    { sku: 'BLT-SPZ-1250', name: 'V-Belt SPZ 1250', category: 'Belts', description: 'Wrapped V-belt, SPZ profile, 1250mm pitch length', list_price: 11.20, tier1_price: 9.52, tier2_price: 10.08, unit: 'each', stock_qty: 340, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: null },
    { sku: 'BLT-SPA-1500', name: 'V-Belt SPA 1500', category: 'Belts', description: 'Wrapped V-belt, SPA profile, 1500mm pitch length', list_price: 15.80, tier1_price: 13.43, tier2_price: 14.22, unit: 'each', stock_qty: 210, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: null },
    { sku: 'BLT-HTD-5M-450', name: 'Timing Belt HTD 5M 450mm', category: 'Belts', description: 'HTD synchronous timing belt, 5mm pitch, 450mm length, 15mm width', list_price: 18.50, tier1_price: 15.73, tier2_price: 16.65, unit: 'each', stock_qty: 95, warehouse: 'Sheffield', lead_time_days: 2, substitute_sku: null },
    { sku: 'FST-HEX-M10X40-A2', name: 'Hex Bolt M10×40 A2 Stainless', category: 'Fasteners', description: 'Hex head bolt M10×40mm, A2 stainless steel, DIN 933, fully threaded', list_price: 0.32, tier1_price: 0.27, tier2_price: 0.29, unit: 'each', stock_qty: 25000, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'FST-HEX-M10X40-88' },
    { sku: 'FST-HEX-M10X40-88', name: 'Hex Bolt M10×40 Grade 8.8 Zinc', category: 'Fasteners', description: 'Hex head bolt M10×40mm, Grade 8.8 zinc plated, DIN 933', list_price: 0.18, tier1_price: 0.15, tier2_price: 0.16, unit: 'each', stock_qty: 40000, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'FST-HEX-M10X40-A2' },
    { sku: 'FST-NUT-M10-A2', name: 'Hex Nut M10 A2 Stainless', category: 'Fasteners', description: 'Hex nut M10, A2 stainless steel, DIN 934', list_price: 0.12, tier1_price: 0.10, tier2_price: 0.11, unit: 'each', stock_qty: 30000, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: null },
    { sku: 'FST-WASH-M10-A2', name: 'Flat Washer M10 A2 Stainless', category: 'Fasteners', description: 'Flat washer M10, A2 stainless steel, DIN 125', list_price: 0.06, tier1_price: 0.05, tier2_price: 0.05, unit: 'each', stock_qty: 50000, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: null },
    { sku: 'LUB-MOLYSLIP-400', name: 'Molyslip Multi-Purpose Grease 400g', category: 'Lubricants', description: 'Lithium-based multi-purpose grease with molybdenum disulphide, 400g cartridge', list_price: 9.80, tier1_price: 8.33, tier2_price: 8.82, unit: 'cartridge', stock_qty: 600, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'LUB-LITH-EP2-400' },
    { sku: 'LUB-LITH-EP2-400', name: 'Lithium EP2 Grease 400g', category: 'Lubricants', description: 'Lithium EP2 multi-purpose grease, 400g cartridge, NLGI Grade 2', list_price: 6.40, tier1_price: 5.44, tier2_price: 5.76, unit: 'cartridge', stock_qty: 900, warehouse: 'Sheffield', lead_time_days: 1, substitute_sku: 'LUB-MOLYSLIP-400' },
    { sku: 'LUB-CHAIN-5L', name: 'Industrial Chain Oil 5L', category: 'Lubricants', description: 'Heavy duty chain and conveyor lubricant, 5 litre container', list_price: 28.00, tier1_price: 23.80, tier2_price: 25.20, unit: 'container', stock_qty: 140, warehouse: 'Birmingham', lead_time_days: 2, substitute_sku: null },
  ]);

  // ── Orders ───────────────────────────────────────────────────────
  seedTableRaw(db, 'orders', `
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      order_date TEXT NOT NULL,
      delivery_date TEXT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      po_number TEXT,
      notes TEXT
    )
  `, [
    {
      order_id: 'ORD-2026-04412', account_id: 'ACME-ACC-00441', status: 'delivered',
      order_date: '2026-01-18', delivery_date: '2026-01-22',
      items: JSON.stringify([
        { sku: 'BRG-6205-2RS', name: 'Deep Groove Ball Bearing 6205-2RS', quantity: 200, unit_price: 7.56, total: 1512.00 },
        { sku: 'SEAL-TC-40X62X8', name: 'TC Oil Seal 40×62×8 mm', quantity: 100, unit_price: 2.88, total: 288.00 },
      ]),
      total: 1800.00, po_number: 'HE-PO-2026-001', notes: 'Quarterly bearing replacement schedule',
    },
    {
      order_id: 'ORD-2026-04587', account_id: 'ACME-ACC-00441', status: 'delivered',
      order_date: '2026-02-22', delivery_date: '2026-02-26',
      items: JSON.stringify([
        { sku: 'BLT-SPA-1500', name: 'V-Belt SPA 1500', quantity: 24, unit_price: 14.22, total: 341.28 },
        { sku: 'LUB-MOLYSLIP-400', name: 'Molyslip Multi-Purpose Grease 400g', quantity: 48, unit_price: 8.82, total: 423.36 },
        { sku: 'FST-HEX-M10X40-A2', name: 'Hex Bolt M10×40 A2 Stainless', quantity: 500, unit_price: 0.29, total: 145.00 },
      ]),
      total: 909.64, po_number: 'HE-PO-2026-007', notes: null,
    },
    {
      order_id: 'ORD-2026-05102', account_id: 'ACME-ACC-00441', status: 'shipped',
      order_date: '2026-04-30', delivery_date: null,
      items: JSON.stringify([
        { sku: 'BRG-6308-2RS', name: 'Deep Groove Ball Bearing 6308-2RS', quantity: 50, unit_price: 13.05, total: 652.50 },
        { sku: 'BRG-NU210-ECJ', name: 'Cylindrical Roller Bearing NU210 ECJ', quantity: 30, unit_price: 28.80, total: 864.00 },
      ]),
      total: 1516.50, po_number: 'HE-PO-2026-018', notes: 'Urgent — line shutdown if delayed',
    },
    {
      order_id: 'ORD-2026-05198', account_id: 'ACME-ACC-00441', status: 'processing',
      order_date: '2026-05-15', delivery_date: null,
      items: JSON.stringify([
        { sku: 'SEAL-ORING-50X3', name: 'Nitrile O-Ring 50×3 mm', quantity: 500, unit_price: 0.41, total: 205.00 },
        { sku: 'LUB-CHAIN-5L', name: 'Industrial Chain Oil 5L', quantity: 10, unit_price: 25.20, total: 252.00 },
      ]),
      total: 457.00, po_number: 'HE-PO-2026-022', notes: null,
    },
    {
      order_id: 'ORD-2026-04820', account_id: 'ACME-ACC-00512', status: 'delivered',
      order_date: '2026-03-05', delivery_date: '2026-03-08',
      items: JSON.stringify([
        { sku: 'FST-HEX-M10X40-88', name: 'Hex Bolt M10×40 Grade 8.8 Zinc', quantity: 2000, unit_price: 0.15, total: 300.00 },
        { sku: 'FST-NUT-M10-A2', name: 'Hex Nut M10 A2 Stainless', quantity: 2000, unit_price: 0.10, total: 200.00 },
        { sku: 'FST-WASH-M10-A2', name: 'Flat Washer M10 A2 Stainless', quantity: 2000, unit_price: 0.05, total: 100.00 },
      ]),
      total: 600.00, po_number: 'NF-PO-0034', notes: 'Framework order – fastener stock replenishment',
    },
    {
      order_id: 'ORD-2026-05310', account_id: 'ACME-ACC-00512', status: 'processing',
      order_date: '2026-05-12', delivery_date: null,
      items: JSON.stringify([
        { sku: 'BLT-HTD-5M-450', name: 'Timing Belt HTD 5M 450mm', quantity: 12, unit_price: 15.73, total: 188.76 },
        { sku: 'BRG-6205-2RS', name: 'Deep Groove Ball Bearing 6205-2RS', quantity: 100, unit_price: 7.14, total: 714.00 },
      ]),
      total: 902.76, po_number: 'NF-PO-0041', notes: null,
    },
    {
      order_id: 'ORD-2026-03890', account_id: 'ACME-ACC-00389', status: 'delivered',
      order_date: '2026-02-10', delivery_date: '2026-02-14',
      items: JSON.stringify([
        { sku: 'LUB-LITH-EP2-400', name: 'Lithium EP2 Grease 400g', quantity: 24, unit_price: 6.40, total: 153.60 },
        { sku: 'BLT-SPZ-1250', name: 'V-Belt SPZ 1250', quantity: 6, unit_price: 11.20, total: 67.20 },
      ]),
      total: 220.80, po_number: 'PI-PO-889', notes: 'Standard pricing applied',
    },
  ]);

  // ── Quotes ───────────────────────────────────────────────────────
  seedTableRaw(db, 'quotes', `
    CREATE TABLE IF NOT EXISTS quotes (
      quote_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      rep_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_date TEXT NOT NULL,
      sent_date TEXT,
      expiry_date TEXT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      notes TEXT
    )
  `, [
    {
      quote_id: 'QT-2026-0441', account_id: 'ACME-ACC-00441', rep_id: 'REP-JW-001',
      status: 'sent', created_date: '2026-05-15', sent_date: '2026-05-18', expiry_date: '2026-05-25',
      items: JSON.stringify([
        { sku: 'BRG-6205-2RS', quantity: 500, unit_price: 7.56, total: 3780.00 },
        { sku: 'BRG-6308-2RS', quantity: 100, unit_price: 13.05, total: 1305.00 },
        { sku: 'SEAL-TC-40X62X8', quantity: 400, unit_price: 2.88, total: 1152.00 },
        { sku: 'LUB-MOLYSLIP-400', quantity: 24, unit_price: 8.82, total: 211.68 },
        { sku: 'BLT-SPA-1500', quantity: 50, unit_price: 14.22, total: 711.00 },
      ]),
      total: 8159.68, notes: 'Q3 maintenance stock. Sarah requested by end of May.',
    },
    {
      quote_id: 'QT-2026-0389', account_id: 'ACME-ACC-00389', rep_id: 'REP-JW-001',
      status: 'draft', created_date: '2026-05-19', sent_date: null, expiry_date: null,
      items: JSON.stringify([
        { sku: 'LUB-LITH-EP2-400', quantity: 48, unit_price: 6.40, total: 307.20 },
        { sku: 'BLT-SPZ-1250', quantity: 20, unit_price: 11.20, total: 224.00 },
        { sku: 'SEAL-ORING-50X3', quantity: 1000, unit_price: 0.45, total: 450.00 },
        { sku: 'FST-HEX-M10X40-88', quantity: 2000, unit_price: 0.18, total: 360.00 },
      ]),
      total: 1341.20, notes: 'Draft — standard pricing. Mohammed mentioned annual maintenance contract.',
    },
  ]);

  // ── Discount approvals ───────────────────────────────────────────
  seedTableRaw(db, 'discount_approvals', `
    CREATE TABLE IF NOT EXISTS discount_approvals (
      approval_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      rep_id TEXT NOT NULL,
      discount_percent REAL NOT NULL,
      expected_order_value REAL NOT NULL,
      justification TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_date TEXT NOT NULL,
      approver TEXT,
      resolved_date TEXT
    )
  `, [
    {
      approval_id: 'DA-2026-0512-01', account_id: 'ACME-ACC-00512', rep_id: 'REP-JW-001',
      discount_percent: 10, expected_order_value: 22000,
      justification: 'Northgate moving to framework agreement — competitive bid from RS Components at 12% below our list. 10% brings us in line and secures 12-month contract.',
      status: 'pending', requested_date: '2026-05-20',
      approver: 'Karen Mitchell (Regional Manager)', resolved_date: null,
    },
  ]);

  // ── Warehouse stock (multi-warehouse view) ──────────────────────
  seedTableRaw(db, 'warehouse_stock', `
    CREATE TABLE IF NOT EXISTS warehouse_stock (
      sku TEXT NOT NULL,
      warehouse TEXT NOT NULL,
      stock_qty INTEGER NOT NULL,
      next_replenishment_date TEXT,
      PRIMARY KEY (sku, warehouse)
    )
  `, [
    { sku: 'BRG-6205-2RS', warehouse: 'Sheffield', stock_qty: 1200, next_replenishment_date: null },
    { sku: 'BRG-6205-2RS', warehouse: 'Birmingham', stock_qty: 450, next_replenishment_date: null },
    { sku: 'BRG-6205-2RS', warehouse: 'Glasgow', stock_qty: 80, next_replenishment_date: '2026-05-28' },
    { sku: 'BRG-6205-ZZ', warehouse: 'Sheffield', stock_qty: 850, next_replenishment_date: null },
    { sku: 'BRG-6205-ZZ', warehouse: 'Birmingham', stock_qty: 200, next_replenishment_date: null },
    { sku: 'BRG-6308-2RS', warehouse: 'Sheffield', stock_qty: 420, next_replenishment_date: null },
    { sku: 'BRG-6308-2RS', warehouse: 'Birmingham', stock_qty: 60, next_replenishment_date: '2026-05-30' },
    { sku: 'BRG-NU210-ECJ', warehouse: 'Sheffield', stock_qty: 180, next_replenishment_date: null },
    { sku: 'SEAL-TC-40X62X8', warehouse: 'Sheffield', stock_qty: 3000, next_replenishment_date: null },
    { sku: 'SEAL-TC-40X62X8', warehouse: 'Birmingham', stock_qty: 1500, next_replenishment_date: null },
    { sku: 'SEAL-TC-40X62X8', warehouse: 'Glasgow', stock_qty: 800, next_replenishment_date: null },
    { sku: 'SEAL-SC-40X62X8', warehouse: 'Sheffield', stock_qty: 2200, next_replenishment_date: null },
    { sku: 'SEAL-ORING-50X3', warehouse: 'Sheffield', stock_qty: 15000, next_replenishment_date: null },
    { sku: 'SEAL-ORING-50X3', warehouse: 'Birmingham', stock_qty: 8000, next_replenishment_date: null },
    { sku: 'BLT-SPZ-1250', warehouse: 'Sheffield', stock_qty: 340, next_replenishment_date: null },
    { sku: 'BLT-SPA-1500', warehouse: 'Sheffield', stock_qty: 210, next_replenishment_date: null },
    { sku: 'BLT-SPA-1500', warehouse: 'Birmingham', stock_qty: 90, next_replenishment_date: null },
    { sku: 'BLT-HTD-5M-450', warehouse: 'Sheffield', stock_qty: 95, next_replenishment_date: null },
    { sku: 'FST-HEX-M10X40-A2', warehouse: 'Sheffield', stock_qty: 25000, next_replenishment_date: null },
    { sku: 'FST-HEX-M10X40-A2', warehouse: 'Birmingham', stock_qty: 15000, next_replenishment_date: null },
    { sku: 'FST-HEX-M10X40-A2', warehouse: 'Glasgow', stock_qty: 10000, next_replenishment_date: null },
    { sku: 'FST-HEX-M10X40-88', warehouse: 'Sheffield', stock_qty: 40000, next_replenishment_date: null },
    { sku: 'FST-HEX-M10X40-88', warehouse: 'Birmingham', stock_qty: 20000, next_replenishment_date: null },
    { sku: 'FST-NUT-M10-A2', warehouse: 'Sheffield', stock_qty: 30000, next_replenishment_date: null },
    { sku: 'FST-NUT-M10-A2', warehouse: 'Birmingham', stock_qty: 12000, next_replenishment_date: null },
    { sku: 'FST-WASH-M10-A2', warehouse: 'Sheffield', stock_qty: 50000, next_replenishment_date: null },
    { sku: 'LUB-MOLYSLIP-400', warehouse: 'Sheffield', stock_qty: 600, next_replenishment_date: null },
    { sku: 'LUB-MOLYSLIP-400', warehouse: 'Birmingham', stock_qty: 200, next_replenishment_date: null },
    { sku: 'LUB-LITH-EP2-400', warehouse: 'Sheffield', stock_qty: 900, next_replenishment_date: null },
    { sku: 'LUB-LITH-EP2-400', warehouse: 'Birmingham', stock_qty: 350, next_replenishment_date: null },
    { sku: 'LUB-CHAIN-5L', warehouse: 'Birmingham', stock_qty: 140, next_replenishment_date: null },
    { sku: 'LUB-CHAIN-5L', warehouse: 'Sheffield', stock_qty: 45, next_replenishment_date: '2026-05-26' },
  ]);
}
