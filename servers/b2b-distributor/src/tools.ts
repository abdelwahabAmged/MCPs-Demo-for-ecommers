import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const ACCOUNT_ID = 'ACME-ACC-00441';

interface Account {
  account_id: string;
  name: string;
  credit_limit: number;
  balance: number;
  payment_terms: string;
  currency: string;
  rep_name: string;
  rep_email: string;
  open_orders: number;
}

interface Product {
  sku: string;
  name: string;
  category: string;
  list_price: number;
  unit: string;
  lead_time_days: number;
}

interface ContractPrice {
  account_id: string;
  category: string;
  discount_pct: number;
  tier: string;
}

interface WarehouseRow {
  sku: string;
  warehouse: string;
  qty: number;
}

interface Order {
  order_id: string;
  account_id: string;
  status: string;
  order_date: string;
  delivery_date: string | null;
  total: number;
  currency: string;
  items: string;
}

interface SubstituteRow {
  sku: string;
  substitute_sku: string;
  notes: string;
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

function applyDiscount(listPrice: number, discountPct: number): number {
  return Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
}

export function registerB2BTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  // ── 1. get_account_summary ────────────────────────────────────
  server.registerTool('get_account_summary', {
    title: 'Get Account Summary',
    description: 'Return the B2B account overview for Hargreaves Engineering Ltd: company name, credit limit, current balance, number of open orders, payment terms, and assigned sales representative.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'get_account_summary', getSessionId(), {}, () => {
      const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as Account | undefined;

      if (!account) {
        return { content: [{ type: 'text' as const, text: 'Account not found.' }] };
      }

      const available = account.credit_limit - account.balance;

      const text =
        `# Account Summary\n\n` +
        `**Company:** ${account.name}\n` +
        `**Account ID:** ${account.account_id}\n` +
        `**Credit Limit:** £${account.credit_limit.toLocaleString('en-GB')}\n` +
        `**Current Balance:** £${account.balance.toLocaleString('en-GB')}\n` +
        `**Available Credit:** £${available.toLocaleString('en-GB')}\n` +
        `**Open Orders:** ${account.open_orders}\n` +
        `**Payment Terms:** ${account.payment_terms}\n\n` +
        `**Sales Rep:** ${account.rep_name} (${account.rep_email})`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 2. get_order_history ──────────────────────────────────────
  server.registerTool('get_order_history', {
    title: 'Get Order History',
    description: 'Return the most recent orders for the Hargreaves Engineering account. Each order includes date, status, items, and total.',
    inputSchema: {
      limit: z.number().min(1).max(50).default(5).describe('Number of recent orders to return (default 5)'),
    },
  }, async ({ limit }) => {
    return withLog(db, 'get_order_history', getSessionId(), { limit }, () => {
      const orders = db.prepare(
        'SELECT * FROM orders WHERE account_id = ? ORDER BY order_date DESC LIMIT ?'
      ).all(ACCOUNT_ID, limit) as Order[];

      if (orders.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No orders found for this account.' }] };
      }

      const lines = orders.map(o => {
        const items = JSON.parse(o.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }>;
        const itemList = items.map(i => `  • ${i.qty}× ${i.name} (${i.sku}) @ £${i.unit_price.toFixed(2)}`).join('\n');

        return `### ${o.order_id} — ${o.status.charAt(0).toUpperCase() + o.status.slice(1)}\n` +
          `**Date:** ${o.order_date}${o.delivery_date ? ` · Delivered: ${o.delivery_date}` : ''}\n` +
          `**Total:** £${o.total.toFixed(2)}\n` +
          `**Items:**\n${itemList}`;
      });

      return { content: [{ type: 'text' as const, text: `# Order History (last ${orders.length})\n\n${lines.join('\n\n---\n\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 3. reorder_from_history ───────────────────────────────────
  server.registerTool('reorder_from_history', {
    title: 'Reorder from History',
    description: 'Build a draft reorder from a previous order. Looks up the original order, checks current contract pricing and warehouse stock for each line item, and returns a ready-to-confirm reorder summary.',
    inputSchema: {
      order_id: z.string().describe('Previous order ID to reorder from (e.g., "ORD-44109")'),
    },
  }, async ({ order_id }) => {
    return withLog(db, 'reorder_from_history', getSessionId(), { order_id }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND account_id = ?').get(order_id, ACCOUNT_ID) as Order | undefined;

      if (!order) {
        return { content: [{ type: 'text' as const, text: `Order "${order_id}" not found for this account.` }] };
      }

      const items = JSON.parse(order.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }>;
      let reorderTotal = 0;

      const lines = items.map(item => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(item.sku) as Product | undefined;
        if (!product) return `  • ${item.sku} — **DISCONTINUED**`;

        const contract = db.prepare(
          'SELECT * FROM contract_pricing WHERE account_id = ? AND category = ?'
        ).get(ACCOUNT_ID, product.category) as ContractPrice | undefined;

        const discount = contract?.discount_pct ?? 0;
        const contractPrice = applyDiscount(product.list_price, discount);

        const totalStock = (db.prepare(
          'SELECT SUM(qty) as total FROM warehouse_stock WHERE sku = ?'
        ).get(item.sku) as { total: number | null }).total ?? 0;

        const lineTotal = contractPrice * item.qty;
        reorderTotal += lineTotal;

        const stockStatus = totalStock >= item.qty
          ? `✓ ${totalStock} in stock`
          : totalStock > 0
            ? `⚠ Only ${totalStock} available (need ${item.qty})`
            : '✗ Out of stock';

        return `  • ${item.qty}× **${product.name}** (${item.sku})\n` +
          `    Contract price: £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off £${product.list_price.toFixed(2)})` : ''}\n` +
          `    Line total: £${lineTotal.toFixed(2)} · Stock: ${stockStatus}`;
      });

      const text =
        `# Draft Reorder from ${order_id}\n\n` +
        `Original order date: ${order.order_date}\n\n` +
        `${lines.join('\n\n')}\n\n` +
        `---\n**Reorder Total: £${reorderTotal.toFixed(2)}**\n\n` +
        `To confirm this reorder, use the **create_quote** tool with the SKUs and quantities above.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 4. get_contract_pricing ───────────────────────────────────
  server.registerTool('get_contract_pricing', {
    title: 'Get Contract Pricing',
    description: 'Return account-specific contract pricing for one or more SKUs. Shows list price, discount tier, discount percentage, and final contract price.',
    inputSchema: {
      skus: z.array(z.string()).min(1).describe('Array of product SKU codes (e.g., ["BRG-6205-ZZ", "SEAL-V-25x42"])'),
    },
  }, async ({ skus }) => {
    return withLog(db, 'get_contract_pricing', getSessionId(), { skus }, () => {
      const lines = skus.map(sku => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!product) return `**${sku}** — SKU not found`;

        const contract = db.prepare(
          'SELECT * FROM contract_pricing WHERE account_id = ? AND category = ?'
        ).get(ACCOUNT_ID, product.category) as ContractPrice | undefined;

        const discount = contract?.discount_pct ?? 0;
        const tier = contract?.tier ?? 'Standard';
        const contractPrice = applyDiscount(product.list_price, discount);

        return `**${product.name}** (${sku})\n` +
          `  List: £${product.list_price.toFixed(2)} · ${tier}: ${discount > 0 ? `${discount}% off → **£${contractPrice.toFixed(2)}**` : `No discount → £${contractPrice.toFixed(2)}`} per ${product.unit}`;
      });

      return { content: [{ type: 'text' as const, text: `# Contract Pricing — Hargreaves Engineering\n\n${lines.join('\n\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 5. check_warehouse_stock ──────────────────────────────────
  server.registerTool('check_warehouse_stock', {
    title: 'Check Warehouse Stock',
    description: 'Return stock levels for one or more SKUs broken down by warehouse location (Manchester, Birmingham, Glasgow). Shows per-warehouse quantities and total availability.',
    inputSchema: {
      skus: z.array(z.string()).min(1).describe('Array of product SKU codes to check stock for'),
    },
  }, async ({ skus }) => {
    return withLog(db, 'check_warehouse_stock', getSessionId(), { skus }, () => {
      const lines = skus.map(sku => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!product) return `**${sku}** — SKU not found`;

        const rows = db.prepare(
          'SELECT * FROM warehouse_stock WHERE sku = ? ORDER BY warehouse'
        ).all(sku) as WarehouseRow[];

        const total = rows.reduce((s, r) => s + r.qty, 0);
        const warehouseLines = rows.map(r =>
          `  • ${r.warehouse}: ${r.qty > 0 ? `${r.qty} units` : '—'}`
        ).join('\n');

        return `**${product.name}** (${sku})\n` +
          `${warehouseLines}\n` +
          `  **Total: ${total} units** · Lead time: ${product.lead_time_days} day${product.lead_time_days > 1 ? 's' : ''}`;
      });

      return { content: [{ type: 'text' as const, text: `# Warehouse Stock Levels\n\n${lines.join('\n\n---\n\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 6. create_quote ───────────────────────────────────────────
  server.registerTool('create_quote', {
    title: 'Create Quote',
    description: 'Build a draft quote from a list of SKUs and quantities. Applies contract pricing automatically and returns a quote with a unique reference number.',
    inputSchema: {
      items: z.array(z.object({
        sku: z.string().describe('Product SKU'),
        quantity: z.number().min(1).describe('Quantity to quote'),
      })).min(1).describe('Array of items to include in the quote'),
    },
  }, async ({ items }) => {
    return withLog(db, 'create_quote', getSessionId(), { items }, () => {
      let quoteTotal = 0;
      const quoteItems: Array<{ sku: string; name: string; qty: number; list_price: number; contract_price: number; discount_pct: number; line_total: number }> = [];

      const lines = items.map(({ sku, quantity }) => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!product) return `  • ${sku} × ${quantity} — **SKU not found**`;

        const contract = db.prepare(
          'SELECT * FROM contract_pricing WHERE account_id = ? AND category = ?'
        ).get(ACCOUNT_ID, product.category) as ContractPrice | undefined;

        const discount = contract?.discount_pct ?? 0;
        const contractPrice = applyDiscount(product.list_price, discount);
        const lineTotal = contractPrice * quantity;
        quoteTotal += lineTotal;

        quoteItems.push({
          sku, name: product.name, qty: quantity,
          list_price: product.list_price, contract_price: contractPrice,
          discount_pct: discount, line_total: lineTotal,
        });

        return `  • ${quantity}× **${product.name}** (${sku})\n` +
          `    £${contractPrice.toFixed(2)} per ${product.unit}${discount > 0 ? ` (${discount}% off)` : ''} · Line: £${lineTotal.toFixed(2)}`;
      });

      const quoteId = `QTE-${randomUUID().substring(0, 8).toUpperCase()}`;

      db.prepare(
        'INSERT INTO quotes (quote_id, account_id, total, items, session_id) VALUES (?, ?, ?, ?, ?)'
      ).run(quoteId, ACCOUNT_ID, quoteTotal, JSON.stringify(quoteItems), getSessionId() ?? null);

      const text =
        `# Quote ${quoteId}\n\n` +
        `**Account:** Hargreaves Engineering Ltd (${ACCOUNT_ID})\n` +
        `**Status:** Draft\n\n` +
        `${lines.join('\n\n')}\n\n` +
        `---\n**Quote Total: £${quoteTotal.toFixed(2)}** (excl. VAT)\n\n` +
        `This quote is valid for 30 days. Contact your rep James Whitfield to confirm.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 7. find_substitute ────────────────────────────────────────
  server.registerTool('find_substitute', {
    title: 'Find Substitute',
    description: 'Return compatible substitute SKUs for a given product. Useful when a part is out of stock or you want to compare alternatives. Shows substitute details, stock, and contract pricing.',
    inputSchema: {
      sku: z.string().describe('Product SKU to find substitutes for (e.g., "BRG-6205-ZZ")'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'find_substitute', getSessionId(), { sku }, () => {
      const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
      if (!product) {
        return { content: [{ type: 'text' as const, text: `SKU "${sku}" not found.` }] };
      }

      const subs = db.prepare('SELECT * FROM substitutes WHERE sku = ?').all(sku) as SubstituteRow[];

      if (subs.length === 0) {
        return { content: [{ type: 'text' as const, text: `No substitutes found for **${product.name}** (${sku}).` }] };
      }

      const lines = subs.map(sub => {
        const subProduct = db.prepare('SELECT * FROM products WHERE sku = ?').get(sub.substitute_sku) as Product | undefined;
        if (!subProduct) return `  • ${sub.substitute_sku} — product data unavailable`;

        const contract = db.prepare(
          'SELECT * FROM contract_pricing WHERE account_id = ? AND category = ?'
        ).get(ACCOUNT_ID, subProduct.category) as ContractPrice | undefined;

        const discount = contract?.discount_pct ?? 0;
        const contractPrice = applyDiscount(subProduct.list_price, discount);

        const totalStock = (db.prepare(
          'SELECT SUM(qty) as total FROM warehouse_stock WHERE sku = ?'
        ).get(sub.substitute_sku) as { total: number | null }).total ?? 0;

        return `### ${subProduct.name} (${sub.substitute_sku})\n` +
          `  Contract price: £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off)` : ''}\n` +
          `  Stock: ${totalStock > 0 ? `${totalStock} units available` : 'Out of stock'}\n` +
          `  Lead time: ${subProduct.lead_time_days} day${subProduct.lead_time_days > 1 ? 's' : ''}\n` +
          `  _${sub.notes}_`;
      });

      const text =
        `# Substitutes for ${product.name} (${sku})\n\n${lines.join('\n\n')}`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // ── 8. route_to_rep ───────────────────────────────────────────
  server.registerTool('route_to_rep', {
    title: 'Route to Sales Rep',
    description: 'Flag the current conversation for follow-up by the assigned sales representative (James Whitfield). Use when the buyer needs human assistance, custom pricing, or has a complex request.',
    inputSchema: {
      message: z.string().describe('Summary of the conversation or request to pass to the sales rep'),
    },
  }, async ({ message }) => {
    return withLog(db, 'route_to_rep', getSessionId(), { message }, () => {
      const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as Account | undefined;
      if (!account) {
        return { content: [{ type: 'text' as const, text: 'Account not found.' }] };
      }

      const escalationId = `ESC-${randomUUID().substring(0, 8).toUpperCase()}`;

      db.prepare(
        'INSERT INTO rep_escalations (escalation_id, account_id, rep_name, message, session_id) VALUES (?, ?, ?, ?, ?)'
      ).run(escalationId, ACCOUNT_ID, account.rep_name, message, getSessionId() ?? null);

      const text =
        `✓ Escalated to your sales rep.\n\n` +
        `**Escalation ID:** ${escalationId}\n` +
        `**Rep:** ${account.rep_name} (${account.rep_email})\n` +
        `**Message:** ${message}\n\n` +
        `${account.rep_name} will follow up within 4 business hours. You can reference escalation **${escalationId}** in any correspondence.`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
