import type Database from 'better-sqlite3';
import { seedTableRaw } from '@mcp-demos/shared';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function seedB2CData(db: Database.Database): void {
  const products = JSON.parse(readFileSync(join(__dirname, 'products.json'), 'utf-8'));
  const orders = JSON.parse(readFileSync(join(__dirname, 'orders.json'), 'utf-8'));

  seedTableRaw(db, 'products', `
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      color TEXT,
      size INTEGER,
      stock_qty INTEGER DEFAULT 0,
      stock_status TEXT DEFAULT 'in_stock',
      delivery_estimate TEXT,
      image_url TEXT,
      tags TEXT
    )
  `, products);

  seedTableRaw(db, 'orders', `
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
      return_deadline TEXT
    )
  `, orders.map((o: Record<string, unknown>) => ({
    ...o,
    items: JSON.stringify(o.items),
    eligible_for_return: o.eligible_for_return ? 1 : 0,
  })));

  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      return_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_description TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      session_id TEXT
    )
  `);
}
