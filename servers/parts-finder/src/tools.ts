import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

interface Part {
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

interface Vehicle {
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
}

interface BranchStock {
  branch: string;
  part_number: string;
  qty: number;
  click_collect: number;
  next_day_delivery: number;
}

interface Branch {
  name: string;
  address: string;
  phone: string;
  email: string;
  opening_hours: string;
  click_collect_hours: string;
  lat: number;
  lng: number;
}

interface Substitute {
  original_part: string;
  substitute_part: string;
  fitment_confidence: number;
  notes: string;
}

interface SymptomMapping {
  id: number;
  symptom_keywords: string;
  diagnosis: string;
  category: string;
  job_type: string;
}

interface JobTemplate {
  id: number;
  job_name: string;
  job_description: string;
  required_categories: string;
  position: string | null;
}

function withLog(db: Database.Database, toolName: string, sessionId: string | undefined, input: unknown, fn: () => unknown) {
  const start = performance.now();
  try {
    const result = fn();
    const latency = performance.now() - start;
    logToolCall(db, toolName, input, 'success', latency, sessionId);
    return result;
  } catch (err) {
    const latency = performance.now() - start;
    logToolCall(db, toolName, input, `error: ${err}`, latency, sessionId);
    throw err;
  }
}

function formatPrice(price: number, currency: string): string {
  return currency === 'GBP' ? `£${price.toFixed(2)}` : `${price.toFixed(2)} ${currency}`;
}

function findVehicle(db: Database.Database, make: string, model: string, year: number, engine?: string): Vehicle | undefined {
  let sql = 'SELECT * FROM vehicles WHERE LOWER(make) LIKE ? AND LOWER(model) LIKE ? AND year = ?';
  const params: unknown[] = [`%${make.toLowerCase()}%`, `%${model.toLowerCase()}%`, year];
  if (engine) {
    sql += ' AND LOWER(engine_code) LIKE ?';
    params.push(`%${engine.toLowerCase()}%`);
  }
  return db.prepare(sql).get(...params) as Vehicle | undefined;
}

function findVehicleFuzzy(db: Database.Database, description: string): Vehicle | undefined {
  const tokens = description.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1);
  const vehicles = db.prepare('SELECT * FROM vehicles').all() as Vehicle[];

  let best: Vehicle | undefined;
  let bestScore = 0;

  for (const v of vehicles) {
    const haystack = `${v.make} ${v.model} ${v.year} ${v.variant} ${v.engine_code}`.toLowerCase();
    const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return bestScore >= 2 ? best : undefined;
}

function getBaseUrl(): string {
  const port = process.env['PORT'] || '3003';
  if (process.env['RAILWAY_PUBLIC_DOMAIN']) {
    return `https://${process.env['RAILWAY_PUBLIC_DOMAIN']}`;
  }
  return process.env['BASE_URL'] || `http://localhost:${port}`;
}

export function registerPartsTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  // ──────────────────────────────────────────────────────────────
  // Tool 1: Find by Vehicle
  // ──────────────────────────────────────────────────────────────
  server.registerTool('find_by_vehicle', {
    title: 'Find Parts by Vehicle',
    description: 'Return compatible parts for a specific vehicle (make/model/year/engine) and job type. Shows OEM and aftermarket options with prices, fitment confidence, and availability.',
    inputSchema: {
      make: z.string().describe('Vehicle manufacturer (e.g., "Volkswagen", "Ford", "BMW")'),
      model: z.string().describe('Vehicle model (e.g., "Golf", "Focus", "3 Series")'),
      year: z.number().describe('Model year (e.g., 2019)'),
      engine: z.string().optional().describe('Engine code if known (e.g., "DGDB", "XWDA", "B47D20A")'),
      job_type: z.string().describe('Type of job/repair (e.g., "front_brake_pads", "rear_brake_pads", "oil_service", "timing_belt_replacement")'),
    },
  }, async ({ make, model, year, engine, job_type }) => {
    return withLog(db, 'find_by_vehicle', getSessionId(), { make, model, year, engine, job_type }, () => {
      const vehicle = findVehicle(db, make, model, year, engine);
      if (!vehicle) {
        return { content: [{ type: 'text' as const, text: `No vehicle found matching ${year} ${make} ${model}${engine ? ` (${engine})` : ''}. Available vehicles: 2019 VW Golf 1.6 TDI, 2021 Ford Focus 2.0 EcoBlue, 2018 BMW 3 Series 320d.` }] };
      }

      const parts = db.prepare(`
        SELECT p.* FROM parts p
        JOIN vehicle_parts vp ON p.part_number = vp.part_number
        WHERE vp.vehicle_id = ? AND vp.job_type = ?
        ORDER BY p.type ASC, p.fitment_confidence DESC
      `).all(vehicle.id, job_type) as Part[];

      if (parts.length === 0) {
        const availableJobs = db.prepare(
          'SELECT DISTINCT job_type FROM vehicle_parts WHERE vehicle_id = ?'
        ).all(vehicle.id) as { job_type: string }[];
        const jobList = availableJobs.map(j => j.job_type).join(', ');
        return { content: [{ type: 'text' as const, text: `No parts found for "${job_type}" on ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.variant}).\n\nAvailable job types for this vehicle: ${jobList}` }] };
      }

      const oem = parts.filter(p => p.type === 'oem');
      const aftermarket = parts.filter(p => p.type === 'aftermarket');

      const header = `## Compatible Parts: ${vehicle.year} ${vehicle.make} ${vehicle.model}\n` +
        `**Variant:** ${vehicle.variant} | **Engine:** ${vehicle.engine_code} | **Job:** ${job_type.replace(/_/g, ' ')}\n`;

      const lines = parts.map(p => {
        const badge = p.type === 'oem' ? '🏭 OEM' : '🔧 Aftermarket';
        return `### ${badge} — ${p.brand} ${p.name}\n` +
          `| Field | Value |\n|---|---|\n` +
          `| Part # | \`${p.part_number}\` |\n` +
          `| Price | ${formatPrice(p.price, p.currency)} |\n` +
          `| Fitment | ${p.fitment_confidence}% |\n` +
          `| Weight | ${p.weight_kg} kg |\n` +
          (p.position ? `| Position | ${p.position} |\n` : '') +
          `\n${p.description}`;
      }).join('\n\n---\n\n');

      let nudge = '';
      if (oem.length > 0 && aftermarket.length > 0) {
        const savings = oem[0]!.price - aftermarket[0]!.price;
        if (savings > 0) {
          nudge = `\n\n---\n💡 **Tip:** The top aftermarket option saves ${formatPrice(savings, 'GBP')} vs OEM with ${aftermarket[0]!.fitment_confidence}% fitment confidence. Would you like a detailed OEM vs aftermarket comparison?`;
        }
      }

      const stockNudge = `\n\n💡 **Next step:** Would you like to check local stock availability or add these parts to a cart?`;

      return { content: [{ type: 'text' as const, text: `${header}\n${lines}${nudge}${stockNudge}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 2: Find by Symptom
  // ──────────────────────────────────────────────────────────────
  server.registerTool('find_by_symptom', {
    title: 'Find Parts by Symptom',
    description: 'Diagnose a problem from a described symptom and return likely parts needed. Provides diagnosis explanation and recommended parts for the described vehicle.',
    inputSchema: {
      vehicle_description: z.string().describe('Vehicle description (e.g., "2019 VW Golf 1.6 TDI")'),
      symptom: z.string().describe('Describe the symptom (e.g., "grinding noise when braking", "vibration through brake pedal", "timing belt rattle on startup")'),
    },
  }, async ({ vehicle_description, symptom }) => {
    return withLog(db, 'find_by_symptom', getSessionId(), { vehicle_description, symptom }, () => {
      const symptomLower = symptom.toLowerCase();
      const allSymptoms = db.prepare('SELECT * FROM symptom_mappings').all() as SymptomMapping[];

      const matched = allSymptoms
        .map(s => {
          const keywords = s.symptom_keywords.split(',');
          const score = keywords.reduce((acc, kw) => acc + (symptomLower.includes(kw.trim()) ? 1 : 0), 0);
          return { mapping: s, score };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (matched.length === 0) {
        return { content: [{ type: 'text' as const, text: `Could not match symptom "${symptom}" to a known issue.\n\nTry describing: grinding/squealing brakes, vibration when braking, pulling to one side, harsh ride, belt squeak, ABS warning light, brake warning light, timing belt noise, or overheating.` }] };
      }

      const top = matched[0]!.mapping;
      const vehicle = findVehicleFuzzy(db, vehicle_description);

      let partsSection = '';
      let stockHint = '';
      if (vehicle) {
        const parts = db.prepare(`
          SELECT p.* FROM parts p
          JOIN vehicle_parts vp ON p.part_number = vp.part_number
          WHERE vp.vehicle_id = ? AND vp.job_type = ?
          ORDER BY p.type ASC, p.fitment_confidence DESC
        `).all(vehicle.id, top.job_type) as Part[];

        if (parts.length > 0) {
          const oem = parts.filter(p => p.type === 'oem');
          const aftermarket = parts.filter(p => p.type === 'aftermarket');

          partsSection = '\n\n## Recommended Parts for ' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model + '\n\n';
          partsSection += '| Type | Brand | Part # | Price | Fitment |\n|---|---|---|---|---|\n';
          parts.forEach(p => {
            partsSection += `| ${p.type.toUpperCase()} | ${p.brand} | \`${p.part_number}\` | ${formatPrice(p.price, p.currency)} | ${p.fitment_confidence}% |\n`;
          });

          if (oem.length > 0 && aftermarket.length > 0) {
            const savings = oem[0]!.price - aftermarket[0]!.price;
            partsSection += `\n💰 **Save ${formatPrice(savings, 'GBP')}** by choosing ${aftermarket[0]!.brand} aftermarket (${aftermarket[0]!.fitment_confidence}% fitment).`;
          }

          stockHint = '\n\n💡 **Next steps:** Check stock at your local branch, compare OEM vs aftermarket in detail, or build a full job parts list.';
        }
      } else {
        partsSection = '\n\n⚠ Could not identify vehicle. Please specify make, model, year and engine for part recommendations.';
      }

      const severity = top.category === 'timing_kits' ? '\n\n⚠️ **CRITICAL:** This is a safety-critical component. Failure can cause catastrophic engine damage. Do not delay replacement.' : '';

      const text = `## 🔍 Diagnosis\n\n**Reported symptom:** ${symptom}\n**Likely cause:** ${top.diagnosis}\n**Affected system:** ${top.category.replace(/_/g, ' ')}\n**Recommended job:** ${top.job_type.replace(/_/g, ' ')}${severity}${partsSection}${stockHint}`;
      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 3: Find by Part Number
  // ──────────────────────────────────────────────────────────────
  server.registerTool('find_by_part_number', {
    title: 'Find by Part Number',
    description: 'Look up a part by its OEM or aftermarket part number. Returns full details including price, fitment, compatible vehicles, and stock availability across all branches.',
    inputSchema: {
      part_number: z.string().describe('OEM or aftermarket part number (e.g., "1J0615301E", "TRW-GDB1757")'),
    },
  }, async ({ part_number }) => {
    return withLog(db, 'find_by_part_number', getSessionId(), { part_number }, () => {
      const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
      if (!part) {
        const similar = db.prepare('SELECT part_number, name, brand FROM parts WHERE part_number LIKE ? LIMIT 5').all(`%${part_number.slice(0, 5)}%`) as Part[];
        let suggestion = '';
        if (similar.length > 0) {
          suggestion = '\n\nDid you mean: ' + similar.map(s => `\`${s.part_number}\` (${s.brand} ${s.name})`).join(', ') + '?';
        }
        return { content: [{ type: 'text' as const, text: `Part number "${part_number}" not found in our catalogue.${suggestion}` }] };
      }

      const vehicles = db.prepare(`
        SELECT v.*, vp.job_type FROM vehicles v
        JOIN vehicle_parts vp ON v.id = vp.vehicle_id
        WHERE vp.part_number = ?
      `).all(part_number) as (Vehicle & { job_type: string })[];

      const stock = db.prepare(`
        SELECT bs.*, b.address, b.phone, b.opening_hours
        FROM branch_stock bs
        JOIN branches b ON bs.branch = b.name
        WHERE bs.part_number = ?
        ORDER BY bs.qty DESC
      `).all(part_number) as (BranchStock & { address: string; phone: string; opening_hours: string })[];

      const vehicleList = vehicles.length > 0
        ? vehicles.map(v => `• ${v.year} ${v.make} ${v.model} (${v.variant}) — *${v.job_type.replace(/_/g, ' ')}*`).join('\n')
        : 'No vehicle fitment data available';

      const stockRows = stock.length > 0
        ? stock.map(s => {
            const icon = s.qty > 5 ? '🟢' : s.qty > 0 ? '🟡' : '🔴';
            return `| ${icon} ${s.branch} | ${s.qty} | ${s.qty > 0 && s.click_collect ? '✓' : '—'} | ${s.next_day_delivery ? '✓' : '—'} |`;
          }).join('\n')
        : '| — | Out of stock everywhere | — | — |';

      const text =
        `# ${part.brand} ${part.name}\n\n` +
        `| Field | Value |\n|---|---|\n` +
        `| Part # | \`${part.part_number}\` |\n` +
        `| Type | ${part.type.toUpperCase()} |\n` +
        `| Category | ${part.category.replace(/_/g, ' ')} |\n` +
        `| Price | ${formatPrice(part.price, part.currency)} |\n` +
        `| Fitment Confidence | ${part.fitment_confidence}% |\n` +
        `| Weight | ${part.weight_kg} kg |\n` +
        (part.oem_ref ? `| OEM Reference | \`${part.oem_ref}\` |\n` : '') +
        (part.position ? `| Position | ${part.position} |\n` : '') +
        `\n**Description:** ${part.description}\n\n` +
        `## Compatible Vehicles\n${vehicleList}\n\n` +
        `## Stock Availability\n| Branch | Qty | Click & Collect | Next-Day |\n|---|---|---|---|\n${stockRows}\n\n` +
        `💡 **Actions:** Check substitutes, compare OEM vs aftermarket, or add to cart.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 4: Compare OEM vs Aftermarket
  // ──────────────────────────────────────────────────────────────
  server.registerTool('compare_oem_aftermarket', {
    title: 'Compare OEM vs Aftermarket',
    description: 'Side-by-side comparison of OEM and aftermarket parts. Can look up by part number or by vehicle + job type. Shows price difference, fitment confidence, and brand details.',
    inputSchema: {
      part_number: z.string().optional().describe('OEM part number to compare against aftermarket options'),
      make: z.string().optional().describe('Vehicle make (use with model/year/job_type instead of part_number)'),
      model: z.string().optional().describe('Vehicle model'),
      year: z.number().optional().describe('Vehicle year'),
      job_type: z.string().optional().describe('Job type (e.g., "front_brake_pads", "rear_brake_pads", "timing_belt_replacement")'),
    },
  }, async ({ part_number, make, model, year, job_type }) => {
    return withLog(db, 'compare_oem_aftermarket', getSessionId(), { part_number, make, model, year, job_type }, () => {
      let oemPart: Part | undefined;
      let aftermarketParts: Part[] = [];
      let vehicleInfo = '';

      if (part_number) {
        const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
        if (!part) {
          return { content: [{ type: 'text' as const, text: `Part "${part_number}" not found in catalogue.` }] };
        }

        if (part.type === 'oem') {
          oemPart = part;
          aftermarketParts = db.prepare('SELECT * FROM parts WHERE oem_ref = ? ORDER BY fitment_confidence DESC').all(part_number) as Part[];
        } else {
          oemPart = part.oem_ref ? db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part.oem_ref) as Part | undefined : undefined;
          aftermarketParts = oemPart
            ? db.prepare('SELECT * FROM parts WHERE oem_ref = ? ORDER BY fitment_confidence DESC').all(oemPart.part_number) as Part[]
            : [part];
        }
      } else if (make && model && year && job_type) {
        const vehicle = findVehicle(db, make, model, year);
        if (!vehicle) {
          return { content: [{ type: 'text' as const, text: `Vehicle not found. Available: 2019 VW Golf 1.6 TDI, 2021 Ford Focus 2.0 EcoBlue, 2018 BMW 3 Series 320d.` }] };
        }
        vehicleInfo = `**Vehicle:** ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.variant})\n`;

        const parts = db.prepare(`
          SELECT p.* FROM parts p
          JOIN vehicle_parts vp ON p.part_number = vp.part_number
          WHERE vp.vehicle_id = ? AND vp.job_type = ?
          ORDER BY p.type ASC, p.fitment_confidence DESC
        `).all(vehicle.id, job_type) as Part[];

        oemPart = parts.find(p => p.type === 'oem');
        aftermarketParts = parts.filter(p => p.type === 'aftermarket');
      } else {
        return { content: [{ type: 'text' as const, text: 'Please provide either a `part_number`, or `make` + `model` + `year` + `job_type` for comparison.' }] };
      }

      if (!oemPart && aftermarketParts.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No parts found for comparison.' }] };
      }

      let text = `## OEM vs Aftermarket Comparison\n${vehicleInfo}\n`;

      if (oemPart) {
        text += `### 🏭 OEM Option — ${oemPart.brand}\n\n`;
        text += `| Attribute | Value |\n|---|---|\n`;
        text += `| Part # | \`${oemPart.part_number}\` |\n`;
        text += `| Price | **${formatPrice(oemPart.price, oemPart.currency)}** |\n`;
        text += `| Fitment | ${oemPart.fitment_confidence}% |\n`;
        text += `| Weight | ${oemPart.weight_kg} kg |\n`;
        text += `\n${oemPart.description}\n\n`;
      }

      if (aftermarketParts.length > 0) {
        text += `### 🔧 Aftermarket Options\n\n`;
        text += `| # | Brand | Part # | Price | Savings | Fitment | Notes |\n|---|---|---|---|---|---|---|\n`;
        aftermarketParts.forEach((p, i) => {
          const savings = oemPart ? `**${formatPrice(oemPart.price - p.price, p.currency)}** (${Math.round((1 - p.price / oemPart.price) * 100)}% off)` : '—';
          text += `| ${i + 1} | ${p.brand} | \`${p.part_number}\` | ${formatPrice(p.price, p.currency)} | ${savings} | ${p.fitment_confidence}% | ${p.description} |\n`;
        });
      }

      if (oemPart && aftermarketParts.length > 0) {
        const best = aftermarketParts[0]!;
        text += `\n---\n\n### 📊 Recommendation\n`;
        text += `The **${best.brand}** option offers the best value: ${formatPrice(oemPart.price - best.price, 'GBP')} savings with ${best.fitment_confidence}% fitment confidence.\n\n`;
        text += `💡 **Next step:** Check stock availability or add your preferred option to cart.`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 5: Check Local Stock
  // ──────────────────────────────────────────────────────────────
  server.registerTool('check_local_stock', {
    title: 'Check Local Stock',
    description: 'Check stock availability at nearest branch(es). Shows quantity, click-and-collect availability, next-day delivery options, and branch details (address, phone, hours).',
    inputSchema: {
      part_number: z.string().describe('Part number to check stock for'),
      branch: z.string().optional().describe('Specific branch name (Manchester, Birmingham, Leeds, London). Omit to check all branches.'),
    },
  }, async ({ part_number, branch }) => {
    return withLog(db, 'check_local_stock', getSessionId(), { part_number, branch }, () => {
      const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
      if (!part) {
        return { content: [{ type: 'text' as const, text: `Part "${part_number}" not found in catalogue.` }] };
      }

      let stockQuery: string;
      let stockParams: unknown[];
      if (branch) {
        stockQuery = `
          SELECT bs.*, b.address, b.phone, b.opening_hours, b.click_collect_hours, b.email
          FROM branch_stock bs
          JOIN branches b ON bs.branch = b.name
          WHERE bs.part_number = ? AND LOWER(bs.branch) = LOWER(?)
        `;
        stockParams = [part_number, branch];
      } else {
        stockQuery = `
          SELECT bs.*, b.address, b.phone, b.opening_hours, b.click_collect_hours, b.email
          FROM branch_stock bs
          JOIN branches b ON bs.branch = b.name
          WHERE bs.part_number = ?
          ORDER BY bs.qty DESC
        `;
        stockParams = [part_number];
      }

      const stock = db.prepare(stockQuery).all(...stockParams) as (BranchStock & Branch)[];

      if (stock.length === 0) {
        const allBranches = branch ? `the ${branch} branch` : 'any branch';
        const subs = db.prepare('SELECT substitute_part FROM substitutes WHERE original_part = ? LIMIT 3').all(part_number) as { substitute_part: string }[];
        let subHint = '';
        if (subs.length > 0) {
          subHint = `\n\n💡 **Alternatives available:** ${subs.map(s => `\`${s.substitute_part}\``).join(', ')}. Use find_substitute for details.`;
        }
        return { content: [{ type: 'text' as const, text: `**${part.brand} ${part.name}** (\`${part.part_number}\`) is not stocked at ${allBranches}.${subHint}` }] };
      }

      const header = `## Stock: ${part.brand} ${part.name}\n` +
        `**Part #:** \`${part.part_number}\` | **Price:** ${formatPrice(part.price, part.currency)}\n`;

      const rows = stock.map(s => {
        const icon = s.qty > 5 ? '🟢' : s.qty > 0 ? '🟡' : '🔴';
        const status = s.qty > 5 ? 'In Stock' : s.qty > 0 ? `Low Stock (${s.qty} left)` : 'Out of Stock';
        const options: string[] = [];
        if (s.click_collect && s.qty > 0) options.push('🏪 Click & Collect (ready in 30 min)');
        if (s.next_day_delivery) options.push('🚚 Next-day delivery available');

        return `### ${icon} ${s.branch} — ${status} (${s.qty} units)\n` +
          `📍 ${s.address}\n` +
          `📞 ${s.phone}\n` +
          `🕐 ${s.opening_hours}\n` +
          (s.click_collect_hours ? `🏪 Collection hours: ${s.click_collect_hours}\n` : '') +
          (options.length > 0 ? `\n${options.join('\n')}\n` : '');
      }).join('\n---\n\n');

      const nudge = `\n💡 **Actions:** Add to cart for collection at your preferred branch, or find substitutes if stock is low.`;

      return { content: [{ type: 'text' as const, text: `${header}\n${rows}${nudge}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 6: Find Substitute
  // ──────────────────────────────────────────────────────────────
  server.registerTool('find_substitute', {
    title: 'Find Substitute Part',
    description: 'Find compatible substitute parts when a specific part is out of stock or you want alternatives. Shows fitment confidence percentage, price comparison, and compatibility notes.',
    inputSchema: {
      part_number: z.string().describe('Part number to find substitutes for'),
    },
  }, async ({ part_number }) => {
    return withLog(db, 'find_substitute', getSessionId(), { part_number }, () => {
      const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
      if (!part) {
        return { content: [{ type: 'text' as const, text: `Part "${part_number}" not found in catalogue.` }] };
      }

      const subs = db.prepare(`
        SELECT s.*, p.name, p.brand, p.price, p.currency, p.type, p.description, p.fitment_confidence as part_fitment
        FROM substitutes s
        JOIN parts p ON s.substitute_part = p.part_number
        WHERE s.original_part = ?
        ORDER BY s.fitment_confidence DESC
      `).all(part_number) as (Substitute & Pick<Part, 'name' | 'brand' | 'price' | 'currency' | 'type' | 'description'> & { part_fitment: number })[];

      if (subs.length === 0) {
        const reverseSubs = db.prepare(`
          SELECT s.*, p.name, p.brand, p.price, p.currency, p.type, p.description
          FROM substitutes s
          JOIN parts p ON s.original_part = p.part_number
          WHERE s.substitute_part = ?
          ORDER BY s.fitment_confidence DESC
        `).all(part_number) as (Substitute & Pick<Part, 'name' | 'brand' | 'price' | 'currency' | 'type' | 'description'>)[];

        if (reverseSubs.length === 0) {
          return { content: [{ type: 'text' as const, text: `No known substitutes for \`${part_number}\`. This may be a unique part — contact our parts specialists on 0800 123 4567 for custom recommendations.` }] };
        }

        const text = `## Substitutes for ${part.brand} ${part.name} (\`${part_number}\`)\n\n` +
          `ℹ️ This part is itself an aftermarket substitute. The original OEM part is:\n\n` +
          reverseSubs.map(s =>
            `• **${s.brand} ${s.name}** — \`${s.original_part}\` — ${formatPrice(s.price, s.currency)} (${s.type.toUpperCase()})\n  Fitment: ${s.fitment_confidence}% | ${s.notes}`
          ).join('\n\n');
        return { content: [{ type: 'text' as const, text }] };
      }

      // Check stock for each substitute
      const subsWithStock = subs.map(s => {
        const totalStock = db.prepare('SELECT SUM(qty) as total FROM branch_stock WHERE part_number = ?').get(s.substitute_part) as { total: number | null };
        return { ...s, totalStock: totalStock.total || 0 };
      });

      const text = `## Substitutes for ${part.brand} ${part.name} (\`${part_number}\`)\n` +
        `**Original price:** ${formatPrice(part.price, part.currency)}\n\n` +
        `| # | Brand | Part # | Price | Savings | Fitment | Stock | Notes |\n|---|---|---|---|---|---|---|---|\n` +
        subsWithStock.map((s, i) => {
          const savings = part.price - s.price;
          const savingsStr = savings > 0 ? `${formatPrice(savings, s.currency)} off` : savings < 0 ? `+${formatPrice(-savings, s.currency)}` : '—';
          const stockIcon = s.totalStock > 5 ? '🟢' : s.totalStock > 0 ? '🟡' : '🔴';
          return `| ${i + 1} | ${s.brand} | \`${s.substitute_part}\` | ${formatPrice(s.price, s.currency)} | ${savingsStr} | **${s.fitment_confidence}%** | ${stockIcon} ${s.totalStock} | ${s.notes} |`;
        }).join('\n') +
        `\n\n### 🏆 Best Substitute: **${subs[0]!.brand}** (\`${subs[0]!.substitute_part}\`)\n` +
        `Fitment confidence: ${subs[0]!.fitment_confidence}% — ${subs[0]!.notes}\n\n` +
        `💡 **Next step:** Check local stock for your preferred substitute, or add to cart.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 7: Build Job Parts List
  // ──────────────────────────────────────────────────────────────
  server.registerTool('build_job_parts_list', {
    title: 'Build Job Parts List',
    description: 'Generate a complete parts list for a described job (e.g., "full front and rear brake service", "timing belt replacement"). Returns all required parts with OEM and aftermarket options, total cost estimates.',
    inputSchema: {
      vehicle: z.string().describe('Vehicle description (e.g., "2019 VW Golf 1.6 TDI", "2021 Ford Focus 2.0 EcoBlue")'),
      job_description: z.string().describe('Description of the job (e.g., "full front and rear brake service", "timing belt replacement", "oil service")'),
    },
  }, async ({ vehicle: vehicleDesc, job_description }) => {
    return withLog(db, 'build_job_parts_list', getSessionId(), { vehicle: vehicleDesc, job_description }, () => {
      const matchedVehicle = findVehicleFuzzy(db, vehicleDesc);

      if (!matchedVehicle) {
        return { content: [{ type: 'text' as const, text: `Could not identify vehicle from "${vehicleDesc}". Available: 2019 VW Golf 1.6 TDI, 2021 Ford Focus 2.0 EcoBlue, 2018 BMW 3 Series 320d.` }] };
      }

      const jobLower = job_description.toLowerCase();
      const templates = db.prepare('SELECT * FROM job_templates').all() as JobTemplate[];

      // Match template by name similarity
      const matchedTemplate = templates
        .map(t => {
          const tWords = t.job_name.toLowerCase().split(' ').filter(w => w.length > 2);
          const score = tWords.reduce((acc, w) => acc + (jobLower.includes(w) ? 1 : 0), 0);
          return { template: t, score };
        })
        .filter(t => t.score >= 2)
        .sort((a, b) => b.score - a.score)[0]?.template;

      let requiredCategories: string[];
      let positionFilter: string | null = null;
      let jobName: string;

      if (matchedTemplate) {
        requiredCategories = JSON.parse(matchedTemplate.required_categories);
        positionFilter = matchedTemplate.position;
        jobName = matchedTemplate.job_name;
      } else {
        // Fallback heuristic
        const hasFront = jobLower.includes('front');
        const hasRear = jobLower.includes('rear');
        const hasBoth = (hasFront && hasRear) || jobLower.includes('full') || jobLower.includes('all');

        if (jobLower.includes('timing')) {
          requiredCategories = ['timing_kits'];
          positionFilter = null;
          jobName = 'Timing Belt Replacement';
        } else if (jobLower.includes('brake') && (jobLower.includes('full') || jobLower.includes('complete') || jobLower.includes('service') || hasBoth)) {
          requiredCategories = ['brake_pads', 'brake_discs', 'sensors'];
          positionFilter = hasBoth || (!hasFront && !hasRear) ? 'both' : (hasRear ? 'rear' : 'front');
          jobName = positionFilter === 'both' ? 'Full Front and Rear Brake Service' : `Full ${positionFilter.charAt(0).toUpperCase() + positionFilter.slice(1)} Brake Service`;
        } else if (jobLower.includes('pad')) {
          requiredCategories = ['brake_pads', 'sensors'];
          positionFilter = hasRear ? 'rear' : 'front';
          jobName = `${positionFilter.charAt(0).toUpperCase() + positionFilter.slice(1)} Pad Replacement`;
        } else if (jobLower.includes('oil') || jobLower.includes('filter')) {
          requiredCategories = ['filters'];
          positionFilter = null;
          jobName = 'Oil Service';
        } else if (jobLower.includes('belt')) {
          requiredCategories = ['belts'];
          positionFilter = null;
          jobName = 'Belt Replacement';
        } else if (jobLower.includes('shock') || jobLower.includes('suspension')) {
          requiredCategories = ['shock_absorbers'];
          positionFilter = 'front';
          jobName = 'Shock Absorber Replacement';
        } else {
          requiredCategories = ['brake_pads', 'brake_discs'];
          positionFilter = 'front';
          jobName = job_description;
        }
      }

      // Build the query — position filter determines which job_types to include
      let jobTypes: string[] = [];
      if (positionFilter === 'both') {
        const allJobTypes = db.prepare(
          'SELECT DISTINCT job_type FROM vehicle_parts WHERE vehicle_id = ?'
        ).all(matchedVehicle.id) as { job_type: string }[];
        jobTypes = allJobTypes
          .map(j => j.job_type)
          .filter(jt => requiredCategories.some(cat => jt.includes(cat.replace('s', '').replace('_kits', '')) || cat === 'sensors'));
        // For brake service, include front and rear brake pads, discs, and sensors
        jobTypes = allJobTypes.map(j => j.job_type).filter(jt =>
          jt.includes('brake') || jt.includes('sensor') ||
          requiredCategories.some(cat => jt.includes(cat.replace(/s$/, '')))
        );
      } else if (positionFilter === 'front') {
        jobTypes = [`front_brake_pads`, `front_brake_discs`];
      } else if (positionFilter === 'rear') {
        jobTypes = [`rear_brake_pads`, `rear_brake_discs`];
      }

      let allParts: Part[];
      if (jobTypes.length > 0) {
        allParts = db.prepare(`
          SELECT DISTINCT p.* FROM parts p
          JOIN vehicle_parts vp ON p.part_number = vp.part_number
          WHERE vp.vehicle_id = ? AND vp.job_type IN (${jobTypes.map(() => '?').join(',')})
          ORDER BY p.category, p.type ASC, p.fitment_confidence DESC
        `).all(matchedVehicle.id, ...jobTypes) as Part[];
      } else {
        allParts = db.prepare(`
          SELECT DISTINCT p.* FROM parts p
          JOIN vehicle_parts vp ON p.part_number = vp.part_number
          WHERE vp.vehicle_id = ? AND p.category IN (${requiredCategories.map(() => '?').join(',')})
          ORDER BY p.category, p.type ASC, p.fitment_confidence DESC
        `).all(matchedVehicle.id, ...requiredCategories) as Part[];
      }

      if (allParts.length === 0) {
        return { content: [{ type: 'text' as const, text: `No parts found for "${job_description}" on ${matchedVehicle.year} ${matchedVehicle.make} ${matchedVehicle.model}. This job may not be applicable to this vehicle.` }] };
      }

      // Group by category + position
      const grouped = new Map<string, Part[]>();
      for (const p of allParts) {
        const key = p.position ? `${p.position}_${p.category}` : p.category;
        const existing = grouped.get(key) || [];
        existing.push(p);
        grouped.set(key, existing);
      }

      let oemTotal = 0;
      let bestAftermarketTotal = 0;
      const sections: string[] = [];
      const oemPartNumbers: { part_number: string; quantity: number }[] = [];
      const amPartNumbers: { part_number: string; quantity: number }[] = [];

      for (const [key, parts] of grouped) {
        const oem = parts.filter(p => p.type === 'oem');
        const aftermarket = parts.filter(p => p.type === 'aftermarket');
        const bestAM = aftermarket[0];

        for (const p of oem) {
          oemTotal += p.price;
          oemPartNumbers.push({ part_number: p.part_number, quantity: 1 });
        }
        if (bestAM) {
          bestAftermarketTotal += bestAM.price;
          amPartNumbers.push({ part_number: bestAM.part_number, quantity: 1 });
        } else {
          for (const p of oem) {
            bestAftermarketTotal += p.price;
            amPartNumbers.push({ part_number: p.part_number, quantity: 1 });
          }
        }

        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        let section = `### ${label}\n`;
        section += `| Type | Brand | Part # | Price | Fitment |\n|---|---|---|---|---|\n`;
        parts.forEach(p => {
          section += `| ${p.type.toUpperCase()} | ${p.brand} | \`${p.part_number}\` | ${formatPrice(p.price, p.currency)} | ${p.fitment_confidence}% |\n`;
        });
        sections.push(section);
      }

      const text =
        `## 🔧 Parts List: ${jobName}\n` +
        `**Vehicle:** ${matchedVehicle.year} ${matchedVehicle.make} ${matchedVehicle.model} (${matchedVehicle.variant})\n` +
        `**Engine:** ${matchedVehicle.engine_code} | **Power:** ${matchedVehicle.power_hp}hp\n\n` +
        sections.join('\n') +
        `\n---\n\n` +
        `### 💰 Estimated Totals\n\n` +
        `| Option | Total | Parts Count |\n|---|---|---|\n` +
        `| All OEM | **${formatPrice(oemTotal, 'GBP')}** | ${oemPartNumbers.length} parts |\n` +
        `| Best Aftermarket Mix | **${formatPrice(bestAftermarketTotal, 'GBP')}** | ${amPartNumbers.length} parts |\n` +
        `| 💰 Savings | **${formatPrice(oemTotal - bestAftermarketTotal, 'GBP')}** | ${oemTotal > 0 ? Math.round((1 - bestAftermarketTotal / oemTotal) * 100) : 0}% off |\n\n` +
        `💡 **Next step:** Say "add all to cart" to create a pre-filled cart with your preferred parts, or check stock availability at your local branch.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 8: Create Cart
  // ──────────────────────────────────────────────────────────────
  server.registerTool('create_cart', {
    title: 'Create Cart',
    description: 'Generate a pre-filled cart with selected parts. Persists the cart and returns a shareable URL with all items ready for checkout, including a cost summary and collection options.',
    inputSchema: {
      items: z.array(z.object({
        part_number: z.string().describe('Part number to add'),
        quantity: z.number().min(1).describe('Quantity required'),
      })).describe('Array of items to add to cart'),
      branch: z.string().optional().describe('Preferred collection branch (Manchester, Birmingham, Leeds, London)'),
    },
  }, async ({ items, branch }) => {
    return withLog(db, 'create_cart', getSessionId(), { items, branch }, () => {
      const cartId = `CART-${randomUUID().substring(0, 8).toUpperCase()}`;
      const cartLines: string[] = [];
      let total = 0;
      let totalWeight = 0;
      const notFound: string[] = [];
      const validItems: { part_number: string; quantity: number; part: Part }[] = [];

      for (const item of items) {
        const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(item.part_number) as Part | undefined;
        if (!part) {
          notFound.push(item.part_number);
          continue;
        }
        validItems.push({ ...item, part });
        const lineTotal = part.price * item.quantity;
        total += lineTotal;
        totalWeight += part.weight_kg * item.quantity;
        cartLines.push(
          `| ${part.brand} | ${part.name} | \`${part.part_number}\` | ${item.quantity} | ${formatPrice(lineTotal, part.currency)} |`
        );
      }

      if (validItems.length === 0) {
        return { content: [{ type: 'text' as const, text: `None of the provided part numbers were found: ${notFound.join(', ')}` }] };
      }

      // Persist cart to database
      db.prepare('INSERT INTO carts (cart_id, created_at) VALUES (?, datetime("now"))').run(cartId);
      const insertItem = db.prepare('INSERT INTO cart_items (cart_id, part_number, quantity, branch) VALUES (?, ?, ?, ?)');
      for (const item of validItems) {
        insertItem.run(cartId, item.part_number, item.quantity, branch || null);
      }

      const baseUrl = getBaseUrl();
      const cartUrl = `${baseUrl}/cart/${cartId}`;

      // Check branch stock if specified
      let branchInfo = '';
      if (branch) {
        const branchData = db.prepare('SELECT * FROM branches WHERE LOWER(name) = LOWER(?)').get(branch) as Branch | undefined;
        if (branchData) {
          const allInStock = validItems.every(item => {
            const stock = db.prepare('SELECT qty FROM branch_stock WHERE branch = ? AND part_number = ?').get(branchData.name, item.part_number) as { qty: number } | undefined;
            return stock && stock.qty >= item.quantity;
          });

          branchInfo = `\n### 🏪 Collection: ${branchData.name}\n` +
            `📍 ${branchData.address}\n` +
            `📞 ${branchData.phone}\n` +
            `🕐 Collection hours: ${branchData.click_collect_hours}\n` +
            `${allInStock ? '✅ All items in stock — ready for collection in 30 minutes' : '⚠️ Some items may need to be ordered — check individual stock levels'}\n`;
        }
      }

      let text = `## 🛒 Cart Created: \`${cartId}\`\n\n` +
        `| Brand | Part | Part # | Qty | Subtotal |\n|---|---|---|---|---|\n` +
        cartLines.join('\n') +
        `\n\n---\n\n` +
        `| | |\n|---|---|\n` +
        `| **Subtotal** | **${formatPrice(total, 'GBP')}** |\n` +
        `| Items | ${validItems.reduce((s, i) => s + i.quantity, 0)} |\n` +
        `| Total Weight | ${totalWeight.toFixed(1)} kg |\n` +
        branchInfo +
        `\n\n🔗 **Cart URL:** [${cartUrl}](${cartUrl})\n` +
        `\n*Cart valid for 24 hours. Share this link to complete your purchase.*`;

      if (notFound.length > 0) {
        text += `\n\n⚠️ Parts not found (excluded): ${notFound.join(', ')}`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
