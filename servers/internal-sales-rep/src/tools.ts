import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const DEMO_REP = {
  rep_id: 'REP-JW-001',
  name: 'James Whitfield',
  title: 'Account Manager',
  email: 'j.whitfield@acmeindustrial.com',
};

interface Account {
  account_id: string;
  name: string;
  tier: string;
  credit_limit: number;
  credit_balance: number;
  payment_terms: string;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  key_contact_name: string;
  key_contact_role: string;
  key_contact_email: string;
  key_contact_phone: string | null;
  assigned_rep_id: string;
  notes: string | null;
}

interface Order {
  order_id: string;
  account_id: string;
  status: string;
  order_date: string;
  delivery_date: string | null;
  items: string;
  total: number;
  currency: string;
  po_number: string | null;
  notes: string | null;
}

interface Product {
  sku: string;
  name: string;
  category: string;
  description: string;
  list_price: number;
  tier1_price: number;
  tier2_price: number;
  currency: string;
  unit: string;
  stock_qty: number;
  warehouse: string;
  lead_time_days: number;
  substitute_sku: string | null;
}

interface Quote {
  quote_id: string;
  account_id: string;
  rep_id: string;
  status: string;
  created_date: string;
  sent_date: string | null;
  expiry_date: string | null;
  items: string;
  total: number;
  currency: string;
  notes: string | null;
}

interface DiscountApproval {
  approval_id: string;
  account_id: string;
  rep_id: string;
  discount_percent: number;
  expected_order_value: number;
  justification: string;
  status: string;
  requested_date: string;
  approver: string | null;
  resolved_date: string | null;
}

interface WarehouseRow {
  sku: string;
  warehouse: string;
  stock_qty: number;
  next_replenishment_date: string | null;
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

function findAccount(db: Database.Database, accountName: string): Account | undefined {
  return db.prepare(
    'SELECT * FROM accounts WHERE LOWER(name) LIKE ? AND assigned_rep_id = ?'
  ).get(`%${accountName.toLowerCase()}%`, DEMO_REP.rep_id) as Account | undefined;
}

function priceForTier(product: Product, tier: string): number {
  if (tier === 'Tier 1') return product.tier1_price;
  if (tier === 'Tier 2') return product.tier2_price;
  return product.list_price;
}

export function registerInternalSalesTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  // ── 1. get_customer_briefing ─────────────────────────────────────
  server.registerTool('get_customer_briefing', {
    title: 'Customer Briefing',
    description: 'Pre-call briefing for a named account: open orders, last purchase, outstanding items, key contacts, and credit position. Use before customer calls to prepare.',
    inputSchema: {
      account_name: z.string().describe('Account name or partial name (e.g., "Hargreaves")'),
    },
  }, async ({ account_name }) => {
    return withLog(db, 'get_customer_briefing', getSessionId(), { account_name }, () => {
      const account = findAccount(db, account_name);
      if (!account) {
        return { content: [{ type: 'text' as const, text: `No account found matching "${account_name}" in your portfolio.` }] };
      }

      const orders = db.prepare(
        'SELECT * FROM orders WHERE account_id = ? ORDER BY order_date DESC'
      ).all(account.account_id) as Order[];

      const openOrders = orders.filter(o => o.status !== 'delivered');
      const lastDelivered = orders.find(o => o.status === 'delivered');

      const quotes = db.prepare(
        'SELECT * FROM quotes WHERE account_id = ? AND status != ? ORDER BY created_date DESC'
      ).all(account.account_id, 'accepted') as Quote[];

      const pendingApprovals = db.prepare(
        'SELECT * FROM discount_approvals WHERE account_id = ? AND status = ?'
      ).all(account.account_id, 'pending') as DiscountApproval[];

      const creditAvailable = account.credit_limit - account.credit_balance;

      let text = `# Customer Briefing — ${account.name}\n`;
      text += `**Account:** ${account.account_id} | **Tier:** ${account.tier} | **Terms:** ${account.payment_terms}\n\n`;

      text += `## Key Contact\n`;
      text += `${account.key_contact_name} (${account.key_contact_role})\n`;
      text += `Email: ${account.key_contact_email}`;
      if (account.key_contact_phone) text += ` | Phone: ${account.key_contact_phone}`;
      text += '\n\n';

      text += `## Credit Position\n`;
      text += `Limit: £${account.credit_limit.toLocaleString('en-GB')} | Balance: £${account.credit_balance.toLocaleString('en-GB')} | Available: £${creditAvailable.toLocaleString('en-GB')}\n`;
      if (account.last_payment_date) {
        text += `Last payment: £${account.last_payment_amount?.toLocaleString('en-GB')} on ${account.last_payment_date}\n`;
      }
      text += '\n';

      if (openOrders.length > 0) {
        text += `## Open Orders (${openOrders.length})\n`;
        for (const o of openOrders) {
          text += `- **${o.order_id}** — ${o.status} — £${o.total.toFixed(2)} — placed ${o.order_date}`;
          if (o.notes) text += ` — _${o.notes}_`;
          text += '\n';
        }
        text += '\n';
      }

      if (lastDelivered) {
        text += `## Last Delivered Order\n`;
        text += `**${lastDelivered.order_id}** — £${lastDelivered.total.toFixed(2)} — delivered ${lastDelivered.delivery_date}\n\n`;
      }

      if (quotes.length > 0) {
        text += `## Active Quotes\n`;
        for (const q of quotes) {
          text += `- **${q.quote_id}** — ${q.status} — £${q.total.toFixed(2)}`;
          if (q.expiry_date) text += ` — expires ${q.expiry_date}`;
          if (q.notes) text += ` — _${q.notes}_`;
          text += '\n';
        }
        text += '\n';
      }

      if (pendingApprovals.length > 0) {
        text += `## Pending Approvals\n`;
        for (const a of pendingApprovals) {
          text += `- **${a.approval_id}** — ${a.discount_percent}% discount on £${a.expected_order_value.toLocaleString('en-GB')} — awaiting ${a.approver ?? 'manager'}\n`;
        }
        text += '\n';
      }

      if (account.notes) {
        text += `## Notes\n${account.notes}\n`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 2. get_order_history ─────────────────────────────────────────
  server.registerTool('get_order_history', {
    title: 'Order History',
    description: 'Retrieve the last N orders for a named account. Shows order ID, status, date, PO number, total, and line items.',
    inputSchema: {
      account_name: z.string().describe('Account name or partial name'),
      limit: z.number().min(1).max(50).default(6).describe('Number of orders to return (default 6)'),
    },
  }, async ({ account_name, limit }) => {
    return withLog(db, 'get_order_history', getSessionId(), { account_name, limit }, () => {
      const account = findAccount(db, account_name);
      if (!account) {
        return { content: [{ type: 'text' as const, text: `No account found matching "${account_name}" in your portfolio.` }] };
      }

      const orders = db.prepare(
        'SELECT * FROM orders WHERE account_id = ? ORDER BY order_date DESC LIMIT ?'
      ).all(account.account_id, limit) as Order[];

      if (orders.length === 0) {
        return { content: [{ type: 'text' as const, text: `No orders found for ${account.name}.` }] };
      }

      let text = `# Order History — ${account.name} (last ${orders.length})\n\n`;

      for (const o of orders) {
        const items = JSON.parse(o.items) as Array<{ sku: string; name: string; quantity: number; unit_price: number; total: number }>;
        text += `## ${o.order_id} — ${o.status.toUpperCase()}\n`;
        text += `Date: ${o.order_date}`;
        if (o.delivery_date) text += ` | Delivered: ${o.delivery_date}`;
        if (o.po_number) text += ` | PO: ${o.po_number}`;
        text += `\nTotal: £${o.total.toFixed(2)}\n`;
        for (const item of items) {
          text += `  • ${item.name} (${item.sku}) × ${item.quantity} @ £${item.unit_price.toFixed(2)} = £${item.total.toFixed(2)}\n`;
        }
        if (o.notes) text += `_Note: ${o.notes}_\n`;
        text += '\n';
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 3. build_quote ───────────────────────────────────────────────
  server.registerTool('build_quote', {
    title: 'Build Quote',
    description: 'Draft a quote with contract pricing for an account. Provide SKUs and quantities; prices are automatically calculated based on the account tier. Returns a formatted quote with line totals.',
    inputSchema: {
      account_name: z.string().describe('Account name or partial name'),
      items: z.array(z.object({
        sku: z.string().describe('Product SKU'),
        quantity: z.number().min(1).describe('Quantity'),
      })).min(1).describe('Array of items to quote'),
    },
  }, async ({ account_name, items }) => {
    return withLog(db, 'build_quote', getSessionId(), { account_name, items }, () => {
      const account = findAccount(db, account_name);
      if (!account) {
        return { content: [{ type: 'text' as const, text: `No account found matching "${account_name}" in your portfolio.` }] };
      }

      const quoteLines: Array<{ sku: string; name: string; quantity: number; unit_price: number; list_price: number; total: number; unit: string }> = [];
      const errors: string[] = [];

      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(item.sku) as Product | undefined;
        if (!product) {
          errors.push(`SKU "${item.sku}" not found`);
          continue;
        }
        const price = priceForTier(product, account.tier);
        quoteLines.push({
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          unit_price: price,
          list_price: product.list_price,
          total: price * item.quantity,
          unit: product.unit,
        });
      }

      if (quoteLines.length === 0) {
        return { content: [{ type: 'text' as const, text: `Could not build quote: ${errors.join(', ')}` }] };
      }

      const quoteId = `QT-${new Date().getFullYear()}-${randomUUID().substring(0, 4).toUpperCase()}`;
      const grandTotal = quoteLines.reduce((sum, l) => sum + l.total, 0);
      const totalListPrice = quoteLines.reduce((sum, l) => sum + (l.list_price * l.quantity), 0);
      const savings = totalListPrice - grandTotal;

      const quoteItems = quoteLines.map(l => ({
        sku: l.sku, quantity: l.quantity, unit_price: l.unit_price, total: l.total,
      }));
      db.prepare(
        'INSERT INTO quotes (quote_id, account_id, rep_id, status, created_date, items, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(quoteId, account.account_id, DEMO_REP.rep_id, 'draft', new Date().toISOString().slice(0, 10), JSON.stringify(quoteItems), grandTotal, null);

      let text = `# Quote ${quoteId}\n`;
      text += `**Account:** ${account.name} (${account.account_id}) | **Tier:** ${account.tier}\n`;
      text += `**Prepared by:** ${DEMO_REP.name}, ${DEMO_REP.title}\n`;
      text += `**Date:** ${new Date().toISOString().slice(0, 10)}\n\n`;
      text += `| SKU | Product | Qty | Unit | Unit Price | List Price | Line Total |\n`;
      text += `|-----|---------|-----|------|-----------|-----------|------------|\n`;
      for (const l of quoteLines) {
        const discount = l.list_price > l.unit_price ? ` (${(((l.list_price - l.unit_price) / l.list_price) * 100).toFixed(0)}% off)` : '';
        text += `| ${l.sku} | ${l.name} | ${l.quantity} | ${l.unit} | £${l.unit_price.toFixed(2)}${discount} | £${l.list_price.toFixed(2)} | £${l.total.toFixed(2)} |\n`;
      }
      text += `\n**Grand Total: £${grandTotal.toFixed(2)}**`;
      if (savings > 0) text += ` (saving £${savings.toFixed(2)} vs list price)`;
      text += '\n';

      if (errors.length > 0) {
        text += `\n⚠ Warnings: ${errors.join('; ')}\n`;
      }

      text += `\nQuote saved as **${quoteId}** (draft). Use the CRM to send to customer.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 4. check_stock_and_delivery ──────────────────────────────────
  server.registerTool('check_stock_and_delivery', {
    title: 'Stock & Delivery Check',
    description: 'Check stock levels by warehouse and earliest delivery date for one or more SKUs. Optionally filter by delivery location to find nearest warehouse.',
    inputSchema: {
      skus: z.array(z.string()).min(1).describe('Array of SKU codes to check'),
      delivery_location: z.string().optional().describe('Delivery city/region to estimate closest warehouse (e.g., "Manchester")'),
    },
  }, async ({ skus, delivery_location }) => {
    return withLog(db, 'check_stock_and_delivery', getSessionId(), { skus, delivery_location }, () => {
      const warehouseTransit: Record<string, Record<string, number>> = {
        Sheffield: { Sheffield: 0, Manchester: 1, Birmingham: 1, London: 2, Glasgow: 3, Leeds: 1, default: 2 },
        Birmingham: { Birmingham: 0, London: 1, Manchester: 1, Sheffield: 1, Glasgow: 3, Leeds: 2, default: 2 },
        Glasgow: { Glasgow: 0, Edinburgh: 1, Sheffield: 2, Manchester: 2, Birmingham: 3, London: 3, default: 2 },
      };

      const results: string[] = [];

      for (const sku of skus) {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!product) {
          results.push(`**${sku}** — ❌ SKU not found`);
          continue;
        }

        const stocks = db.prepare(
          'SELECT * FROM warehouse_stock WHERE sku = ? ORDER BY stock_qty DESC'
        ).all(sku) as WarehouseRow[];

        if (stocks.length === 0) {
          results.push(`**${product.name}** (${sku}) — No stock data available`);
          continue;
        }

        let text = `**${product.name}** (${sku})\n`;
        text += `Lead time: ${product.lead_time_days} day(s) picking + transit\n`;

        for (const s of stocks) {
          const transitDays = delivery_location
            ? (warehouseTransit[s.warehouse]?.[delivery_location] ?? warehouseTransit[s.warehouse]?.['default'] ?? 2)
            : 0;
          const totalDays = product.lead_time_days + transitDays;
          const deliveryDate = new Date();
          deliveryDate.setDate(deliveryDate.getDate() + totalDays);
          const dateStr = deliveryDate.toISOString().slice(0, 10);

          text += `  📦 ${s.warehouse}: ${s.stock_qty.toLocaleString('en-GB')} in stock`;
          if (delivery_location) text += ` → ${totalDays} day(s) to ${delivery_location} (est. ${dateStr})`;
          if (s.next_replenishment_date) text += ` | Replenishment: ${s.next_replenishment_date}`;
          text += '\n';
        }

        results.push(text);
      }

      return { content: [{ type: 'text' as const, text: `# Stock & Delivery Check\n\n${results.join('\n---\n\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 5. find_substitute ───────────────────────────────────────────
  server.registerTool('find_substitute', {
    title: 'Find Substitute',
    description: 'Find substitute SKUs for a product with price impact versus the original. Useful when a product is out of stock or the customer wants alternatives.',
    inputSchema: {
      sku: z.string().describe('Original product SKU to find substitutes for'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'find_substitute', getSessionId(), { sku }, () => {
      const original = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
      if (!original) {
        return { content: [{ type: 'text' as const, text: `SKU "${sku}" not found.` }] };
      }

      if (!original.substitute_sku) {
        return { content: [{ type: 'text' as const, text: `No known substitute for **${original.name}** (${sku}). Check with the product team for alternatives.` }] };
      }

      const substitute = db.prepare('SELECT * FROM products WHERE sku = ?').get(original.substitute_sku) as Product | undefined;
      if (!substitute) {
        return { content: [{ type: 'text' as const, text: `Substitute SKU ${original.substitute_sku} is listed but not found in catalogue.` }] };
      }

      const listDiff = substitute.list_price - original.list_price;
      const pctDiff = ((listDiff / original.list_price) * 100).toFixed(1);
      const direction = listDiff > 0 ? '↑' : listDiff < 0 ? '↓' : '→';

      const subStock = db.prepare(
        'SELECT SUM(stock_qty) as total FROM warehouse_stock WHERE sku = ?'
      ).get(substitute.sku) as { total: number } | undefined;

      let text = `# Substitute for ${original.name} (${original.sku})\n\n`;
      text += `## Original\n`;
      text += `**${original.name}** — ${original.description}\n`;
      text += `List: £${original.list_price.toFixed(2)}/${original.unit} | T1: £${original.tier1_price.toFixed(2)} | T2: £${original.tier2_price.toFixed(2)}\n\n`;
      text += `## Substitute\n`;
      text += `**${substitute.name}** (${substitute.sku}) — ${substitute.description}\n`;
      text += `List: £${substitute.list_price.toFixed(2)}/${substitute.unit} | T1: £${substitute.tier1_price.toFixed(2)} | T2: £${substitute.tier2_price.toFixed(2)}\n`;
      text += `Stock: ${subStock?.total?.toLocaleString('en-GB') ?? 'N/A'} across all warehouses\n\n`;
      text += `## Price Impact\n`;
      text += `${direction} £${Math.abs(listDiff).toFixed(2)} per ${original.unit} (${pctDiff}%) at list price\n`;

      if (listDiff > 0) {
        text += `⚠ Substitute is more expensive. Consider absorbing the difference for key accounts.`;
      } else if (listDiff < 0) {
        text += `✓ Substitute is cheaper — good cost-saving option for the customer.`;
      } else {
        text += `→ Price neutral swap.`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 6. request_discount_approval ─────────────────────────────────
  server.registerTool('request_discount_approval', {
    title: 'Request Discount Approval',
    description: 'Raise a discount approval request to the regional manager. Provide the account, discount percentage, business justification, and expected order value.',
    inputSchema: {
      account_name: z.string().describe('Account name or partial name'),
      discount_percent: z.number().min(0.1).max(30).describe('Requested discount percentage'),
      justification: z.string().min(10).describe('Business justification for the discount'),
      expected_order_value: z.number().min(1).describe('Expected order value in GBP'),
    },
  }, async ({ account_name, discount_percent, justification, expected_order_value }) => {
    return withLog(db, 'request_discount_approval', getSessionId(), { account_name, discount_percent, justification, expected_order_value }, () => {
      const account = findAccount(db, account_name);
      if (!account) {
        return { content: [{ type: 'text' as const, text: `No account found matching "${account_name}" in your portfolio.` }] };
      }

      const approvalId = `DA-${new Date().getFullYear()}-${randomUUID().substring(0, 6).toUpperCase()}`;
      const approver = 'Karen Mitchell (Regional Manager)';

      db.prepare(
        'INSERT INTO discount_approvals (approval_id, account_id, rep_id, discount_percent, expected_order_value, justification, status, requested_date, approver) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(approvalId, account.account_id, DEMO_REP.rep_id, discount_percent, expected_order_value, justification, 'pending', new Date().toISOString().slice(0, 10), approver);

      const discountValue = (expected_order_value * discount_percent) / 100;

      let text = `✓ Discount approval request submitted.\n\n`;
      text += `**Request ID:** ${approvalId}\n`;
      text += `**Account:** ${account.name} (${account.account_id})\n`;
      text += `**Discount:** ${discount_percent}% on expected order of £${expected_order_value.toLocaleString('en-GB')}\n`;
      text += `**Discount Value:** £${discountValue.toFixed(2)}\n`;
      text += `**Justification:** ${justification}\n`;
      text += `**Routed to:** ${approver}\n`;
      text += `**Status:** Pending\n\n`;
      text += `You will receive an email notification when a decision is made. Typical turnaround is 24–48 hours.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 7. check_credit ──────────────────────────────────────────────
  server.registerTool('check_credit', {
    title: 'Check Credit',
    description: 'Check credit limit, current balance, available credit, and recent payment history for a named account.',
    inputSchema: {
      account_name: z.string().describe('Account name or partial name'),
    },
  }, async ({ account_name }) => {
    return withLog(db, 'check_credit', getSessionId(), { account_name }, () => {
      const account = findAccount(db, account_name);
      if (!account) {
        return { content: [{ type: 'text' as const, text: `No account found matching "${account_name}" in your portfolio.` }] };
      }

      const available = account.credit_limit - account.credit_balance;
      const utilisation = ((account.credit_balance / account.credit_limit) * 100).toFixed(1);

      const orders = db.prepare(
        'SELECT * FROM orders WHERE account_id = ? ORDER BY order_date DESC LIMIT 5'
      ).all(account.account_id) as Order[];

      const openOrdersTotal = orders
        .filter(o => o.status !== 'delivered')
        .reduce((sum, o) => sum + o.total, 0);

      let text = `# Credit Report — ${account.name}\n\n`;
      text += `| Metric | Value |\n`;
      text += `|--------|-------|\n`;
      text += `| Credit Limit | £${account.credit_limit.toLocaleString('en-GB')} |\n`;
      text += `| Current Balance | £${account.credit_balance.toLocaleString('en-GB')} |\n`;
      text += `| Available Credit | £${available.toLocaleString('en-GB')} |\n`;
      text += `| Utilisation | ${utilisation}% |\n`;
      text += `| Payment Terms | ${account.payment_terms} |\n`;
      text += `| Open Orders Value | £${openOrdersTotal.toFixed(2)} |\n`;
      text += '\n';

      if (account.last_payment_date) {
        text += `## Last Payment\n`;
        text += `£${account.last_payment_amount?.toLocaleString('en-GB')} on ${account.last_payment_date}\n\n`;
      }

      if (available < 0) {
        text += `⚠ **Account is over credit limit by £${Math.abs(available).toLocaleString('en-GB')}.** New orders require finance approval.\n`;
      } else if (parseFloat(utilisation) > 80) {
        text += `⚠ Credit utilisation is above 80%. Large orders may require a credit limit review.\n`;
      } else {
        text += `✓ Account in good standing.\n`;
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 8. get_rep_pipeline ──────────────────────────────────────────
  server.registerTool('get_rep_pipeline', {
    title: 'My Pipeline',
    description: 'View your open quotes, pending discount approvals, and pipeline summary as the logged-in sales rep (James Whitfield). No input required.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'get_rep_pipeline', getSessionId(), {}, () => {
      const quotes = db.prepare(
        'SELECT q.*, a.name as account_name FROM quotes q JOIN accounts a ON q.account_id = a.account_id WHERE q.rep_id = ? ORDER BY q.created_date DESC'
      ).all(DEMO_REP.rep_id) as (Quote & { account_name: string })[];

      const approvals = db.prepare(
        'SELECT da.*, a.name as account_name FROM discount_approvals da JOIN accounts a ON da.account_id = a.account_id WHERE da.rep_id = ? ORDER BY da.requested_date DESC'
      ).all(DEMO_REP.rep_id) as (DiscountApproval & { account_name: string })[];

      const openQuotes = quotes.filter(q => q.status !== 'accepted' && q.status !== 'rejected');
      const pendingApprovals = approvals.filter(a => a.status === 'pending');

      const totalPipelineValue = openQuotes.reduce((sum, q) => sum + q.total, 0);
      const sentQuotes = openQuotes.filter(q => q.status === 'sent');
      const draftQuotes = openQuotes.filter(q => q.status === 'draft');

      let text = `# Pipeline — ${DEMO_REP.name}, ${DEMO_REP.title}\n\n`;

      text += `## Summary\n`;
      text += `| Metric | Value |\n`;
      text += `|--------|-------|\n`;
      text += `| Open Quotes | ${openQuotes.length} |\n`;
      text += `| Sent / Awaiting Response | ${sentQuotes.length} |\n`;
      text += `| Drafts | ${draftQuotes.length} |\n`;
      text += `| Total Pipeline Value | £${totalPipelineValue.toFixed(2)} |\n`;
      text += `| Pending Discount Approvals | ${pendingApprovals.length} |\n`;
      text += '\n';

      if (openQuotes.length > 0) {
        text += `## Open Quotes\n`;
        for (const q of openQuotes) {
          text += `- **${q.quote_id}** — ${q.account_name} — £${q.total.toFixed(2)} — ${q.status}`;
          if (q.sent_date) text += ` (sent ${q.sent_date})`;
          if (q.expiry_date) {
            const daysLeft = Math.ceil((new Date(q.expiry_date).getTime() - Date.now()) / 86400000);
            if (daysLeft <= 0) {
              text += ` — ❌ EXPIRED`;
            } else if (daysLeft <= 7) {
              text += ` — ⚠ expires in ${daysLeft} day(s)`;
            } else {
              text += ` — expires ${q.expiry_date}`;
            }
          }
          if (q.notes) text += `\n  _${q.notes}_`;
          text += '\n';
        }
        text += '\n';
      }

      if (pendingApprovals.length > 0) {
        text += `## Pending Discount Approvals\n`;
        for (const a of pendingApprovals) {
          text += `- **${a.approval_id}** — ${a.account_name} — ${a.discount_percent}% on £${a.expected_order_value.toLocaleString('en-GB')}`;
          text += ` — since ${a.requested_date}`;
          if (a.approver) text += ` — awaiting ${a.approver}`;
          text += '\n';
        }
      }

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
