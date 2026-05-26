import type Database from "better-sqlite3";
import { seedTableRaw } from "@mcp-demos/shared";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Bump this number whenever products.json, orders.json or reviews.json change.
 * On next start the server will drop stale catalogue tables and re-seed.
 */
const DATA_VERSION = 5;

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
  db.exec(`DROP TABLE IF EXISTS products`);
  db.exec(`DROP TABLE IF EXISTS orders`);
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
    readFileSync(join(__dirname, "products.json"), "utf-8"),
  );
  const orders = JSON.parse(
    readFileSync(join(__dirname, "orders.json"), "utf-8"),
  );
  const reviews = JSON.parse(
    readFileSync(join(__dirname, "reviews.json"), "utf-8"),
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
      currency TEXT DEFAULT 'EUR',
      color TEXT,
      color_hex TEXT,
      size TEXT,
      stock_qty INTEGER DEFAULT 0,
      stock_status TEXT DEFAULT 'in_stock',
      delivery_estimate TEXT,
      image_url TEXT,
      tags TEXT,
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      weight_grams INTEGER,
      material TEXT,
      specs TEXT,
      dimensions TEXT,
      frequently_bought_together TEXT
    )
  `,
    products,
  );

  seedTableRaw(
    db,
    "orders",
    `
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      carrier TEXT,
      tracking_number TEXT,
      delivery_estimate TEXT,
      order_date TEXT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      eligible_for_return INTEGER DEFAULT 0,
      return_deadline TEXT,
      user_id TEXT
    )
  `,
    orders.map((o: Record<string, unknown>) => ({
      ...o,
      items: JSON.stringify(o.items),
      eligible_for_return: o.eligible_for_return ? 1 : 0,
    })),
  );

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
      color TEXT,
      size TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
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
