import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';

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
}

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  variant: string;
  engine_code: string;
  front_disc_mm: number;
  rear_disc_mm: number;
}

interface BranchStock {
  branch: string;
  part_number: string;
  qty: number;
  click_collect: number;
  next_day_delivery: number;
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

export function registerPartsTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  server.registerTool('find_by_vehicle', {
    title: 'Find Parts by Vehicle',
    description: 'Return compatible parts for a specific vehicle (make/model/year/engine) and job type. Shows OEM and aftermarket options with prices, fitment confidence, and availability.',
    inputSchema: {
      make: z.string().describe('Vehicle manufacturer (e.g., "Volkswagen", "Ford", "BMW")'),
      model: z.string().describe('Vehicle model (e.g., "Golf", "Focus", "3 Series")'),
      year: z.number().describe('Model year (e.g., 2019)'),
      engine: z.string().optional().describe('Engine code if known (e.g., "DGDB", "XWDA", "B47D20A")'),
      job_type: z.string().describe('Type of job/repair (e.g., "front_brake_pads", "oil_service", "belt_replacement")'),
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
        return { content: [{ type: 'text' as const, text: `No parts found for "${job_type}" on ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.variant}). Try: front_brake_pads, front_brake_discs, oil_service, belt_replacement, shock_absorber_replacement, abs_sensor_replacement, air_filter_replacement.` }] };
      }

      const header = `## Compatible parts for ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.variant})\n**Engine:** ${vehicle.engine_code} | **Job:** ${job_type}\n`;
      const lines = parts.map(p =>
        `**${p.brand} ${p.name}**\n` +
        `Part #: ${p.part_number} | ${p.type.toUpperCase()} | ${formatPrice(p.price, p.currency)}\n` +
        `Fitment: ${p.fitment_confidence}% | ${p.description}`
      ).join('\n\n---\n\n');

      return { content: [{ type: 'text' as const, text: `${header}\n${lines}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('find_by_symptom', {
    title: 'Find Parts by Symptom',
    description: 'Diagnose a problem from a described symptom and return likely parts needed. Provides diagnosis explanation and recommended parts for the described vehicle.',
    inputSchema: {
      vehicle_description: z.string().describe('Vehicle description (e.g., "2019 VW Golf 1.6 TDI")'),
      symptom: z.string().describe('Describe the symptom (e.g., "grinding noise when braking", "vibration through brake pedal")'),
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
        return { content: [{ type: 'text' as const, text: `Could not match symptom "${symptom}" to a known issue. Try describing: grinding/squealing brakes, vibration when braking, pulling to one side, harsh ride, belt squeak, ABS warning light, or brake warning light.` }] };
      }

      const top = matched[0]!.mapping;
      const vParts = vehicle_description.toLowerCase().split(/[\s,]+/);
      const vehicles = db.prepare('SELECT * FROM vehicles').all() as Vehicle[];
      const vehicle = vehicles.find(v =>
        vParts.some(p => v.make.toLowerCase().includes(p)) ||
        vParts.some(p => v.model.toLowerCase().includes(p))
      );

      let partsSection = '';
      if (vehicle) {
        const parts = db.prepare(`
          SELECT p.* FROM parts p
          JOIN vehicle_parts vp ON p.part_number = vp.part_number
          WHERE vp.vehicle_id = ? AND vp.job_type = ?
          ORDER BY p.type ASC, p.fitment_confidence DESC
        `).all(vehicle.id, top.job_type) as Part[];

        if (parts.length > 0) {
          partsSection = '\n\n## Recommended Parts\n' + parts.map(p =>
            `• **${p.brand} ${p.name}** — ${p.part_number} — ${formatPrice(p.price, p.currency)} (${p.type.toUpperCase()}, ${p.fitment_confidence}% fit)`
          ).join('\n');
        }
      }

      const text = `## Diagnosis\n**Symptom:** ${symptom}\n**Likely cause:** ${top.diagnosis}\n**Category:** ${top.category}\n**Recommended job:** ${top.job_type}${partsSection}`;
      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('find_by_part_number', {
    title: 'Find by Part Number',
    description: 'Look up a part by its OEM or aftermarket part number. Returns full details including price, fitment, compatible vehicles, and stock availability.',
    inputSchema: {
      part_number: z.string().describe('OEM or aftermarket part number (e.g., "1J0615301E", "TRW-GDB1757")'),
    },
  }, async ({ part_number }) => {
    return withLog(db, 'find_by_part_number', getSessionId(), { part_number }, () => {
      const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
      if (!part) {
        return { content: [{ type: 'text' as const, text: `Part number "${part_number}" not found. Check the number and try again.` }] };
      }

      const vehicles = db.prepare(`
        SELECT v.*, vp.job_type FROM vehicles v
        JOIN vehicle_parts vp ON v.id = vp.vehicle_id
        WHERE vp.part_number = ?
      `).all(part_number) as (Vehicle & { job_type: string })[];

      const stock = db.prepare('SELECT * FROM branch_stock WHERE part_number = ? AND qty > 0').all(part_number) as BranchStock[];

      const vehicleList = vehicles.length > 0
        ? vehicles.map(v => `  • ${v.year} ${v.make} ${v.model} (${v.variant}) — ${v.job_type}`).join('\n')
        : '  No vehicle fitment data available';

      const stockList = stock.length > 0
        ? stock.map(s => `  • ${s.branch}: ${s.qty} in stock${s.click_collect ? ' (Click & Collect)' : ''}${s.next_day_delivery ? ' (Next-day delivery)' : ''}`).join('\n')
        : '  Currently out of stock at all branches';

      const text =
        `# ${part.brand} ${part.name}\n\n` +
        `**Part #:** ${part.part_number}\n` +
        `**Type:** ${part.type.toUpperCase()}\n` +
        `**Category:** ${part.category}\n` +
        `**Price:** ${formatPrice(part.price, part.currency)}\n` +
        `**Fitment Confidence:** ${part.fitment_confidence}%\n` +
        `**Weight:** ${part.weight_kg}kg\n` +
        (part.oem_ref ? `**OEM Reference:** ${part.oem_ref}\n` : '') +
        `**Description:** ${part.description}\n\n` +
        `## Compatible Vehicles\n${vehicleList}\n\n` +
        `## Stock Availability\n${stockList}`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('compare_oem_aftermarket', {
    title: 'Compare OEM vs Aftermarket',
    description: 'Side-by-side comparison of OEM and aftermarket parts. Can look up by part number or by vehicle + job type. Shows price difference, fitment confidence, and brand details.',
    inputSchema: {
      part_number: z.string().optional().describe('OEM part number to compare against aftermarket options'),
      make: z.string().optional().describe('Vehicle make (use with model/year/job_type instead of part_number)'),
      model: z.string().optional().describe('Vehicle model'),
      year: z.number().optional().describe('Vehicle year'),
      job_type: z.string().optional().describe('Job type (e.g., "front_brake_pads")'),
    },
  }, async ({ part_number, make, model, year, job_type }) => {
    return withLog(db, 'compare_oem_aftermarket', getSessionId(), { part_number, make, model, year, job_type }, () => {
      let oemPart: Part | undefined;
      let aftermarketParts: Part[] = [];

      if (part_number) {
        const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
        if (!part) {
          return { content: [{ type: 'text' as const, text: `Part "${part_number}" not found.` }] };
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
          return { content: [{ type: 'text' as const, text: `Vehicle not found. Available: 2019 VW Golf, 2021 Ford Focus, 2018 BMW 3 Series.` }] };
        }
        const parts = db.prepare(`
          SELECT p.* FROM parts p
          JOIN vehicle_parts vp ON p.part_number = vp.part_number
          WHERE vp.vehicle_id = ? AND vp.job_type = ?
          ORDER BY p.type ASC, p.fitment_confidence DESC
        `).all(vehicle.id, job_type) as Part[];

        oemPart = parts.find(p => p.type === 'oem');
        aftermarketParts = parts.filter(p => p.type === 'aftermarket');
      } else {
        return { content: [{ type: 'text' as const, text: 'Please provide either a part_number, or make + model + year + job_type for comparison.' }] };
      }

      if (!oemPart && aftermarketParts.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No parts found for comparison.' }] };
      }

      let text = '## OEM vs Aftermarket Comparison\n\n';

      if (oemPart) {
        text += `### OEM Option\n`;
        text += `| Attribute | Value |\n|---|---|\n`;
        text += `| Brand | ${oemPart.brand} |\n`;
        text += `| Part # | ${oemPart.part_number} |\n`;
        text += `| Price | ${formatPrice(oemPart.price, oemPart.currency)} |\n`;
        text += `| Fitment | ${oemPart.fitment_confidence}% |\n`;
        text += `| Description | ${oemPart.description} |\n\n`;
      }

      if (aftermarketParts.length > 0) {
        text += `### Aftermarket Options\n`;
        text += `| Brand | Part # | Price | Savings | Fitment | Description |\n|---|---|---|---|---|---|\n`;
        aftermarketParts.forEach(p => {
          const savings = oemPart ? `${formatPrice(oemPart.price - p.price, p.currency)} (${Math.round((1 - p.price / oemPart.price) * 100)}% off)` : '—';
          text += `| ${p.brand} | ${p.part_number} | ${formatPrice(p.price, p.currency)} | ${savings} | ${p.fitment_confidence}% | ${p.description} |\n`;
        });
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('check_local_stock', {
    title: 'Check Local Stock',
    description: 'Check stock availability at nearest branch(es). Shows quantity, click-and-collect availability, and next-day delivery options.',
    inputSchema: {
      part_number: z.string().describe('Part number to check stock for'),
      branch: z.string().optional().describe('Specific branch name (Manchester, Birmingham, Leeds, London). Omit to check all branches.'),
    },
  }, async ({ part_number, branch }) => {
    return withLog(db, 'check_local_stock', getSessionId(), { part_number, branch }, () => {
      const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
      if (!part) {
        return { content: [{ type: 'text' as const, text: `Part "${part_number}" not found.` }] };
      }

      let stock: BranchStock[];
      if (branch) {
        stock = db.prepare('SELECT * FROM branch_stock WHERE part_number = ? AND LOWER(branch) = LOWER(?)').all(part_number, branch) as BranchStock[];
      } else {
        stock = db.prepare('SELECT * FROM branch_stock WHERE part_number = ? ORDER BY qty DESC').all(part_number) as BranchStock[];
      }

      if (stock.length === 0) {
        const allBranches = branch ? `the ${branch} branch` : 'any branch';
        return { content: [{ type: 'text' as const, text: `**${part.brand} ${part.name}** (${part.part_number}) is not stocked at ${allBranches}. Consider ordering for next-day delivery or check substitute parts.` }] };
      }

      const header = `## Stock: ${part.brand} ${part.name} (${part.part_number})\n**Price:** ${formatPrice(part.price, part.currency)}\n`;
      const rows = stock.map(s => {
        const status = s.qty > 5 ? '✓ In stock' : s.qty > 0 ? `⚠ Low stock (${s.qty} left)` : '✗ Out of stock';
        const options = [
          s.click_collect && s.qty > 0 ? '🏪 Click & Collect (ready in 30 min)' : null,
          s.next_day_delivery ? '🚚 Next-day delivery' : null,
        ].filter(Boolean).join(' | ');
        return `**${s.branch}:** ${status} — ${s.qty} units\n  ${options}`;
      }).join('\n\n');

      return { content: [{ type: 'text' as const, text: `${header}\n${rows}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('find_substitute', {
    title: 'Find Substitute Part',
    description: 'Find compatible substitute parts when a specific part is out of stock. Shows fitment confidence percentage and compatibility notes.',
    inputSchema: {
      part_number: z.string().describe('Part number to find substitutes for'),
    },
  }, async ({ part_number }) => {
    return withLog(db, 'find_substitute', getSessionId(), { part_number }, () => {
      const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(part_number) as Part | undefined;
      if (!part) {
        return { content: [{ type: 'text' as const, text: `Part "${part_number}" not found.` }] };
      }

      const subs = db.prepare(`
        SELECT s.*, p.name, p.brand, p.price, p.currency, p.type, p.description
        FROM substitutes s
        JOIN parts p ON s.substitute_part = p.part_number
        WHERE s.original_part = ?
        ORDER BY s.fitment_confidence DESC
      `).all(part_number) as (Substitute & Pick<Part, 'name' | 'brand' | 'price' | 'currency' | 'type' | 'description'>)[];

      if (subs.length === 0) {
        const reverseSubs = db.prepare(`
          SELECT s.*, p.name, p.brand, p.price, p.currency, p.type, p.description
          FROM substitutes s
          JOIN parts p ON s.original_part = p.part_number
          WHERE s.substitute_part = ?
          ORDER BY s.fitment_confidence DESC
        `).all(part_number) as (Substitute & Pick<Part, 'name' | 'brand' | 'price' | 'currency' | 'type' | 'description'>)[];

        if (reverseSubs.length === 0) {
          return { content: [{ type: 'text' as const, text: `No known substitutes for "${part_number}". Contact our parts specialists for custom recommendations.` }] };
        }

        const text = `## Substitutes for ${part.brand} ${part.name} (${part_number})\n\n` +
          `This part is itself a substitute. Original OEM part:\n\n` +
          reverseSubs.map(s =>
            `• **${s.brand} ${s.name}** — ${s.original_part}\n  ${formatPrice(s.price, s.currency)} | ${s.type.toUpperCase()} | Fitment: ${s.fitment_confidence}%\n  ${s.notes}`
          ).join('\n\n');
        return { content: [{ type: 'text' as const, text }] };
      }

      const text = `## Substitutes for ${part.brand} ${part.name} (${part_number})\n**Original price:** ${formatPrice(part.price, part.currency)}\n\n` +
        subs.map((s, i) =>
          `### Option ${i + 1}: ${s.brand} ${s.name}\n` +
          `**Part #:** ${s.substitute_part} | **Price:** ${formatPrice(s.price, s.currency)} | **Type:** ${s.type.toUpperCase()}\n` +
          `**Fitment Confidence:** ${s.fitment_confidence}%\n` +
          `**Notes:** ${s.notes}\n` +
          `${s.description}`
        ).join('\n\n---\n\n');

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('build_job_parts_list', {
    title: 'Build Job Parts List',
    description: 'Generate a complete parts list for a described job (e.g., "full front brake service"). Returns all required parts with OEM and aftermarket options, total cost estimates.',
    inputSchema: {
      vehicle: z.string().describe('Vehicle description (e.g., "2019 VW Golf 1.6 TDI")'),
      job_description: z.string().describe('Description of the job (e.g., "full front brake service", "oil service", "shock absorber replacement")'),
    },
  }, async ({ vehicle: vehicleDesc, job_description }) => {
    return withLog(db, 'build_job_parts_list', getSessionId(), { vehicle: vehicleDesc, job_description }, () => {
      const vParts = vehicleDesc.toLowerCase().split(/[\s,]+/);
      const vehicles = db.prepare('SELECT * FROM vehicles').all() as Vehicle[];
      const matchedVehicle = vehicles.find(v =>
        vParts.some(p => v.make.toLowerCase().includes(p)) ||
        vParts.some(p => v.model.toLowerCase().includes(p))
      );

      if (!matchedVehicle) {
        return { content: [{ type: 'text' as const, text: `Could not identify vehicle from "${vehicleDesc}". Available: 2019 VW Golf 1.6 TDI, 2021 Ford Focus 2.0 EcoBlue, 2018 BMW 3 Series 320d.` }] };
      }

      const jobLower = job_description.toLowerCase();
      const templates = db.prepare('SELECT * FROM job_templates').all() as JobTemplate[];
      const matchedTemplate = templates.find(t =>
        jobLower.includes(t.job_name.toLowerCase()) ||
        t.job_name.toLowerCase().split(' ').filter(w => w.length > 3).some(w => jobLower.includes(w))
      );

      let requiredCategories: string[];
      if (matchedTemplate) {
        requiredCategories = JSON.parse(matchedTemplate.required_categories);
      } else {
        if (jobLower.includes('brake') && (jobLower.includes('full') || jobLower.includes('complete') || jobLower.includes('service'))) {
          requiredCategories = ['brake_pads', 'brake_discs', 'sensors'];
        } else if (jobLower.includes('brake') || jobLower.includes('pad')) {
          requiredCategories = ['brake_pads'];
        } else if (jobLower.includes('oil') || jobLower.includes('filter')) {
          requiredCategories = ['filters'];
        } else if (jobLower.includes('belt')) {
          requiredCategories = ['belts'];
        } else if (jobLower.includes('shock') || jobLower.includes('suspension')) {
          requiredCategories = ['shock_absorbers'];
        } else {
          requiredCategories = ['brake_pads', 'brake_discs'];
        }
      }

      const allParts = db.prepare(`
        SELECT p.* FROM parts p
        JOIN vehicle_parts vp ON p.part_number = vp.part_number
        WHERE vp.vehicle_id = ? AND p.category IN (${requiredCategories.map(() => '?').join(',')})
        ORDER BY p.category, p.type ASC, p.fitment_confidence DESC
      `).all(matchedVehicle.id, ...requiredCategories) as Part[];

      if (allParts.length === 0) {
        return { content: [{ type: 'text' as const, text: `No parts found for "${job_description}" on ${matchedVehicle.year} ${matchedVehicle.make} ${matchedVehicle.model}.` }] };
      }

      const grouped = new Map<string, Part[]>();
      for (const p of allParts) {
        const existing = grouped.get(p.category) || [];
        existing.push(p);
        grouped.set(p.category, existing);
      }

      let oemTotal = 0;
      let bestAftermarketTotal = 0;
      const sections: string[] = [];

      for (const [category, parts] of grouped) {
        const oem = parts.find(p => p.type === 'oem');
        const aftermarket = parts.filter(p => p.type === 'aftermarket');
        const bestAM = aftermarket[0];

        if (oem) oemTotal += oem.price;
        if (bestAM) bestAftermarketTotal += bestAM.price;
        else if (oem) bestAftermarketTotal += oem.price;

        let section = `### ${category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n`;
        if (oem) {
          section += `**OEM:** ${oem.brand} ${oem.name} — ${oem.part_number} — ${formatPrice(oem.price, oem.currency)}\n`;
        }
        if (aftermarket.length > 0) {
          section += aftermarket.map(p =>
            `**Aftermarket:** ${p.brand} ${p.name} — ${p.part_number} — ${formatPrice(p.price, p.currency)} (${p.fitment_confidence}% fit)`
          ).join('\n') + '\n';
        }
        sections.push(section);
      }

      const jobName = matchedTemplate?.job_name || job_description;
      const text =
        `## Parts List: ${jobName}\n` +
        `**Vehicle:** ${matchedVehicle.year} ${matchedVehicle.make} ${matchedVehicle.model} (${matchedVehicle.variant})\n\n` +
        sections.join('\n') +
        `\n---\n\n` +
        `### Estimated Totals\n` +
        `| Option | Total |\n|---|---|\n` +
        `| All OEM | ${formatPrice(oemTotal, 'GBP')} |\n` +
        `| Best Aftermarket | ${formatPrice(bestAftermarketTotal, 'GBP')} |\n` +
        `| Savings | ${formatPrice(oemTotal - bestAftermarketTotal, 'GBP')} (${Math.round((1 - bestAftermarketTotal / oemTotal) * 100)}% off) |`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('create_cart', {
    title: 'Create Cart',
    description: 'Generate a pre-filled cart URL with selected parts. Returns a link with all items ready for checkout, including a cost summary.',
    inputSchema: {
      items: z.array(z.object({
        part_number: z.string().describe('Part number to add'),
        quantity: z.number().min(1).describe('Quantity required'),
      })).describe('Array of items to add to cart'),
    },
  }, async ({ items }) => {
    return withLog(db, 'create_cart', getSessionId(), { items }, () => {
      const cartLines: string[] = [];
      let total = 0;
      const notFound: string[] = [];

      for (const item of items) {
        const part = db.prepare('SELECT * FROM parts WHERE part_number = ?').get(item.part_number) as Part | undefined;
        if (!part) {
          notFound.push(item.part_number);
          continue;
        }
        const lineTotal = part.price * item.quantity;
        total += lineTotal;
        cartLines.push(
          `• ${part.brand} ${part.name} (${part.part_number}) × ${item.quantity} — ${formatPrice(lineTotal, part.currency)}`
        );
      }

      if (cartLines.length === 0) {
        return { content: [{ type: 'text' as const, text: `None of the provided part numbers were found: ${notFound.join(', ')}` }] };
      }

      const params = items
        .filter(i => !notFound.includes(i.part_number))
        .map(i => `${encodeURIComponent(i.part_number)}:${i.quantity}`)
        .join(',');
      const cartUrl = `https://www.acmeparts.co.uk/cart?items=${params}`;

      let text = `## 🛒 Your Cart\n\n${cartLines.join('\n')}\n\n**Total: ${formatPrice(total, 'GBP')}**\n\n[Proceed to Checkout](${cartUrl})`;

      if (notFound.length > 0) {
        text += `\n\n⚠ Parts not found (excluded): ${notFound.join(', ')}`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
