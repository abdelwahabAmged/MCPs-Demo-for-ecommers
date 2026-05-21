import type Database from 'better-sqlite3';

export function seedPartsData(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      variant TEXT,
      engine_code TEXT,
      front_disc_mm INTEGER,
      rear_disc_mm INTEGER
    )
  `);

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
      weight_kg REAL
    )
  `);

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS branch_stock (
      branch TEXT NOT NULL,
      part_number TEXT NOT NULL,
      qty INTEGER DEFAULT 0,
      click_collect INTEGER DEFAULT 1,
      next_day_delivery INTEGER DEFAULT 1,
      PRIMARY KEY (branch, part_number),
      FOREIGN KEY (part_number) REFERENCES parts(part_number)
    )
  `);

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS symptom_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symptom_keywords TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      category TEXT NOT NULL,
      job_type TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS job_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      job_description TEXT NOT NULL,
      required_categories TEXT NOT NULL
    )
  `);

  const vehicleCount = db.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number };
  if (vehicleCount.c > 0) return;

  const insertVehicle = db.prepare(
    'INSERT INTO vehicles (id, make, model, year, variant, engine_code, front_disc_mm, rear_disc_mm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertVehicle.run(1, 'Volkswagen', 'Golf', 2019, 'Mk7.5 1.6 TDI', 'DGDB', 288, 272);
  insertVehicle.run(2, 'Ford', 'Focus', 2021, '2.0 EcoBlue', 'XWDA', 300, 271);
  insertVehicle.run(3, 'BMW', '3 Series', 2018, '320d F30', 'B47D20A', 330, 300);

  const insertPart = db.prepare(
    'INSERT INTO parts (part_number, name, category, type, oem_ref, price, currency, fitment_confidence, brand, description, weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // VW Golf parts
  insertPart.run('1J0615301E', 'Front Brake Pad Set', 'brake_pads', 'oem', null, 48.50, 'GBP', 100, 'VAG', 'Genuine VW front brake pads for 288mm disc', 1.2);
  insertPart.run('TRW-GDB1757', 'Front Brake Pad Set', 'brake_pads', 'aftermarket', '1J0615301E', 28.90, 'GBP', 98, 'TRW', 'TRW premium front brake pads, OE-quality replacement', 1.1);
  insertPart.run('BREMBO-P85063', 'Front Brake Pad Set', 'brake_pads', 'aftermarket', '1J0615301E', 34.50, 'GBP', 96, 'Brembo', 'Brembo P85063 front pads, low-dust compound', 1.15);
  insertPart.run('BUDGET-BP288', 'Front Brake Pad Set', 'brake_pads', 'aftermarket', '1J0615301E', 14.99, 'GBP', 91, 'Drivemaster', 'Budget front brake pads for 288mm disc', 1.0);
  insertPart.run('VW-DISC-288F', 'Front Brake Disc 288mm', 'brake_discs', 'oem', null, 85.00, 'GBP', 100, 'VAG', 'Genuine VW ventilated front disc 288mm', 6.8);
  insertPart.run('BREMBO-09A820', 'Front Brake Disc 288mm', 'brake_discs', 'aftermarket', 'VW-DISC-288F', 52.00, 'GBP', 98, 'Brembo', 'Brembo replacement ventilated disc 288mm', 6.5);
  insertPart.run('VW-OIL-FILTER', 'Oil Filter', 'filters', 'oem', null, 12.80, 'GBP', 100, 'VAG', 'Genuine VW oil filter for 1.6 TDI DGDB', 0.3);
  insertPart.run('MANN-W712-94', 'Oil Filter', 'filters', 'aftermarket', 'VW-OIL-FILTER', 8.50, 'GBP', 99, 'MANN', 'MANN premium oil filter, OE specification', 0.28);
  insertPart.run('VW-SERPBELT', 'Serpentine Belt', 'belts', 'oem', null, 38.00, 'GBP', 100, 'VAG', 'Genuine VW auxiliary drive belt 6PK1070', 0.4);
  insertPart.run('GATES-6PK1070', 'Serpentine Belt', 'belts', 'aftermarket', 'VW-SERPBELT', 22.50, 'GBP', 98, 'Gates', 'Gates Micro-V belt 6PK1070', 0.38);

  // Ford Focus parts
  insertPart.run('BFD-FF20-FRONT', 'Front Brake Pad Set', 'brake_pads', 'oem', null, 55.00, 'GBP', 100, 'Motorcraft', 'Genuine Ford/Motorcraft front pads for 300mm disc', 1.3);
  insertPart.run('FERODO-FDB4715', 'Front Brake Pad Set', 'brake_pads', 'aftermarket', 'BFD-FF20-FRONT', 32.50, 'GBP', 98, 'Ferodo', 'Ferodo Premier front pads, ECE R90 approved', 1.25);
  insertPart.run('FORD-DISC-300F', 'Front Brake Disc 300mm', 'brake_discs', 'oem', null, 95.00, 'GBP', 100, 'Motorcraft', 'Genuine Ford ventilated disc 300mm', 7.2);
  insertPart.run('BOSCH-BD2184', 'Front Brake Disc 300mm', 'brake_discs', 'aftermarket', 'FORD-DISC-300F', 58.00, 'GBP', 97, 'Bosch', 'Bosch disc 300mm, precision-balanced', 7.0);
  insertPart.run('FORD-SHOCK-F', 'Front Shock Absorber', 'shock_absorbers', 'oem', null, 125.00, 'GBP', 100, 'Motorcraft', 'Genuine Ford front shock absorber', 3.5);
  insertPart.run('SACHS-316591', 'Front Shock Absorber', 'shock_absorbers', 'aftermarket', 'FORD-SHOCK-F', 78.00, 'GBP', 97, 'Sachs', 'Sachs twin-tube front shock absorber', 3.3);
  insertPart.run('FORD-ABS-SENS', 'ABS Wheel Speed Sensor', 'sensors', 'oem', null, 62.00, 'GBP', 100, 'Motorcraft', 'Genuine Ford ABS sensor front left/right', 0.15);

  // BMW 3 Series parts
  insertPart.run('BMW-3F-PAD-330', 'Front Brake Pad Set', 'brake_pads', 'oem', null, 78.00, 'GBP', 100, 'BMW', 'Genuine BMW front pads for 330mm disc with sensor', 1.5);
  insertPart.run('TEXTAR-2529601', 'Front Brake Pad Set', 'brake_pads', 'aftermarket', 'BMW-3F-PAD-330', 45.00, 'GBP', 98, 'Textar', 'Textar premium front pads inc. wear sensor', 1.4);
  insertPart.run('BMW-DISC-330F', 'Front Brake Disc 330mm', 'brake_discs', 'oem', null, 180.00, 'GBP', 100, 'BMW', 'Genuine BMW ventilated front disc 330mm', 9.2);
  insertPart.run('ZIMMERMANN-150290', 'Front Brake Disc 330mm', 'brake_discs', 'aftermarket', 'BMW-DISC-330F', 95.00, 'GBP', 97, 'Zimmermann', 'Zimmermann Sport disc 330mm, precision-coated', 8.9);
  insertPart.run('BMW-AIR-FILTER', 'Air Filter', 'filters', 'oem', null, 32.00, 'GBP', 100, 'BMW', 'Genuine BMW air filter element for B47D20A', 0.6);
  insertPart.run('K&N-33-3072', 'Air Filter', 'filters', 'aftermarket', 'BMW-AIR-FILTER', 48.00, 'GBP', 95, 'K&N', 'K&N high-flow reusable air filter', 0.55);
  insertPart.run('BMW-WEAR-SENSOR', 'Brake Wear Sensor', 'sensors', 'oem', null, 28.00, 'GBP', 100, 'BMW', 'Genuine BMW front brake wear indicator sensor', 0.05);

  // Vehicle-part mappings
  const insertVP = db.prepare('INSERT INTO vehicle_parts (vehicle_id, part_number, job_type) VALUES (?, ?, ?)');

  // VW Golf mappings
  ['1J0615301E', 'TRW-GDB1757', 'BREMBO-P85063', 'BUDGET-BP288'].forEach(pn => insertVP.run(1, pn, 'front_brake_pads'));
  ['VW-DISC-288F', 'BREMBO-09A820'].forEach(pn => insertVP.run(1, pn, 'front_brake_discs'));
  ['VW-OIL-FILTER', 'MANN-W712-94'].forEach(pn => insertVP.run(1, pn, 'oil_service'));
  ['VW-SERPBELT', 'GATES-6PK1070'].forEach(pn => insertVP.run(1, pn, 'belt_replacement'));

  // Ford Focus mappings
  ['BFD-FF20-FRONT', 'FERODO-FDB4715'].forEach(pn => insertVP.run(2, pn, 'front_brake_pads'));
  ['FORD-DISC-300F', 'BOSCH-BD2184'].forEach(pn => insertVP.run(2, pn, 'front_brake_discs'));
  ['FORD-SHOCK-F', 'SACHS-316591'].forEach(pn => insertVP.run(2, pn, 'shock_absorber_replacement'));
  insertVP.run(2, 'FORD-ABS-SENS', 'abs_sensor_replacement');

  // BMW 3 Series mappings
  ['BMW-3F-PAD-330', 'TEXTAR-2529601'].forEach(pn => insertVP.run(3, pn, 'front_brake_pads'));
  ['BMW-DISC-330F', 'ZIMMERMANN-150290'].forEach(pn => insertVP.run(3, pn, 'front_brake_discs'));
  ['BMW-AIR-FILTER', 'K&N-33-3072'].forEach(pn => insertVP.run(3, pn, 'air_filter_replacement'));
  insertVP.run(3, 'BMW-WEAR-SENSOR', 'front_brake_pads');

  // Branch stock
  const insertStock = db.prepare(
    'INSERT INTO branch_stock (branch, part_number, qty, click_collect, next_day_delivery) VALUES (?, ?, ?, ?, ?)'
  );
  const branches = ['Manchester', 'Birmingham', 'Leeds', 'London'];
  const stockData: Record<string, Record<string, number>> = {
    'Manchester': { '1J0615301E': 4, 'TRW-GDB1757': 12, 'BREMBO-P85063': 6, 'BUDGET-BP288': 20, 'VW-DISC-288F': 2, 'BREMBO-09A820': 5, 'BFD-FF20-FRONT': 3, 'FERODO-FDB4715': 8, 'BMW-3F-PAD-330': 2, 'TEXTAR-2529601': 4, 'BMW-DISC-330F': 1, 'ZIMMERMANN-150290': 3 },
    'Birmingham': { '1J0615301E': 2, 'TRW-GDB1757': 8, 'BREMBO-P85063': 3, 'BUDGET-BP288': 15, 'VW-DISC-288F': 0, 'BREMBO-09A820': 2, 'BFD-FF20-FRONT': 5, 'FERODO-FDB4715': 10, 'FORD-DISC-300F': 3, 'BMW-3F-PAD-330': 0, 'TEXTAR-2529601': 6, 'FORD-SHOCK-F': 2 },
    'Leeds': { '1J0615301E': 0, 'TRW-GDB1757': 6, 'BREMBO-P85063': 0, 'BUDGET-BP288': 10, 'VW-DISC-288F': 3, 'BREMBO-09A820': 4, 'FORD-DISC-300F': 1, 'BOSCH-BD2184': 2, 'BMW-DISC-330F': 2, 'ZIMMERMANN-150290': 1, 'BMW-AIR-FILTER': 4 },
    'London': { '1J0615301E': 6, 'TRW-GDB1757': 15, 'BREMBO-P85063': 8, 'BUDGET-BP288': 25, 'VW-DISC-288F': 4, 'BREMBO-09A820': 7, 'BFD-FF20-FRONT': 6, 'FERODO-FDB4715': 12, 'FORD-DISC-300F': 4, 'BMW-3F-PAD-330': 3, 'TEXTAR-2529601': 5, 'BMW-DISC-330F': 2, 'ZIMMERMANN-150290': 4, 'FORD-SHOCK-F': 3, 'SACHS-316591': 5, 'FORD-ABS-SENS': 4, 'BMW-WEAR-SENSOR': 6 },
  };

  for (const branch of branches) {
    const parts = stockData[branch]!;
    for (const [pn, qty] of Object.entries(parts)) {
      insertStock.run(branch, pn, qty, 1, 1);
    }
  }

  // Substitutes
  const insertSub = db.prepare(
    'INSERT INTO substitutes (original_part, substitute_part, fitment_confidence, notes) VALUES (?, ?, ?, ?)'
  );
  insertSub.run('1J0615301E', 'TRW-GDB1757', 98, 'Direct OE-quality replacement, same friction compound');
  insertSub.run('1J0615301E', 'BREMBO-P85063', 96, 'Premium alternative, low-dust formulation');
  insertSub.run('1J0615301E', 'BUDGET-BP288', 91, 'Budget option, meets minimum ECE R90 standard');
  insertSub.run('BFD-FF20-FRONT', 'FERODO-FDB4715', 98, 'Ferodo Premier range, equivalent stopping power');
  insertSub.run('BMW-3F-PAD-330', 'TEXTAR-2529601', 98, 'Textar OE supplier, includes wear sensor');
  insertSub.run('VW-DISC-288F', 'BREMBO-09A820', 98, 'Brembo direct replacement, same geometry');
  insertSub.run('FORD-DISC-300F', 'BOSCH-BD2184', 97, 'Bosch precision disc, suitable replacement');
  insertSub.run('BMW-DISC-330F', 'ZIMMERMANN-150290', 97, 'Zimmermann Sport, anti-corrosion coated');
  insertSub.run('FORD-SHOCK-F', 'SACHS-316591', 97, 'Sachs OE supplier to many manufacturers');

  // Symptom mappings
  const insertSymptom = db.prepare(
    'INSERT INTO symptom_mappings (symptom_keywords, diagnosis, category, job_type) VALUES (?, ?, ?, ?)'
  );
  insertSymptom.run('grinding,noise,braking,brake,squeal', 'Worn brake pads — friction material depleted, metal-on-metal contact', 'brake_pads', 'front_brake_pads');
  insertSymptom.run('vibration,judder,pulsing,brake,pedal', 'Warped or worn brake discs — uneven surface causing pulsation', 'brake_discs', 'front_brake_discs');
  insertSymptom.run('pulling,one side,braking,uneven', 'Sticking brake caliper or uneven pad wear — inspect calipers and pads', 'brake_pads', 'front_brake_pads');
  insertSymptom.run('bouncing,harsh,ride,bumps,clunking', 'Worn shock absorbers — damping capacity reduced', 'shock_absorbers', 'shock_absorber_replacement');
  insertSymptom.run('squeaking,belt,cold,startup,whine', 'Worn or glazed serpentine/auxiliary belt', 'belts', 'belt_replacement');
  insertSymptom.run('abs,light,warning,wheel,speed', 'Faulty ABS wheel speed sensor — signal intermittent or lost', 'sensors', 'abs_sensor_replacement');
  insertSymptom.run('brake,warning,light,pad,indicator', 'Brake wear sensor triggered — pads at minimum thickness', 'sensors', 'front_brake_pads');

  // Job templates
  const insertJob = db.prepare(
    'INSERT INTO job_templates (job_name, job_description, required_categories) VALUES (?, ?, ?)'
  );
  insertJob.run('Full Front Brake Service', 'Complete front brake overhaul including pads, discs, and wear sensor', JSON.stringify(['brake_pads', 'brake_discs', 'sensors']));
  insertJob.run('Front Pad Replacement', 'Front brake pad replacement only', JSON.stringify(['brake_pads']));
  insertJob.run('Oil Service', 'Engine oil and filter change', JSON.stringify(['filters']));
  insertJob.run('Belt Replacement', 'Auxiliary/serpentine belt replacement', JSON.stringify(['belts']));
  insertJob.run('Shock Absorber Replacement', 'Front shock absorber replacement (pair)', JSON.stringify(['shock_absorbers']));
}
