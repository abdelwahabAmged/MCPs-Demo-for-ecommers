import type Database from "better-sqlite3";
import { seedTableRaw } from "@mcp-demos/shared";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Bump this number whenever products_1.json or reviews_1.json change.
 * On next start the server will drop stale catalogue tables and re-seed.
 */
const DATA_VERSION = 17;

function isDataCurrent(db: Database.Database): boolean {
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS _data_meta (key TEXT PRIMARY KEY, value TEXT)`,
    );
    const row = db
      .prepare(`SELECT value FROM _data_meta WHERE key = 'data_version'`)
      .get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) >= DATA_VERSION : false;
  } catch {
    return false;
  }
}

function dropCatalogueTables(db: Database.Database): void {
  // Only catalogue (seed-owned) tables may be dropped on a DATA_VERSION bump.
  // NEVER drop `orders` (or any other user-generated table) here — those hold
  // real customer data that must survive catalogue re-seeds and deploys.
  db.exec(`DROP TABLE IF EXISTS products`);
  db.exec(`DROP TABLE IF EXISTS reviews`);
}

function stampVersion(db: Database.Database): void {
  db.prepare(
    `INSERT OR REPLACE INTO _data_meta (key, value) VALUES ('data_version', ?)`,
  ).run(String(DATA_VERSION));
}

export function seedB2CData(db: Database.Database): void {
  if (isDataCurrent(db)) {
    ensureRuntimeTables(db);
    return;
  }

  dropCatalogueTables(db);

  const products = JSON.parse(
    readFileSync(join(__dirname, "products_1.json"), "utf-8"),
  );
  const reviews = JSON.parse(
    readFileSync(join(__dirname, "reviews_1.json"), "utf-8"),
  );

  seedTableRaw(
    db,
    "products",
    `
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT DEFAULT 'Acme',
      category TEXT NOT NULL,
      subcategory TEXT,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      discount TEXT,
      currency TEXT DEFAULT 'USD',
      stock_qty INTEGER DEFAULT 0,
      stock_status TEXT DEFAULT 'in_stock',
      delivery_estimate TEXT,
      image_url TEXT,
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      weight TEXT,
      dimensions TEXT,
      features TEXT,
      manufacturer TEXT,
      department TEXT,
      bought_past_month INTEGER,
      country_of_origin TEXT,
      images TEXT,
      top_review TEXT,
      badge TEXT,
      variations TEXT,
      delivery TEXT,
      model_number TEXT,
      date_first_available TEXT,
      frequently_bought_together TEXT
    )
  `,
    products,
  );

  // Orders table exists but starts empty — users create orders via checkout
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      carrier TEXT,
      tracking_number TEXT,
      delivery_estimate TEXT,
      order_date TEXT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      eligible_for_return INTEGER DEFAULT 0,
      return_deadline TEXT,
      user_id TEXT
    )
  `);

  seedTableRaw(
    db,
    "reviews",
    `
    CREATE TABLE IF NOT EXISTS reviews (
      review_id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      created_at TEXT,
      verified_purchase INTEGER DEFAULT 1
    )
  `,
    reviews.map((r: Record<string, unknown>) => ({
      ...r,
      verified_purchase: r.verified_purchase ? 1 : 0,
    })),
  );

  ensureRuntimeTables(db);
  stampVersion(db);
}

function ensureRuntimeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      return_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_description TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      session_id TEXT,
      user_id TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      image_url TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      user_id TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      added_at TEXT DEFAULT (datetime('now')),
      user_id TEXT,
      UNIQUE(session_id, sku)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      ticket_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolution TEXT,
      session_id TEXT,
      user_id TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      session_id TEXT,
      user_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'active'
    )
  `);

  ensureBackOfficeTables(db);
  seedBackOfficeDemoData(db);

  // Add user_id columns to existing tables if missing (upgrade path)
  const tablesToPatch = [
    "cart_items",
    "wishlist",
    "returns",
    "support_tickets",
    "orders",
  ];
  for (const table of tablesToPatch) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>;
      if (!cols.some((c) => c.name === "user_id")) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
      }
    } catch {
      /* table may not exist yet */
    }
  }
}

function ensureBackOfficeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_performance_daily (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      date TEXT NOT NULL,
      sessions INTEGER NOT NULL,
      product_views INTEGER NOT NULL,
      conversion_rate REAL NOT NULL,
      units_sold INTEGER NOT NULL,
      revenue REAL NOT NULL,
      stock_qty INTEGER NOT NULL,
      UNIQUE(sku, date)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_reorders (
      reorder_id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      expected_arrival TEXT,
      email_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sent_emails (
      email_id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      related_type TEXT NOT NULL,
      related_id TEXT NOT NULL,
      to_email TEXT NOT NULL,
      from_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function seedBackOfficeDemoData(db: Database.Database): void {
  const targetSku = "ACM-CSJ-033";
  const product = db
    .prepare("SELECT sku, name, price, stock_qty FROM products WHERE sku = ?")
    .get(targetSku) as
    | { sku: string; name: string; price: number; stock_qty: number }
    | undefined;

  if (!product) return;

  const performanceRows = [
    ["2026-07-07", 1230, 402, 0.052, 21, 18],
    ["2026-07-08", 1218, 397, 0.048, 19, 15],
    ["2026-07-09", 1244, 411, 0.041, 17, 12],
    ["2026-07-10", 1226, 405, 0.034, 14, 9],
    ["2026-07-11", 1251, 409, 0.026, 11, 7],
    ["2026-07-12", 1238, 401, 0.019, 8, 5],
    ["2026-07-13", 1241, 406, 0.012, 5, 4],
  ] as const;

  const insertPerformance = db.prepare(`
    INSERT OR IGNORE INTO product_performance_daily
      (id, sku, date, sessions, product_views, conversion_rate, units_sold, revenue, stock_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [date, sessions, views, conversion, units, stock] of performanceRows) {
    insertPerformance.run(
      `perf-${targetSku}-${date}`,
      targetSku,
      date,
      sessions,
      views,
      conversion,
      units,
      +(units * product.price).toFixed(2),
      stock,
    );
  }

  const secondarySku = "ACM-ELEC-018";
  const secondaryProduct = db
    .prepare("SELECT sku, price FROM products WHERE sku = ?")
    .get(secondarySku) as { sku: string; price: number } | undefined;
  if (secondaryProduct) {
    const secondaryRows = [
      ["2026-07-07", 880, 280, 0.044, 12, 12],
      ["2026-07-08", 906, 291, 0.043, 13, 10],
      ["2026-07-09", 899, 287, 0.041, 12, 8],
      ["2026-07-10", 914, 293, 0.038, 11, 7],
      ["2026-07-11", 902, 286, 0.036, 10, 6],
      ["2026-07-12", 918, 295, 0.033, 9, 5],
      ["2026-07-13", 911, 289, 0.030, 8, 4],
    ] as const;

    for (const [date, sessions, views, conversion, units, stock] of secondaryRows) {
      insertPerformance.run(
        `perf-${secondarySku}-${date}`,
        secondarySku,
        date,
        sessions,
        views,
        conversion,
        units,
        +(units * secondaryProduct.price).toFixed(2),
        stock,
      );
    }
  }

  db.prepare(`
    INSERT OR IGNORE INTO orders
      (order_id, status, carrier, tracking_number, delivery_estimate, order_date, items, total, currency, eligible_for_return, return_deadline, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "ACM-2026-DEMO1",
    "delivered",
    "Acme Ship",
    "ACMTRACKDEMO1",
    "2026-07-10",
    "2026-07-06",
    JSON.stringify([
      {
        sku: targetSku,
        name: product.name,
        quantity: 1,
        price: product.price,
        image_url:
          "https://m.media-amazon.com/images/I/61wReiFg2mL.__AC_SX395_SY395_QL70_FMwebp_.jpg",
      },
    ]),
    product.price,
    "USD",
    1,
    "2026-08-09",
    null,
  );

  db.prepare(`
    INSERT OR IGNORE INTO support_tickets
      (ticket_id, order_id, issue_type, description, status, priority, created_at, updated_at, resolution, session_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "TKT-DEMO-ASICS",
    "ACM-2026-DEMO1",
    "late_delivery",
    "Customer says the ASICS GT-1000 shoes are still marked delayed and asks whether the size 10 restock is coming soon.",
    "open",
    "high",
    "2026-07-13T09:15:00.000Z",
    "2026-07-13T09:15:00.000Z",
    null,
    null,
    null,
  );
}
