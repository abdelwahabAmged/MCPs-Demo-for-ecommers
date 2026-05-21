import { McpServer, logToolCall } from '@mcp-demos/shared';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

interface Product {
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  color: string;
  size: number | null;
  stock_qty: number;
  stock_status: string;
  delivery_estimate: string;
  image_url: string;
  tags: string;
}

interface Order {
  order_id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  delivery_estimate: string;
  order_date: string;
  items: string;
  total: number;
  currency: string;
  eligible_for_return: number;
  return_deadline: string | null;
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

export function registerB2CTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
): void {

  server.registerTool('search_products', {
    title: 'Search Products',
    description: 'Search the Acme Sports catalog by natural language query. Returns matching products with name, price, stock status, image, and delivery estimate. Use for queries like "trail running shoes under €200" or "waterproof jacket".',
    inputSchema: {
      query: z.string().describe('Natural language search query (e.g., "trail running shoes, waterproof, under €200")'),
      max_price: z.number().optional().describe('Maximum price filter in EUR'),
      size: z.number().optional().describe('EU shoe size filter (38–47)'),
    },
  }, async ({ query, max_price, size }) => {
    return withLog(db, 'search_products', getSessionId(), { query, max_price, size }, () => {
      const keywords = query.toLowerCase().split(/[\s,]+/).filter(Boolean);

      let sql = 'SELECT * FROM products WHERE 1=1';
      const params: unknown[] = [];

      if (max_price) {
        sql += ' AND price <= ?';
        params.push(max_price);
      }
      if (size) {
        sql += ' AND (size = ? OR size IS NULL)';
        params.push(size);
      }

      const allProducts = db.prepare(sql).all(...params) as Product[];

      const scored = allProducts.map(p => {
        const searchText = `${p.name} ${p.category} ${p.description} ${p.tags} ${p.color}`.toLowerCase();
        const score = keywords.reduce((s: number, kw: string) => s + (searchText.includes(kw) ? 1 : 0), 0);
        return { product: p, score };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

      if (scored.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No products found matching your search. Try different keywords or browse our categories: Trail running, Road running, Hiking, Cycling, Gym.' }] };
      }

      const results = scored.map(({ product: p }) =>
        `**${p.name}** (${p.color}, ${p.size ? `Size ${p.size}` : 'One size'})\n` +
        `SKU: ${p.sku} | €${p.price.toFixed(2)} | ${p.stock_status === 'in_stock' ? '✓ In stock' : p.stock_status === 'low_stock' ? `⚠ Low stock (${p.stock_qty} left)` : '✗ Out of stock'}\n` +
        `Delivery: ${p.delivery_estimate}\n` +
        `${p.image_url}`
      ).join('\n\n---\n\n');

      return { content: [{ type: 'text' as const, text: results }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('get_product_detail', {
    title: 'Get Product Detail',
    description: 'Return full product information including description, specs, all available variants (sizes and colours), stock levels per variant, and delivery estimates. Use when a user asks about a specific product by name.',
    inputSchema: {
      product_name: z.string().describe('Product name or partial name (e.g., "Apex Trail Runner X2")'),
    },
  }, async ({ product_name }) => {
    return withLog(db, 'get_product_detail', getSessionId(), { product_name }, () => {
      const searchName = product_name.toLowerCase();
      const variants = db.prepare(
        'SELECT * FROM products WHERE LOWER(name) LIKE ?'
      ).all(`%${searchName}%`) as Product[];

      if (variants.length === 0) {
        return { content: [{ type: 'text' as const, text: `No product found matching "${product_name}". Try searching with different keywords.` }] };
      }

      const first = variants[0]!;
      const variantList = variants.map(v =>
        `  • ${v.color}${v.size ? `, Size ${v.size}` : ''} — SKU: ${v.sku} — €${v.price.toFixed(2)} — ${v.stock_status === 'in_stock' ? `✓ In stock (${v.stock_qty})` : v.stock_status === 'low_stock' ? `⚠ Low stock (${v.stock_qty} left)` : '✗ Out of stock'} — ${v.delivery_estimate}`
      ).join('\n');

      const text =
        `# ${first.name}\n\n` +
        `**Category:** ${first.category}\n` +
        `**Description:** ${first.description}\n` +
        `**Price:** €${first.price.toFixed(2)}\n` +
        `**Image:** ${first.image_url}\n\n` +
        `## Available Variants\n${variantList}`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('check_stock', {
    title: 'Check Stock',
    description: 'Check real-time availability of a specific product SKU or variant. Returns stock quantity, status, and delivery estimate.',
    inputSchema: {
      sku: z.string().describe('Product SKU code (e.g., "APX-TRL-X2-BLK-10")'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'check_stock', getSessionId(), { sku }, () => {
      const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;

      if (!product) {
        return { content: [{ type: 'text' as const, text: `SKU "${sku}" not found. Please check the SKU and try again.` }] };
      }

      const statusText = product.stock_status === 'in_stock'
        ? `✓ In stock (${product.stock_qty} available)`
        : product.stock_status === 'low_stock'
          ? `⚠ Low stock — only ${product.stock_qty} left`
          : '✗ Out of stock';

      return {
        content: [{
          type: 'text' as const,
          text: `**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ''})\nSKU: ${product.sku}\nStock: ${statusText}\nDelivery: ${product.delivery_estimate}`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('get_order_status', {
    title: 'Get Order Status',
    description: 'Look up the current status of an order by order number. Returns order state, tracking information, and delivery estimate. No login required for demo.',
    inputSchema: {
      order_id: z.string().describe('Order number (e.g., "ACM-2024-08812")'),
    },
  }, async ({ order_id }) => {
    return withLog(db, 'get_order_status', getSessionId(), { order_id }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(order_id) as Order | undefined;

      if (!order) {
        return { content: [{ type: 'text' as const, text: `Order "${order_id}" not found. Please check your order number and try again. Order numbers look like ACM-2024-XXXXX.` }] };
      }

      const items = JSON.parse(order.items) as Array<{ name: string; color: string; size?: number; quantity: number; price: number }>;
      const itemList = items.map(i =>
        `  • ${i.name} (${i.color}${i.size ? `, Size ${i.size}` : ''}) × ${i.quantity} — €${i.price.toFixed(2)}`
      ).join('\n');

      let statusLine = `**Status:** ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`;
      if (order.carrier) statusLine += ` · ${order.carrier}`;
      if (order.tracking_number) statusLine += ` · Tracking: ${order.tracking_number}`;

      return {
        content: [{
          type: 'text' as const,
          text: `# Order ${order.order_id}\n\n${statusLine}\n**Delivery:** ${order.delivery_estimate}\n**Order Date:** ${order.order_date}\n**Total:** €${order.total.toFixed(2)}\n\n**Items:**\n${itemList}`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('start_return', {
    title: 'Start Return',
    description: 'Initiate a return request for an item from a delivered order. Checks that the order is delivered and within the 30-day return window.',
    inputSchema: {
      order_id: z.string().describe('Order number to return from (e.g., "ACM-2024-07543")'),
      item_description: z.string().describe('Description of the item to return (e.g., "the jacket" or "TrailShield Waterproof Jacket")'),
    },
  }, async ({ order_id, item_description }) => {
    return withLog(db, 'start_return', getSessionId(), { order_id, item_description }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(order_id) as Order | undefined;

      if (!order) {
        return { content: [{ type: 'text' as const, text: `Order "${order_id}" not found.` }] };
      }

      if (order.status !== 'delivered') {
        return { content: [{ type: 'text' as const, text: `Order ${order_id} is currently "${order.status}" and cannot be returned yet. Only delivered orders are eligible for return.` }] };
      }

      if (!order.eligible_for_return) {
        return { content: [{ type: 'text' as const, text: `Order ${order_id} is no longer eligible for return. The 30-day return window has closed.` }] };
      }

      const returnId = `RET-${randomUUID().substring(0, 8).toUpperCase()}`;
      db.prepare(
        'INSERT INTO returns (return_id, order_id, item_description, session_id) VALUES (?, ?, ?, ?)'
      ).run(returnId, order_id, item_description, getSessionId() ?? null);

      return {
        content: [{
          type: 'text' as const,
          text: `✓ Return request created!\n\n**Return ID:** ${returnId}\n**Order:** ${order_id}\n**Item:** ${item_description}\n**Status:** Pending\n\nYou will receive a return shipping label via email within 24 hours. Please pack the item securely and drop it at any DHL service point. Refund will be processed within 5–7 business days after we receive the item.`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('get_recommendations', {
    title: 'Get Recommendations',
    description: 'Return 3–5 recommended products based on a described use case (e.g., "half-marathon training") or a product the user is viewing. Suggests complementary gear.',
    inputSchema: {
      context: z.string().describe('Describe what you need recommendations for (e.g., "trail running in wet weather" or "goes well with hiking boots")'),
    },
  }, async ({ context }) => {
    return withLog(db, 'get_recommendations', getSessionId(), { context }, () => {
      const keywords = context.toLowerCase().split(/[\s,]+/).filter(Boolean);
      const allProducts = db.prepare('SELECT * FROM products').all() as Product[];

      const uniqueProducts = new Map<string, { product: Product; score: number }>();
      for (const p of allProducts) {
        const searchText = `${p.name} ${p.category} ${p.description} ${p.tags}`.toLowerCase();
        const score = keywords.reduce((s: number, kw: string) => s + (searchText.includes(kw) ? 1 : 0), 0);
        if (score > 0) {
          const existing = uniqueProducts.get(p.name);
          if (!existing || score > existing.score) {
            uniqueProducts.set(p.name, { product: p, score });
          }
        }
      }

      const sorted = Array.from(uniqueProducts.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (sorted.length === 0) {
        return { content: [{ type: 'text' as const, text: 'I couldn\'t find specific recommendations for that. Try describing the activity or terrain you\'re planning for, and I\'ll suggest suitable gear.' }] };
      }

      const text = `Here are my recommendations based on "${context}":\n\n` +
        sorted.map(({ product: p }, i) =>
          `${i + 1}. **${p.name}** — €${p.price.toFixed(2)}\n   ${p.description.substring(0, 100)}...\n   ${p.stock_status === 'in_stock' ? '✓ In stock' : p.stock_status === 'low_stock' ? '⚠ Low stock' : '✗ Out of stock'}`
        ).join('\n\n');

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('add_to_cart', {
    title: 'Add to Cart',
    description: 'Generate a pre-filled cart URL with the selected product SKU and quantity. Returns a link the customer can click to proceed to checkout.',
    inputSchema: {
      sku: z.string().describe('Product SKU to add (e.g., "APX-TRL-X2-BLK-10")'),
      quantity: z.number().min(1).default(1).describe('Number of items to add'),
    },
  }, async ({ sku, quantity }) => {
    return withLog(db, 'add_to_cart', getSessionId(), { sku, quantity }, () => {
      const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;

      if (!product) {
        return { content: [{ type: 'text' as const, text: `SKU "${sku}" not found. Please check the SKU and try again.` }] };
      }

      if (product.stock_status === 'out_of_stock') {
        return { content: [{ type: 'text' as const, text: `Sorry, ${product.name} (${product.sku}) is currently out of stock. ${product.delivery_estimate}.` }] };
      }

      const cartUrl = `https://demo.acmesports.com/cart?sku=${encodeURIComponent(sku)}&qty=${quantity}`;

      return {
        content: [{
          type: 'text' as const,
          text: `✓ Added to cart!\n\n**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ''})\nQuantity: ${quantity}\nUnit Price: €${product.price.toFixed(2)}\nSubtotal: €${(product.price * quantity).toFixed(2)}\n\n🛒 [Open Cart](${cartUrl})`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
