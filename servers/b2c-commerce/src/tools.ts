import { McpServer, logToolCall } from "@mcp-demos/shared";
import { z } from "zod";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

const BASE_URL =
  process.env["RAILWAY_PUBLIC_DOMAIN"]
    ? `https://${process.env["RAILWAY_PUBLIC_DOMAIN"]}`
    : process.env["BASE_URL"] ||
      `http://localhost:${process.env["PORT"] || "3001"}`;

interface Product {
  sku: string;
  name: string;
  brand: string;
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
  rating: number;
  review_count: number;
  weight_grams: number | null;
  material: string | null;
}

interface Review {
  review_id: string;
  sku: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  verified_purchase: number;
}

interface SupportTicket {
  ticket_id: string;
  order_id: string;
  issue_type: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolution: string | null;
  session_id: string | null;
}

interface WishlistItem {
  id: string;
  session_id: string;
  sku: string;
  added_at: string;
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

function withLog(
  db: Database.Database,
  toolName: string,
  sessionId: string | undefined,
  input: unknown,
  fn: () => unknown,
) {
  const start = performance.now();
  try {
    const result = fn();
    const latency = performance.now() - start;
    logToolCall(db, toolName, input, "success", latency, sessionId);
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
  server.registerTool(
    "search_products",
    {
      title: "Search Products",
      description:
        'Search the Acme Sports catalog by natural language query. Returns matching products with name, price, stock status, image, and delivery estimate. Use for queries like "trail running shoes under €200" or "waterproof jacket".',
      inputSchema: {
        query: z
          .string()
          .describe(
            'Natural language search query (e.g., "trail running shoes, waterproof, under €200")',
          ),
        max_price: z
          .number()
          .optional()
          .describe("Maximum price filter in EUR"),
        size: z.number().optional().describe("EU shoe size filter (38–47)"),
      },
    },
    async ({ query, max_price, size }) => {
      return withLog(
        db,
        "search_products",
        getSessionId(),
        { query, max_price, size },
        () => {
          const keywords = query
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(Boolean);

          let sql = "SELECT * FROM products WHERE 1=1";
          const params: unknown[] = [];

          if (max_price) {
            sql += " AND price <= ?";
            params.push(max_price);
          }
          if (size) {
            sql += " AND (size = ? OR size IS NULL)";
            params.push(size);
          }

          const allProducts = db.prepare(sql).all(...params) as Product[];

          const scored = allProducts
            .map((p) => {
              const searchText =
                `${p.name} ${p.category} ${p.description} ${p.tags} ${p.color}`.toLowerCase();
              const score = keywords.reduce(
                (s: number, kw: string) =>
                  s + (searchText.includes(kw) ? 1 : 0),
                0,
              );
              return { product: p, score };
            })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          if (scored.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No products found matching your search. Try different keywords or browse our categories: Trail running, Road running, Hiking, Cycling, Gym.",
                },
              ],
            };
          }

          const results = scored
            .map(
              ({ product: p }) =>
                `**${p.name}** (${p.color}, ${p.size ? `Size ${p.size}` : "One size"})\n` +
                `SKU: ${p.sku} | €${p.price.toFixed(2)} | ${p.stock_status === "in_stock" ? "✓ In stock" : p.stock_status === "low_stock" ? `⚠ Low stock (${p.stock_qty} left)` : "✗ Out of stock"}\n` +
                `Delivery: ${p.delivery_estimate}\n` +
                `${p.image_url}`,
            )
            .join("\n\n---\n\n");

          return { content: [{ type: "text" as const, text: results }] };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool(
    "get_product_detail",
    {
      title: "Get Product Detail",
      description:
        "Return full product information including description, specs, all available variants (sizes and colours), stock levels per variant, and delivery estimates. Use when a user asks about a specific product by name.",
      inputSchema: {
        product_name: z
          .string()
          .describe(
            'Product name or partial name (e.g., "Apex Trail Runner X2")',
          ),
      },
    },
    async ({ product_name }) => {
      return withLog(
        db,
        "get_product_detail",
        getSessionId(),
        { product_name },
        () => {
          const searchName = product_name.toLowerCase();
          const variants = db
            .prepare("SELECT * FROM products WHERE LOWER(name) LIKE ?")
            .all(`%${searchName}%`) as Product[];

          if (variants.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No product found matching "${product_name}". Try searching with different keywords.`,
                },
              ],
            };
          }

          const first = variants[0]!;
          const variantList = variants
            .map(
              (v) =>
                `  • ${v.color}${v.size ? `, Size ${v.size}` : ""} — SKU: ${v.sku} — €${v.price.toFixed(2)} — ${v.stock_status === "in_stock" ? `✓ In stock (${v.stock_qty})` : v.stock_status === "low_stock" ? `⚠ Low stock (${v.stock_qty} left)` : "✗ Out of stock"} — ${v.delivery_estimate}`,
            )
            .join("\n");

          const text =
            `# ${first.name}\n\n` +
            `**Category:** ${first.category}\n` +
            `**Description:** ${first.description}\n` +
            `**Price:** €${first.price.toFixed(2)}\n` +
            `**Image:** ${first.image_url}\n\n` +
            `## Available Variants\n${variantList}`;

          return { content: [{ type: "text" as const, text }] };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool(
    "check_stock",
    {
      title: "Check Stock",
      description:
        "Check real-time availability of a specific product SKU or variant. Returns stock quantity, status, and delivery estimate.",
      inputSchema: {
        sku: z
          .string()
          .describe('Product SKU code (e.g., "APX-TRL-X2-BLK-10")'),
      },
    },
    async ({ sku }) => {
      return withLog(db, "check_stock", getSessionId(), { sku }, () => {
        const product = db
          .prepare("SELECT * FROM products WHERE sku = ?")
          .get(sku) as Product | undefined;

        if (!product) {
          return {
            content: [
              {
                type: "text" as const,
                text: `SKU "${sku}" not found. Please check the SKU and try again.`,
              },
            ],
          };
        }

        const statusText =
          product.stock_status === "in_stock"
            ? `✓ In stock (${product.stock_qty} available)`
            : product.stock_status === "low_stock"
              ? `⚠ Low stock — only ${product.stock_qty} left`
              : "✗ Out of stock";

        return {
          content: [
            {
              type: "text" as const,
              text: `**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ""})\nSKU: ${product.sku}\nStock: ${statusText}\nDelivery: ${product.delivery_estimate}`,
            },
          ],
        };
      }) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool(
    "get_order_status",
    {
      title: "Get Order Status",
      description:
        "Look up the current status of an order by order number. Returns order state, tracking information, and delivery estimate. No login required for demo.",
      inputSchema: {
        order_id: z.string().describe('Order number (e.g., "ACM-2024-08812")'),
      },
    },
    async ({ order_id }) => {
      return withLog(
        db,
        "get_order_status",
        getSessionId(),
        { order_id },
        () => {
          const order = db
            .prepare("SELECT * FROM orders WHERE order_id = ?")
            .get(order_id) as Order | undefined;

          if (!order) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order "${order_id}" not found. Please check your order number and try again. Order numbers look like ACM-2024-XXXXX.`,
                },
              ],
            };
          }

          const items = JSON.parse(order.items) as Array<{
            name: string;
            color: string;
            size?: number;
            quantity: number;
            price: number;
          }>;
          const itemList = items
            .map(
              (i) =>
                `  • ${i.name} (${i.color}${i.size ? `, Size ${i.size}` : ""}) × ${i.quantity} — €${i.price.toFixed(2)}`,
            )
            .join("\n");

          let statusLine = `**Status:** ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`;
          if (order.carrier) statusLine += ` · ${order.carrier}`;
          if (order.tracking_number)
            statusLine += ` · Tracking: ${order.tracking_number}`;

          return {
            content: [
              {
                type: "text" as const,
                text: `# Order ${order.order_id}\n\n${statusLine}\n**Delivery:** ${order.delivery_estimate}\n**Order Date:** ${order.order_date}\n**Total:** €${order.total.toFixed(2)}\n\n**Items:**\n${itemList}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool(
    "start_return",
    {
      title: "Start Return",
      description:
        "Initiate a return request for an item from a delivered order. Checks that the order is delivered and within the 30-day return window.",
      inputSchema: {
        order_id: z
          .string()
          .describe('Order number to return from (e.g., "ACM-2024-07543")'),
        item_description: z
          .string()
          .describe(
            'Description of the item to return (e.g., "the jacket" or "TrailShield Waterproof Jacket")',
          ),
      },
    },
    async ({ order_id, item_description }) => {
      return withLog(
        db,
        "start_return",
        getSessionId(),
        { order_id, item_description },
        () => {
          const order = db
            .prepare("SELECT * FROM orders WHERE order_id = ?")
            .get(order_id) as Order | undefined;

          if (!order) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order "${order_id}" not found.`,
                },
              ],
            };
          }

          if (order.status !== "delivered") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order ${order_id} is currently "${order.status}" and cannot be returned yet. Only delivered orders are eligible for return.`,
                },
              ],
            };
          }

          if (!order.eligible_for_return) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order ${order_id} is no longer eligible for return. The 30-day return window has closed.`,
                },
              ],
            };
          }

          const returnId = `RET-${randomUUID().substring(0, 8).toUpperCase()}`;
          db.prepare(
            "INSERT INTO returns (return_id, order_id, item_description, session_id) VALUES (?, ?, ?, ?)",
          ).run(returnId, order_id, item_description, getSessionId() ?? null);

          return {
            content: [
              {
                type: "text" as const,
                text: `✓ Return request created!\n\n**Return ID:** ${returnId}\n**Order:** ${order_id}\n**Item:** ${item_description}\n**Status:** Pending\n\nYou will receive a return shipping label via email within 24 hours. Please pack the item securely and drop it at any DHL service point. Refund will be processed within 5–7 business days after we receive the item.`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool(
    "get_recommendations",
    {
      title: "Get Recommendations",
      description:
        'Return 3–5 recommended products based on a described use case (e.g., "half-marathon training") or a product the user is viewing. Suggests complementary gear.',
      inputSchema: {
        context: z
          .string()
          .describe(
            'Describe what you need recommendations for (e.g., "trail running in wet weather" or "goes well with hiking boots")',
          ),
      },
    },
    async ({ context }) => {
      return withLog(
        db,
        "get_recommendations",
        getSessionId(),
        { context },
        () => {
          const keywords = context
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(Boolean);
          const allProducts = db
            .prepare("SELECT * FROM products")
            .all() as Product[];

          const uniqueProducts = new Map<
            string,
            { product: Product; score: number }
          >();
          for (const p of allProducts) {
            const searchText =
              `${p.name} ${p.category} ${p.description} ${p.tags}`.toLowerCase();
            const score = keywords.reduce(
              (s: number, kw: string) => s + (searchText.includes(kw) ? 1 : 0),
              0,
            );
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
            return {
              content: [
                {
                  type: "text" as const,
                  text: "I couldn't find specific recommendations for that. Try describing the activity or terrain you're planning for, and I'll suggest suitable gear.",
                },
              ],
            };
          }

          const text =
            `Here are my recommendations based on "${context}":\n\n` +
            sorted
              .map(
                ({ product: p }, i) =>
                  `${i + 1}. **${p.name}** — €${p.price.toFixed(2)}\n   ${p.description.substring(0, 100)}...\n   ${p.stock_status === "in_stock" ? "✓ In stock" : p.stock_status === "low_stock" ? "⚠ Low stock" : "✗ Out of stock"}`,
              )
              .join("\n\n");

          return { content: [{ type: "text" as const, text }] };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool(
    "add_to_cart",
    {
      title: "Add to Cart",
      description:
        "Add a product to the shopping cart by SKU and quantity. Returns a link the customer can click to view their cart and proceed to checkout.",
      inputSchema: {
        sku: z
          .string()
          .describe('Product SKU to add (e.g., "APX-TRL-X2-BLK-10")'),
        quantity: z
          .number()
          .min(1)
          .default(1)
          .describe("Number of items to add"),
      },
    },
    async ({ sku, quantity }) => {
      return withLog(
        db,
        "add_to_cart",
        getSessionId(),
        { sku, quantity },
        () => {
          const product = db
            .prepare("SELECT * FROM products WHERE sku = ?")
            .get(sku) as Product | undefined;

          if (!product) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `SKU "${sku}" not found. Please check the SKU and try again.`,
                },
              ],
            };
          }

          if (product.stock_status === "out_of_stock") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Sorry, ${product.name} (${product.sku}) is currently out of stock. ${product.delivery_estimate}.`,
                },
              ],
            };
          }

          const sessionId = getSessionId();
          const cartId = sessionId || randomUUID();

          const existing = db
            .prepare("SELECT * FROM cart_items WHERE cart_id = ? AND sku = ?")
            .get(cartId, sku) as { id: string; quantity: number } | undefined;

          if (existing) {
            db.prepare(
              "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
            ).run(quantity, existing.id);
          } else {
            db.prepare(
              "INSERT INTO cart_items (id, cart_id, sku, name, color, size, quantity, unit_price, currency, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ).run(
              randomUUID(),
              cartId,
              product.sku,
              product.name,
              product.color,
              product.size,
              quantity,
              product.price,
              product.currency,
              product.image_url,
            );
          }

          const cartItems = db
            .prepare("SELECT * FROM cart_items WHERE cart_id = ?")
            .all(cartId) as Array<{
            name: string;
            sku: string;
            quantity: number;
            unit_price: number;
          }>;
          const totalItems = cartItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
          );
          const totalPrice = cartItems.reduce(
            (sum, item) => sum + item.unit_price * item.quantity,
            0,
          );

          const cartUrl = `${BASE_URL}/cart/${cartId}`;

          return {
            content: [
              {
                type: "text" as const,
                text: `✓ Added to cart!\n\n**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ""})\nQuantity: ${quantity}\nUnit Price: €${product.price.toFixed(2)}\nSubtotal: €${(product.price * quantity).toFixed(2)}\n\n🛒 Cart: ${totalItems} item(s) — €${totalPrice.toFixed(2)} total\n\nView your cart: ${cartUrl}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  server.registerTool('remove_from_cart', {
    title: 'Remove from Cart',
    description: 'Remove a product from the shopping cart by SKU, or clear the entire cart.',
    inputSchema: {
      sku: z.string().optional().describe('Product SKU to remove. Omit to clear the entire cart.'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'remove_from_cart', getSessionId(), { sku }, () => {
      const sessionId = getSessionId();
      if (!sessionId) {
        return { content: [{ type: 'text' as const, text: 'No active cart session found.' }] };
      }
      const cartId = sessionId;

      if (sku) {
        const item = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND sku = ?').get(cartId, sku) as { id: string; name: string } | undefined;
        if (!item) {
          return { content: [{ type: 'text' as const, text: `SKU "${sku}" is not in your cart.` }] };
        }
        db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
      } else {
        db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
      }

      const cartItems = db.prepare('SELECT * FROM cart_items WHERE cart_id = ?').all(cartId) as Array<{ name: string; sku: string; quantity: number; unit_price: number }>;
      const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const cartUrl = `${BASE_URL}/cart/${cartId}`;

      if (totalItems === 0) {
        return { content: [{ type: 'text' as const, text: sku ? `✓ Removed from cart.\n\nYour cart is now empty.` : `✓ Cart cleared.\n\nYour cart is now empty.` }] };
      }

      const itemList = cartItems.map(i => `  • ${i.name} × ${i.quantity} — €${(i.unit_price * i.quantity).toFixed(2)}`).join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: `✓ ${sku ? 'Item removed' : 'Cart cleared'}!\n\n🛒 Cart: ${totalItems} item(s) — €${totalPrice.toFixed(2)} total\n\n${itemList}\n\nView your cart: ${cartUrl}`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  server.registerTool('view_cart', {
    title: 'View Cart',
    description: 'Show the current contents of the shopping cart with a link to view it in the browser.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'view_cart', getSessionId(), {}, () => {
      const sessionId = getSessionId();
      if (!sessionId) {
        return { content: [{ type: 'text' as const, text: 'No active cart session found.' }] };
      }
      const cartId = sessionId;
      const cartItems = db.prepare('SELECT * FROM cart_items WHERE cart_id = ?').all(cartId) as Array<{ name: string; sku: string; quantity: number; unit_price: number; color: string; size: number | null }>;

      if (cartItems.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Your cart is empty. Ask me to search for products and add them!' }] };
      }

      const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const cartUrl = `${BASE_URL}/cart/${cartId}`;

      const itemList = cartItems.map(i =>
        `  • **${i.name}** (${i.color}${i.size ? `, Size ${i.size}` : ''}) × ${i.quantity} — €${(i.unit_price * i.quantity).toFixed(2)}`
      ).join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: `🛒 **Your Cart** — ${totalItems} item${totalItems !== 1 ? 's' : ''}\n\n${itemList}\n\n**Total: €${totalPrice.toFixed(2)}**\n\nView your cart: ${cartUrl}`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- list_orders ---
  server.registerTool('list_orders', {
    title: 'List Orders',
    description: 'List all orders with optional filters for status and date range. Returns a summary list of orders. Use for "show me my orders", "show cancelled orders", or "orders from March".',
    inputSchema: {
      status: z.enum(['delivered', 'shipped', 'processing', 'cancelled', 'returned']).optional().describe('Filter by order status'),
      date_from: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
    },
  }, async ({ status, date_from, date_to }) => {
    return withLog(db, 'list_orders', getSessionId(), { status, date_from, date_to }, () => {
      let sql = 'SELECT * FROM orders WHERE 1=1';
      const params: unknown[] = [];

      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (date_from) { sql += ' AND order_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND order_date <= ?'; params.push(date_to); }
      sql += ' ORDER BY order_date DESC';

      const orders = db.prepare(sql).all(...params) as Order[];

      if (orders.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No orders found matching your filters.' }] };
      }

      const lines = orders.map(o => {
        const items = JSON.parse(o.items) as Array<{ name: string }>;
        const itemNames = items.map(i => i.name).join(', ');
        const statusIcon = o.status === 'delivered' ? '✓' : o.status === 'shipped' ? '🚚' : o.status === 'processing' ? '⏳' : o.status === 'cancelled' ? '✗' : '↩';
        return `${statusIcon} **${o.order_id}** — ${o.order_date} — €${o.total.toFixed(2)} — ${o.status}\n   ${itemNames}`;
      });

      return { content: [{ type: 'text' as const, text: `**Your Orders** (${orders.length})\n\n${lines.join('\n\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- get_order_items (raw data for LLM analysis) ---
  server.registerTool('get_order_items', {
    title: 'Get Order Items',
    description: 'Return a flat list of every item from every order with full detail (order_id, date, status, SKU, name, category, quantity, price, line total). Returns raw data so you can compute any analytics: spending trends, category breakdowns, monthly totals, etc.',
    inputSchema: {
      status: z.enum(['delivered', 'shipped', 'processing', 'cancelled', 'returned']).optional().describe('Filter by order status'),
      date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      category: z.string().optional().describe('Filter by product category (e.g., "Hiking", "Cycling")'),
    },
  }, async ({ status, date_from, date_to, category }) => {
    return withLog(db, 'get_order_items', getSessionId(), { status, date_from, date_to, category }, () => {
      let sql = 'SELECT * FROM orders WHERE 1=1';
      const params: unknown[] = [];

      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (date_from) { sql += ' AND order_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND order_date <= ?'; params.push(date_to); }
      sql += ' ORDER BY order_date DESC';

      const orders = db.prepare(sql).all(...params) as Order[];

      const rows: Array<Record<string, unknown>> = [];
      for (const o of orders) {
        const items = JSON.parse(o.items) as Array<{ sku: string; name: string; category?: string; quantity: number; price: number; color?: string; size?: number }>;
        for (const item of items) {
          if (category && item.category && item.category.toLowerCase() !== category.toLowerCase()) continue;
          rows.push({
            order_id: o.order_id,
            order_date: o.order_date,
            status: o.status,
            sku: item.sku,
            name: item.name,
            category: item.category || 'Unknown',
            color: item.color || null,
            size: item.size || null,
            quantity: item.quantity,
            unit_price: item.price,
            line_total: item.price * item.quantity,
          });
        }
      }

      if (rows.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No order items found matching your filters.' }] };
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- order_analytics (pre-computed summary) ---
  server.registerTool('order_analytics', {
    title: 'Order Analytics',
    description: 'Get a pre-computed analytics summary: total spent, order count, average order value, spending by month, and top categories. Use for quick overview questions like "how much did I spend?" or "give me a summary of my orders".',
    inputSchema: {
      date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
  }, async ({ date_from, date_to }) => {
    return withLog(db, 'order_analytics', getSessionId(), { date_from, date_to }, () => {
      let sql = "SELECT * FROM orders WHERE status NOT IN ('cancelled')";
      const params: unknown[] = [];
      if (date_from) { sql += ' AND order_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND order_date <= ?'; params.push(date_to); }

      const orders = db.prepare(sql).all(...params) as Order[];

      if (orders.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No orders found in the specified period.' }] };
      }

      const totalSpent = orders.reduce((s, o) => s + o.total, 0);
      const avgOrderValue = totalSpent / orders.length;

      const monthlySpend: Record<string, number> = {};
      const categorySpend: Record<string, number> = {};
      const productCount: Record<string, number> = {};

      for (const o of orders) {
        const month = o.order_date.substring(0, 7);
        monthlySpend[month] = (monthlySpend[month] || 0) + o.total;

        const items = JSON.parse(o.items) as Array<{ name: string; category?: string; quantity: number; price: number }>;
        for (const item of items) {
          const cat = item.category || 'Unknown';
          categorySpend[cat] = (categorySpend[cat] || 0) + item.price * item.quantity;
          productCount[item.name] = (productCount[item.name] || 0) + item.quantity;
        }
      }

      const monthlyLines = Object.entries(monthlySpend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => `  ${m}: €${v.toFixed(2)}`)
        .join('\n');

      const categoryLines = Object.entries(categorySpend)
        .sort(([, a], [, b]) => b - a)
        .map(([c, v]) => `  ${c}: €${v.toFixed(2)}`)
        .join('\n');

      const topProducts = Object.entries(productCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, qty]) => `  ${name}: ${qty} units`)
        .join('\n');

      const text = `## Order Analytics\n\n` +
        `**Total Orders:** ${orders.length}\n` +
        `**Total Spent:** €${totalSpent.toFixed(2)}\n` +
        `**Average Order Value:** €${avgOrderValue.toFixed(2)}\n\n` +
        `### Monthly Spending\n${monthlyLines}\n\n` +
        `### Spending by Category\n${categoryLines}\n\n` +
        `### Most Purchased Products\n${topProducts}`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- get_product_reviews ---
  server.registerTool('get_product_reviews', {
    title: 'Get Product Reviews',
    description: 'Fetch customer reviews for a product by name or SKU. Returns average rating, review count, and individual reviews.',
    inputSchema: {
      product: z.string().describe('Product name or SKU to look up reviews for'),
    },
  }, async ({ product }) => {
    return withLog(db, 'get_product_reviews', getSessionId(), { product }, () => {
      let reviews: Review[];

      const directReviews = db.prepare('SELECT * FROM reviews WHERE sku = ? ORDER BY created_at DESC').all(product) as Review[];
      if (directReviews.length > 0) {
        reviews = directReviews;
      } else {
        const matchingProducts = db.prepare('SELECT sku FROM products WHERE LOWER(name) LIKE ?').all(`%${product.toLowerCase()}%`) as Array<{ sku: string }>;
        if (matchingProducts.length === 0) {
          return { content: [{ type: 'text' as const, text: `No product found matching "${product}".` }] };
        }
        const skus = matchingProducts.map(p => p.sku);
        const placeholders = skus.map(() => '?').join(',');
        reviews = db.prepare(`SELECT * FROM reviews WHERE sku IN (${placeholders}) ORDER BY created_at DESC`).all(...skus) as Review[];
      }

      if (reviews.length === 0) {
        return { content: [{ type: 'text' as const, text: `No reviews found for "${product}".` }] };
      }

      const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

      const reviewLines = reviews.map(r =>
        `**${r.title}** — ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} (${r.rating}/5)\n` +
        `By ${r.author}${r.verified_purchase ? ' ✓ Verified' : ''} — ${r.created_at}\n` +
        `${r.body}`
      ).join('\n\n---\n\n');

      const text = `## Reviews (${reviews.length}) — Average: ${avgRating.toFixed(1)}/5\n\n${reviewLines}`;

      return { content: [{ type: 'text' as const, text }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- browse_categories ---
  server.registerTool('browse_categories', {
    title: 'Browse Categories',
    description: 'List all product categories with product counts and price ranges. Optionally filter to show products within a specific category.',
    inputSchema: {
      category: z.string().optional().describe('Category name to browse (e.g., "Cycling"). Omit to list all categories.'),
    },
  }, async ({ category }) => {
    return withLog(db, 'browse_categories', getSessionId(), { category }, () => {
      if (category) {
        const products = db.prepare('SELECT * FROM products WHERE LOWER(category) = ? ORDER BY price ASC')
          .all(category.toLowerCase()) as Product[];

        if (products.length === 0) {
          return { content: [{ type: 'text' as const, text: `No products found in category "${category}".` }] };
        }

        const uniqueProducts = new Map<string, Product>();
        for (const p of products) {
          if (!uniqueProducts.has(p.name)) uniqueProducts.set(p.name, p);
        }

        const lines = Array.from(uniqueProducts.values()).map(p =>
          `• **${p.name}** — €${p.price.toFixed(2)} — ${p.rating}/5 (${p.review_count} reviews)\n  ${p.description.substring(0, 80)}...`
        );

        return { content: [{ type: 'text' as const, text: `## ${products[0]!.category} (${uniqueProducts.size} products)\n\n${lines.join('\n\n')}` }] };
      }

      const categories = db.prepare(
        'SELECT category, COUNT(DISTINCT name) as product_count, MIN(price) as min_price, MAX(price) as max_price, COUNT(*) as sku_count FROM products GROUP BY category ORDER BY category'
      ).all() as Array<{ category: string; product_count: number; min_price: number; max_price: number; sku_count: number }>;

      const lines = categories.map(c =>
        `• **${c.category}** — ${c.product_count} products (${c.sku_count} SKUs) — €${c.min_price.toFixed(2)} – €${c.max_price.toFixed(2)}`
      );

      return { content: [{ type: 'text' as const, text: `## Product Categories\n\n${lines.join('\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- create_support_ticket ---
  server.registerTool('create_support_ticket', {
    title: 'Create Support Ticket',
    description: 'Report an issue with an order: damaged item, wrong item, missing item, late delivery, or other. Creates a support case with tracking number and priority.',
    inputSchema: {
      order_id: z.string().describe('Order number the issue relates to'),
      issue_type: z.enum(['damaged', 'wrong_item', 'missing_item', 'late_delivery', 'other']).describe('Type of issue'),
      description: z.string().describe('Detailed description of the issue'),
    },
  }, async ({ order_id, issue_type, description }) => {
    return withLog(db, 'create_support_ticket', getSessionId(), { order_id, issue_type, description }, () => {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(order_id) as Order | undefined;
      if (!order) {
        return { content: [{ type: 'text' as const, text: `Order "${order_id}" not found. Please check the order number.` }] };
      }

      const priority = issue_type === 'damaged' || issue_type === 'missing_item' ? 'high' : 'normal';
      const ticketId = `TKT-${randomUUID().substring(0, 8).toUpperCase()}`;

      db.prepare(
        'INSERT INTO support_tickets (ticket_id, order_id, issue_type, description, status, priority, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(ticketId, order_id, issue_type, description, 'open', priority, getSessionId() ?? null);

      const issueLabel = issue_type.replace(/_/g, ' ');
      const resolutionTime = priority === 'high' ? '24–48 hours' : '3–5 business days';

      return {
        content: [{
          type: 'text' as const,
          text: `✓ Support ticket created!\n\n` +
            `**Ticket ID:** ${ticketId}\n` +
            `**Order:** ${order_id}\n` +
            `**Issue:** ${issueLabel}\n` +
            `**Priority:** ${priority}\n` +
            `**Status:** Open\n\n` +
            `Our support team will review your case within ${resolutionTime}. You can check the status at any time by asking about ticket ${ticketId}.`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- get_support_tickets ---
  server.registerTool('get_support_tickets', {
    title: 'Get Support Tickets',
    description: 'List all your support tickets or look up a specific ticket by case number. Returns ticket status, priority, and details.',
    inputSchema: {
      ticket_id: z.string().optional().describe('Specific ticket ID to look up. Omit to list all tickets.'),
    },
  }, async ({ ticket_id }) => {
    return withLog(db, 'get_support_tickets', getSessionId(), { ticket_id }, () => {
      const sessionId = getSessionId();

      if (ticket_id) {
        const ticket = db.prepare('SELECT * FROM support_tickets WHERE ticket_id = ?').get(ticket_id) as SupportTicket | undefined;
        if (!ticket) {
          return { content: [{ type: 'text' as const, text: `Ticket "${ticket_id}" not found.` }] };
        }

        const issueLabel = ticket.issue_type.replace(/_/g, ' ');
        return {
          content: [{
            type: 'text' as const,
            text: `## Ticket ${ticket.ticket_id}\n\n` +
              `**Order:** ${ticket.order_id}\n` +
              `**Issue:** ${issueLabel}\n` +
              `**Priority:** ${ticket.priority}\n` +
              `**Status:** ${ticket.status}\n` +
              `**Created:** ${ticket.created_at}\n` +
              `**Description:** ${ticket.description}\n` +
              (ticket.resolution ? `**Resolution:** ${ticket.resolution}` : ''),
          }],
        };
      }

      const tickets = sessionId
        ? db.prepare('SELECT * FROM support_tickets WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as SupportTicket[]
        : db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all() as SupportTicket[];

      if (tickets.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No support tickets found.' }] };
      }

      const lines = tickets.map(t => {
        const issueLabel = t.issue_type.replace(/_/g, ' ');
        const statusIcon = t.status === 'open' ? '🔴' : t.status === 'in_progress' ? '🟡' : '🟢';
        return `${statusIcon} **${t.ticket_id}** — ${t.order_id} — ${issueLabel} — ${t.priority} priority — ${t.status}`;
      });

      return { content: [{ type: 'text' as const, text: `## Support Tickets (${tickets.length})\n\n${lines.join('\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- add_to_wishlist ---
  server.registerTool('add_to_wishlist', {
    title: 'Add to Wishlist',
    description: 'Save a product to your wishlist by SKU. Products are saved per session for later browsing.',
    inputSchema: {
      sku: z.string().describe('Product SKU to save'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'add_to_wishlist', getSessionId(), { sku }, () => {
      const sessionId = getSessionId();
      if (!sessionId) {
        return { content: [{ type: 'text' as const, text: 'No active session. Please reconnect.' }] };
      }

      const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
      if (!product) {
        return { content: [{ type: 'text' as const, text: `SKU "${sku}" not found.` }] };
      }

      const existing = db.prepare('SELECT * FROM wishlist WHERE session_id = ? AND sku = ?').get(sessionId, sku) as WishlistItem | undefined;
      if (existing) {
        return { content: [{ type: 'text' as const, text: `**${product.name}** is already on your wishlist.` }] };
      }

      db.prepare('INSERT INTO wishlist (id, session_id, sku) VALUES (?, ?, ?)').run(randomUUID(), sessionId, sku);

      const count = (db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE session_id = ?').get(sessionId) as { count: number }).count;

      return {
        content: [{
          type: 'text' as const,
          text: `♡ Saved to wishlist!\n\n**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ''}) — €${product.price.toFixed(2)}\n\nYou have ${count} item${count !== 1 ? 's' : ''} on your wishlist.`,
        }],
      };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- view_wishlist ---
  server.registerTool('view_wishlist', {
    title: 'View Wishlist',
    description: 'Show all saved wishlist items with current prices and stock status. Highlights items that are low stock or back in stock.',
    inputSchema: {},
  }, async () => {
    return withLog(db, 'view_wishlist', getSessionId(), {}, () => {
      const sessionId = getSessionId();
      if (!sessionId) {
        return { content: [{ type: 'text' as const, text: 'No active session.' }] };
      }

      const items = db.prepare(
        `SELECT w.*, p.name, p.color, p.size, p.price, p.stock_status, p.stock_qty, p.delivery_estimate, p.rating
         FROM wishlist w JOIN products p ON w.sku = p.sku
         WHERE w.session_id = ? ORDER BY w.added_at DESC`
      ).all(sessionId) as Array<WishlistItem & { name: string; color: string; size: number | null; price: number; stock_status: string; stock_qty: number; delivery_estimate: string; rating: number }>;

      if (items.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Your wishlist is empty. Browse products and save items for later!' }] };
      }

      const lines = items.map(i => {
        const stockIcon = i.stock_status === 'in_stock' ? '✓ In stock' : i.stock_status === 'low_stock' ? `⚠ Low stock (${i.stock_qty} left)` : '✗ Out of stock';
        return `• **${i.name}** (${i.color}${i.size ? `, Size ${i.size}` : ''}) — €${i.price.toFixed(2)}\n  SKU: ${i.sku} — ${stockIcon} — ${i.rating}/5\n  Saved: ${i.added_at}`;
      });

      return { content: [{ type: 'text' as const, text: `♡ **Your Wishlist** (${items.length} items)\n\n${lines.join('\n\n')}` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });

  // --- remove_from_wishlist ---
  server.registerTool('remove_from_wishlist', {
    title: 'Remove from Wishlist',
    description: 'Remove a product from your wishlist by SKU, or clear the entire wishlist.',
    inputSchema: {
      sku: z.string().optional().describe('Product SKU to remove. Omit to clear the entire wishlist.'),
    },
  }, async ({ sku }) => {
    return withLog(db, 'remove_from_wishlist', getSessionId(), { sku }, () => {
      const sessionId = getSessionId();
      if (!sessionId) {
        return { content: [{ type: 'text' as const, text: 'No active session.' }] };
      }

      if (sku) {
        const item = db.prepare('SELECT * FROM wishlist WHERE session_id = ? AND sku = ?').get(sessionId, sku) as WishlistItem | undefined;
        if (!item) {
          return { content: [{ type: 'text' as const, text: `SKU "${sku}" is not on your wishlist.` }] };
        }
        db.prepare('DELETE FROM wishlist WHERE id = ?').run(item.id);
      } else {
        db.prepare('DELETE FROM wishlist WHERE session_id = ?').run(sessionId);
      }

      const count = (db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE session_id = ?').get(sessionId) as { count: number }).count;

      if (count === 0) {
        return { content: [{ type: 'text' as const, text: sku ? '✓ Removed from wishlist.\n\nYour wishlist is now empty.' : '✓ Wishlist cleared.' }] };
      }

      return { content: [{ type: 'text' as const, text: `✓ ${sku ? 'Removed from wishlist' : 'Wishlist cleared'}. You have ${count} item${count !== 1 ? 's' : ''} remaining.` }] };
    }) as { content: Array<{ type: 'text'; text: string }> };
  });
}
