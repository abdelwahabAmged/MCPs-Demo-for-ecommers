import type Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_VERSION = 2;

interface VehicleRow {
  id: number;
  make: string;
  model: string;
  year: number;
  variant: string;
  engine_code: string;
  fuel_type: string;
  power_hp: number;
  transmission: string;
  body_type: string;
  front_disc_mm: number;
  rear_disc_mm: number;
  front_brake_type: string;
  rear_brake_type: string;
  image_url: string | null;
}

interface PartRow {
  part_number: string;
  name: string;
  category: string;
  type: string;
  oem_ref: string | null;
  price: number;
  currency: string;
  fitment_confidence: number;
  brand: string;
  description: string;
  weight_kg: number;
  position: string | null;
}

interface VehiclePartRow {
  vehicle_id: number;
  part_number: string;
  job_type: string;
}

interface SubstituteRow {
  original_part: string;
  substitute_part: string;
  fitment_confidence: number;
  notes: string;
}

interface SymptomRow {
  symptom_keywords: string;
  diagnosis: string;
  category: string;
  job_type: string;
}

interface JobTemplateRow {
  job_name: string;
  job_description: string;
  required_categories: string[];
  position: string | null;
}

interface BranchRow {
  name: string;
  address: string;
  phone: string;
  email: string;
  opening_hours: string;
  click_collect_hours: string;
  lat: number;
  lng: number;
}

function loadJSON<T>(filename: string): T {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

function isDataCurrent(db: Database.Database): boolean {
  try {
    const row = db.prepare("SELECT version FROM _data_meta WHERE id = 'parts_data'").get() as { version: number } | undefined;
    return row?.version === DATA_VERSION;
  } catch {
    return false;
  }
}

function dropCatalogueTables(db: Database.Database): void {
  db.exec('DROP TABLE IF EXISTS branch_stock');
  db.exec('DROP TABLE IF EXISTS substitutes');
  db.exec('DROP TABLE IF EXISTS vehicle_parts');
  db.exec('DROP TABLE IF EXISTS symptom_mappings');
  db.exec('DROP TABLE IF EXISTS job_templates');
  db.exec('DROP TABLE IF EXISTS parts');
  db.exec('DROP TABLE IF EXISTS vehicles');
  db.exec('DROP TABLE IF EXISTS branches');
}

function ensureRuntimeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS carts (
      cart_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      vehicle_id INTEGER,
      job_name TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL,
      part_number TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      branch TEXT,
      FOREIGN KEY (cart_id) REFERENCES carts(cart_id),
      FOREIGN KEY (part_number) REFERENCES parts(part_number)
    )
  `);
}

export function seedPartsData(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _data_meta (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    )
  `);

  if (isDataCurrent(db)) {
    ensureRuntimeTables(db);
    return;
  }

  dropCatalogueTables(db);

  // Vehicles
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      variant TEXT,
      engine_code TEXT,
      fuel_type TEXT,
      power_hp INTEGER,
      transmission TEXT,
      body_type TEXT,
      front_disc_mm INTEGER,
      rear_disc_mm INTEGER,
      front_brake_type TEXT,
      rear_brake_type TEXT,
      image_url TEXT
    )
  `);

  // Parts
  db.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      part_number TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('oem','aftermarket')),
      oem_ref TEXT,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'GBP',
      fitment_confidence INTEGER DEFAULT 100,
      brand TEXT,
      description TEXT,
      weight_kg REAL,
      position TEXT
    )
  `);

  // Vehicle-Part fitment
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_parts (
      vehicle_id INTEGER NOT NULL,
      part_number TEXT NOT NULL,
      job_type TEXT NOT NULL,
      PRIMARY KEY (vehicle_id, part_number, job_type),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (part_number) REFERENCES parts(part_number)
    )
  `);

  // Branch metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      name TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      opening_hours TEXT,
      click_collect_hours TEXT,
      lat REAL,
      lng REAL
    )
  `);

  // Branch stock
  db.exec(`
    CREATE TABLE IF NOT EXISTS branch_stock (
      branch TEXT NOT NULL,
      part_number TEXT NOT NULL,
      qty INTEGER DEFAULT 0,
      click_collect INTEGER DEFAULT 1,
      next_day_delivery INTEGER DEFAULT 1,
      PRIMARY KEY (branch, part_number),
      FOREIGN KEY (branch) REFERENCES branches(name),
      FOREIGN KEY (part_number) REFERENCES parts(part_number)
    )
  `);

  // Substitutes
  db.exec(`
    CREATE TABLE IF NOT EXISTS substitutes (
      original_part TEXT NOT NULL,
      substitute_part TEXT NOT NULL,
      fitment_confidence INTEGER NOT NULL,
      notes TEXT,
      PRIMARY KEY (original_part, substitute_part),
      FOREIGN KEY (original_part) REFERENCES parts(part_number),
      FOREIGN KEY (substitute_part) REFERENCES parts(part_number)
    )
  `);

  // Symptom mappings
  db.exec(`
    CREATE TABLE IF NOT EXISTS symptom_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symptom_keywords TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      category TEXT NOT NULL,
      job_type TEXT NOT NULL
    )
  `);

  // Job templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      job_description TEXT NOT NULL,
      required_categories TEXT NOT NULL,
      position TEXT
    )
  `);

  // Load data from JSON files
  const vehicles = loadJSON<VehicleRow[]>('vehicles.json');
  const partsData = loadJSON<{
    parts: PartRow[];
    vehicle_parts: VehiclePartRow[];
    substitutes: SubstituteRow[];
    symptom_mappings: SymptomRow[];
    job_templates: JobTemplateRow[];
    branch_stock: Record<string, Record<string, number>>;
  }>('parts.json');
  const branchesData = loadJSON<BranchRow[]>('branches.json');

  const insertVehicle = db.prepare(
    'INSERT INTO vehicles (id, make, model, year, variant, engine_code, fuel_type, power_hp, transmission, body_type, front_disc_mm, rear_disc_mm, front_brake_type, rear_brake_type, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const v of vehicles) {
    insertVehicle.run(v.id, v.make, v.model, v.year, v.variant, v.engine_code, v.fuel_type, v.power_hp, v.transmission, v.body_type, v.front_disc_mm, v.rear_disc_mm, v.front_brake_type, v.rear_brake_type, v.image_url);
  }

  const insertPart = db.prepare(
    'INSERT INTO parts (part_number, name, category, type, oem_ref, price, currency, fitment_confidence, brand, description, weight_kg, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const p of partsData.parts) {
    insertPart.run(p.part_number, p.name, p.category, p.type, p.oem_ref, p.price, p.currency, p.fitment_confidence, p.brand, p.description, p.weight_kg, p.position);
  }

  const insertVP = db.prepare('INSERT INTO vehicle_parts (vehicle_id, part_number, job_type) VALUES (?, ?, ?)');
  for (const vp of partsData.vehicle_parts) {
    insertVP.run(vp.vehicle_id, vp.part_number, vp.job_type);
  }

  const insertBranch = db.prepare(
    'INSERT INTO branches (name, address, phone, email, opening_hours, click_collect_hours, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const b of branchesData) {
    insertBranch.run(b.name, b.address, b.phone, b.email, b.opening_hours, b.click_collect_hours, b.lat, b.lng);
  }

  const insertStock = db.prepare(
    'INSERT INTO branch_stock (branch, part_number, qty, click_collect, next_day_delivery) VALUES (?, ?, ?, ?, ?)'
  );
  for (const [branch, parts] of Object.entries(partsData.branch_stock)) {
    for (const [pn, qty] of Object.entries(parts)) {
      insertStock.run(branch, pn, qty, 1, 1);
    }
  }

  const insertSub = db.prepare(
    'INSERT INTO substitutes (original_part, substitute_part, fitment_confidence, notes) VALUES (?, ?, ?, ?)'
  );
  for (const s of partsData.substitutes) {
    insertSub.run(s.original_part, s.substitute_part, s.fitment_confidence, s.notes);
  }

  const insertSymptom = db.prepare(
    'INSERT INTO symptom_mappings (symptom_keywords, diagnosis, category, job_type) VALUES (?, ?, ?, ?)'
  );
  for (const sm of partsData.symptom_mappings) {
    insertSymptom.run(sm.symptom_keywords, sm.diagnosis, sm.category, sm.job_type);
  }

  const insertJob = db.prepare(
    'INSERT INTO job_templates (job_name, job_description, required_categories, position) VALUES (?, ?, ?, ?)'
  );
  for (const jt of partsData.job_templates) {
    insertJob.run(jt.job_name, jt.job_description, JSON.stringify(jt.required_categories), jt.position);
  }

  ensureRuntimeTables(db);

  // Update version stamp
  db.prepare("INSERT OR REPLACE INTO _data_meta (id, version) VALUES ('parts_data', ?)").run(DATA_VERSION);
}
