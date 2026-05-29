import { McpServer, logToolCall } from "@mcp-demos/shared";
import type { AuthUser } from "@mcp-demos/shared";
import { z } from "zod";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchImageAsBase64, fetchMultipleImages } from "./images.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const STORE_APP_RESOURCE_URI = "ui://b2c-commerce/store-app";

const BASE_URL = process.env["RAILWAY_PUBLIC_DOMAIN"]
  ? `https://${process.env["RAILWAY_PUBLIC_DOMAIN"]}`
  : process.env["BASE_URL"] ||
    `http://localhost:${process.env["PORT"] || "3001"}`;

interface Product {
  sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string | null;
  description: string;
  price: number;
  currency: string;
  color: string;
  color_hex: string | null;
  size: string | null;
  stock_qty: number;
  stock_status: string;
  delivery_estimate: string;
  image_url: string;
  tags: string;
  rating: number;
  review_count: number;
  weight_grams: number | null;
  material: string | null;
  specs: string | null;
  dimensions: string | null;
  frequently_bought_together: string | null;
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

async function withLogAsync<T>(
  db: Database.Database,
  toolName: string,
  sessionId: string | undefined,
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const latency = performance.now() - start;
    logToolCall(db, toolName, input, "success", latency, sessionId);
    return result;
  } catch (err) {
    const latency = performance.now() - start;
    logToolCall(db, toolName, input, `error: ${err}`, latency, sessionId);
    throw err;
  }
}

interface Reservation {
  id: string;
  sku: string;
  session_id: string | null;
  user_id: string | null;
  quantity: number;
  expires_at: string;
  created_at: string;
  status: string;
}

function getActiveReservationCount(db: Database.Database, sku: string): number {
  const now = new Date().toISOString();
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(quantity), 0) as total FROM reservations WHERE sku = ? AND status = 'active' AND expires_at > ?",
    )
    .get(sku, now) as { total: number };
  return row.total;
}

function getAvailableStock(db: Database.Database, p: Product): number {
  const reserved = getActiveReservationCount(db, p.sku);
  return Math.max(0, p.stock_qty - reserved);
}

function formatStock(p: Product): string {
  if (p.stock_status === "in_stock") return `✓ In stock (${p.stock_qty})`;
  if (p.stock_status === "low_stock")
    return `⚠ Low stock (${p.stock_qty} left)`;
  return "✗ Out of stock";
}

function stockUrgencyNotice(db: Database.Database, p: Product): string {
  if (p.stock_status !== "low_stock") return "";
  const available = getAvailableStock(db, p);
  if (available <= 0)
    return `\n\n🚨 **STOCK ALERT:** All ${p.stock_qty} units are reserved by other shoppers. This item may sell out imminently.`;
  if (available <= 3)
    return `\n\n🚨 **STOCK ALERT:** Only ${available} unreserved unit${available === 1 ? "" : "s"} left (${p.stock_qty} total, ${p.stock_qty - available} reserved by other shoppers). This is a fast-moving item — offer to reserve it for the customer now using the reserve_product tool.`;
  return `\n\n⚠️ **LOW STOCK:** ${available} available (${p.stock_qty} total). Consider offering to reserve this item for the customer.`;
}

function formatSize(p: Product): string {
  return p.size ? `Size ${p.size}` : "One size";
}

export function registerB2CTools(
  server: McpServer,
  db: Database.Database,
  getSessionId: () => string | undefined,
  getUser: () => AuthUser | undefined = () => undefined,
): void {
  // ── Register app resource for store UI ──
  registerAppResource(
    server,
    STORE_APP_RESOURCE_URI,
    STORE_APP_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(import.meta.dirname, "ui", "store-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: STORE_APP_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  // ── search_products ──
  registerAppTool(
    server,
    "search_products",
    {
      title: "Search Products",
      description:
        'Search the product catalog by natural language query. Returns matching products with name, price, stock, image, and delivery info. Supports filters for price, category, and size. Use for queries like "wireless headphones under €100" or "running shoes size 42".',
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {
        query: z
          .string()
          .describe(
            'Natural language search (e.g. "wireless headphones", "yoga mat")',
          ),
        max_price: z
          .number()
          .optional()
          .describe("Maximum price filter in EUR"),
        category: z
          .string()
          .optional()
          .describe('Filter by category (e.g. "Electronics", "Clothing")'),
        size: z
          .string()
          .optional()
          .describe('Size filter (e.g. "42", "M", "XL")'),
      },
    },
    async ({ query, max_price, category, size }) => {
      return withLogAsync(
        db,
        "search_products",
        getSessionId(),
        { query, max_price, category, size },
        async () => {
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
          if (category) {
            sql += " AND LOWER(category) = LOWER(?)";
            params.push(category);
          }
          if (size) {
            sql += " AND (size = ? OR size IS NULL)";
            params.push(size);
          }

          const allProducts = db.prepare(sql).all(...params) as Product[];

          const scored = allProducts
            .map((p) => {
              const searchText =
                `${p.name} ${p.category} ${p.subcategory || ""} ${p.description} ${p.tags} ${p.color} ${p.brand}`.toLowerCase();
              const score = keywords.reduce(
                (s: number, kw: string) =>
                  s + (searchText.includes(kw) ? 1 : 0),
                0,
              );
              return { product: p, score };
            })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

          if (scored.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No products found matching your search. Try different keywords or browse categories with the browse_categories tool.",
                },
              ],
            };
          }

          const lowStockItems = scored.filter(
            ({ product: p }) => p.stock_status === "low_stock",
          );

          const results = scored
            .map(
              ({ product: p }) =>
                `**${p.name}** by ${p.brand} (${p.color}, ${formatSize(p)})\n` +
                `SKU: ${p.sku} | €${p.price.toFixed(2)} | ${formatStock(p)}\n` +
                `★ ${p.rating}/5 (${p.review_count} reviews) | Delivery: ${p.delivery_estimate}\n` +
                `${p.image_url}`,
            )
            .join("\n\n---\n\n");

          let urgencyBlock = "";
          if (lowStockItems.length > 0) {
            urgencyBlock =
              "\n\n---\n\n⚡ **STOCK URGENCY NOTICE FOR ASSISTANT:** " +
              lowStockItems
                .map(({ product: p }) => {
                  const available = getAvailableStock(db, p);
                  return `${p.name} (SKU: ${p.sku}) has only ${available} unreserved unit${available === 1 ? "" : "s"} left`;
                })
                .join("; ") +
              ". Proactively offer to reserve these for the customer using reserve_product.";
          }

          const content: ContentBlock[] = [
            { type: "text" as const, text: results + urgencyBlock },
          ];

          // Tier 1: Fetch product images as base64 for Claude's vision
          const products = scored.map((s) => s.product);
          const images = await fetchMultipleImages(
            products.map((p) => ({ imageUrl: p.image_url, width: 300 })),
          );
          for (let i = 0; i < products.length; i++) {
            const img = images[i];
            if (img) {
              content.push({
                type: "image" as const,
                data: img.data,
                mimeType: img.mimeType,
              });
            }
          }

          return {
            content,
            structuredContent: {
              viewType: "product-grid",
              title: `Search results for "${query}"`,
              products: products.map((p) => ({
                sku: p.sku, name: p.name, brand: p.brand, price: p.price,
                color: p.color, size: p.size, image_url: p.image_url,
                rating: p.rating, review_count: p.review_count,
                stock_status: p.stock_status, delivery_estimate: p.delivery_estimate,
              })),
            },
          };
        },
      );
    },
  );

  // ── get_product_detail ──
  registerAppTool(
    server,
    "get_product_detail",
    {
      title: "Get Product Detail",
      description:
        "Return full product detail: description, specs, dimensions, all available variants (sizes/colours), stock per variant, delivery estimates, and frequently bought together items. When results include 'Frequently Bought Together' items, proactively mention them to the customer as complementary suggestions.",
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {
        product_name: z
          .string()
          .describe('Product name or partial name (e.g. "UltraBook Pro")'),
      },
    },
    async ({ product_name }) => {
      return withLogAsync(
        db,
        "get_product_detail",
        getSessionId(),
        { product_name },
        async () => {
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
                `  • ${v.color}${v.size ? `, ${formatSize(v)}` : ""} — SKU: ${v.sku} — €${v.price.toFixed(2)} — ${formatStock(v)} — ${v.delivery_estimate}` +
                (v.stock_status === "low_stock" ? ` 🔥 SELLING FAST` : ""),
            )
            .join("\n");

          let specsBlock = "";
          let parsedSpecs: Record<string, string> | undefined;
          if (first.specs) {
            try {
              parsedSpecs = JSON.parse(first.specs) as Record<string, string>;
              specsBlock =
                "\n\n## Specifications\n" +
                Object.entries(parsedSpecs)
                  .map(([k, v]) => `  • **${k}:** ${v}`)
                  .join("\n");
            } catch {
              /* ignore parse errors */
            }
          }

          let dimsBlock = "";
          if (first.dimensions) {
            try {
              const dims = JSON.parse(first.dimensions) as {
                length: number;
                width: number;
                height: number;
                unit: string;
              };
              dimsBlock = `\n**Dimensions:** ${dims.length} × ${dims.width} × ${dims.height} ${dims.unit}`;
            } catch {
              /* ignore */
            }
          }

          let fbtBlock = "";
          if (first.frequently_bought_together) {
            try {
              const fbtSkus = JSON.parse(
                first.frequently_bought_together,
              ) as string[];
              if (fbtSkus.length > 0) {
                const placeholders = fbtSkus.map(() => "?").join(",");
                const fbtProducts = db
                  .prepare(
                    `SELECT sku, name, price, color, stock_status, stock_qty FROM products WHERE sku IN (${placeholders})`,
                  )
                  .all(...fbtSkus) as Array<
                  Product & { stock_status: string; stock_qty: number }
                >;
                if (fbtProducts.length > 0) {
                  const bundleTotal =
                    first.price +
                    fbtProducts.reduce((s, fp) => s + fp.price, 0);
                  fbtBlock =
                    "\n\n## Goes Well With This Product\n" +
                    fbtProducts
                      .map(
                        (fp) =>
                          `  • **${fp.name}** (${fp.color}) — €${fp.price.toFixed(2)} — SKU: ${fp.sku}` +
                          (fp.stock_status === "low_stock"
                            ? ` ⚠️ only ${fp.stock_qty} left`
                            : ""),
                      )
                      .join("\n") +
                    `\n  **Bundle price (all together): €${bundleTotal.toFixed(2)}**` +
                    '\n\n**ASSISTANT INSTRUCTION:** The customer is actively looking at this product. Proactively recommend these complementary items — e.g. "This pairs great with the [X], many customers get them together. Want me to add both to your cart?"';
                }
              }
            } catch {
              /* ignore */
            }
          }

          const lowStockVariants = variants.filter(
            (v) => v.stock_status === "low_stock",
          );
          let urgencyBlock = "";
          if (lowStockVariants.length > 0) {
            urgencyBlock =
              "\n\n---\n⚡ **STOCK URGENCY:** " +
              lowStockVariants
                .map((v) => {
                  const available = getAvailableStock(db, v);
                  return `${v.color}${v.size ? ` (${v.size})` : ""}: ${available} left`;
                })
                .join(", ") +
              ". Proactively tell the customer about low availability and offer to reserve with reserve_product.";
          }

          const text =
            `# ${first.name}\n\n` +
            `**Brand:** ${first.brand}\n` +
            `**Category:** ${first.category}${first.subcategory ? ` › ${first.subcategory}` : ""}\n` +
            `**Description:** ${first.description}\n` +
            `**Price:** €${first.price.toFixed(2)}\n` +
            `**Rating:** ★ ${first.rating}/5 (${first.review_count} reviews)\n` +
            `**Material:** ${first.material || "N/A"}\n` +
            `**Weight:** ${first.weight_grams ? `${first.weight_grams}g` : "N/A"}\n` +
            `**Image:** ${first.image_url}` +
            dimsBlock +
            specsBlock +
            `\n\n## Available Variants\n${variantList}` +
            fbtBlock +
            urgencyBlock;

          const content: ContentBlock[] = [
            { type: "text" as const, text },
          ];

          // Tier 1: Fetch product image as base64 for Claude's vision
          const img = await fetchImageAsBase64(first.image_url, 600);
          if (img) {
            content.push({
              type: "image" as const,
              data: img.data,
              mimeType: img.mimeType,
            });
          }

          return {
            content,
            structuredContent: {
              viewType: "product-detail",
              title: first.name,
              product: {
                sku: first.sku, name: first.name, brand: first.brand,
                price: first.price, color: first.color, size: first.size,
                image_url: first.image_url, rating: first.rating,
                review_count: first.review_count, stock_status: first.stock_status,
                delivery_estimate: first.delivery_estimate,
                description: first.description,
                material: first.material ?? undefined,
                weight_grams: first.weight_grams ?? undefined,
                specs: parsedSpecs,
              },
            },
          };
        },
      );
    },
  );

  // ── check_stock ──
  server.registerTool(
    "check_stock",
    {
      title: "Check Stock",
      description:
        "Check real-time availability of a specific product SKU. Returns stock quantity, status, and delivery estimate.",
      inputSchema: {
        sku: z.string().describe('Product SKU code (e.g. "ELEC-PHN-001-BLK")'),
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

        const urgency = stockUrgencyNotice(db, product);

        return {
          content: [
            {
              type: "text" as const,
              text:
                `**${product.name}** (${product.color}${product.size ? `, ${formatSize(product)}` : ""})\nSKU: ${product.sku}\nStock: ${formatStock(product)}\nDelivery: ${product.delivery_estimate}` +
                urgency,
            },
          ],
        };
      }) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── reserve_product ──
  server.registerTool(
    "reserve_product",
    {
      title: "Reserve Product",
      description:
        'Temporarily hold a low-stock item for the customer (15-minute reservation). PROACTIVE USE: When you see a product with low stock (≤5 units), proactively offer to reserve it — say something like "I notice there are only X left — want me to hold one for you for 15 minutes while you decide?" This creates urgency and demonstrates care for the customer.',
      inputSchema: {
        sku: z.string().describe("Product SKU to reserve"),
        quantity: z
          .number()
          .min(1)
          .max(3)
          .default(1)
          .describe("Quantity to reserve (max 3)"),
      },
    },
    async ({ sku, quantity }) => {
      return withLog(
        db,
        "reserve_product",
        getSessionId(),
        { sku, quantity },
        () => {
          const product = db
            .prepare("SELECT * FROM products WHERE sku = ?")
            .get(sku) as Product | undefined;
          if (!product)
            return {
              content: [
                { type: "text" as const, text: `SKU "${sku}" not found.` },
              ],
            };

          if (product.stock_status === "out_of_stock") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Sorry, **${product.name}** is currently out of stock and cannot be reserved.`,
                },
              ],
            };
          }

          const available = getAvailableStock(db, product);
          if (available < quantity) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Cannot reserve ${quantity} unit${quantity > 1 ? "s" : ""} of **${product.name}** — only ${available} available (others have reserved the rest). ${available > 0 ? `I can reserve ${available} instead if you'd like.` : "Would you like to be notified when it's back in stock?"}`,
                },
              ],
            };
          }

          const user = getUser();
          const sessionId = getSessionId();
          const reservationId = randomUUID();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

          db.prepare(
            "INSERT INTO reservations (id, sku, session_id, user_id, quantity, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
          ).run(
            reservationId,
            sku,
            sessionId ?? null,
            user?.id ?? null,
            quantity,
            expiresAt,
          );

          const newAvailable = getAvailableStock(db, product);
          const expiryTime = new Date(expiresAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return {
            content: [
              {
                type: "text" as const,
                text:
                  `✓ **Reserved!**\n\n` +
                  `**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ""})\n` +
                  `Quantity: ${quantity} held for you\n` +
                  `**Expires:** 15 minutes (at ${expiryTime})\n` +
                  `**Reservation ID:** ${reservationId.substring(0, 8).toUpperCase()}\n\n` +
                  `${newAvailable === 0 ? "🔥 You got the last one!" : `Only ${newAvailable} left unreserved after yours.`}\n\n` +
                  `Add to cart within 15 minutes to complete your purchase. The reservation will automatically release after that.`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── get_order_status ──
  server.registerTool(
    "get_order_status",
    {
      title: "Get Order Status",
      description:
        "Look up the current status of an order by order number. Returns order state, tracking, and delivery estimate.",
      inputSchema: {
        order_id: z.string().describe('Order number (e.g. "ACM-2026-00112")'),
      },
    },
    async ({ order_id }) => {
      return withLog(
        db,
        "get_order_status",
        getSessionId(),
        { order_id },
        () => {
          const user = getUser();
          const orderSql = user
            ? "SELECT * FROM orders WHERE order_id = ? AND user_id = ?"
            : "SELECT * FROM orders WHERE order_id = ?";
          const orderParams: unknown[] = user
            ? [order_id, user.id]
            : [order_id];
          const order = db.prepare(orderSql).get(...orderParams) as
            | Order
            | undefined;
          if (!order) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order "${order_id}" not found. Order numbers look like ACM-2026-XXXXX.`,
                },
              ],
            };
          }

          const items = JSON.parse(order.items) as Array<{
            name: string;
            color: string;
            size?: string;
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

  // ── start_return ──
  server.registerTool(
    "start_return",
    {
      title: "Start Return",
      description:
        "Initiate a return for an item from a delivered order. Checks eligibility and the 30-day return window.",
      inputSchema: {
        order_id: z.string().describe("Order number to return from"),
        item_description: z
          .string()
          .describe(
            'Description of the item to return (e.g. "the headphones")',
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
          if (!order)
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order "${order_id}" not found.`,
                },
              ],
            };
          if (order.status !== "delivered")
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order ${order_id} is "${order.status}" — only delivered orders can be returned.`,
                },
              ],
            };
          if (!order.eligible_for_return)
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order ${order_id} is no longer eligible for return (30-day window closed).`,
                },
              ],
            };

          const returnId = `RET-${randomUUID().substring(0, 8).toUpperCase()}`;
          db.prepare(
            "INSERT INTO returns (return_id, order_id, item_description, session_id, user_id) VALUES (?, ?, ?, ?, ?)",
          ).run(
            returnId,
            order_id,
            item_description,
            getSessionId() ?? null,
            getUser()?.id ?? null,
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `✓ Return request created!\n\n**Return ID:** ${returnId}\n**Order:** ${order_id}\n**Item:** ${item_description}\n**Status:** Pending\n\nReturn shipping label will be emailed within 24 hours. Refund processed 5–7 business days after receipt.`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── get_recommendations ──
  registerAppTool(
    server,
    "get_recommendations",
    {
      title: "Get Recommendations",
      description:
        'Return 3–5 product recommendations based on a described use case or product the user is viewing. Uses keyword matching and "frequently bought together" data. Use proactively when the customer seems undecided or is browsing — offer tailored suggestions based on what they\'ve looked at.',
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {
        context: z
          .string()
          .describe(
            'What to base recommendations on (e.g. "home office setup", "birthday gift for a runner")',
          ),
      },
    },
    async ({ context }) => {
      return withLogAsync(
        db,
        "get_recommendations",
        getSessionId(),
        { context },
        async () => {
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
              `${p.name} ${p.category} ${p.subcategory || ""} ${p.description} ${p.tags} ${p.brand}`.toLowerCase();
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
                  text: "No specific recommendations found. Try describing the activity or occasion, and I'll suggest suitable products.",
                },
              ],
            };
          }

          const text =
            `Here are my recommendations based on "${context}":\n\n` +
            sorted
              .map(
                ({ product: p }, i) =>
                  `${i + 1}. **${p.name}** by ${p.brand} — €${p.price.toFixed(2)}\n   ${p.description.substring(0, 120)}…\n   ★ ${p.rating}/5 | ${formatStock(p)} | SKU: ${p.sku}`,
              )
              .join("\n\n");

          const content: ContentBlock[] = [
            { type: "text" as const, text },
          ];

          const products = sorted.map((s) => s.product);
          const images = await fetchMultipleImages(
            products.map((p) => ({ imageUrl: p.image_url, width: 300 })),
          );
          for (const img of images) {
            if (img) {
              content.push({ type: "image" as const, data: img.data, mimeType: img.mimeType });
            }
          }

          return {
            content,
            structuredContent: {
              viewType: "product-grid",
              title: `Recommendations for "${context}"`,
              products: products.map((p) => ({
                sku: p.sku, name: p.name, brand: p.brand, price: p.price,
                color: p.color, size: p.size, image_url: p.image_url,
                rating: p.rating, review_count: p.review_count,
                stock_status: p.stock_status, delivery_estimate: p.delivery_estimate,
              })),
            },
          };
        },
      );
    },
  );

  // ── add_to_cart ──
  server.registerTool(
    "add_to_cart",
    {
      title: "Add to Cart",
      description:
        "Add a product to the shopping cart by SKU. Returns a link the customer can open to view their cart.",
      inputSchema: {
        sku: z.string().describe("Product SKU to add"),
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
          if (!product)
            return {
              content: [
                { type: "text" as const, text: `SKU "${sku}" not found.` },
              ],
            };
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

          const user = getUser();
          if (!user) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Please sign in to add items to your cart.",
                },
              ],
            };
          }

          // Consume any active reservation this user/session has for this SKU
          const now = new Date().toISOString();
          db.prepare(
            `UPDATE reservations SET status = 'fulfilled' WHERE sku = ? AND user_id = ? AND status = 'active' AND expires_at > ?`,
          ).run(sku, user.id, now);

          const cartId = user.id;

          const existing = db
            .prepare("SELECT * FROM cart_items WHERE cart_id = ? AND sku = ?")
            .get(cartId, sku) as { id: string; quantity: number } | undefined;
          if (existing) {
            db.prepare(
              "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
            ).run(quantity, existing.id);
          } else {
            db.prepare(
              "INSERT INTO cart_items (id, cart_id, sku, name, color, size, quantity, unit_price, currency, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
              user.id,
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
          const cartUrl = `${BASE_URL}/cart`;

          // Build cross-sell recommendations from FBT data
          let crossSellBlock = "";
          if (product.frequently_bought_together) {
            try {
              const fbtSkus = JSON.parse(
                product.frequently_bought_together,
              ) as string[];
              const cartSkus = cartItems.map((i) => i.sku);
              const newSuggestions = fbtSkus.filter(
                (s) => !cartSkus.includes(s),
              );
              if (newSuggestions.length > 0) {
                const placeholders = newSuggestions.map(() => "?").join(",");
                const companions = db
                  .prepare(
                    `SELECT sku, name, price, color, stock_status, stock_qty FROM products WHERE sku IN (${placeholders})`,
                  )
                  .all(...newSuggestions) as Array<{
                  sku: string;
                  name: string;
                  price: number;
                  color: string;
                  stock_status: string;
                  stock_qty: number;
                }>;
                if (companions.length > 0) {
                  crossSellBlock =
                    "\n\n---\n🛍️ **Pairs well with this purchase:**\n" +
                    companions
                      .map(
                        (c) =>
                          `• **${c.name}** (${c.color}) — €${c.price.toFixed(2)} — SKU: ${c.sku}` +
                          (c.stock_status === "low_stock"
                            ? ` ⚠️ only ${c.stock_qty} left`
                            : ""),
                      )
                      .join("\n") +
                    '\n\n**ASSISTANT INSTRUCTION:** Proactively suggest these complementary products to the customer. Frame it naturally, e.g. "Many customers also grab the [X] with this — want me to add it?"';
                }
              }
            } catch {
              /* ignore parse errors */
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text:
                  `✓ Added to cart!\n\n**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ""})\nQuantity: ${quantity} | Unit Price: €${product.price.toFixed(2)} | Subtotal: €${(product.price * quantity).toFixed(2)}\n\n🛒 Cart: ${totalItems} item(s) — €${totalPrice.toFixed(2)} total\n\nView your cart: ${cartUrl}` +
                  crossSellBlock,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── remove_from_cart ──
  server.registerTool(
    "remove_from_cart",
    {
      title: "Remove from Cart",
      description:
        "Remove a product from the shopping cart by SKU, or clear the entire cart.",
      inputSchema: {
        sku: z
          .string()
          .optional()
          .describe("Product SKU to remove. Omit to clear entire cart."),
      },
    },
    async ({ sku }) => {
      return withLog(db, "remove_from_cart", getSessionId(), { sku }, () => {
        const user = getUser();
        if (!user)
          return {
            content: [
              {
                type: "text" as const,
                text: "Please sign in to manage your cart.",
              },
            ],
          };
        const cartId = user.id;

        if (sku) {
          const item = db
            .prepare("SELECT * FROM cart_items WHERE cart_id = ? AND sku = ?")
            .get(cartId, sku) as { id: string; name: string } | undefined;
          if (!item)
            return {
              content: [
                {
                  type: "text" as const,
                  text: `SKU "${sku}" is not in your cart.`,
                },
              ],
            };
          db.prepare("DELETE FROM cart_items WHERE id = ?").run(item.id);
        } else {
          db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
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
        const cartUrl = `${BASE_URL}/cart`;

        if (totalItems === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: sku
                  ? "✓ Removed from cart.\n\nYour cart is now empty."
                  : "✓ Cart cleared.\n\nYour cart is now empty.",
              },
            ],
          };
        }

        const itemList = cartItems
          .map(
            (i) =>
              `  • ${i.name} × ${i.quantity} — €${(i.unit_price * i.quantity).toFixed(2)}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text: `✓ ${sku ? "Item removed" : "Cart cleared"}!\n\n🛒 Cart: ${totalItems} item(s) — €${totalPrice.toFixed(2)} total\n\n${itemList}\n\nView your cart: ${cartUrl}`,
            },
          ],
        };
      }) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── view_cart ──
  registerAppTool(
    server,
    "view_cart",
    {
      title: "View Cart",
      description:
        "Show the current shopping cart contents with a browser link.",
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {},
    },
    async () => {
      return withLogAsync(db, "view_cart", getSessionId(), {}, async () => {
        const user = getUser();
        if (!user)
          return {
            content: [
              {
                type: "text" as const,
                text: "Please sign in to view your cart.",
              },
            ],
          };
        const cartId = user.id;
        const cartItems = db
          .prepare("SELECT * FROM cart_items WHERE cart_id = ?")
          .all(cartId) as Array<{
          name: string;
          sku: string;
          quantity: number;
          unit_price: number;
          color: string;
          size: string | null;
          image_url: string | null;
        }>;

        if (cartItems.length === 0)
          return {
            content: [
              {
                type: "text" as const,
                text: "Your cart is empty. Search for products and add them!",
              },
            ],
          };

        const totalItems = cartItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const totalPrice = cartItems.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        );
        const cartUrl = `${BASE_URL}/cart`;

        const itemList = cartItems
          .map(
            (i) =>
              `  • **${i.name}** (${i.color}${i.size ? `, Size ${i.size}` : ""}) × ${i.quantity} — €${(i.unit_price * i.quantity).toFixed(2)}`,
          )
          .join("\n");

        let crossSellBlock = "";
        const cartSkus = cartItems.map((i) => i.sku);
        const suggestedSkus = new Set<string>();
        for (const cartItem of cartItems) {
          const prod = db
            .prepare("SELECT frequently_bought_together FROM products WHERE sku = ?")
            .get(cartItem.sku) as { frequently_bought_together: string | null } | undefined;
          if (!prod?.frequently_bought_together) continue;
          try {
            const fbtSkus = JSON.parse(prod.frequently_bought_together) as string[];
            for (const s of fbtSkus) {
              if (!cartSkus.includes(s)) suggestedSkus.add(s);
            }
          } catch { /* ignore */ }
        }
        if (suggestedSkus.size > 0) {
          const skuArr = Array.from(suggestedSkus).slice(0, 4);
          const placeholders = skuArr.map(() => "?").join(",");
          const suggestions = db
            .prepare(`SELECT sku, name, price, color, stock_status, stock_qty FROM products WHERE sku IN (${placeholders})`)
            .all(...skuArr) as Array<{ sku: string; name: string; price: number; color: string; stock_status: string; stock_qty: number }>;
          if (suggestions.length > 0) {
            crossSellBlock =
              "\n\n---\n🛍️ **Complete your order — goes well with what's in your cart:**\n" +
              suggestions
                .map((c) =>
                  `• **${c.name}** (${c.color}) — €${c.price.toFixed(2)} — SKU: ${c.sku}` +
                  (c.stock_status === "low_stock" ? ` ⚠️ only ${c.stock_qty} left` : ""))
                .join("\n") +
              "\n\n**ASSISTANT INSTRUCTION:** Suggest these to the customer naturally, e.g. \"Before you check out, the [X] pairs really well with your [Y] — want me to add it?\"";
          }
        }

        const content: ContentBlock[] = [
          {
            type: "text" as const,
            text: `🛒 **Your Cart** — ${totalItems} item${totalItems !== 1 ? "s" : ""}\n\n${itemList}\n\n**Total: €${totalPrice.toFixed(2)}**\n\nView your cart: ${cartUrl}` + crossSellBlock,
          },
        ];

        return {
          content,
          structuredContent: {
            viewType: "cart",
            title: "Your Cart",
            cartItems: cartItems.map((i) => ({
              name: i.name, sku: i.sku, color: i.color, size: i.size,
              quantity: i.quantity, unit_price: i.unit_price,
              image_url: i.image_url ?? undefined,
            })),
            cartTotal: totalPrice,
          },
        };
      });
    },
  );

  // ── list_orders ──
  server.registerTool(
    "list_orders",
    {
      title: "List Orders",
      description:
        'List all orders with optional status/date filters. Use for "show my orders", "cancelled orders", or "orders from March".',
      inputSchema: {
        status: z
          .enum(["delivered", "shipped", "processing", "cancelled", "returned"])
          .optional()
          .describe("Filter by order status"),
        date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
        date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      },
    },
    async ({ status, date_from, date_to }) => {
      return withLog(
        db,
        "list_orders",
        getSessionId(),
        { status, date_from, date_to },
        () => {
          const user = getUser();
          let sql = "SELECT * FROM orders WHERE 1=1";
          const params: unknown[] = [];
          if (user) {
            sql += " AND user_id = ?";
            params.push(user.id);
          }
          if (status) {
            sql += " AND status = ?";
            params.push(status);
          }
          if (date_from) {
            sql += " AND order_date >= ?";
            params.push(date_from);
          }
          if (date_to) {
            sql += " AND order_date <= ?";
            params.push(date_to);
          }
          sql += " ORDER BY order_date DESC";

          const orders = db.prepare(sql).all(...params) as Order[];
          if (orders.length === 0)
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No orders found matching your filters.",
                },
              ],
            };

          const lines = orders.map((o) => {
            const items = JSON.parse(o.items) as Array<{ name: string }>;
            const itemNames = items.map((i) => i.name).join(", ");
            const icon =
              o.status === "delivered"
                ? "✓"
                : o.status === "shipped"
                  ? "🚚"
                  : o.status === "processing"
                    ? "⏳"
                    : o.status === "cancelled"
                      ? "✗"
                      : "↩";
            return `${icon} **${o.order_id}** — ${o.order_date} — €${o.total.toFixed(2)} — ${o.status}\n   ${itemNames}`;
          });

          return {
            content: [
              {
                type: "text" as const,
                text: `**Your Orders** (${orders.length})\n\n${lines.join("\n\n")}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── get_order_items ──
  server.registerTool(
    "get_order_items",
    {
      title: "Get Order Items",
      description:
        "Return a flat list of every item from every order with full detail (order_id, date, status, SKU, name, category, quantity, price, line total). Raw data for computing analytics.",
      inputSchema: {
        status: z
          .enum(["delivered", "shipped", "processing", "cancelled", "returned"])
          .optional()
          .describe("Filter by order status"),
        date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
        date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
        category: z.string().optional().describe("Filter by product category"),
      },
    },
    async ({ status, date_from, date_to, category }) => {
      return withLog(
        db,
        "get_order_items",
        getSessionId(),
        { status, date_from, date_to, category },
        () => {
          const user = getUser();
          let sql = "SELECT * FROM orders WHERE 1=1";
          const params: unknown[] = [];
          if (user) {
            sql += " AND user_id = ?";
            params.push(user.id);
          }
          if (status) {
            sql += " AND status = ?";
            params.push(status);
          }
          if (date_from) {
            sql += " AND order_date >= ?";
            params.push(date_from);
          }
          if (date_to) {
            sql += " AND order_date <= ?";
            params.push(date_to);
          }
          sql += " ORDER BY order_date DESC";

          const orders = db.prepare(sql).all(...params) as Order[];
          const rows: Array<Record<string, unknown>> = [];

          for (const o of orders) {
            const items = JSON.parse(o.items) as Array<{
              sku: string;
              name: string;
              category?: string;
              quantity: number;
              price: number;
              color?: string;
              size?: string;
            }>;
            for (const item of items) {
              if (
                category &&
                item.category &&
                item.category.toLowerCase() !== category.toLowerCase()
              )
                continue;
              rows.push({
                order_id: o.order_id,
                order_date: o.order_date,
                status: o.status,
                sku: item.sku,
                name: item.name,
                category: item.category || "Unknown",
                color: item.color || null,
                size: item.size || null,
                quantity: item.quantity,
                unit_price: item.price,
                line_total: item.price * item.quantity,
              });
            }
          }

          if (rows.length === 0)
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No order items found matching your filters.",
                },
              ],
            };
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(rows, null, 2) },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── order_analytics ──
  server.registerTool(
    "order_analytics",
    {
      title: "Order Analytics",
      description:
        'Pre-computed analytics: total spent, order count, average order value, spending by month and category. Use for "how much did I spend?" or "order summary".',
      inputSchema: {
        date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
        date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      },
    },
    async ({ date_from, date_to }) => {
      return withLog(
        db,
        "order_analytics",
        getSessionId(),
        { date_from, date_to },
        () => {
          const user = getUser();
          let sql = "SELECT * FROM orders WHERE status NOT IN ('cancelled')";
          const params: unknown[] = [];
          if (user) {
            sql += " AND user_id = ?";
            params.push(user.id);
          }
          if (date_from) {
            sql += " AND order_date >= ?";
            params.push(date_from);
          }
          if (date_to) {
            sql += " AND order_date <= ?";
            params.push(date_to);
          }

          const orders = db.prepare(sql).all(...params) as Order[];
          if (orders.length === 0)
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No orders found in the specified period.",
                },
              ],
            };

          const totalSpent = orders.reduce((s, o) => s + o.total, 0);
          const avgOrderValue = totalSpent / orders.length;

          const monthlySpend: Record<string, number> = {};
          const categorySpend: Record<string, number> = {};
          const productCount: Record<string, number> = {};

          for (const o of orders) {
            const month = o.order_date.substring(0, 7);
            monthlySpend[month] = (monthlySpend[month] || 0) + o.total;
            const items = JSON.parse(o.items) as Array<{
              name: string;
              category?: string;
              quantity: number;
              price: number;
            }>;
            for (const item of items) {
              const cat = item.category || "Unknown";
              categorySpend[cat] =
                (categorySpend[cat] || 0) + item.price * item.quantity;
              productCount[item.name] =
                (productCount[item.name] || 0) + item.quantity;
            }
          }

          const monthlyLines = Object.entries(monthlySpend)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([m, v]) => `  ${m}: €${v.toFixed(2)}`)
            .join("\n");
          const categoryLines = Object.entries(categorySpend)
            .sort(([, a], [, b]) => b - a)
            .map(([c, v]) => `  ${c}: €${v.toFixed(2)}`)
            .join("\n");
          const topProducts = Object.entries(productCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, qty]) => `  ${name}: ${qty} units`)
            .join("\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `## Order Analytics\n\n**Total Orders:** ${orders.length}\n**Total Spent:** €${totalSpent.toFixed(2)}\n**Average Order Value:** €${avgOrderValue.toFixed(2)}\n\n### Monthly Spending\n${monthlyLines}\n\n### Spending by Category\n${categoryLines}\n\n### Most Purchased Products\n${topProducts}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── get_product_reviews ──
  server.registerTool(
    "get_product_reviews",
    {
      title: "Get Product Reviews",
      description:
        "Fetch customer reviews for a product by name or SKU. Returns average rating and individual reviews.",
      inputSchema: {
        product: z.string().describe("Product name or SKU"),
      },
    },
    async ({ product }) => {
      return withLog(
        db,
        "get_product_reviews",
        getSessionId(),
        { product },
        () => {
          let reviews: Review[];

          const directReviews = db
            .prepare(
              "SELECT * FROM reviews WHERE sku = ? ORDER BY created_at DESC",
            )
            .all(product) as Review[];
          if (directReviews.length > 0) {
            reviews = directReviews;
          } else {
            const matchingProducts = db
              .prepare("SELECT sku FROM products WHERE LOWER(name) LIKE ?")
              .all(`%${product.toLowerCase()}%`) as Array<{ sku: string }>;
            if (matchingProducts.length === 0)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No product found matching "${product}".`,
                  },
                ],
              };
            const skus = matchingProducts.map((p) => p.sku);
            const placeholders = skus.map(() => "?").join(",");
            reviews = db
              .prepare(
                `SELECT * FROM reviews WHERE sku IN (${placeholders}) ORDER BY created_at DESC`,
              )
              .all(...skus) as Review[];
          }

          if (reviews.length === 0)
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No reviews found for "${product}".`,
                },
              ],
            };

          const avgRating =
            reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
          const reviewLines = reviews
            .map(
              (r) =>
                `**${r.title}** — ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} (${r.rating}/5)\nBy ${r.author}${r.verified_purchase ? " ✓ Verified" : ""} — ${r.created_at}\n${r.body}`,
            )
            .join("\n\n---\n\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `## Reviews (${reviews.length}) — Average: ${avgRating.toFixed(1)}/5\n\n${reviewLines}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── browse_categories ──
  server.registerTool(
    "browse_categories",
    {
      title: "Browse Categories",
      description:
        "List all product categories with counts and price ranges, or browse products within a specific category. Shows subcategories when available.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Category name to browse. Omit to list all categories."),
      },
    },
    async ({ category }) => {
      return withLog(
        db,
        "browse_categories",
        getSessionId(),
        { category },
        () => {
          if (category) {
            const products = db
              .prepare(
                "SELECT * FROM products WHERE LOWER(category) = ? ORDER BY price ASC",
              )
              .all(category.toLowerCase()) as Product[];
            if (products.length === 0)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No products found in category "${category}".`,
                  },
                ],
              };

            const uniqueProducts = new Map<string, Product>();
            for (const p of products) {
              if (!uniqueProducts.has(p.name)) uniqueProducts.set(p.name, p);
            }

            const subcategories = new Map<string, Product[]>();
            for (const p of Array.from(uniqueProducts.values())) {
              const sub = p.subcategory || "Other";
              if (!subcategories.has(sub)) subcategories.set(sub, []);
              subcategories.get(sub)!.push(p);
            }

            let text = `## ${products[0]!.category} (${uniqueProducts.size} products)\n`;
            for (const [sub, prods] of subcategories) {
              text += `\n### ${sub}\n`;
              text += prods
                .map(
                  (p) =>
                    `• **${p.name}** by ${p.brand} — €${p.price.toFixed(2)} — ★ ${p.rating}/5 (${p.review_count} reviews)\n  ${p.description.substring(0, 80)}…`,
                )
                .join("\n\n");
              text += "\n";
            }

            return { content: [{ type: "text" as const, text }] };
          }

          const categories = db
            .prepare(
              "SELECT category, COUNT(DISTINCT name) as product_count, MIN(price) as min_price, MAX(price) as max_price, COUNT(*) as sku_count FROM products GROUP BY category ORDER BY category",
            )
            .all() as Array<{
            category: string;
            product_count: number;
            min_price: number;
            max_price: number;
            sku_count: number;
          }>;

          const lines = categories.map(
            (c) =>
              `• **${c.category}** — ${c.product_count} products (${c.sku_count} SKUs) — €${c.min_price.toFixed(2)} – €${c.max_price.toFixed(2)}`,
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `## Product Categories\n\n${lines.join("\n")}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── create_support_ticket ──
  server.registerTool(
    "create_support_ticket",
    {
      title: "Create Support Ticket",
      description:
        "Report an issue with an order: damaged, wrong item, missing, late delivery, or other. Returns a link to the created ticket.",
      inputSchema: {
        order_id: z.string().describe("Order number the issue relates to"),
        issue_type: z
          .enum([
            "damaged",
            "wrong_item",
            "missing_item",
            "late_delivery",
            "other",
          ])
          .describe("Type of issue"),
        description: z.string().describe("Detailed description of the issue"),
      },
    },
    async ({ order_id, issue_type, description }) => {
      return withLog(
        db,
        "create_support_ticket",
        getSessionId(),
        { order_id, issue_type, description },
        () => {
          const userId = getUser()?.id ?? null;

          const orderQuery = userId
            ? "SELECT * FROM orders WHERE order_id = ? AND user_id = ?"
            : "SELECT * FROM orders WHERE order_id = ?";
          const orderParams = userId ? [order_id, userId] : [order_id];
          const order = db.prepare(orderQuery).get(...orderParams) as
            | Order
            | undefined;
          if (!order)
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Order "${order_id}" not found.`,
                },
              ],
            };

          const priority =
            issue_type === "damaged" || issue_type === "missing_item"
              ? "high"
              : "normal";
          const ticketId = `TKT-${randomUUID().substring(0, 8).toUpperCase()}`;
          db.prepare(
            "INSERT INTO support_tickets (ticket_id, order_id, issue_type, description, status, priority, session_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          ).run(
            ticketId,
            order_id,
            issue_type,
            description,
            "open",
            priority,
            getSessionId() ?? null,
            userId,
          );

          const ticketUrl = `${BASE_URL}/support/${ticketId}`;
          const resolutionTime =
            priority === "high" ? "24–48 hours" : "3–5 business days";
          return {
            content: [
              {
                type: "text" as const,
                text: `✓ Support ticket created!\n\n**Ticket ID:** ${ticketId}\n**Order:** ${order_id}\n**Issue:** ${issue_type.replace(/_/g, " ")}\n**Priority:** ${priority}\n**Status:** Open\n\n**View ticket:** ${ticketUrl}\n\nOur team will review within ${resolutionTime}. Ask about ticket ${ticketId} anytime for updates.`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── get_support_tickets ──
  server.registerTool(
    "get_support_tickets",
    {
      title: "Get Support Tickets",
      description: "List all support tickets or look up a specific one by ID.",
      inputSchema: {
        ticket_id: z
          .string()
          .optional()
          .describe("Specific ticket ID to look up. Omit to list all."),
      },
    },
    async ({ ticket_id }) => {
      return withLog(
        db,
        "get_support_tickets",
        getSessionId(),
        { ticket_id },
        () => {
          const userId = getUser()?.id ?? null;

          if (ticket_id) {
            const ticketQuery = userId
              ? "SELECT * FROM support_tickets WHERE ticket_id = ? AND user_id = ?"
              : "SELECT * FROM support_tickets WHERE ticket_id = ?";
            const ticketParams = userId ? [ticket_id, userId] : [ticket_id];
            const ticket = db.prepare(ticketQuery).get(...ticketParams) as
              | SupportTicket
              | undefined;
            if (!ticket)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Ticket "${ticket_id}" not found.`,
                  },
                ],
              };

            const ticketUrl = `${BASE_URL}/support/${ticket.ticket_id}`;
            return {
              content: [
                {
                  type: "text" as const,
                  text: `## Ticket ${ticket.ticket_id}\n\n**Order:** ${ticket.order_id}\n**Issue:** ${ticket.issue_type.replace(/_/g, " ")}\n**Priority:** ${ticket.priority}\n**Status:** ${ticket.status}\n**Created:** ${ticket.created_at}\n**Description:** ${ticket.description}\n${ticket.resolution ? `**Resolution:** ${ticket.resolution}\n` : ""}**View ticket:** ${ticketUrl}`,
                },
              ],
            };
          }

          const tickets = userId
            ? (db
                .prepare(
                  "SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC",
                )
                .all(userId) as SupportTicket[])
            : (db
                .prepare(
                  "SELECT * FROM support_tickets ORDER BY created_at DESC",
                )
                .all() as SupportTicket[]);

          if (tickets.length === 0)
            return {
              content: [
                { type: "text" as const, text: "No support tickets found." },
              ],
            };

          const lines = tickets.map((t) => {
            const icon =
              t.status === "open"
                ? "🔴"
                : t.status === "in_progress"
                  ? "🟡"
                  : "🟢";
            const ticketUrl = `${BASE_URL}/support/${t.ticket_id}`;
            return `${icon} **${t.ticket_id}** — ${t.order_id} — ${t.issue_type.replace(/_/g, " ")} — ${t.priority} priority — ${t.status}\n   View: ${ticketUrl}`;
          });

          return {
            content: [
              {
                type: "text" as const,
                text: `## Support Tickets (${tickets.length})\n\n${lines.join("\n\n")}`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── add_to_wishlist ──
  server.registerTool(
    "add_to_wishlist",
    {
      title: "Add to Wishlist",
      description: "Save a product to your wishlist by SKU.",
      inputSchema: { sku: z.string().describe("Product SKU to save") },
    },
    async ({ sku }) => {
      return withLog(db, "add_to_wishlist", getSessionId(), { sku }, () => {
        const userId = getUser()?.id;
        const sessionId = getSessionId();
        const ownerId = userId || sessionId;
        if (!ownerId)
          return {
            content: [
              {
                type: "text" as const,
                text: "No active session. Please reconnect.",
              },
            ],
          };

        const product = db
          .prepare("SELECT * FROM products WHERE sku = ?")
          .get(sku) as Product | undefined;
        if (!product)
          return {
            content: [
              { type: "text" as const, text: `SKU "${sku}" not found.` },
            ],
          };

        const existing = db
          .prepare("SELECT * FROM wishlist WHERE session_id = ? AND sku = ?")
          .get(ownerId, sku) as WishlistItem | undefined;
        if (existing)
          return {
            content: [
              {
                type: "text" as const,
                text: `**${product.name}** is already on your wishlist.`,
              },
            ],
          };

        db.prepare(
          "INSERT INTO wishlist (id, session_id, sku, user_id) VALUES (?, ?, ?, ?)",
        ).run(randomUUID(), ownerId, sku, userId ?? null);
        const count = (
          db
            .prepare(
              "SELECT COUNT(*) as count FROM wishlist WHERE session_id = ?",
            )
            .get(ownerId) as { count: number }
        ).count;

        return {
          content: [
            {
              type: "text" as const,
              text: `♡ Saved to wishlist!\n\n**${product.name}** (${product.color}${product.size ? `, Size ${product.size}` : ""}) — €${product.price.toFixed(2)}\n\nYou have ${count} item${count !== 1 ? "s" : ""} on your wishlist.`,
            },
          ],
        };
      }) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── view_wishlist ──
  registerAppTool(
    server,
    "view_wishlist",
    {
      title: "View Wishlist",
      description:
        "Show all saved wishlist items with current prices and stock status.",
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {},
    },
    async () => {
      return withLogAsync(db, "view_wishlist", getSessionId(), {}, async () => {
        const ownerId = getUser()?.id || getSessionId();
        if (!ownerId)
          return {
            content: [{ type: "text" as const, text: "No active session." }],
          };

        const items = db
          .prepare(
            `SELECT w.*, p.name, p.color, p.size, p.price, p.stock_status, p.stock_qty, p.delivery_estimate, p.rating, p.brand, p.image_url, p.review_count, p.currency
         FROM wishlist w JOIN products p ON w.sku = p.sku WHERE w.session_id = ? ORDER BY w.added_at DESC`,
          )
          .all(ownerId) as Array<
          WishlistItem & {
            name: string;
            color: string;
            size: string | null;
            price: number;
            stock_status: string;
            stock_qty: number;
            delivery_estimate: string;
            rating: number;
            brand: string;
            image_url: string;
            review_count: number;
            currency: string;
          }
        >;

        if (items.length === 0)
          return {
            content: [
              {
                type: "text" as const,
                text: "Your wishlist is empty. Browse products and save items!",
              },
            ],
          };

        const lines = items.map((i) => {
          const stockIcon =
            i.stock_status === "in_stock"
              ? "✓ In stock"
              : i.stock_status === "low_stock"
                ? `⚠ Low stock (${i.stock_qty} left)`
                : "✗ Out of stock";
          return `• **${i.name}** (${i.color}${i.size ? `, Size ${i.size}` : ""}) — €${i.price.toFixed(2)}\n  SKU: ${i.sku} — ${stockIcon} — ★ ${i.rating}/5\n  Saved: ${i.added_at}`;
        });

        const content: ContentBlock[] = [
          {
            type: "text" as const,
            text: `♡ **Your Wishlist** (${items.length} items)\n\n${lines.join("\n\n")}`,
          },
        ];

        return {
          content,
          structuredContent: {
            viewType: "product-grid",
            title: `Your Wishlist (${items.length} items)`,
            products: items.map((i) => ({
              sku: i.sku, name: i.name, brand: i.brand, price: i.price,
              color: i.color, size: i.size, image_url: i.image_url,
              rating: i.rating, review_count: i.review_count,
              stock_status: i.stock_status, delivery_estimate: i.delivery_estimate,
            })),
          },
        };
      });
    },
  );

  // ── remove_from_wishlist ──
  server.registerTool(
    "remove_from_wishlist",
    {
      title: "Remove from Wishlist",
      description:
        "Remove a product from your wishlist by SKU, or clear the entire wishlist.",
      inputSchema: {
        sku: z
          .string()
          .optional()
          .describe("Product SKU to remove. Omit to clear all."),
      },
    },
    async ({ sku }) => {
      return withLog(
        db,
        "remove_from_wishlist",
        getSessionId(),
        { sku },
        () => {
          const ownerId = getUser()?.id || getSessionId();
          if (!ownerId)
            return {
              content: [{ type: "text" as const, text: "No active session." }],
            };

          if (sku) {
            const item = db
              .prepare(
                "SELECT * FROM wishlist WHERE session_id = ? AND sku = ?",
              )
              .get(ownerId, sku) as WishlistItem | undefined;
            if (!item)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `SKU "${sku}" is not on your wishlist.`,
                  },
                ],
              };
            db.prepare("DELETE FROM wishlist WHERE id = ?").run(item.id);
          } else {
            db.prepare("DELETE FROM wishlist WHERE session_id = ?").run(
              ownerId,
            );
          }

          const count = (
            db
              .prepare(
                "SELECT COUNT(*) as count FROM wishlist WHERE session_id = ?",
              )
              .get(ownerId) as { count: number }
          ).count;
          if (count === 0)
            return {
              content: [
                {
                  type: "text" as const,
                  text: sku
                    ? "✓ Removed from wishlist.\n\nYour wishlist is now empty."
                    : "✓ Wishlist cleared.",
                },
              ],
            };
          return {
            content: [
              {
                type: "text" as const,
                text: `✓ ${sku ? "Removed from wishlist" : "Wishlist cleared"}. You have ${count} item${count !== 1 ? "s" : ""} remaining.`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── get_frequently_bought_together ──
  registerAppTool(
    server,
    "get_frequently_bought_together",
    {
      title: "Frequently Bought Together",
      description:
        "Show products frequently purchased alongside a given product SKU. Useful for cross-selling and bundle suggestions.",
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {
        sku: z
          .string()
          .describe("Product SKU to find complementary products for"),
      },
    },
    async ({ sku }) => {
      return withLogAsync(
        db,
        "get_frequently_bought_together",
        getSessionId(),
        { sku },
        async () => {
          const product = db
            .prepare("SELECT * FROM products WHERE sku = ?")
            .get(sku) as Product | undefined;
          if (!product)
            return {
              content: [
                { type: "text" as const, text: `SKU "${sku}" not found.` },
              ],
            };

          if (!product.frequently_bought_together) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No "frequently bought together" data for **${product.name}**.`,
                },
              ],
            };
          }

          try {
            const fbtSkus = JSON.parse(
              product.frequently_bought_together,
            ) as string[];
            if (fbtSkus.length === 0)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No companion products found for **${product.name}**.`,
                  },
                ],
              };

            const placeholders = fbtSkus.map(() => "?").join(",");
            const companions = db
              .prepare(`SELECT * FROM products WHERE sku IN (${placeholders})`)
              .all(...fbtSkus) as Product[];

            if (companions.length === 0)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No companion products found for **${product.name}**.`,
                  },
                ],
              };

            const bundleTotal =
              product.price + companions.reduce((s, c) => s + c.price, 0);
            const lines = companions
              .map(
                (c) =>
                  `• **${c.name}** (${c.color}) — €${c.price.toFixed(2)} — ${formatStock(c)}\n  ${c.description.substring(0, 80)}…\n  SKU: ${c.sku}`,
              )
              .join("\n\n");

            const content: ContentBlock[] = [
              {
                type: "text" as const,
                text: `## Frequently Bought With: ${product.name}\n\n${lines}\n\n**Bundle total (${1 + companions.length} items): €${bundleTotal.toFixed(2)}**`,
              },
            ];

            const images = await fetchMultipleImages(
              companions.map((c) => ({ imageUrl: c.image_url, width: 300 })),
            );
            for (const img of images) {
              if (img) {
                content.push({ type: "image" as const, data: img.data, mimeType: img.mimeType });
              }
            }

            return {
              content,
              structuredContent: {
                viewType: "product-grid",
                title: `Frequently Bought With: ${product.name}`,
                products: companions.map((c) => ({
                  sku: c.sku, name: c.name, brand: c.brand, price: c.price,
                  color: c.color, size: c.size, image_url: c.image_url,
                  rating: c.rating, review_count: c.review_count,
                  stock_status: c.stock_status, delivery_estimate: c.delivery_estimate,
                })),
              },
            };
          } catch {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Could not load companion products for **${product.name}**.`,
                },
              ],
            };
          }
        },
      );
    },
  );

  // ── get_personalized_recommendations ──
  registerAppTool(
    server,
    "get_personalized_recommendations",
    {
      title: "Personalized Recommendations",
      description:
        "Recommend products based on the customer's purchase history. Finds accessories and complementary items for things they've already bought but haven't purchased yet. PROACTIVE USE: Call this when greeting a returning customer or when they seem to be browsing without a clear goal — say something like \"Based on your GPS watch purchase last month, here are some compatible accessories you might like.\"",
      _meta: { ui: { resourceUri: STORE_APP_RESOURCE_URI } },
      inputSchema: {},
    },
    async () => {
      return withLogAsync(
        db,
        "get_personalized_recommendations",
        getSessionId(),
        {},
        async () => {
          const user = getUser();
          if (!user) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Customer is not signed in. Sign in to see personalized recommendations based on purchase history.",
                },
              ],
            };
          }

          const orders = db
            .prepare(
              "SELECT items, order_date FROM orders WHERE user_id = ? AND status IN ('delivered', 'shipped', 'processing') ORDER BY order_date DESC",
            )
            .all(user.id) as Array<{ items: string; order_date: string }>;

          if (orders.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No purchase history found. Use get_recommendations with a context query to suggest products based on interests instead.",
                },
              ],
            };
          }

          // Collect all SKUs the customer has purchased
          const purchasedSkus = new Set<string>();
          const purchasedItems: Array<{
            sku: string;
            name: string;
            order_date: string;
          }> = [];
          for (const order of orders) {
            const items = JSON.parse(order.items) as Array<{
              sku: string;
              name: string;
            }>;
            for (const item of items) {
              if (!purchasedSkus.has(item.sku)) {
                purchasedSkus.add(item.sku);
                purchasedItems.push({
                  sku: item.sku,
                  name: item.name,
                  order_date: order.order_date,
                });
              }
            }
          }

          // Also exclude anything currently in cart
          const cartSkus = new Set(
            (
              db
                .prepare("SELECT sku FROM cart_items WHERE cart_id = ?")
                .all(user.id) as Array<{ sku: string }>
            ).map((r) => r.sku),
          );

          // Find FBT items for purchased products that the customer hasn't bought
          const recommendations: Array<{
            product: Product;
            reason: string;
            sourceDate: string;
          }> = [];
          const seenSkus = new Set<string>();

          for (const purchased of purchasedItems) {
            const product = db
              .prepare("SELECT * FROM products WHERE sku = ?")
              .get(purchased.sku) as Product | undefined;
            if (!product?.frequently_bought_together) continue;

            try {
              const fbtSkus = JSON.parse(
                product.frequently_bought_together,
              ) as string[];
              for (const fbtSku of fbtSkus) {
                if (
                  purchasedSkus.has(fbtSku) ||
                  cartSkus.has(fbtSku) ||
                  seenSkus.has(fbtSku)
                )
                  continue;
                seenSkus.add(fbtSku);

                const companion = db
                  .prepare("SELECT * FROM products WHERE sku = ?")
                  .get(fbtSku) as Product | undefined;
                if (companion && companion.stock_status !== "out_of_stock") {
                  recommendations.push({
                    product: companion,
                    reason: `complements your ${purchased.name}`,
                    sourceDate: purchased.order_date,
                  });
                }
              }
            } catch {
              /* ignore */
            }

            if (recommendations.length >= 6) break;
          }

          if (recommendations.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Found ${purchasedItems.length} item(s) in purchase history but no new complementary products to suggest. The customer may already own the common accessories. Try get_recommendations with a context query for fresh ideas.`,
                },
              ],
            };
          }

          const lines = recommendations.map((r) => {
            const p = r.product;
            const stockNote =
              p.stock_status === "low_stock"
                ? ` — ⚠️ only ${p.stock_qty} left!`
                : "";
            return (
              `• **${p.name}** (${p.color}) — €${p.price.toFixed(2)}${stockNote}\n` +
              `  _${r.reason} (purchased ${r.sourceDate})_\n` +
              `  SKU: ${p.sku}`
            );
          });

          const text =
            `## Recommended For You\n\n` +
            `Based on your recent purchases, here are compatible accessories and complementary products:\n\n` +
            lines.join("\n\n") +
            `\n\n---\n**ASSISTANT INSTRUCTION:** Present these naturally to the customer, referencing their specific past purchases. For example: "Since you got the [product] last month, you might like [recommendation] — it pairs really well with it." If any item is low stock, mention the urgency.`;

          const content: ContentBlock[] = [
            { type: "text" as const, text },
          ];

          const recProducts = recommendations.map((r) => r.product);
          const images = await fetchMultipleImages(
            recProducts.map((p) => ({ imageUrl: p.image_url, width: 300 })),
          );
          for (const img of images) {
            if (img) {
              content.push({ type: "image" as const, data: img.data, mimeType: img.mimeType });
            }
          }

          return {
            content,
            structuredContent: {
              viewType: "product-grid",
              title: "Recommended For You",
              products: recProducts.map((p) => ({
                sku: p.sku, name: p.name, brand: p.brand, price: p.price,
                color: p.color, size: p.size, image_url: p.image_url,
                rating: p.rating, review_count: p.review_count,
                stock_status: p.stock_status, delivery_estimate: p.delivery_estimate,
              })),
            },
          };
        },
      );
    },
  );

  // ── get_current_user ──
  server.registerTool(
    "get_current_user",
    {
      title: "Get Current User",
      description:
        "Return the currently authenticated user's profile (name, email, avatar). Returns null fields if the user is not signed in yet. Use this before checkout or to personalize the experience.",
      inputSchema: {},
    },
    async () => {
      return withLog(db, "get_current_user", getSessionId(), {}, () => {
        const user = getUser();
        if (!user) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No user is currently signed in. The customer can sign in at the store's login page to link their account, or you can proceed with a guest session.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `## Signed In\n\n**Name:** ${user.name}\n**Email:** ${user.email}${user.image ? `\n**Avatar:** ${user.image}` : ""}`,
            },
          ],
        };
      }) as { content: Array<{ type: "text"; text: string }> };
    },
  );

  // ── checkout ──
  server.registerTool(
    "checkout",
    {
      title: "Checkout",
      description:
        "Place an order from the current cart. Requires an authenticated user. Creates an order record and clears the cart. Returns the new order ID and summary.",
      inputSchema: {
        shipping_address: z.string().describe("Full shipping address"),
        payment_method: z
          .enum(["credit_card", "paypal", "bank_transfer"])
          .default("credit_card")
          .describe("Payment method"),
      },
    },
    async ({ shipping_address, payment_method }) => {
      return withLog(
        db,
        "checkout",
        getSessionId(),
        { shipping_address, payment_method },
        () => {
          const user = getUser();
          if (!user) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Please sign in before checking out. The customer needs to authenticate to place an order.",
                },
              ],
            };
          }

          const cartId = user.id;
          const cartItems = db
            .prepare("SELECT * FROM cart_items WHERE cart_id = ?")
            .all(cartId) as Array<{
            sku: string;
            name: string;
            color: string;
            size: string | null;
            quantity: number;
            unit_price: number;
            category?: string;
          }>;

          if (cartItems.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Your cart is empty. Add items before checking out.",
                },
              ],
            };
          }

          const total = cartItems.reduce(
            (s, i) => s + i.unit_price * i.quantity,
            0,
          );
          const orderId = `ACM-${new Date().getFullYear()}-${randomUUID().substring(0, 5).toUpperCase()}`;
          const orderItems = cartItems.map((i) => ({
            sku: i.sku,
            name: i.name,
            color: i.color,
            size: i.size,
            quantity: i.quantity,
            price: i.unit_price,
          }));

          const deliveryDate = new Date();
          deliveryDate.setDate(deliveryDate.getDate() + 3);

          db.prepare(
            `
        INSERT INTO orders (order_id, status, delivery_estimate, order_date, items, total, currency, eligible_for_return, return_deadline, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
          ).run(
            orderId,
            "processing",
            deliveryDate.toISOString().split("T")[0],
            new Date().toISOString().split("T")[0],
            JSON.stringify(orderItems),
            total,
            "EUR",
            1,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            user.id,
          );

          db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);

          const itemList = orderItems
            .map(
              (i) =>
                `  • ${i.name} (${i.color}${i.size ? `, Size ${i.size}` : ""}) × ${i.quantity} — €${(i.price * i.quantity).toFixed(2)}`,
            )
            .join("\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `## Order Placed!\n\n**Order ID:** ${orderId}\n**Status:** Processing\n**Payment:** ${payment_method.replace(/_/g, " ")}\n**Shipping to:** ${shipping_address}\n**Estimated Delivery:** ${deliveryDate.toISOString().split("T")[0]}\n\n**Items:**\n${itemList}\n\n**Total: €${total.toFixed(2)}**\n\nThank you, ${user.name}! You'll receive a confirmation email at ${user.email}.`,
              },
            ],
          };
        },
      ) as { content: Array<{ type: "text"; text: string }> };
    },
  );
}
