import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const ACCOUNT_ID = 'ACME-ACC-00441';

interface Account {
  account_id: string; name: string; credit_limit: number; balance: number;
  payment_terms: string; currency: string; rep_name: string; rep_email: string;
  open_orders: number; tier: string; ytd_spend: number; last_order_date: string;
}
interface Product {
  sku: string; name: string; brand: string; category: string; description: string;
  list_price: number; unit: string; lead_time_days: number; min_order_qty: number;
  weight_kg: number; specifications: string;
}
interface ContractPrice { account_id: string; category: string; discount_pct: number; tier: string; }
interface WarehouseRow { sku: string; warehouse: string; qty: number; }
interface Order {
  order_id: string; account_id: string; status: string; order_date: string;
  delivery_date: string | null; total: number; currency: string; po_number: string;
  carrier: string | null; tracking_number: string | null; delivery_address_id: string;
  items: string; tracking_milestones: string;
}
interface SubstituteRow { sku: string; substitute_sku: string; notes: string; }
interface Invoice {
  invoice_id: string; order_id: string; account_id: string; issue_date: string;
  due_date: string; paid_date: string | null; amount: number; vat: number;
  total_inc_vat: number; currency: string; status: string;
}
interface Address {
  address_id: string; account_id: string; label: string; line1: string; line2: string;
  city: string; postcode: string; country: string; contact_name: string;
  contact_phone: string; is_default: number;
}
interface ReorderPattern {
  sku: string; avg_order_qty: number; avg_interval_days: number;
  last_ordered: string; next_predicted: string; times_ordered: number;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }> };

function withLog(db: Database.Database, toolName: string, sessionId: string | undefined, input: unknown, fn: () => unknown) {
  const start = performance.now();
  try {
    const result = fn();
    logToolCall(db, toolName, input, 'success', performance.now() - start, sessionId);
    return result;
  } catch (err) {
    logToolCall(db, toolName, input, `error: ${err}`, performance.now() - start, sessionId);
    throw err;
  }
}

function text(t: string): ToolResult {
  return { content: [{ type: 'text' as const, text: t }] };
}

function applyDiscount(listPrice: number, discountPct: number): number {
  return Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
}

function getContractPrice(db: Database.Database, product: Product): { contractPrice: number; discount: number; tier: string } {
  const contract = db.prepare(
    'SELECT * FROM contract_pricing WHERE account_id = ? AND category = ?'
  ).get(ACCOUNT_ID, product.category) as ContractPrice | undefined;
  const discount = contract?.discount_pct ?? 0;
  const tier = contract?.tier ?? 'Standard';
  return { contractPrice: applyDiscount(product.list_price, discount), discount, tier };
}

function getTotalStock(db: Database.Database, sku: string): number {
  return (db.prepare('SELECT SUM(qty) as total FROM warehouse_stock WHERE sku = ?').get(sku) as { total: number | null }).total ?? 0;
}

function getBaseUrl(): string {
  if (process.env['RAILWAY_PUBLIC_DOMAIN']) {
    return `https://${process.env['RAILWAY_PUBLIC_DOMAIN']}`;
  }
  const port = process.env['PORT'] || '3002';
  return `http://localhost:${port}`;
}

export function registerB2BTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  // ── 1. get_account_summary ────────────────────────────────────
  server.registerTool('get_account_summary', {
    title: 'Get Account Summary',
    description: 'Return the B2B account overview for Hargreaves Engineering Ltd: company name, credit limit, current balance, open orders, payment terms, tier, YTD spend, and sales rep. Includes a link to the live account dashboard.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'get_account_summary', getSessionId(), {}, () => {
      const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as Account | undefined;
      if (!account) return text('Account not found.');

      const available = account.credit_limit - account.balance;
      const addrCount = (db.prepare('SELECT COUNT(*) as c FROM delivery_addresses WHERE account_id = ?').get(ACCOUNT_ID) as { c: number }).c;
      const openInvoices = (db.prepare("SELECT COUNT(*) as c FROM invoices WHERE account_id = ? AND status = 'open'").get(ACCOUNT_ID) as { c: number }).c;

      return text(
        `# Account Summary\n\n` +
        `| Field | Value |\n|---|---|\n` +
        `| **Company** | ${account.name} |\n` +
        `| **Account ID** | ${account.account_id} |\n` +
        `| **Tier** | ${account.tier} |\n` +
        `| **Credit Limit** | £${account.credit_limit.toLocaleString('en-GB')} |\n` +
        `| **Current Balance** | £${account.balance.toLocaleString('en-GB')} |\n` +
        `| **Available Credit** | £${available.toLocaleString('en-GB')} |\n` +
        `| **YTD Spend** | £${account.ytd_spend.toLocaleString('en-GB')} |\n` +
        `| **Open Orders** | ${account.open_orders} |\n` +
        `| **Open Invoices** | ${openInvoices} |\n` +
        `| **Payment Terms** | ${account.payment_terms} |\n` +
        `| **Delivery Addresses** | ${addrCount} on file |\n` +
        `| **Last Order** | ${account.last_order_date} |\n` +
        `| **Sales Rep** | ${account.rep_name} (${account.rep_email}) |\n\n` +
        `[View Account Dashboard](${getBaseUrl()}/dashboard)`
      );
    }) as ToolResult;
  });

  // ── 2. get_order_history ──────────────────────────────────────
  server.registerTool('get_order_history', {
    title: 'Get Order History',
    description: 'Return recent orders for the Hargreaves Engineering account. Each order includes date, status, PO number, carrier, items, and total. Filterable by status.',
    inputSchema: {
      limit: z.number().min(1).max(50).default(5).describe('Number of recent orders to return (default 5)'),
      status: z.string().optional().describe('Filter by order status: delivered, shipped, processing, cancelled'),
    },
  }, async ({ limit, status }) => {
    return withLog(db, 'get_order_history', getSessionId(), { limit, status }, () => {
      let query = 'SELECT * FROM orders WHERE account_id = ?';
      const params: unknown[] = [ACCOUNT_ID];
      if (status) { query += ' AND status = ?'; params.push(status); }
      query += ' ORDER BY order_date DESC LIMIT ?';
      params.push(limit);

      const orders = db.prepare(query).all(...params) as Order[];
      if (orders.length === 0) return text('No orders found for this account.');

      const lines = orders.map(o => {
        const items = JSON.parse(o.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }>;
        const itemList = items.map(i => `  - ${i.qty}× ${i.name} (${i.sku}) @ £${i.unit_price.toFixed(2)}`).join('\n');
        const statusBadge = o.status.charAt(0).toUpperCase() + o.status.slice(1);
        const tracking = o.carrier ? `\n**Carrier:** ${o.carrier} · Tracking: ${o.tracking_number}` : '';

        return `### ${o.order_id} — ${statusBadge}\n` +
          `**PO:** ${o.po_number} · **Date:** ${o.order_date}${o.delivery_date ? ` · Delivered: ${o.delivery_date}` : ''}${tracking}\n` +
          `**Total:** £${o.total.toFixed(2)}\n` +
          `**Items:**\n${itemList}\n` +
          `[Track this order](${getBaseUrl()}/track/${o.order_id})`;
      });

      return text(`# Order History (last ${orders.length})\n\n${lines.join('\n\n---\n\n')}`);
    }) as ToolResult;
  });

  // ── 3. reorder_from_history ───────────────────────────────────
  server.registerTool('reorder_from_history', {
    title: 'Reorder from History',
    description: 'Build a draft reorder from a previous order. Checks current contract pricing and warehouse stock for each line item, and returns a ready-to-confirm reorder summary.',
    inputSchema: {
      order_id: z.string().describe('Previous order ID to reorder from (e.g., "ORD-44109")'),
    },
  }, async ({ order_id }) => {
    return withLog(db, 'reorder_from_history', getSessionId(), { order_id }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND account_id = ?').get(order_id, ACCOUNT_ID) as Order | undefined;
      if (!order) return text(`Order "${order_id}" not found for this account.`);

      const items = JSON.parse(order.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }>;
      let reorderTotal = 0;

      const lines = items.map(item => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(item.sku) as Product | undefined;
        if (!product) return `- ${item.sku} — **DISCONTINUED**`;

        const { contractPrice, discount } = getContractPrice(db, product);
        const totalStock = getTotalStock(db, item.sku);
        const lineTotal = contractPrice * item.qty;
        reorderTotal += lineTotal;

        const stockStatus = totalStock >= item.qty
          ? `${totalStock} in stock`
          : totalStock > 0 ? `Only ${totalStock} available (need ${item.qty})` : 'Out of stock';

        return `- ${item.qty}× **${product.name}** (${item.sku})\n` +
          `  Contract price: £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off £${product.list_price.toFixed(2)})` : ''}\n` +
          `  Line total: £${lineTotal.toFixed(2)} · Stock: ${stockStatus}`;
      });

      return text(
        `# Draft Reorder from ${order_id}\n\nOriginal order date: ${order.order_date}\n\n` +
        `${lines.join('\n\n')}\n\n---\n**Reorder Total: £${reorderTotal.toFixed(2)}**\n\n` +
        `To confirm this reorder, use the **create_quote** tool with the SKUs and quantities above.`
      );
    }) as ToolResult;
  });

  // ── 4. get_contract_pricing ───────────────────────────────────
  server.registerTool('get_contract_pricing', {
    title: 'Get Contract Pricing',
    description: 'Return account-specific contract pricing for one or more SKUs. Shows list price, discount tier, discount percentage, and final contract price.',
    inputSchema: {
      skus: z.array(z.string()).min(1).describe('Array of product SKU codes'),
    },
  }, async ({ skus }) => {
    return withLog(db, 'get_contract_pricing', getSessionId(), { skus }, () => {
      const lines = skus.map(sku => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!product) return `**${sku}** — SKU not found`;

        const { contractPrice, discount, tier } = getContractPrice(db, product);
        return `**${product.name}** (${sku})\n` +
          `  List: £${product.list_price.toFixed(2)} · ${tier}: ${discount > 0 ? `${discount}% off → **£${contractPrice.toFixed(2)}**` : `No discount → £${contractPrice.toFixed(2)}`} per ${product.unit}`;
      });

      return text(`# Contract Pricing — Hargreaves Engineering\n\n${lines.join('\n\n')}`);
    }) as ToolResult;
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

        const rows = db.prepare('SELECT * FROM warehouse_stock WHERE sku = ? ORDER BY warehouse').all(sku) as WarehouseRow[];
        const total = rows.reduce((s, r) => s + r.qty, 0);
        const warehouseLines = rows.map(r => `  - ${r.warehouse}: ${r.qty > 0 ? `${r.qty} units` : '—'}`).join('\n');

        return `**${product.name}** (${sku})\n${warehouseLines}\n  **Total: ${total} units** · Lead time: ${product.lead_time_days} day${product.lead_time_days > 1 ? 's' : ''}`;
      });

      return text(`# Warehouse Stock Levels\n\n${lines.join('\n\n---\n\n')}`);
    }) as ToolResult;
  });

  // ── 6. create_quote ───────────────────────────────────────────
  server.registerTool('create_quote', {
    title: 'Create Quote',
    description: 'Build a draft quote from a list of SKUs and quantities. Applies contract pricing automatically. Optionally specify a delivery address and notes. Returns a quote with a unique reference number and a link to the professional quote document.',
    inputSchema: {
      items: z.array(z.object({
        sku: z.string().describe('Product SKU'),
        quantity: z.number().min(1).describe('Quantity to quote'),
      })).min(1).describe('Array of items to include in the quote'),
      delivery_address_id: z.string().optional().describe('Delivery address ID (e.g., "ADDR-001"). Use get_delivery_addresses to see options.'),
      notes: z.string().optional().describe('Additional notes for the quote'),
    },
  }, async ({ items, delivery_address_id, notes }) => {
    return withLog(db, 'create_quote', getSessionId(), { items, delivery_address_id, notes }, () => {
      let quoteTotal = 0;
      const quoteItems: Array<{ sku: string; name: string; qty: number; list_price: number; contract_price: number; discount_pct: number; line_total: number; unit: string }> = [];

      const lines = items.map(({ sku, quantity }) => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!product) return `- ${sku} × ${quantity} — **SKU not found**`;

        const { contractPrice, discount } = getContractPrice(db, product);
        const lineTotal = contractPrice * quantity;
        quoteTotal += lineTotal;

        quoteItems.push({
          sku, name: product.name, qty: quantity,
          list_price: product.list_price, contract_price: contractPrice,
          discount_pct: discount, line_total: lineTotal, unit: product.unit,
        });

        return `- ${quantity}× **${product.name}** (${sku})\n` +
          `  £${contractPrice.toFixed(2)} per ${product.unit}${discount > 0 ? ` (${discount}% off)` : ''} · Line: £${lineTotal.toFixed(2)}`;
      });

      const quoteId = `QTE-${randomUUID().substring(0, 8).toUpperCase()}`;
      const vat = Math.round(quoteTotal * 0.2 * 100) / 100;

      db.prepare(
        'INSERT INTO quotes (quote_id, account_id, total, items, delivery_address_id, notes, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(quoteId, ACCOUNT_ID, quoteTotal, JSON.stringify(quoteItems), delivery_address_id ?? null, notes ?? null, getSessionId() ?? null);

      let addressLine = '';
      if (delivery_address_id) {
        const addr = db.prepare('SELECT * FROM delivery_addresses WHERE address_id = ?').get(delivery_address_id) as Address | undefined;
        if (addr) addressLine = `**Deliver to:** ${addr.label} — ${addr.line1}, ${addr.city} ${addr.postcode}\n`;
      }

      return text(
        `# Quote ${quoteId}\n\n` +
        `**Account:** Hargreaves Engineering Ltd (${ACCOUNT_ID})\n` +
        `**Status:** Draft\n` +
        `${addressLine}` +
        `${notes ? `**Notes:** ${notes}\n` : ''}\n` +
        `${lines.join('\n\n')}\n\n` +
        `---\n| | |\n|---|---|\n` +
        `| **Subtotal** | £${quoteTotal.toFixed(2)} |\n` +
        `| **VAT (20%)** | £${vat.toFixed(2)} |\n` +
        `| **Total** | **£${(quoteTotal + vat).toFixed(2)}** |\n\n` +
        `This quote is valid for 30 days. Contact your rep James Whitfield to confirm.\n\n` +
        `[View Quote Document](${getBaseUrl()}/quote/${quoteId})`
      );
    }) as ToolResult;
  });

  // ── 7. find_substitute ────────────────────────────────────────
  server.registerTool('find_substitute', {
    title: 'Find Substitute',
    description: 'Return compatible substitute SKUs for a given product. Useful when a part is out of stock. Shows substitute details, stock, and contract pricing.',
    inputSchema: {
      sku: z.string().describe('Product SKU to find substitutes for'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'find_substitute', getSessionId(), { sku }, () => {
      const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
      if (!product) return text(`SKU "${sku}" not found.`);

      const subs = db.prepare('SELECT * FROM substitutes WHERE sku = ?').all(sku) as SubstituteRow[];
      if (subs.length === 0) return text(`No substitutes found for **${product.name}** (${sku}).`);

      const lines = subs.map(sub => {
        const subProduct = db.prepare('SELECT * FROM products WHERE sku = ?').get(sub.substitute_sku) as Product | undefined;
        if (!subProduct) return `- ${sub.substitute_sku} — product data unavailable`;

        const { contractPrice, discount } = getContractPrice(db, subProduct);
        const totalStock = getTotalStock(db, sub.substitute_sku);

        return `### ${subProduct.name} (${sub.substitute_sku})\n` +
          `  Contract price: £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off)` : ''}\n` +
          `  Stock: ${totalStock > 0 ? `${totalStock} units available` : 'Out of stock'}\n` +
          `  Lead time: ${subProduct.lead_time_days} day${subProduct.lead_time_days > 1 ? 's' : ''}\n` +
          `  _${sub.notes}_`;
      });

      return text(`# Substitutes for ${product.name} (${sku})\n\n${lines.join('\n\n')}`);
    }) as ToolResult;
  });

  // ── 8. route_to_rep ───────────────────────────────────────────
  server.registerTool('route_to_rep', {
    title: 'Route to Sales Rep',
    description: 'Flag the current conversation for follow-up by the assigned sales representative. Use when the buyer needs human assistance, custom pricing, or has a complex request.',
    inputSchema: {
      message: z.string().describe('Summary of the request to pass to the sales rep'),
      urgency: z.enum(['low', 'medium', 'high']).default('medium').describe('Urgency level'),
      topic: z.string().optional().describe('Topic category: pricing, delivery, returns, technical, other'),
    },
  }, async ({ message, urgency, topic }) => {
    return withLog(db, 'route_to_rep', getSessionId(), { message, urgency, topic }, () => {
      const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as Account | undefined;
      if (!account) return text('Account not found.');

      const escalationId = `ESC-${randomUUID().substring(0, 8).toUpperCase()}`;
      db.prepare(
        'INSERT INTO rep_escalations (escalation_id, account_id, rep_name, message, urgency, topic, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(escalationId, ACCOUNT_ID, account.rep_name, message, urgency, topic ?? null, getSessionId() ?? null);

      const urgencyMap: Record<string, string> = { low: '8 business hours', medium: '4 business hours', high: '1 business hour' };

      return text(
        `Escalated to your sales rep.\n\n` +
        `**Escalation ID:** ${escalationId}\n` +
        `**Rep:** ${account.rep_name} (${account.rep_email})\n` +
        `**Urgency:** ${urgency.charAt(0).toUpperCase() + urgency.slice(1)}${topic ? ` · **Topic:** ${topic}` : ''}\n` +
        `**Message:** ${message}\n\n` +
        `${account.rep_name} will follow up within ${urgencyMap[urgency]}.`
      );
    }) as ToolResult;
  });

  // ── 9. search_catalog ─────────────────────────────────────────
  server.registerTool('search_catalog', {
    title: 'Search Catalog',
    description: 'Full-text keyword search across the product catalog. Returns matching products with contract pricing, stock status, and links to the product catalog page.',
    inputSchema: {
      query: z.string().describe('Search keywords (e.g., "bearing 6205", "hydraulic filter", "safety gloves")'),
      category: z.string().optional().describe('Filter by category: bearings, seals, belts, fasteners, lubricants, filters, pneumatics, electrical, abrasives, safety'),
      limit: z.number().min(1).max(20).default(10).describe('Max results to return'),
    },
  }, async ({ query, category, limit }) => {
    return withLog(db, 'search_catalog', getSessionId(), { query, category, limit }, () => {
      let sql = 'SELECT * FROM products WHERE 1=1';
      const params: unknown[] = [];

      if (category) { sql += ' AND category = ?'; params.push(category); }
      sql += ' ORDER BY sku';

      const all = db.prepare(sql).all(...params) as Product[];
      const queryLower = query.toLowerCase();
      const terms = queryLower.split(/\s+/);

      const scored = all.map(p => {
        let score = 0;
        const hay = `${p.name} ${p.sku} ${p.brand} ${p.category} ${p.description}`.toLowerCase();
        for (const term of terms) {
          if (hay.includes(term)) score += 1;
          if (p.name.toLowerCase().includes(term)) score += 2;
          if (p.sku.toLowerCase().includes(term)) score += 3;
        }
        return { product: p, score };
      }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

      if (scored.length === 0) return text(`No products found matching "${query}".`);

      const lines = scored.map(({ product: p }) => {
        const { contractPrice, discount } = getContractPrice(db, p);
        const stock = getTotalStock(db, p.sku);
        const stockLabel = stock > 20 ? 'In Stock' : stock > 0 ? `Low Stock (${stock})` : 'Out of Stock';

        return `**${p.name}** (${p.sku})\n` +
          `  ${p.brand} · ${p.category} · £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off £${p.list_price.toFixed(2)})` : ''} per ${p.unit}\n` +
          `  ${stockLabel} · Lead time: ${p.lead_time_days}d · Min order: ${p.min_order_qty}`;
      });

      return text(
        `# Search Results for "${query}" (${scored.length} found)\n\n${lines.join('\n\n---\n\n')}\n\n` +
        `[Browse Full Catalog](${getBaseUrl()}/catalog${category ? `/${category}` : ''})`
      );
    }) as ToolResult;
  });

  // ── 10. browse_categories ─────────────────────────────────────
  server.registerTool('browse_categories', {
    title: 'Browse Categories',
    description: 'List all product categories with SKU counts, or drill into a specific category to see all products with pricing.',
    inputSchema: {
      category: z.string().optional().describe('Category to drill into. Omit to list all categories.'),
    },
  }, async ({ category }) => {
    return withLog(db, 'browse_categories', getSessionId(), { category }, () => {
      if (!category) {
        const cats = db.prepare('SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY category').all() as Array<{ category: string; count: number }>;
        const lines = cats.map(c => `- **${c.category}** — ${c.count} products`);
        return text(
          `# Product Categories\n\n${lines.join('\n')}\n\n` +
          `Use \`browse_categories\` with a category name to see products, or \`search_catalog\` to search.\n\n` +
          `[View Catalog](${getBaseUrl()}/catalog)`
        );
      }

      const products = db.prepare('SELECT * FROM products WHERE category = ? ORDER BY name').all(category) as Product[];
      if (products.length === 0) return text(`No products found in category "${category}".`);

      const lines = products.map(p => {
        const { contractPrice, discount } = getContractPrice(db, p);
        const stock = getTotalStock(db, p.sku);
        return `- **${p.name}** (${p.sku}) — £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off)` : ''} · Stock: ${stock} · ${p.brand}`;
      });

      return text(
        `# ${category.charAt(0).toUpperCase() + category.slice(1)} — ${products.length} products\n\n${lines.join('\n')}\n\n` +
        `[View in Catalog](${getBaseUrl()}/catalog/${category})`
      );
    }) as ToolResult;
  });

  // ── 11. track_order ───────────────────────────────────────────
  server.registerTool('track_order', {
    title: 'Track Order',
    description: 'Get real-time shipment tracking for a specific order. Shows carrier, tracking number, milestone timeline, and delivery ETA. Includes a link to the visual tracking page.',
    inputSchema: {
      order_id: z.string().describe('Order ID to track (e.g., "ORD-44550")'),
    },
  }, async ({ order_id }) => {
    return withLog(db, 'track_order', getSessionId(), { order_id }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND account_id = ?').get(order_id, ACCOUNT_ID) as Order | undefined;
      if (!order) return text(`Order "${order_id}" not found.`);

      const milestones = JSON.parse(order.tracking_milestones) as Array<{ status: string; timestamp: string; note: string }>;
      const addr = order.delivery_address_id ? db.prepare('SELECT * FROM delivery_addresses WHERE address_id = ?').get(order.delivery_address_id) as Address | undefined : undefined;

      const timelineLines = milestones.map((m, i) => {
        const icon = i === milestones.length - 1 ? '>>>' : '---';
        const dt = new Date(m.timestamp);
        return `${icon} **${m.status.replace(/_/g, ' ').toUpperCase()}** — ${dt.toLocaleDateString('en-GB')} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}\n    ${m.note}`;
      });

      return text(
        `# Order Tracking — ${order.order_id}\n\n` +
        `**Status:** ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}\n` +
        `**PO:** ${order.po_number}\n` +
        (order.carrier ? `**Carrier:** ${order.carrier} · **Tracking:** ${order.tracking_number}\n` : '') +
        (addr ? `**Deliver to:** ${addr.label} — ${addr.line1}, ${addr.city} ${addr.postcode}\n` : '') +
        `\n## Timeline\n\n${timelineLines.join('\n\n')}\n\n` +
        `[View Tracking Page](${getBaseUrl()}/track/${order.order_id})`
      );
    }) as ToolResult;
  });

  // ── 12. bulk_reorder ──────────────────────────────────────────
  server.registerTool('bulk_reorder', {
    title: 'Bulk Reorder',
    description: 'Merge line items from multiple previous orders into a single consolidated draft quote. Deduplicates SKUs and sums quantities.',
    inputSchema: {
      order_ids: z.array(z.string()).min(1).max(10).describe('Array of previous order IDs to merge'),
    },
  }, async ({ order_ids }) => {
    return withLog(db, 'bulk_reorder', getSessionId(), { order_ids }, () => {
      const merged = new Map<string, { sku: string; name: string; qty: number }>();
      const foundOrders: string[] = [];

      for (const orderId of order_ids) {
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND account_id = ?').get(orderId, ACCOUNT_ID) as Order | undefined;
        if (!order) continue;
        foundOrders.push(orderId);

        const items = JSON.parse(order.items) as Array<{ sku: string; name: string; qty: number }>;
        for (const item of items) {
          const existing = merged.get(item.sku);
          if (existing) { existing.qty += item.qty; }
          else { merged.set(item.sku, { sku: item.sku, name: item.name, qty: item.qty }); }
        }
      }

      if (merged.size === 0) return text('No valid orders found to merge.');

      let total = 0;
      const lines = Array.from(merged.values()).map(item => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(item.sku) as Product | undefined;
        if (!product) return `- ${item.sku} × ${item.qty} — **DISCONTINUED**`;

        const { contractPrice, discount } = getContractPrice(db, product);
        const lineTotal = contractPrice * item.qty;
        total += lineTotal;
        const stock = getTotalStock(db, item.sku);

        return `- ${item.qty}× **${product.name}** (${item.sku})\n  £${contractPrice.toFixed(2)}${discount > 0 ? ` (${discount}% off)` : ''} · Line: £${lineTotal.toFixed(2)} · Stock: ${stock}`;
      });

      return text(
        `# Bulk Reorder — Merged from ${foundOrders.length} orders\n\n` +
        `Orders merged: ${foundOrders.join(', ')}\n\n` +
        `${lines.join('\n\n')}\n\n---\n**Estimated Total: £${total.toFixed(2)}**\n\n` +
        `To confirm, use **create_quote** with these SKUs and quantities.`
      );
    }) as ToolResult;
  });

  // ── 13. cancel_order ──────────────────────────────────────────
  server.registerTool('cancel_order', {
    title: 'Cancel Order',
    description: 'Cancel an order that is still in "processing" status. Orders that are already shipped or delivered cannot be cancelled.',
    inputSchema: {
      order_id: z.string().describe('Order ID to cancel'),
      reason: z.string().optional().describe('Reason for cancellation'),
    },
  }, async ({ order_id, reason }) => {
    return withLog(db, 'cancel_order', getSessionId(), { order_id, reason }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ? AND account_id = ?').get(order_id, ACCOUNT_ID) as Order | undefined;
      if (!order) return text(`Order "${order_id}" not found.`);

      if (order.status !== 'processing') {
        return text(`Cannot cancel order ${order_id} — current status is **${order.status}**. Only orders in "processing" status can be cancelled.`);
      }

      const milestones = JSON.parse(order.tracking_milestones) as Array<{ status: string; timestamp: string; note: string }>;
      milestones.push({ status: 'cancelled', timestamp: new Date().toISOString(), note: reason || 'Cancelled by customer' });

      db.prepare('UPDATE orders SET status = ?, tracking_milestones = ? WHERE order_id = ?')
        .run('cancelled', JSON.stringify(milestones), order_id);

      return text(
        `Order **${order_id}** has been cancelled.\n\n` +
        `**PO:** ${order.po_number}\n` +
        `**Total:** £${order.total.toFixed(2)}\n` +
        `**Reason:** ${reason || 'Not specified'}\n\n` +
        `The credit hold of £${order.total.toFixed(2)} will be released within 24 hours.`
      );
    }) as ToolResult;
  });

  // ── 14. spend_analytics ───────────────────────────────────────
  server.registerTool('spend_analytics', {
    title: 'Spend Analytics',
    description: 'Get spending breakdown by category, month, and top SKUs. Shows total spend, average order value, and category distribution. Includes a link to the dashboard for visual charts.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'spend_analytics', getSessionId(), {}, () => {
      const orders = db.prepare(
        "SELECT * FROM orders WHERE account_id = ? AND status != 'cancelled'"
      ).all(ACCOUNT_ID) as Order[];

      if (orders.length === 0) return text('No order data available for analytics.');

      let totalSpend = 0;
      const byCategory = new Map<string, number>();
      const byMonth = new Map<string, number>();
      const bySku = new Map<string, { name: string; qty: number; spend: number }>();

      for (const o of orders) {
        totalSpend += o.total;
        const month = o.order_date.substring(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + o.total);

        const items = JSON.parse(o.items) as Array<{ sku: string; name: string; qty: number; unit_price: number }>;
        for (const item of items) {
          const product = db.prepare('SELECT category FROM products WHERE sku = ?').get(item.sku) as { category: string } | undefined;
          if (product) {
            byCategory.set(product.category, (byCategory.get(product.category) ?? 0) + item.qty * item.unit_price);
          }
          const existing = bySku.get(item.sku);
          if (existing) { existing.qty += item.qty; existing.spend += item.qty * item.unit_price; }
          else { bySku.set(item.sku, { name: item.name, qty: item.qty, spend: item.qty * item.unit_price }); }
        }
      }

      const avgOrder = totalSpend / orders.length;

      const catLines = Array.from(byCategory.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat, spend]) => `| ${cat} | £${spend.toFixed(2)} | ${(spend / totalSpend * 100).toFixed(1)}% |`);

      const monthLines = Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, spend]) => `| ${month} | £${spend.toFixed(2)} |`);

      const topSkus = Array.from(bySku.entries())
        .sort((a, b) => b[1].spend - a[1].spend)
        .slice(0, 10)
        .map(([sku, data]) => `| ${sku} | ${data.name} | ${data.qty} | £${data.spend.toFixed(2)} |`);

      return text(
        `# Spend Analytics — Hargreaves Engineering\n\n` +
        `| Metric | Value |\n|---|---|\n` +
        `| **Total Spend** | £${totalSpend.toFixed(2)} |\n` +
        `| **Orders** | ${orders.length} |\n` +
        `| **Avg Order Value** | £${avgOrder.toFixed(2)} |\n\n` +
        `## Spend by Category\n\n| Category | Spend | % |\n|---|---|---|\n${catLines.join('\n')}\n\n` +
        `## Monthly Spend\n\n| Month | Spend |\n|---|---|\n${monthLines.join('\n')}\n\n` +
        `## Top 10 SKUs by Spend\n\n| SKU | Product | Qty Ordered | Total Spend |\n|---|---|---|---|\n${topSkus.join('\n')}\n\n` +
        `[View Dashboard](${getBaseUrl()}/dashboard)`
      );
    }) as ToolResult;
  });

  // ── 15. budget_check ──────────────────────────────────────────
  server.registerTool('budget_check', {
    title: 'Budget Check',
    description: 'Check if a proposed order amount fits within the account credit limit. Shows available credit, current balance, and whether the order can proceed.',
    inputSchema: {
      proposed_amount: z.number().min(0).describe('Proposed order amount in GBP (excl. VAT)'),
    },
  }, async ({ proposed_amount }) => {
    return withLog(db, 'budget_check', getSessionId(), { proposed_amount }, () => {
      const account = db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(ACCOUNT_ID) as Account | undefined;
      if (!account) return text('Account not found.');

      const available = account.credit_limit - account.balance;
      const withVat = Math.round(proposed_amount * 1.2 * 100) / 100;
      const fits = withVat <= available;

      return text(
        `# Budget Check\n\n` +
        `| | |\n|---|---|\n` +
        `| **Proposed Order** | £${proposed_amount.toFixed(2)} (+ £${(withVat - proposed_amount).toFixed(2)} VAT = £${withVat.toFixed(2)}) |\n` +
        `| **Credit Limit** | £${account.credit_limit.toLocaleString('en-GB')} |\n` +
        `| **Current Balance** | £${account.balance.toLocaleString('en-GB')} |\n` +
        `| **Available Credit** | £${available.toLocaleString('en-GB')} |\n` +
        `| **After This Order** | £${(available - withVat).toFixed(2)} remaining |\n` +
        `| **Payment Terms** | ${account.payment_terms} |\n\n` +
        (fits
          ? `**Result: APPROVED** — This order fits within your available credit.`
          : `**Result: EXCEEDS CREDIT** — This order exceeds available credit by £${(withVat - available).toFixed(2)}. Contact your sales rep to discuss a credit limit increase.`)
      );
    }) as ToolResult;
  });

  // ── 16. list_invoices ─────────────────────────────────────────
  server.registerTool('list_invoices', {
    title: 'List Invoices',
    description: 'Show invoices for the account with amounts, due dates, and payment status. Filter by status (open, paid, overdue). Each invoice includes a link to its document.',
    inputSchema: {
      status: z.string().optional().describe('Filter by status: open, paid, overdue. Omit for all.'),
      limit: z.number().min(1).max(50).default(10).describe('Max invoices to return'),
    },
  }, async ({ status, limit }) => {
    return withLog(db, 'list_invoices', getSessionId(), { status, limit }, () => {
      let sql = 'SELECT * FROM invoices WHERE account_id = ?';
      const params: unknown[] = [ACCOUNT_ID];
      if (status) { sql += ' AND status = ?'; params.push(status); }
      sql += ' ORDER BY issue_date DESC LIMIT ?';
      params.push(limit);

      const invoices = db.prepare(sql).all(...params) as Invoice[];
      if (invoices.length === 0) return text('No invoices found.');

      const totalOpen = invoices.filter(i => i.status === 'open').reduce((s, i) => s + i.total_inc_vat, 0);

      const lines = invoices.map(inv => {
        const badge = inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'OVERDUE' : 'Open';
        return `| [${inv.invoice_id}](${getBaseUrl()}/invoice/${inv.invoice_id}) | ${inv.order_id} | ${inv.issue_date} | ${inv.due_date} | £${inv.total_inc_vat.toFixed(2)} | ${badge} |`;
      });

      return text(
        `# Invoices — Hargreaves Engineering\n\n` +
        (totalOpen > 0 ? `**Total Outstanding:** £${totalOpen.toFixed(2)}\n\n` : '') +
        `| Invoice | Order | Issued | Due | Total (inc VAT) | Status |\n|---|---|---|---|---|---|\n${lines.join('\n')}`
      );
    }) as ToolResult;
  });

  // ── 17. get_delivery_addresses ────────────────────────────────
  server.registerTool('get_delivery_addresses', {
    title: 'Get Delivery Addresses',
    description: 'List all saved delivery addresses for the account. Shows address details, contact person, and phone number. Use the address ID when creating quotes.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'get_delivery_addresses', getSessionId(), {}, () => {
      const addresses = db.prepare('SELECT * FROM delivery_addresses WHERE account_id = ? ORDER BY is_default DESC, label').all(ACCOUNT_ID) as Address[];

      if (addresses.length === 0) return text('No delivery addresses on file.');

      const lines = addresses.map(a => {
        const def = a.is_default ? ' **(Default)**' : '';
        return `### ${a.label}${def}\n` +
          `**ID:** \`${a.address_id}\`\n` +
          `${a.line1}\n${a.line2}\n${a.city}, ${a.postcode}\n` +
          `**Contact:** ${a.contact_name} · ${a.contact_phone}`;
      });

      return text(`# Delivery Addresses\n\n${lines.join('\n\n---\n\n')}`);
    }) as ToolResult;
  });

  // ── 18. get_reorder_suggestions ───────────────────────────────
  server.registerTool('get_reorder_suggestions', {
    title: 'Get Reorder Suggestions',
    description: 'AI-powered reorder suggestions based on purchase history. Shows which SKUs are predicted to be due for reorder soon, with recommended quantities and current stock levels.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'get_reorder_suggestions', getSessionId(), {}, () => {
      const patterns = db.prepare('SELECT * FROM reorder_patterns ORDER BY next_predicted ASC').all() as ReorderPattern[];
      const today = new Date().toISOString().split('T')[0];

      const suggestions = patterns.map(p => {
        const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(p.sku) as Product | undefined;
        if (!product) return null;

        const { contractPrice } = getContractPrice(db, product);
        const stock = getTotalStock(db, p.sku);
        const daysUntil = Math.ceil((new Date(p.next_predicted).getTime() - new Date(today!).getTime()) / 86400000);
        const urgency = daysUntil <= 0 ? 'OVERDUE' : daysUntil <= 14 ? 'Due Soon' : 'Upcoming';
        const estTotal = contractPrice * p.avg_order_qty;

        return {
          urgency, daysUntil, product, pattern: p, contractPrice, stock, estTotal,
          line: `| ${urgency} | ${p.sku} | ${product.name} | ${p.avg_order_qty} | £${contractPrice.toFixed(2)} | £${estTotal.toFixed(2)} | ${stock} | ${p.next_predicted} |`,
        };
      }).filter(Boolean) as Array<{ line: string; urgency: string; estTotal: number }>;

      const totalEstimate = suggestions.reduce((s, r) => s + r.estTotal, 0);
      const overdueCount = suggestions.filter(s => s.urgency === 'OVERDUE').length;
      const dueSoonCount = suggestions.filter(s => s.urgency === 'Due Soon').length;

      return text(
        `# Reorder Suggestions\n\n` +
        `**${overdueCount} overdue** · **${dueSoonCount} due soon** · Est. reorder value: £${totalEstimate.toFixed(2)}\n\n` +
        `| Priority | SKU | Product | Suggested Qty | Unit Price | Est. Total | Stock | Predicted Due |\n` +
        `|---|---|---|---|---|---|---|---|\n` +
        `${suggestions.map(s => s.line).join('\n')}\n\n` +
        `Use **bulk_reorder** with past order IDs, or **create_quote** with specific SKUs to act on these suggestions.`
      );
    }) as ToolResult;
  });

  // ── 19. get_backorder_eta ─────────────────────────────────────
  server.registerTool('get_backorder_eta', {
    title: 'Get Backorder ETA',
    description: 'For out-of-stock or low-stock SKUs, check the expected restock date and optionally place a backorder reservation.',
    inputSchema: {
      sku: z.string().describe('Product SKU to check backorder ETA'),
      place_backorder: z.boolean().default(false).describe('Set to true to place a backorder reservation'),
      quantity: z.number().min(1).optional().describe('Quantity to backorder (required if place_backorder is true)'),
    },
  }, async ({ sku, place_backorder, quantity }) => {
    return withLog(db, 'get_backorder_eta', getSessionId(), { sku, place_backorder, quantity }, () => {
      const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
      if (!product) return text(`SKU "${sku}" not found.`);

      const stock = getTotalStock(db, sku);
      const restockDays = product.lead_time_days + 5;
      const restockDate = new Date();
      restockDate.setDate(restockDate.getDate() + restockDays);
      const restockStr = restockDate.toISOString().split('T')[0];

      let result = `# Backorder Information — ${product.name}\n\n` +
        `**SKU:** ${sku}\n` +
        `**Current Stock:** ${stock} units\n` +
        `**Expected Restock:** ${restockStr} (${restockDays} days)\n` +
        `**Lead Time:** ${product.lead_time_days} days from restock\n`;

      if (place_backorder && quantity) {
        const backorderId = `BO-${randomUUID().substring(0, 8).toUpperCase()}`;
        db.prepare(
          'INSERT INTO backorders (backorder_id, account_id, sku, quantity, expected_date, session_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(backorderId, ACCOUNT_ID, sku, quantity, restockStr, getSessionId() ?? null);

        const { contractPrice } = getContractPrice(db, product);

        result += `\n## Backorder Placed\n\n` +
          `**Backorder ID:** ${backorderId}\n` +
          `**Quantity:** ${quantity}\n` +
          `**Est. Total:** £${(contractPrice * quantity).toFixed(2)} (contract price)\n` +
          `**Expected Delivery:** ${restockStr}\n\n` +
          `You will be notified when this item is back in stock and ready to ship.`;
      } else if (stock === 0) {
        result += `\nThis item is currently **out of stock**. Use this tool with \`place_backorder: true\` and a \`quantity\` to reserve stock when it arrives.`;
      }

      return text(result);
    }) as ToolResult;
  });

  // ── 20. compare_products ──────────────────────────────────────
  server.registerTool('compare_products', {
    title: 'Compare Products',
    description: 'Side-by-side comparison of 2-3 products. Shows price, lead time, stock, brand, and specifications to help make informed purchasing decisions.',
    inputSchema: {
      skus: z.array(z.string()).min(2).max(3).describe('Array of 2-3 SKU codes to compare'),
    },
  }, async ({ skus }) => {
    return withLog(db, 'compare_products', getSessionId(), { skus }, () => {
      const products = skus.map(sku => {
        const p = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
        if (!p) return null;
        const { contractPrice, discount } = getContractPrice(db, p);
        const stock = getTotalStock(db, sku);
        const specs = JSON.parse(p.specifications) as Record<string, unknown>;
        return { ...p, contractPrice, discount, stock, specs };
      });

      const valid = products.filter(Boolean) as Array<Product & { contractPrice: number; discount: number; stock: number; specs: Record<string, unknown> }>;
      if (valid.length < 2) return text('Need at least 2 valid SKUs to compare.');

      const header = `| Feature | ${valid.map(p => `**${p.name}** |`).join(' ')}`;
      const sep = `|---|${valid.map(() => '---|').join(' ')}`;

      const rows = [
        `| SKU | ${valid.map(p => `${p.sku} |`).join(' ')}`,
        `| Brand | ${valid.map(p => `${p.brand} |`).join(' ')}`,
        `| List Price | ${valid.map(p => `£${p.list_price.toFixed(2)} |`).join(' ')}`,
        `| Contract Price | ${valid.map(p => `**£${p.contractPrice.toFixed(2)}**${p.discount > 0 ? ` (${p.discount}% off)` : ''} |`).join(' ')}`,
        `| Stock | ${valid.map(p => `${p.stock} units |`).join(' ')}`,
        `| Lead Time | ${valid.map(p => `${p.lead_time_days} day${p.lead_time_days > 1 ? 's' : ''} |`).join(' ')}`,
        `| Min Order | ${valid.map(p => `${p.min_order_qty} |`).join(' ')}`,
        `| Weight | ${valid.map(p => `${p.weight_kg} kg |`).join(' ')}`,
        `| Unit | ${valid.map(p => `${p.unit} |`).join(' ')}`,
      ];

      const allSpecKeys = new Set<string>();
      valid.forEach(p => Object.keys(p.specs).forEach(k => allSpecKeys.add(k)));

      const specRows = Array.from(allSpecKeys).map(key =>
        `| ${key.replace(/_/g, ' ')} | ${valid.map(p => `${p.specs[key] ?? '—'} |`).join(' ')}`
      );

      return text(
        `# Product Comparison\n\n${header}\n${sep}\n${rows.join('\n')}\n\n` +
        (specRows.length > 0 ? `## Specifications\n\n${header}\n${sep}\n${specRows.join('\n')}\n\n` : '') +
        `[View in Catalog](${getBaseUrl()}/catalog)`
      );
    }) as ToolResult;
  });
}
