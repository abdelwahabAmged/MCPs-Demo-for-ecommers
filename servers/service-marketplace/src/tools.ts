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
  response_time: string;
  bio: string;
  specialisms: string;
  sample_jobs: string;
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
  session_id: string | null;
}

interface QuoteEstimate {
  id: number;
  job_type: string;
  location: string;
  min_cost: number;
  max_cost: number;
  typical_duration: string;
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

export function registerServiceMarketplaceTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  server.registerTool('search_providers', {
    title: 'Search Providers',
    description: 'Search for local tradespeople by job type, location, and optional budget. Returns matching providers with ratings, hourly rates, and response times.',
    inputSchema: {
      job_type: z.string().describe('Type of job needed (e.g., "plumbing", "electrical", "roofing", "painting/decorating")'),
      location: z.string().describe('Area or postcode (e.g., "Manchester", "Salford", "Stockport")'),
      budget: z.number().optional().describe('Maximum hourly rate in GBP'),
    },
  }, async ({ job_type, location, budget }) => {
    return withLog(db, 'search_providers', getSessionId(), { job_type, location, budget }, () => {
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
        return { content: [{ type: 'text' as const, text: `No providers found for "${job_type}" in ${location}. Try broadening your search — we cover most trades across Greater Manchester.` }] };
      }

      const results = scored.map(({ provider: p }) =>
        `**${p.name}** — ${p.job_type}\n` +
        `⭐ ${p.rating}/5 (${p.review_count} reviews) | £${p.hourly_rate}/hr${p.callout_fee ? ` + £${p.callout_fee} call-out` : ''}\n` +
        `📍 ${p.location.replace(/,/g, ', ')} | ⏱ Response: ${p.response_time}`
      ).join('\n\n---\n\n');

      return { content: [{ type: 'text' as const, text: results }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('get_provider_detail', {
    title: 'Get Provider Detail',
    description: 'Get the full profile of a provider including bio, specialisms, ratings breakdown, and sample completed jobs with prices.',
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
        return { content: [{ type: 'text' as const, text: `No provider found matching "${provider_name}". Try searching by trade type instead.` }] };
      }

      const specialisms = provider.specialisms.split(',').map(s => `  • ${s.trim()}`).join('\n');
      const sampleJobs = provider.sample_jobs.split(',').map(s => `  • ${s.trim()}`).join('\n');

      const text =
        `# ${provider.name}\n\n` +
        `**Trade:** ${provider.job_type}\n` +
        `**Rating:** ⭐ ${provider.rating}/5 (${provider.review_count} reviews)\n` +
        `**Rate:** £${provider.hourly_rate}/hr${provider.callout_fee ? ` + £${provider.callout_fee} call-out fee` : ' (no call-out fee)'}\n` +
        `**Areas covered:** ${provider.location.replace(/,/g, ', ')}\n` +
        `**Response time:** ${provider.response_time}\n\n` +
        `## About\n${provider.bio}\n\n` +
        `## Specialisms\n${specialisms}\n\n` +
        `## Sample Completed Jobs\n${sampleJobs}`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('check_availability', {
    title: 'Check Availability',
    description: 'Check available appointment slots for a provider over the next 7 days. Returns dates and times that can be booked.',
    inputSchema: {
      provider_name: z.string().describe('Provider name or partial name (e.g., "Dave\'s Plumbing")'),
    },
  }, async ({ provider_name }) => {
    return withLog(db, 'check_availability', getSessionId(), { provider_name }, () => {
      const searchName = provider_name.toLowerCase();
      const provider = db.prepare(
        'SELECT * FROM providers WHERE LOWER(name) LIKE ?'
      ).get(`%${searchName}%`) as Provider | undefined;

      if (!provider) {
        return { content: [{ type: 'text' as const, text: `No provider found matching "${provider_name}".` }] };
      }

      const slots = db.prepare(
        'SELECT * FROM availability WHERE provider_id = ? AND available = 1 ORDER BY day_offset, time_slot'
      ).all(provider.id) as Availability[];

      if (slots.length === 0) {
        return { content: [{ type: 'text' as const, text: `${provider.name} has no available slots in the next 7 days. Try another provider or check back later.` }] };
      }

      const grouped = new Map<number, string[]>();
      for (const slot of slots) {
        const existing = grouped.get(slot.day_offset) ?? [];
        existing.push(slot.time_slot);
        grouped.set(slot.day_offset, existing);
      }

      const lines = Array.from(grouped.entries()).map(([offset, times]) => {
        const dayLabel = offset === 0 ? `Today (${getDayName(offset)})` : getDayName(offset);
        return `**${dayLabel}:** ${times.join(', ')}`;
      });

      const text =
        `## Available slots for ${provider.name}\n\n` +
        lines.join('\n') +
        `\n\nTo book a slot, use the book_slot tool with the provider name, date, and time.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('get_quote_estimate', {
    title: 'Get Quote Estimate',
    description: 'Get an indicative price range for a described job type in a given location. Returns min/max cost and typical duration.',
    inputSchema: {
      job_type: z.string().describe('Type of job (e.g., "plumbing", "electrical", "roofing")'),
      location: z.string().describe('Area (e.g., "Manchester", "Stockport")'),
    },
  }, async ({ job_type, location }) => {
    return withLog(db, 'get_quote_estimate', getSessionId(), { job_type, location }, () => {
      const jobKeyword = job_type.toLowerCase();
      const locKeyword = location.toLowerCase();

      let estimate = db.prepare(
        'SELECT * FROM quote_estimates WHERE LOWER(job_type) LIKE ? AND LOWER(location) LIKE ?'
      ).get(`%${jobKeyword}%`, `%${locKeyword}%`) as QuoteEstimate | undefined;

      if (!estimate) {
        estimate = db.prepare(
          'SELECT * FROM quote_estimates WHERE LOWER(job_type) LIKE ?'
        ).get(`%${jobKeyword}%`) as QuoteEstimate | undefined;
      }

      if (!estimate) {
        return { content: [{ type: 'text' as const, text: `No quote estimates available for "${job_type}" in ${location}. Try describing the job in more detail or contact a provider directly for a bespoke quote.` }] };
      }

      const text =
        `## Quote Estimate: ${job_type} in ${location}\n\n` +
        `**Price range:** £${estimate.min_cost} – £${estimate.max_cost}\n` +
        `**Typical duration:** ${estimate.typical_duration}\n\n` +
        `_This is an indicative range. Final cost depends on job complexity, materials, and access. ` +
        `Book a slot for a fixed quote from a provider._`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('book_slot', {
    title: 'Book Slot',
    description: 'Reserve an appointment slot with a provider. Returns a booking confirmation with reference number.',
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

      const bookingRef = `BK-${20046 + Math.floor(Math.random() * 1000)}`;
      const estimatedCost = provider.hourly_rate + provider.callout_fee;

      db.prepare(
        'INSERT INTO bookings (booking_ref, provider_id, provider_name, status, date, time, job_description, estimated_cost, currency, notes, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        bookingRef,
        provider.id,
        provider.name,
        'confirmed',
        date,
        time,
        job_description,
        estimatedCost,
        provider.currency,
        `Provider will arrive at ${time}. ${provider.response_time} response guarantee.`,
        getSessionId() ?? null,
      );

      const text =
        `✓ Booking confirmed!\n\n` +
        `**Booking Ref:** ${bookingRef}\n` +
        `**Provider:** ${provider.name}\n` +
        `**Date:** ${date}\n` +
        `**Time:** ${time}\n` +
        `**Job:** ${job_description}\n` +
        `**Estimated cost:** £${estimatedCost}${provider.callout_fee ? ` (includes £${provider.callout_fee} call-out fee)` : ''}\n\n` +
        `${provider.name} will confirm via SMS. You can modify or cancel this booking using reference ${bookingRef}.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('modify_booking', {
    title: 'Modify Booking',
    description: 'Reschedule or cancel an existing booking by reference number.',
    inputSchema: {
      booking_ref: z.string().describe('Booking reference (e.g., "BK-20045")'),
      action: z.enum(['reschedule', 'cancel']).describe('Action to take: "reschedule" or "cancel"'),
      new_date: z.string().optional().describe('New date if rescheduling (e.g., "next Monday")'),
      new_time: z.string().optional().describe('New time if rescheduling (e.g., "14:00")'),
    },
  }, async ({ booking_ref, action, new_date, new_time }) => {
    return withLog(db, 'modify_booking', getSessionId(), { booking_ref, action, new_date, new_time }, () => {
      const booking = db.prepare(
        'SELECT * FROM bookings WHERE booking_ref = ?'
      ).get(booking_ref) as Booking | undefined;

      if (!booking) {
        return { content: [{ type: 'text' as const, text: `Booking "${booking_ref}" not found. Please check the reference number.` }] };
      }

      if (booking.status === 'cancelled') {
        return { content: [{ type: 'text' as const, text: `Booking ${booking_ref} has already been cancelled.` }] };
      }

      if (booking.status === 'completed') {
        return { content: [{ type: 'text' as const, text: `Booking ${booking_ref} has already been completed and cannot be modified.` }] };
      }

      if (action === 'cancel') {
        db.prepare('UPDATE bookings SET status = ? WHERE booking_ref = ?').run('cancelled', booking_ref);
        return {
          content: [{
            type: 'text' as const,
            text: `✓ Booking ${booking_ref} has been cancelled.\n\n` +
              `**Provider:** ${booking.provider_name}\n` +
              `**Original date:** ${booking.date} at ${booking.time}\n\n` +
              `No cancellation fee applies. The provider has been notified.`,
          }],
        };
      }

      if (action === 'reschedule') {
        if (!new_date || !new_time) {
          return { content: [{ type: 'text' as const, text: 'Please provide both a new_date and new_time to reschedule.' }] };
        }

        db.prepare('UPDATE bookings SET date = ?, time = ?, notes = ? WHERE booking_ref = ?')
          .run(new_date, new_time, `Rescheduled from ${booking.date} ${booking.time}. Provider will arrive at ${new_time}.`, booking_ref);

        return {
          content: [{
            type: 'text' as const,
            text: `✓ Booking ${booking_ref} has been rescheduled.\n\n` +
              `**Provider:** ${booking.provider_name}\n` +
              `**New date:** ${new_date} at ${new_time}\n` +
              `**Previous:** ${booking.date} at ${booking.time}\n\n` +
              `The provider has been notified of the change.`,
          }],
        };
      }

      return { content: [{ type: 'text' as const, text: `Unknown action "${action}". Use "reschedule" or "cancel".` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('get_booking_status', {
    title: 'Get Booking Status',
    description: 'Check the current status of a booking by reference number. Returns booking details, status, and any provider notes.',
    inputSchema: {
      booking_ref: z.string().describe('Booking reference (e.g., "BK-20045")'),
    },
  }, async ({ booking_ref }) => {
    return withLog(db, 'get_booking_status', getSessionId(), { booking_ref }, () => {
      const booking = db.prepare(
        'SELECT * FROM bookings WHERE booking_ref = ?'
      ).get(booking_ref) as Booking | undefined;

      if (!booking) {
        return { content: [{ type: 'text' as const, text: `Booking "${booking_ref}" not found. Booking references look like BK-XXXXX.` }] };
      }

      const statusEmoji = booking.status === 'confirmed' ? '✓' :
        booking.status === 'completed' ? '✔' :
        booking.status === 'cancelled' ? '✗' : '⏳';

      const text =
        `# Booking ${booking.booking_ref}\n\n` +
        `**Status:** ${statusEmoji} ${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}\n` +
        `**Provider:** ${booking.provider_name}\n` +
        `**Date:** ${booking.date} at ${booking.time}\n` +
        `**Job:** ${booking.job_description}\n` +
        `**Estimated cost:** £${booking.estimated_cost}\n\n` +
        (booking.notes ? `**Notes:** ${booking.notes}` : '');

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('collect_job_details', {
    title: 'Collect Job Details',
    description: 'Given a brief job description, returns structured follow-up questions to properly qualify the job and provide an accurate quote.',
    inputSchema: {
      job_description: z.string().describe('Initial description of the job (e.g., "my boiler is making a banging noise", "need some sockets added")'),
    },
  }, async ({ job_description }) => {
    return withLog(db, 'collect_job_details', getSessionId(), { job_description }, () => {
      const desc = job_description.toLowerCase();

      const questions: string[] = [];
      let detectedType = 'general';

      if (desc.includes('boiler') || desc.includes('heating') || desc.includes('radiator') || desc.includes('hot water')) {
        detectedType = 'boiler/heating';
        questions.push(
          'What is the make and model of your boiler (usually on a sticker on the front)?',
          'How old is the boiler approximately?',
          'Is it a combi boiler, system boiler, or conventional (with a tank in the loft)?',
          'When did the issue start, and is it constant or intermittent?',
          'Do you have a current Gas Safety certificate?',
        );
      } else if (desc.includes('leak') || desc.includes('tap') || desc.includes('pipe') || desc.includes('toilet') || desc.includes('drain') || desc.includes('plumb')) {
        detectedType = 'plumbing';
        questions.push(
          'Where exactly is the issue (which room, which fixture)?',
          'Is there active water leaking right now? If yes, how fast?',
          'Do you know where your stopcock is (to isolate the water supply)?',
          'Is this in a house or flat? Which floor?',
          'Is there any visible damage to walls/ceilings from the issue?',
        );
      } else if (desc.includes('socket') || desc.includes('switch') || desc.includes('wire') || desc.includes('light') || desc.includes('fuse') || desc.includes('electric')) {
        detectedType = 'electrical';
        questions.push(
          'How many sockets/lights/switches are affected?',
          'When was the property last rewired (if known)?',
          'Is your fuse board a modern consumer unit with RCDs, or an older style?',
          'Is this for a new installation or a repair/replacement?',
          'Does the issue trip any circuit breakers?',
        );
      } else if (desc.includes('roof') || desc.includes('gutter') || desc.includes('chimney') || desc.includes('tile')) {
        detectedType = 'roofing';
        questions.push(
          'Is there an active leak coming through the roof?',
          'What type of roof is it (slate, tile, flat)?',
          'Approximately how old is the roof?',
          'Can you see any missing or damaged tiles/slates from ground level?',
          'Is the property 2-storey or higher (affects scaffolding needs)?',
        );
      } else if (desc.includes('paint') || desc.includes('decorat') || desc.includes('wallpaper')) {
        detectedType = 'painting/decorating';
        questions.push(
          'How many rooms need decorating?',
          'What is the approximate room size(s)?',
          'Is there existing wallpaper that needs stripping?',
          'Are ceilings included?',
          'Do you have any colour/finish preferences already?',
        );
      } else if (desc.includes('lock') || desc.includes('door') || desc.includes('key') || desc.includes('break-in')) {
        detectedType = 'locksmith';
        questions.push(
          'Are you locked out right now (emergency)?',
          'What type of door is it (UPVC, wooden, composite)?',
          'Is this for a lock repair, replacement, or upgrade?',
          'How many locks/doors need attention?',
          'Is this related to a break-in (may need a police reference)?',
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

      const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

      const text =
        `## Job Qualification: ${detectedType}\n\n` +
        `Based on your description: _"${job_description}"_\n\n` +
        `To provide an accurate quote, we need a few more details:\n\n` +
        `${questionList}\n\n` +
        `_Once you've answered these, I can match you with the best provider and give a more accurate cost estimate._`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
