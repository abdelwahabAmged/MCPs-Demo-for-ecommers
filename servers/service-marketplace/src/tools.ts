import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

interface Provider {
  id: string;
  name: string;
  job_type: string;
  rating: number;
  review_count: number;
  hourly_rate: number;
  callout_fee: number;
  currency: string;
  location: string;
  coverage_radius_miles: number;
  response_time: string;
  bio: string;
  specialisms: string;
  sample_jobs: string;
  certifications: string;
  years_in_business: number;
  insurance: string;
  website: string;
  phone: string;
}

interface Review {
  id: number;
  provider_id: string;
  reviewer_name: string;
  rating: number;
  date: string;
  job_type: string;
  comment: string;
}

interface Availability {
  id: number;
  provider_id: string;
  day_offset: number;
  time_slot: string;
  available: number;
}

interface Booking {
  booking_ref: string;
  provider_id: string;
  provider_name: string;
  status: string;
  date: string;
  time: string;
  job_description: string;
  estimated_cost: number;
  currency: string;
  notes: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  session_id: string | null;
}

interface QuoteEstimate {
  id: number;
  job_type: string;
  sub_type: string | null;
  location: string;
  min_cost: number;
  max_cost: number;
  typical_duration: string;
  includes: string;
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

function getDayName(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function isWeekend(offset: number): boolean {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getBaseUrl(): string {
  const port = process.env['PORT'] || '3004';
  if (process.env['RAILWAY_PUBLIC_DOMAIN']) {
    return `https://${process.env['RAILWAY_PUBLIC_DOMAIN']}`;
  }
  return process.env['BASE_URL'] || `http://localhost:${port}`;
}

function starRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
}

export function registerServiceMarketplaceTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  // ──────────────────────────────────────────────────────────────
  // Tool 1: Search Providers
  // ──────────────────────────────────────────────────────────────
  server.registerTool('search_providers', {
    title: 'Search Providers',
    description: 'Search for local tradespeople by job type, location, and optional budget. Returns matching providers with ratings, hourly rates, response times, and weekend availability.',
    inputSchema: {
      job_type: z.string().describe('Type of job needed (e.g., "plumbing", "electrical", "boiler/heating", "roofing", "painting/decorating", "locksmith")'),
      location: z.string().describe('Area or postcode (e.g., "Manchester", "Salford", "Stockport")'),
      budget: z.number().optional().describe('Maximum hourly rate in GBP'),
      weekend_only: z.boolean().optional().describe('Only show providers with weekend availability'),
    },
  }, async ({ job_type, location, budget, weekend_only }) => {
    return withLog(db, 'search_providers', getSessionId(), { job_type, location, budget, weekend_only }, () => {
      const jobKeywords = job_type.toLowerCase().split(/[\s/,]+/).filter(Boolean);
      const locationKeyword = location.toLowerCase();

      let allProviders = db.prepare('SELECT * FROM providers').all() as Provider[];

      if (budget) {
        allProviders = allProviders.filter(p => p.hourly_rate <= budget);
      }

      const scored = allProviders.map(p => {
        const typeText = `${p.job_type} ${p.specialisms}`.toLowerCase();
        const locText = p.location.toLowerCase();
        const typeScore = jobKeywords.reduce((s, kw) => s + (typeText.includes(kw) ? 1 : 0), 0);
        const locScore = locText.includes(locationKeyword) ? 2 : 0;
        return { provider: p, score: typeScore + locScore };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score || b.provider.rating - a.provider.rating);

      if (scored.length === 0) {
        return { content: [{ type: 'text' as const, text: `No providers found for "${job_type}" in ${location}${budget ? ` under £${budget}/hr` : ''}.\n\nWe cover most trades across Greater Manchester. Try broadening your search or adjusting the budget.` }] };
      }

      const results = scored.map(({ provider: p }) => {
        // Check weekend availability
        const weekendSlots = db.prepare(
          'SELECT COUNT(*) as c FROM availability WHERE provider_id = ? AND available = 1 AND day_offset IN (5, 6)'
        ).get(p.id) as { c: number };

        // Get top review
        const topReview = db.prepare(
          'SELECT * FROM reviews WHERE provider_id = ? ORDER BY rating DESC, date DESC LIMIT 1'
        ).get(p.id) as Review | undefined;

        const availBadge = weekendSlots.c > 0 ? '🟢 Weekend slots available' : '🔵 Weekday availability';

        let entry = `### ${p.name}\n` +
          `**${p.job_type}** | ${starRating(p.rating)} ${p.rating}/5 (${p.review_count} reviews)\n` +
          `💷 £${p.hourly_rate}/hr${p.callout_fee ? ` + £${p.callout_fee} call-out` : ' (no call-out fee)'}\n` +
          `📍 ${p.location.replace(/,/g, ', ')} | ⏱ ${p.response_time}\n` +
          `${availBadge}`;

        if (topReview) {
          entry += `\n> _"${topReview.comment.substring(0, 80)}${topReview.comment.length > 80 ? '...' : ''}"_ — ${topReview.reviewer_name}`;
        }

        return entry;
      });

      if (weekend_only) {
        const weekendProviders = scored.filter(({ provider: p }) => {
          const slots = db.prepare('SELECT COUNT(*) as c FROM availability WHERE provider_id = ? AND available = 1 AND day_offset IN (5, 6)').get(p.id) as { c: number };
          return slots.c > 0;
        });
        if (weekendProviders.length === 0) {
          return { content: [{ type: 'text' as const, text: `No providers with weekend availability for "${job_type}" in ${location}. Try checking weekday slots instead.` }] };
        }
      }

      const text = `## ${scored.length} provider${scored.length > 1 ? 's' : ''} found for ${job_type} in ${location}\n\n` +
        results.join('\n\n---\n\n') +
        `\n\n---\n\n💡 **Next steps:** Get more details about a provider, check their availability, or get a quote estimate for your specific job.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 2: Get Provider Detail
  // ──────────────────────────────────────────────────────────────
  server.registerTool('get_provider_detail', {
    title: 'Get Provider Detail',
    description: 'Get the full profile of a provider including bio, certifications, ratings, recent reviews, and next available appointment slot.',
    inputSchema: {
      provider_name: z.string().describe('Provider name or partial name (e.g., "Dave\'s Plumbing" or "Green Boiler")'),
    },
  }, async ({ provider_name }) => {
    return withLog(db, 'get_provider_detail', getSessionId(), { provider_name }, () => {
      const searchName = provider_name.toLowerCase();
      const provider = db.prepare(
        'SELECT * FROM providers WHERE LOWER(name) LIKE ?'
      ).get(`%${searchName}%`) as Provider | undefined;

      if (!provider) {
        const allNames = (db.prepare('SELECT name FROM providers').all() as { name: string }[]).map(p => p.name);
        return { content: [{ type: 'text' as const, text: `No provider found matching "${provider_name}".\n\nAvailable providers: ${allNames.join(', ')}` }] };
      }

      const reviews = db.prepare(
        'SELECT * FROM reviews WHERE provider_id = ? ORDER BY date DESC LIMIT 5'
      ).all(provider.id) as Review[];

      const nextSlot = db.prepare(
        'SELECT * FROM availability WHERE provider_id = ? AND available = 1 ORDER BY day_offset, time_slot LIMIT 1'
      ).get(provider.id) as Availability | undefined;

      const specialisms = provider.specialisms.split(',').map(s => `  • ${s.trim()}`).join('\n');
      const certs = provider.certifications.split(',').map(s => `  ✓ ${s.trim()}`).join('\n');
      const sampleJobs = provider.sample_jobs.split(',').map(s => `  • ${s.trim()}`).join('\n');

      const reviewSection = reviews.length > 0
        ? reviews.map(r =>
            `  ${starRating(r.rating)} — **${r.reviewer_name}** (${r.date})\n  _"${r.comment}"_`
          ).join('\n\n')
        : '  No reviews yet.';

      const nextAvail = nextSlot
        ? `**Next available:** ${getDayName(nextSlot.day_offset)} at ${nextSlot.time_slot}`
        : 'No slots available in the next 7 days';

      const text =
        `# ${provider.name}\n\n` +
        `| | |\n|---|---|\n` +
        `| **Trade** | ${provider.job_type} |\n` +
        `| **Rating** | ${starRating(provider.rating)} ${provider.rating}/5 (${provider.review_count} reviews) |\n` +
        `| **Rate** | £${provider.hourly_rate}/hr${provider.callout_fee ? ` + £${provider.callout_fee} call-out fee` : ' (no call-out fee)'} |\n` +
        `| **Areas** | ${provider.location.replace(/,/g, ', ')} (${provider.coverage_radius_miles} mile radius) |\n` +
        `| **Response** | ${provider.response_time} |\n` +
        `| **Experience** | ${provider.years_in_business} years |\n` +
        `| **Insurance** | ${provider.insurance} |\n` +
        `| **Phone** | ${provider.phone} |\n` +
        `| **Website** | ${provider.website} |\n\n` +
        `## About\n${provider.bio}\n\n` +
        `## Certifications\n${certs}\n\n` +
        `## Specialisms\n${specialisms}\n\n` +
        `## Sample Completed Jobs\n${sampleJobs}\n\n` +
        `## Recent Reviews\n${reviewSection}\n\n` +
        `---\n${nextAvail}\n\n` +
        `💡 **Actions:** Check full availability, book a slot, or get a quote estimate for your job.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 3: Check Availability
  // ──────────────────────────────────────────────────────────────
  server.registerTool('check_availability', {
    title: 'Check Availability',
    description: 'Check available appointment slots for a provider over the next 7 days. Returns real dates and times that can be booked.',
    inputSchema: {
      provider_name: z.string().describe('Provider name or partial name (e.g., "Dave\'s Plumbing")'),
      weekend_only: z.boolean().optional().describe('Only show weekend (Saturday/Sunday) slots'),
    },
  }, async ({ provider_name, weekend_only }) => {
    return withLog(db, 'check_availability', getSessionId(), { provider_name, weekend_only }, () => {
      const searchName = provider_name.toLowerCase();
      const provider = db.prepare(
        'SELECT * FROM providers WHERE LOWER(name) LIKE ?'
      ).get(`%${searchName}%`) as Provider | undefined;

      if (!provider) {
        return { content: [{ type: 'text' as const, text: `No provider found matching "${provider_name}".` }] };
      }

      let slots: Availability[];
      if (weekend_only) {
        slots = db.prepare(
          'SELECT * FROM availability WHERE provider_id = ? AND available = 1 AND day_offset IN (5, 6) ORDER BY day_offset, time_slot'
        ).all(provider.id) as Availability[];
      } else {
        slots = db.prepare(
          'SELECT * FROM availability WHERE provider_id = ? AND available = 1 ORDER BY day_offset, time_slot'
        ).all(provider.id) as Availability[];
      }

      if (slots.length === 0) {
        const msg = weekend_only
          ? `${provider.name} has no weekend slots available. Would you like to see weekday availability instead?`
          : `${provider.name} has no available slots in the next 7 days. Try another provider or check back later.`;
        return { content: [{ type: 'text' as const, text: msg }] };
      }

      const grouped = new Map<number, string[]>();
      for (const slot of slots) {
        const existing = grouped.get(slot.day_offset) ?? [];
        existing.push(slot.time_slot);
        grouped.set(slot.day_offset, existing);
      }

      const lines = Array.from(grouped.entries()).map(([offset, times]) => {
        const dayLabel = offset === 0 ? `**Today** (${getDayName(offset)})` : `**${getDayName(offset)}**`;
        const weekend = isWeekend(offset) ? ' 🗓️' : '';
        return `${dayLabel}${weekend}\n  ${times.map(t => `\`${t}\``).join('  •  ')}`;
      });

      const text =
        `## Available Slots: ${provider.name}\n` +
        `**Rate:** £${provider.hourly_rate}/hr${provider.callout_fee ? ` + £${provider.callout_fee} call-out` : ''}\n\n` +
        lines.join('\n\n') +
        `\n\n---\n\n💡 **To book:** Tell me the date and time, and describe the job you need done.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 4: Get Quote Estimate
  // ──────────────────────────────────────────────────────────────
  server.registerTool('get_quote_estimate', {
    title: 'Get Quote Estimate',
    description: 'Get an indicative price range for a described job type in a given location. Returns min/max cost, typical duration, and what is included.',
    inputSchema: {
      job_type: z.string().describe('Type of job (e.g., "plumbing", "electrical", "boiler/heating", "boiler service", "rewire")'),
      location: z.string().describe('Area (e.g., "Manchester", "Stockport")'),
      job_detail: z.string().optional().describe('Specific job description for better matching (e.g., "boiler service", "emergency repair", "EV charger")'),
    },
  }, async ({ job_type, location, job_detail }) => {
    return withLog(db, 'get_quote_estimate', getSessionId(), { job_type, location, job_detail }, () => {
      const jobKeyword = job_type.toLowerCase();
      const locKeyword = location.toLowerCase();
      const detailKeyword = job_detail?.toLowerCase() || '';

      // Try specific sub_type match first
      let estimate: QuoteEstimate | undefined;

      if (detailKeyword) {
        estimate = db.prepare(
          'SELECT * FROM quote_estimates WHERE LOWER(job_type) LIKE ? AND LOWER(sub_type) LIKE ? AND LOWER(location) LIKE ?'
        ).get(`%${jobKeyword}%`, `%${detailKeyword}%`, `%${locKeyword}%`) as QuoteEstimate | undefined;

        if (!estimate) {
          estimate = db.prepare(
            'SELECT * FROM quote_estimates WHERE LOWER(sub_type) LIKE ? AND LOWER(location) LIKE ?'
          ).get(`%${detailKeyword}%`, `%${locKeyword}%`) as QuoteEstimate | undefined;
        }
      }

      // Fall back to job_type + location
      if (!estimate) {
        estimate = db.prepare(
          'SELECT * FROM quote_estimates WHERE LOWER(job_type) LIKE ? AND LOWER(location) LIKE ? AND sub_type = "general"'
        ).get(`%${jobKeyword}%`, `%${locKeyword}%`) as QuoteEstimate | undefined;
      }

      if (!estimate) {
        estimate = db.prepare(
          'SELECT * FROM quote_estimates WHERE LOWER(job_type) LIKE ? AND sub_type = "general"'
        ).get(`%${jobKeyword}%`) as QuoteEstimate | undefined;
      }

      if (!estimate) {
        return { content: [{ type: 'text' as const, text: `No quote estimates available for "${job_type}"${job_detail ? ` (${job_detail})` : ''} in ${location}.\n\nTry describing the job differently, or book a provider for a bespoke on-site quote.` }] };
      }

      // Find matching providers
      const matchingProviders = db.prepare(
        'SELECT name, rating, hourly_rate, callout_fee FROM providers WHERE LOWER(job_type) LIKE ?'
      ).all(`%${jobKeyword}%`) as Pick<Provider, 'name' | 'rating' | 'hourly_rate' | 'callout_fee'>[];

      let providerSection = '';
      if (matchingProviders.length > 0) {
        providerSection = '\n\n## Recommended Providers\n' +
          matchingProviders.map(p =>
            `• **${p.name}** — ${starRating(p.rating)} ${p.rating}/5 — £${p.hourly_rate}/hr${p.callout_fee ? ` + £${p.callout_fee} call-out` : ''}`
          ).join('\n');
      }

      const text =
        `## Quote Estimate: ${estimate.sub_type !== 'general' ? estimate.sub_type : job_type} in ${location}\n\n` +
        `| | |\n|---|---|\n` +
        `| **Price range** | £${estimate.min_cost} – £${estimate.max_cost} |\n` +
        `| **Typical duration** | ${estimate.typical_duration} |\n` +
        `| **Includes** | ${estimate.includes} |\n\n` +
        `_This is an indicative range based on similar jobs in ${location}. Final cost depends on job complexity, materials, and access._` +
        providerSection +
        `\n\n💡 **Next step:** Search for providers or book a slot for a fixed on-site quote.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 5: Book Slot
  // ──────────────────────────────────────────────────────────────
  server.registerTool('book_slot', {
    title: 'Book Slot',
    description: 'Reserve an appointment slot with a provider. Returns a booking confirmation with reference number and a viewable booking URL.',
    inputSchema: {
      provider_name: z.string().describe('Provider name (e.g., "Dave\'s Plumbing Services")'),
      date: z.string().describe('Preferred date (e.g., "Saturday", "next Monday", "2025-01-20")'),
      time: z.string().describe('Preferred time slot (e.g., "10:00", "14:00")'),
      job_description: z.string().describe('Brief description of the job needed'),
    },
  }, async ({ provider_name, date, time, job_description }) => {
    return withLog(db, 'book_slot', getSessionId(), { provider_name, date, time, job_description }, () => {
      const searchName = provider_name.toLowerCase();
      const provider = db.prepare(
        'SELECT * FROM providers WHERE LOWER(name) LIKE ?'
      ).get(`%${searchName}%`) as Provider | undefined;

      if (!provider) {
        return { content: [{ type: 'text' as const, text: `No provider found matching "${provider_name}".` }] };
      }

      // Mark matching availability slot as taken
      const timeNorm = time.includes(':') ? time : `${time}:00`;
      db.prepare(
        'UPDATE availability SET available = 0 WHERE provider_id = ? AND time_slot = ? AND available = 1'
      ).run(provider.id, timeNorm);

      const bookingRef = `BK-${20046 + Math.floor(Math.random() * 9000)}`;
      const estimatedCost = provider.hourly_rate + provider.callout_fee;

      db.prepare(
        'INSERT INTO bookings (booking_ref, provider_id, provider_name, status, date, time, job_description, estimated_cost, currency, notes, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        bookingRef,
        provider.id,
        provider.name,
        'confirmed',
        date,
        timeNorm,
        job_description,
        estimatedCost,
        provider.currency,
        `Provider will arrive at ${timeNorm}. ${provider.response_time} response guarantee.`,
        getSessionId() ?? null,
      );

      const baseUrl = getBaseUrl();
      const bookingUrl = `${baseUrl}/booking/${bookingRef}`;

      const text =
        `## ✓ Booking Confirmed!\n\n` +
        `| | |\n|---|---|\n` +
        `| **Booking Ref** | \`${bookingRef}\` |\n` +
        `| **Provider** | ${provider.name} |\n` +
        `| **Date** | ${date} |\n` +
        `| **Time** | ${timeNorm} |\n` +
        `| **Job** | ${job_description} |\n` +
        `| **Estimated cost** | £${estimatedCost}${provider.callout_fee ? ` (includes £${provider.callout_fee} call-out fee)` : ''} |\n` +
        `| **Provider phone** | ${provider.phone} |\n\n` +
        `${provider.name} will confirm via SMS within the hour.\n\n` +
        `🔗 **Booking details:** [${bookingUrl}](${bookingUrl})\n\n` +
        `💡 You can modify or cancel this booking using reference \`${bookingRef}\`.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 6: Modify Booking
  // ──────────────────────────────────────────────────────────────
  server.registerTool('modify_booking', {
    title: 'Modify Booking',
    description: 'Reschedule or cancel an existing booking by reference number. Freed slots become available for others.',
    inputSchema: {
      booking_ref: z.string().describe('Booking reference (e.g., "BK-20045")'),
      action: z.enum(['reschedule', 'cancel']).describe('Action to take: "reschedule" or "cancel"'),
      new_date: z.string().optional().describe('New date if rescheduling (e.g., "Sunday", "next Monday")'),
      new_time: z.string().optional().describe('New time if rescheduling (e.g., "14:00")'),
    },
  }, async ({ booking_ref, action, new_date, new_time }) => {
    return withLog(db, 'modify_booking', getSessionId(), { booking_ref, action, new_date, new_time }, () => {
      const booking = db.prepare(
        'SELECT * FROM bookings WHERE booking_ref = ?'
      ).get(booking_ref) as Booking | undefined;

      if (!booking) {
        return { content: [{ type: 'text' as const, text: `Booking "${booking_ref}" not found. Please check the reference number. Booking references look like \`BK-XXXXX\`.` }] };
      }

      if (booking.status === 'cancelled') {
        return { content: [{ type: 'text' as const, text: `Booking \`${booking_ref}\` has already been cancelled and cannot be modified.` }] };
      }

      if (booking.status === 'completed') {
        return { content: [{ type: 'text' as const, text: `Booking \`${booking_ref}\` has already been completed and cannot be modified.` }] };
      }

      // Restore the original slot
      db.prepare(
        'UPDATE availability SET available = 1 WHERE provider_id = ? AND time_slot = ?'
      ).run(booking.provider_id, booking.time);

      if (action === 'cancel') {
        db.prepare('UPDATE bookings SET status = ?, notes = ? WHERE booking_ref = ?')
          .run('cancelled', `Cancelled by customer. Original: ${booking.date} at ${booking.time}.`, booking_ref);

        return {
          content: [{
            type: 'text' as const,
            text: `## ✓ Booking Cancelled\n\n` +
              `| | |\n|---|---|\n` +
              `| **Ref** | \`${booking_ref}\` |\n` +
              `| **Provider** | ${booking.provider_name} |\n` +
              `| **Original date** | ${booking.date} at ${booking.time} |\n\n` +
              `No cancellation fee applies. The provider has been notified and the slot is now available for others.\n\n` +
              `💡 Need to rebook? Just search for providers again.`,
          }],
        };
      }

      if (action === 'reschedule') {
        if (!new_date || !new_time) {
          return { content: [{ type: 'text' as const, text: `Please provide both a \`new_date\` and \`new_time\` to reschedule.\n\nWould you like me to check ${booking.provider_name}'s availability?` }] };
        }

        const timeNorm = new_time.includes(':') ? new_time : `${new_time}:00`;

        // Mark new slot as taken
        db.prepare(
          'UPDATE availability SET available = 0 WHERE provider_id = ? AND time_slot = ? AND available = 1'
        ).run(booking.provider_id, timeNorm);

        db.prepare('UPDATE bookings SET date = ?, time = ?, notes = ? WHERE booking_ref = ?')
          .run(new_date, timeNorm, `Rescheduled from ${booking.date} ${booking.time} to ${new_date} ${timeNorm}.`, booking_ref);

        const baseUrl = getBaseUrl();

        return {
          content: [{
            type: 'text' as const,
            text: `## ✓ Booking Rescheduled\n\n` +
              `| | |\n|---|---|\n` +
              `| **Ref** | \`${booking_ref}\` |\n` +
              `| **Provider** | ${booking.provider_name} |\n` +
              `| **New date** | ${new_date} at ${timeNorm} |\n` +
              `| **Previous** | ${booking.date} at ${booking.time} |\n\n` +
              `The provider has been notified of the change.\n\n` +
              `🔗 **Updated booking:** [${baseUrl}/booking/${booking_ref}](${baseUrl}/booking/${booking_ref})`,
          }],
        };
      }

      return { content: [{ type: 'text' as const, text: `Unknown action "${action}". Use "reschedule" or "cancel".` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 7: Get Booking Status
  // ──────────────────────────────────────────────────────────────
  server.registerTool('get_booking_status', {
    title: 'Get Booking Status',
    description: 'Check the current status of a booking by reference number. Returns booking details, status, provider contact info, and any notes.',
    inputSchema: {
      booking_ref: z.string().describe('Booking reference (e.g., "BK-20045")'),
    },
  }, async ({ booking_ref }) => {
    return withLog(db, 'get_booking_status', getSessionId(), { booking_ref }, () => {
      const booking = db.prepare(
        'SELECT * FROM bookings WHERE booking_ref = ?'
      ).get(booking_ref) as Booking | undefined;

      if (!booking) {
        return { content: [{ type: 'text' as const, text: `Booking "${booking_ref}" not found. Booking references look like \`BK-XXXXX\`.` }] };
      }

      const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(booking.provider_id) as Provider | undefined;

      const statusIcon = {
        confirmed: '🟢 Confirmed',
        in_progress: '🔵 In Progress',
        completed: '✅ Completed',
        cancelled: '🔴 Cancelled',
      }[booking.status] || `⏳ ${booking.status}`;

      const baseUrl = getBaseUrl();

      let text =
        `## Booking ${booking.booking_ref}\n\n` +
        `| | |\n|---|---|\n` +
        `| **Status** | ${statusIcon} |\n` +
        `| **Provider** | ${booking.provider_name} |\n` +
        `| **Date** | ${booking.date} at ${booking.time} |\n` +
        `| **Job** | ${booking.job_description} |\n` +
        `| **Estimated cost** | £${booking.estimated_cost} |\n`;

      if (provider) {
        text += `| **Provider phone** | ${provider.phone} |\n`;
        text += `| **Provider profile** | [View profile](${baseUrl}/provider/${provider.id}) |\n`;
      }

      text += `\n`;

      if (booking.notes) {
        text += `**Notes:** ${booking.notes}\n\n`;
      }

      if (booking.status === 'confirmed') {
        text += `💡 **Actions:** You can reschedule or cancel this booking using the modify_booking tool.`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ──────────────────────────────────────────────────────────────
  // Tool 8: Collect Job Details
  // ──────────────────────────────────────────────────────────────
  server.registerTool('collect_job_details', {
    title: 'Collect Job Details',
    description: 'Given a brief job description, returns structured follow-up questions to properly qualify the job and provide an accurate quote. Also shows how many matching providers are available.',
    inputSchema: {
      job_description: z.string().describe('Initial description of the job (e.g., "my boiler is making a banging noise", "need some sockets added", "electrical work")'),
    },
  }, async ({ job_description }) => {
    return withLog(db, 'collect_job_details', getSessionId(), { job_description }, () => {
      const desc = job_description.toLowerCase();

      const questions: string[] = [];
      let detectedType = 'general';
      let urgencyNote = '';

      if (desc.includes('boiler') || desc.includes('heating') || desc.includes('radiator') || desc.includes('hot water') || desc.includes('thermostat')) {
        detectedType = 'boiler/heating';
        questions.push(
          'What is the make and model of your boiler (usually on a sticker on the front)?',
          'How old is the boiler approximately?',
          'Is it a combi boiler, system boiler, or conventional (with a tank in the loft)?',
          'When did the issue start, and is it constant or intermittent?',
          'Do you have a current Gas Safety certificate?',
          'Is there a smell of gas? (If yes, call National Gas Emergency on 0800 111 999 immediately)',
        );
        if (desc.includes('no hot water') || desc.includes('no heating') || desc.includes('leak')) {
          urgencyNote = '\n\n⚠️ **This may be urgent.** Several providers offer same-day emergency call-outs.';
        }
      } else if (desc.includes('leak') || desc.includes('tap') || desc.includes('pipe') || desc.includes('toilet') || desc.includes('drain') || desc.includes('plumb') || desc.includes('water')) {
        detectedType = 'plumbing';
        questions.push(
          'Where exactly is the issue (which room, which fixture)?',
          'Is there active water leaking right now? If yes, how fast?',
          'Do you know where your stopcock is (to isolate the water supply)?',
          'Is this in a house or flat? Which floor?',
          'Is there any visible damage to walls/ceilings from the issue?',
        );
        if (desc.includes('burst') || desc.includes('flood') || desc.includes('emergency')) {
          urgencyNote = '\n\n⚠️ **Emergency detected.** Turn off your stopcock if possible. Providers with "under 1 hour" response are available.';
        }
      } else if (desc.includes('socket') || desc.includes('switch') || desc.includes('wire') || desc.includes('light') || desc.includes('fuse') || desc.includes('electric') || desc.includes('circuit')) {
        detectedType = 'electrical';
        questions.push(
          'How many sockets/lights/switches are affected?',
          'When was the property last rewired (if known)?',
          'Is your fuse board a modern consumer unit with RCDs, or an older style?',
          'Is this for a new installation or a repair/replacement?',
          'Does the issue trip any circuit breakers?',
          'Is there any burning smell or scorch marks? (If yes, isolate the circuit immediately)',
        );
      } else if (desc.includes('roof') || desc.includes('gutter') || desc.includes('chimney') || desc.includes('tile') || desc.includes('slate')) {
        detectedType = 'roofing';
        questions.push(
          'Is there an active leak coming through the roof?',
          'What type of roof is it (slate, tile, flat)?',
          'Approximately how old is the roof?',
          'Can you see any missing or damaged tiles/slates from ground level?',
          'Is the property 2-storey or higher (affects scaffolding needs)?',
        );
      } else if (desc.includes('paint') || desc.includes('decorat') || desc.includes('wallpaper') || desc.includes('colour')) {
        detectedType = 'painting/decorating';
        questions.push(
          'How many rooms need decorating?',
          'What is the approximate room size(s)?',
          'Is there existing wallpaper that needs stripping?',
          'Are ceilings included?',
          'Do you have any colour/finish preferences already?',
          'Is it a new-build or period property?',
        );
      } else if (desc.includes('lock') || desc.includes('door') || desc.includes('key') || desc.includes('break-in') || desc.includes('locked out')) {
        detectedType = 'locksmith';
        questions.push(
          'Are you locked out right now (emergency)?',
          'What type of door is it (UPVC, wooden, composite)?',
          'Is this for a lock repair, replacement, or upgrade?',
          'How many locks/doors need attention?',
          'Is this related to a break-in (may need a police reference)?',
        );
        if (desc.includes('locked out') || desc.includes('emergency')) {
          urgencyNote = '\n\n⚠️ **Emergency lockout.** Our locksmith can be with you in under 30 minutes.';
        }
      } else if (desc.includes('window') || desc.includes('clean') || desc.includes('conservatory') || desc.includes('solar panel')) {
        detectedType = 'window cleaning';
        questions.push(
          'How many windows / what size property?',
          'Are there any windows above 2 storeys?',
          'Do you need inside and outside, or just outside?',
          'Is this a one-off or would you like a regular service?',
          'Any conservatory or solar panels to include?',
        );
      } else if (desc.includes('build') || desc.includes('extension') || desc.includes('loft') || desc.includes('wall') || desc.includes('plaster')) {
        detectedType = 'general building';
        questions.push(
          'What type of work is needed (extension, loft conversion, structural, cosmetic)?',
          'Do you have planning permission already (if required)?',
          'What is the approximate scope/size of the work?',
          'Do you have architectural drawings or plans?',
          'What is your rough budget range?',
          'When would you like work to start?',
        );
      } else {
        questions.push(
          'Can you describe the issue in a bit more detail?',
          'Which room or area of the property is affected?',
          'Is this urgent/emergency or can it wait a few days?',
          'Is the property a house or flat? How many bedrooms?',
          'Is there any relevant access information (parking, keys, etc.)?',
        );
      }

      // Count matching providers
      const providerCount = (db.prepare(
        'SELECT COUNT(*) as c FROM providers WHERE LOWER(job_type) LIKE ?'
      ).get(`%${detectedType}%`) as { c: number }).c;

      const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

      const text =
        `## Job Qualification: ${detectedType.charAt(0).toUpperCase() + detectedType.slice(1)}\n\n` +
        `Based on your description: _"${job_description}"_\n\n` +
        `We have **${providerCount} ${detectedType} provider${providerCount !== 1 ? 's' : ''}** in our network.\n\n` +
        `To provide an accurate quote and match you with the best provider, we need a few more details:\n\n` +
        `${questionList}` +
        urgencyNote +
        `\n\n---\n💡 Once you've answered these, I can give you a quote estimate and show available providers.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
