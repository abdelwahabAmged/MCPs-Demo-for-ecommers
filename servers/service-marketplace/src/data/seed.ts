import type Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_VERSION = 2;

function loadJSON<T>(filename: string): T {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

function isDataCurrent(db: Database.Database): boolean {
  try {
    const row = db.prepare("SELECT version FROM _data_meta WHERE id = 'marketplace_data'").get() as { version: number } | undefined;
    return row?.version === DATA_VERSION;
  } catch {
    return false;
  }
}

function dropCatalogueTables(db: Database.Database): void {
  db.exec('DROP TABLE IF EXISTS reviews');
  db.exec('DROP TABLE IF EXISTS availability');
  db.exec('DROP TABLE IF EXISTS bookings');
  db.exec('DROP TABLE IF EXISTS quote_estimates');
  db.exec('DROP TABLE IF EXISTS providers');
}

export function seedServiceMarketplaceData(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _data_meta (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    )
  `);

  if (isDataCurrent(db)) {
    return;
  }

  dropCatalogueTables(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      job_type TEXT NOT NULL,
      rating REAL NOT NULL,
      review_count INTEGER NOT NULL,
      hourly_rate REAL NOT NULL,
      callout_fee REAL DEFAULT 0,
      currency TEXT DEFAULT 'GBP',
      location TEXT NOT NULL,
      coverage_radius_miles INTEGER DEFAULT 10,
      response_time TEXT,
      bio TEXT,
      specialisms TEXT,
      sample_jobs TEXT,
      certifications TEXT,
      years_in_business INTEGER,
      insurance TEXT,
      website TEXT,
      phone TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      provider_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      date TEXT NOT NULL,
      job_type TEXT,
      comment TEXT,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      day_offset INTEGER NOT NULL,
      time_slot TEXT NOT NULL,
      available INTEGER DEFAULT 1,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      booking_ref TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      job_description TEXT,
      estimated_cost REAL,
      currency TEXT DEFAULT 'GBP',
      notes TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      address TEXT,
      session_id TEXT,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      sub_type TEXT,
      location TEXT NOT NULL,
      min_cost REAL NOT NULL,
      max_cost REAL NOT NULL,
      typical_duration TEXT,
      includes TEXT
    )
  `);

  // Load from JSON
  const providers = loadJSON<any[]>('providers.json');
  const reviews = loadJSON<any[]>('reviews.json');
  const availability = loadJSON<any[]>('availability.json');
  const bookings = loadJSON<any[]>('bookings.json');
  const quotes = loadJSON<any[]>('quotes.json');

  const insertProvider = db.prepare(
    `INSERT INTO providers (id, name, job_type, rating, review_count, hourly_rate, callout_fee, currency, location, coverage_radius_miles, response_time, bio, specialisms, sample_jobs, certifications, years_in_business, insurance, website, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of providers) {
    insertProvider.run(p.id, p.name, p.job_type, p.rating, p.review_count, p.hourly_rate, p.callout_fee, p.currency, p.location, p.coverage_radius_miles, p.response_time, p.bio, p.specialisms, p.sample_jobs, p.certifications, p.years_in_business, p.insurance, p.website, p.phone);
  }

  const insertReview = db.prepare(
    'INSERT INTO reviews (id, provider_id, reviewer_name, rating, date, job_type, comment) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const r of reviews) {
    insertReview.run(r.id, r.provider_id, r.reviewer_name, r.rating, r.date, r.job_type, r.comment);
  }

  const insertAvailability = db.prepare(
    'INSERT INTO availability (provider_id, day_offset, time_slot, available) VALUES (?, ?, ?, ?)'
  );
  for (const a of availability) {
    insertAvailability.run(a.provider_id, a.day_offset, a.time_slot, a.available);
  }

  const insertBooking = db.prepare(
    'INSERT INTO bookings (booking_ref, provider_id, provider_name, status, date, time, job_description, estimated_cost, currency, notes, customer_name, customer_phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const b of bookings) {
    insertBooking.run(b.booking_ref, b.provider_id, b.provider_name, b.status, b.date, b.time, b.job_description, b.estimated_cost, b.currency, b.notes, b.customer_name, b.customer_phone, b.address);
  }

  const insertQuote = db.prepare(
    'INSERT INTO quote_estimates (job_type, sub_type, location, min_cost, max_cost, typical_duration, includes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const q of quotes) {
    insertQuote.run(q.job_type, q.sub_type, q.location, q.min_cost, q.max_cost, q.typical_duration, q.includes);
  }

  db.prepare("INSERT OR REPLACE INTO _data_meta (id, version) VALUES ('marketplace_data', ?)").run(DATA_VERSION);
}
