import type Database from 'better-sqlite3';
import type { ColumnDef } from './types.js';

export function seedTable(
  db: Database.Database,
  tableName: string,
  columns: ColumnDef[],
  data: Record<string, unknown>[],
): void {
  const columnDefs = columns.map(col => {
    let def = `"${col.name}" ${col.type}`;
    if (col.primaryKey) def += ' PRIMARY KEY';
    if (col.notNull) def += ' NOT NULL';
    if (col.defaultValue !== undefined) def += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
    return def;
  }).join(', ');

  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs})`);

  const count = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
  if (count.count > 0) return;

  const colNames = columns.map(c => `"${c.name}"`).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const insert = db.prepare(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`);

  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col.name];
        if (val === undefined || val === null) return null;
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      insert.run(...values);
    }
  });

  insertMany(data);
}

export function seedTableRaw(
  db: Database.Database,
  tableName: string,
  createSQL: string,
  data: Record<string, unknown>[],
): void {
  db.exec(createSQL);

  const count = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
  if (count.count > 0) return;

  if (data.length === 0) return;

  const colNames = Object.keys(data[0]!);
  const cols = colNames.map(c => `"${c}"`).join(', ');
  const placeholders = colNames.map(() => '?').join(', ');
  const insert = db.prepare(`INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`);

  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const values = colNames.map(col => {
        const val = row[col];
        if (val === undefined || val === null) return null;
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      insert.run(...values);
    }
  });

  insertMany(data);
}
