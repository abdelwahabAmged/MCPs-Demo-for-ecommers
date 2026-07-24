import { createServerApp, getSessionUser } from "@mcp-demos/shared";
import type { AuthConfig } from "@mcp-demos/shared";
import { seedB2CData } from "./data/seed.js";
import { registerB2CTools } from "./tools.js";
import {
  renderCartPage,
  renderLoginPage,
  renderProductsPage,
  renderProductDetailPage,
  renderCheckoutPage,
  renderOrdersPage,
  renderOrderDetailPage,
  renderTicketsPage,
  renderTicketDetailPage,
  renderAdminDashboardPage,
  renderAdminAnalyticsPage,
  renderAdminSupportPage,
  renderAdminSupportTicketPage,
  renderAdminSuppliersPage,
  renderAdminSupplierConversationPage,
} from "./pages.js";
import type { Request, Response } from "express";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = parseInt(process.env["PORT"] || "3001", 10);

const BASE_URL = process.env["RAILWAY_PUBLIC_DOMAIN"]
  ? `https://${process.env["RAILWAY_PUBLIC_DOMAIN"]}`
  : process.env["BASE_URL"] || `http://localhost:${PORT}`;

interface CartItem {
  id: string;
  cart_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  currency: string;
  image_url: string | null;
  added_at: string;
}

// Build auth config from environment variables (optional)
function buildAuthConfig(): AuthConfig | undefined {
  const googleId = process.env["GOOGLE_CLIENT_ID"];
  const googleSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const githubId = process.env["GITHUB_CLIENT_ID"];
  const githubSecret = process.env["GITHUB_CLIENT_SECRET"];
  const hasGoogle = googleId && googleSecret;
  const hasGithub = githubId && githubSecret;

  if (!hasGoogle && !hasGithub) return undefined;

  const config: AuthConfig = {
    baseURL: BASE_URL,
    loginPage: `${BASE_URL}/login`,
    trustedOrigins: ["*"],
    socialProviders: {},
  };

  if (hasGoogle) {
    config.socialProviders!.google = {
      clientId: googleId,
      clientSecret: googleSecret,
    };
  }
  if (hasGithub) {
    config.socialProviders!.github = {
      clientId: githubId,
      clientSecret: githubSecret,
    };
  }

  return config;
}

const authConfig = buildAuthConfig();

if (authConfig) {
  console.log(
    `[Auth] Enabled with providers: ${[
      authConfig.socialProviders?.google ? "Google" : "",
      authConfig.socialProviders?.github ? "GitHub" : "",
    ]
      .filter(Boolean)
      .join(", ")}`,
  );
} else {
  console.log(
    "[Auth] Disabled — set GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET to enable",
  );
}

const { app, db, start, auth } = createServerApp(
  (server, db, getSessionId, getUser) => {
    registerB2CTools(server, db, getSessionId, getUser);
  },
  {
    serverName: "Acme Store — Shop, search, and track orders",
    serverVersion: "1.0.0",
    port: PORT,
    auth: authConfig,
    websiteUrl: BASE_URL,
    icons: [
      {
        src: `${BASE_URL}/static/favicon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["any"],
      },
    ],
  },
);

seedB2CData(db);

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use("/static", express.static(join(__dirname, "public")));

// Favicon — serve the branded SVG for both the default /favicon.ico request and /favicon.svg
app.get(["/favicon.ico", "/favicon.svg"], (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.sendFile(join(__dirname, "public", "favicon.svg"));
});

// ── Auth pages ────────────────────────────────────────────────
app.get("/login", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(
    renderLoginPage({
      hasGoogle: !!authConfig?.socialProviders?.google,
      hasGithub: !!authConfig?.socialProviders?.github,
    }),
  );
});

app.get("/api/me", async (req: Request, res: Response) => {
  if (!auth) {
    res.json({ user: null });
    return;
  }
  const user = await getSessionUser(auth, req.headers);
  res.json({ user });
});

app.post("/api/logout", async (req: Request, res: Response) => {
  if (!auth) {
    res.json({ ok: true });
    return;
  }
  try {
    await auth.api.signOut({
      headers: new Headers(req.headers as Record<string, string>),
    });
  } catch {
    /* already signed out */
  }
  res.json({ ok: true });
});

// ── Cart helpers ─────────────────────────────────────────────
async function resolveCartUser(req: Request, res: Response): Promise<string | null> {
  if (!auth) {
    res.status(401).json({ error: "Authentication not configured" });
    return null;
  }
  const user = await getSessionUser(auth, req.headers);
  if (!user) {
    res.status(401).json({ error: "Sign in required", loginUrl: "/login" });
    return null;
  }
  return user.id;
}

function getCartResponse(userId: string) {
  const items = db
    .prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at DESC")
    .all(userId) as CartItem[];
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  return { items, totalItems, totalPrice };
}

// ── Cart API ──────────────────────────────────────────────────
app.post("/api/cart", async (req: Request, res: Response) => {
  const userId = await resolveCartUser(req, res);
  if (!userId) return;
  const { sku, quantity } = req.body;
  if (!sku || typeof sku !== "string") {
    res.status(400).json({ error: "sku is required" });
    return;
  }
  const qty = typeof quantity === "number" && quantity > 0 ? quantity : 1;

  const product = db
    .prepare("SELECT sku, name, price, currency, image_url FROM products WHERE sku = ?")
    .get(sku) as { sku: string; name: string; price: number; currency: string; image_url: string | null } | undefined;

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const existing = db
    .prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND sku = ?")
    .get(userId, sku) as { id: string; quantity: number } | undefined;

  if (existing) {
    db.prepare("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?").run(qty, existing.id);
  } else {
    const { randomUUID } = await import("node:crypto");
    db.prepare(
      "INSERT INTO cart_items (id, cart_id, sku, name, quantity, unit_price, currency, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), userId, product.sku, product.name, qty, product.price, product.currency, product.image_url, userId);
  }

  res.json(getCartResponse(userId));
});

app.get("/api/cart", async (req: Request, res: Response) => {
  const userId = await resolveCartUser(req, res);
  if (!userId) return;
  res.json(getCartResponse(userId));
});

app.patch("/api/cart/item/:itemId", async (req: Request, res: Response) => {
  const userId = await resolveCartUser(req, res);
  if (!userId) return;
  const { quantity } = req.body;
  if (typeof quantity !== "number" || quantity < 0) {
    res.status(400).json({ error: "Invalid quantity" });
    return;
  }
  if (quantity === 0) {
    db.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(
      req.params.itemId, userId,
    );
  } else {
    db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?").run(
      quantity, req.params.itemId, userId,
    );
  }
  res.json(getCartResponse(userId));
});

app.delete("/api/cart/item/:itemId", async (req: Request, res: Response) => {
  const userId = await resolveCartUser(req, res);
  if (!userId) return;
  db.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(
    req.params.itemId, userId,
  );
  res.json(getCartResponse(userId));
});

// ── Cart page ─────────────────────────────────────────────────
app.get("/cart", async (req: Request, res: Response) => {
  if (!auth) {
    res.redirect("/login");
    return;
  }
  const user = await getSessionUser(auth, req.headers);
  if (!user) {
    res.redirect("/login");
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.send(renderCartPage());
});

// ── Products API ─────────────────────────────────────────────
interface ProductRow {
  sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string | null;
  price: number;
  original_price: number | null;
  discount: string | null;
  image_url: string | null;
  stock_status: string;
  rating: number;
  review_count: number;
  badge: string | null;
}

app.get("/api/products", (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 24));
  const category = (req.query.category as string) || null;
  const search = (req.query.search as string) || null;
  const offset = (page - 1) * limit;

  let countSql = "SELECT COUNT(*) as total FROM products WHERE 1=1";
  let dataSql =
    "SELECT sku, name, brand, category, subcategory, price, original_price, discount, image_url, stock_status, rating, review_count, badge FROM products WHERE 1=1";
  const params: unknown[] = [];

  if (category) {
    countSql += " AND category = ?";
    dataSql += " AND category = ?";
    params.push(category);
  }
  if (search) {
    const clause =
      " AND (LOWER(name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(category) LIKE ? OR LOWER(subcategory) LIKE ?)";
    countSql += clause;
    dataSql += clause;
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  dataSql += " ORDER BY category, name LIMIT ? OFFSET ?";

  const totalRow = db.prepare(countSql).get(...params) as { total: number };
  const products = db
    .prepare(dataSql)
    .all(...params, limit, offset) as ProductRow[];

  // Categories are always fetched in full (lightweight query)
  const catRows = db
    .prepare(
      "SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY category",
    )
    .all() as Array<{ category: string; count: number }>;

  res.json({
    products,
    categories: catRows.map((c) => c.category),
    categoryCounts: catRows.reduce(
      (acc, c) => {
        acc[c.category] = c.count;
        return acc;
      },
      {} as Record<string, number>,
    ),
    pagination: {
      page,
      limit,
      total: totalRow.total,
      totalPages: Math.ceil(totalRow.total / limit),
      hasMore: offset + products.length < totalRow.total,
    },
  });
});

// ── Admin Demo API ─────────────────────────────────────────
interface AdminProductRow {
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock_qty: number;
  stock_status: string;
  delivery_estimate: string | null;
  image_url: string | null;
  rating: number;
  review_count: number;
}

interface PerformanceRow {
  sku: string;
  date: string;
  sessions: number;
  product_views: number;
  conversion_rate: number;
  units_sold: number;
  revenue: number;
  stock_qty: number;
}

interface ReorderRow {
  reorder_id: string;
  sku: string;
  quantity: number;
  supplier_name: string;
  supplier_email: string;
  status: string;
  expected_arrival: string | null;
  email_id: string | null;
  created_at: string;
  sent_at: string | null;
}

interface AdminReorderRow extends ReorderRow {
  product_name: string | null;
  image_url: string | null;
  stock_qty: number | null;
  delivery_estimate: string | null;
}

interface EmailRow {
  email_id: string;
  purpose: string;
  related_type: string;
  related_id: string;
  to_email: string;
  from_email: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
}

const ADMIN_DEMO_SKU = "ACM-CSJ-033";
const ADMIN_DEMO_QUERY = "admin=1";

function hasAdminDemoAccess(req: Request): boolean {
  return req.query.admin === "1";
}

function requireAdminDemoAccess(req: Request, res: Response): boolean {
  if (hasAdminDemoAccess(req)) return true;
  res.status(404).send("Not found");
  return false;
}

function adminUrl(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${ADMIN_DEMO_QUERY}`;
}

function getEmailsFor(relatedType: string, relatedId: string): EmailRow[] {
  return db
    .prepare(
      "SELECT * FROM sent_emails WHERE related_type = ? AND related_id = ? ORDER BY created_at ASC",
    )
    .all(relatedType, relatedId) as EmailRow[];
}

function resetBackOfficeDemoState() {
  const reset = db.transaction(() => {
    db.prepare("DELETE FROM supplier_reorders WHERE sku = ?").run(ADMIN_DEMO_SKU);
    db.prepare(
      "DELETE FROM sent_emails WHERE purpose IN ('supplier_reorder', 'customer_support_reply')",
    ).run();
    db.prepare(
      "UPDATE support_tickets SET status = 'open', resolution = NULL, updated_at = ? WHERE ticket_id = ?",
    ).run("2026-07-13T09:15:00.000Z", "TKT-DEMO-ASICS");
    db.prepare("UPDATE products SET delivery_estimate = ? WHERE sku = ?").run(
      "3-7 business days",
      ADMIN_DEMO_SKU,
    );
  });

  reset();

  const ticket = db
    .prepare("SELECT * FROM support_tickets WHERE ticket_id = ?")
    .get("TKT-DEMO-ASICS") as TicketRow | undefined;
  const reorders = db
    .prepare("SELECT * FROM supplier_reorders WHERE sku = ?")
    .all(ADMIN_DEMO_SKU) as ReorderRow[];
  const emails = db
    .prepare(
      "SELECT * FROM sent_emails WHERE purpose IN ('supplier_reorder', 'customer_support_reply') ORDER BY created_at DESC",
    )
    .all() as EmailRow[];

  return {
    reset_at: new Date().toISOString(),
    ticket,
    reorders,
    emails,
  };
}

function getPerformanceRows(sku: string): PerformanceRow[] {
  return db
    .prepare(
      "SELECT * FROM product_performance_daily WHERE sku = ? ORDER BY date ASC",
    )
    .all(sku) as PerformanceRow[];
}

function getAdminProduct(sku: string): AdminProductRow | undefined {
  return db
    .prepare(
      "SELECT sku, name, brand, category, price, stock_qty, stock_status, delivery_estimate, image_url, rating, review_count FROM products WHERE sku = ?",
    )
    .get(sku) as AdminProductRow | undefined;
}

function getLatestReorder(sku: string): ReorderRow | null {
  return (
    (db
      .prepare(
        "SELECT * FROM supplier_reorders WHERE sku = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(sku) as ReorderRow | undefined) || null
  );
}

function calculateProductSignal(sku: string) {
  const product = getAdminProduct(sku);
  if (!product) return null;
  const performance = getPerformanceRows(sku);
  const first = performance[0];
  const latest = performance[performance.length - 1];
  const reorder = getLatestReorder(sku);

  if (!first || !latest) {
    return { product, performance, reorder, metrics: null };
  }

  const conversionDropPct =
    first.conversion_rate > 0
      ? ((first.conversion_rate - latest.conversion_rate) /
          first.conversion_rate) *
        100
      : 0;
  const trafficChangePct =
    first.sessions > 0 ? ((latest.sessions - first.sessions) / first.sessions) * 100 : 0;
  const unitsDropPct =
    first.units_sold > 0
      ? ((first.units_sold - latest.units_sold) / first.units_sold) * 100
      : 0;
  const stockDrop = first.stock_qty - latest.stock_qty;

  return {
    product,
    performance,
    reorder,
    metrics: {
      start_date: first.date,
      end_date: latest.date,
      first_sessions: first.sessions,
      latest_sessions: latest.sessions,
      traffic_change_pct: +trafficChangePct.toFixed(1),
      first_conversion_rate: first.conversion_rate,
      latest_conversion_rate: latest.conversion_rate,
      conversion_drop_pct: +conversionDropPct.toFixed(1),
      first_units_sold: first.units_sold,
      latest_units_sold: latest.units_sold,
      units_drop_pct: +unitsDropPct.toFixed(1),
      first_stock_qty: first.stock_qty,
      latest_stock_qty: latest.stock_qty,
      stock_drop: stockDrop,
    },
  };
}

function getAdminTickets() {
  return db
    .prepare(
      `SELECT t.*, o.items, o.total, o.currency, o.order_date
       FROM support_tickets t
       LEFT JOIN orders o ON o.order_id = t.order_id
       ORDER BY t.created_at DESC`,
    )
    .all() as Array<TicketRow & {
    items: string | null;
    total: number | null;
    currency: string | null;
    order_date: string | null;
  }>;
}

function getAdminTicket(ticketId: string) {
  return db
    .prepare(
      `SELECT t.*, o.items, o.total, o.currency, o.order_date
       FROM support_tickets t
       LEFT JOIN orders o ON o.order_id = t.order_id
       WHERE t.ticket_id = ?`,
    )
    .get(ticketId) as
    | (TicketRow & {
        items: string | null;
        total: number | null;
        currency: string | null;
        order_date: string | null;
      })
    | undefined;
}

function getAdminReorders(): AdminReorderRow[] {
  return db
    .prepare(
      `SELECT r.*, p.name AS product_name, p.image_url, p.stock_qty, p.delivery_estimate
       FROM supplier_reorders r
       LEFT JOIN products p ON p.sku = r.sku
       ORDER BY r.created_at DESC`,
    )
    .all() as AdminReorderRow[];
}

function getAdminReorder(reorderId: string): AdminReorderRow | undefined {
  return db
    .prepare(
      `SELECT r.*, p.name AS product_name, p.image_url, p.stock_qty, p.delivery_estimate
       FROM supplier_reorders r
       LEFT JOIN products p ON p.sku = r.sku
       WHERE r.reorder_id = ?`,
    )
    .get(reorderId) as AdminReorderRow | undefined;
}

function getAttentionReportData() {
  const primary = calculateProductSignal(ADMIN_DEMO_SKU);
  const secondary = calculateProductSignal("ACM-ELEC-018");
  const tickets = getAdminTickets();
  const openTickets = tickets.filter(
    (t) => !["resolved", "closed", "replied"].includes(t.status),
  );

  const flags: Array<Record<string, unknown>> = [];
  if (primary?.metrics) {
    flags.push({
      id: "stock-sales-asics",
      type: "stock_sales",
      severity: "critical",
      title: "ASICS GT-1000 sales are falling while traffic is flat",
      summary:
        "Sessions are essentially flat, but conversion and units sold are dropping as stock falls to 4 units.",
      sku: primary.product.sku,
      product_name: primary.product.name,
      admin_url: adminUrl(`/admin/analytics?sku=${primary.product.sku}`),
      metrics: primary.metrics,
      reorder: primary.reorder,
    });
  }

  const demoTicket = tickets.find((t) => t.ticket_id === "TKT-DEMO-ASICS");
  if (demoTicket) {
    flags.push({
      id: "support-ticket-asics",
      type: "support_ticket",
      severity: demoTicket.status === "replied" ? "handled" : "high",
      title: "New support ticket mentions ASICS restock delay",
      summary: demoTicket.description,
      ticket_id: demoTicket.ticket_id,
      status: demoTicket.status,
      priority: demoTicket.priority,
      admin_url: adminUrl(`/admin/support/${demoTicket.ticket_id}`),
    });
  } else if (openTickets[0]) {
    flags.push({
      id: `support-ticket-${openTickets[0].ticket_id}`,
      type: "support_ticket",
      severity: "high",
      title: `Open support ticket ${openTickets[0].ticket_id}`,
      summary: openTickets[0].description,
      ticket_id: openTickets[0].ticket_id,
      status: openTickets[0].status,
      priority: openTickets[0].priority,
      admin_url: adminUrl(`/admin/support/${openTickets[0].ticket_id}`),
    });
  }

  if (secondary?.metrics) {
    flags.push({
      id: "stock-watch-linksys",
      type: "stock_watch",
      severity: "medium",
      title: "Linksys Hydra 6 is also approaching stockout",
      summary:
        "Conversion is softening and stock is down to 4 units; watch after the ASICS reorder.",
      sku: secondary.product.sku,
      product_name: secondary.product.name,
      admin_url: adminUrl(`/admin/analytics?sku=${secondary.product.sku}`),
      metrics: secondary.metrics,
      reorder: secondary.reorder,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    week: "2026-07-07 to 2026-07-13",
    flags,
    primary,
    open_ticket_count: openTickets.length,
  };
}

app.get("/api/admin/attention", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.json(getAttentionReportData());
});

app.get("/api/admin/products/:sku/performance", (req: Request, res: Response) => {
  if (!requireAdminDemoAccess(req, res)) return;
  const skuParam = req.params.sku;
  const sku = typeof skuParam === "string" ? skuParam : ADMIN_DEMO_SKU;
  const signal = calculateProductSignal(sku);
  if (!signal) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(signal);
});

app.get("/api/admin/support", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  const tickets = getAdminTickets();
  const emails = db
    .prepare(
      "SELECT * FROM sent_emails WHERE related_type = 'support_ticket' ORDER BY created_at DESC",
    )
    .all() as EmailRow[];
  res.json({ tickets, emails });
});

app.get("/api/admin/support/:ticketId", (req: Request, res: Response) => {
  if (!requireAdminDemoAccess(req, res)) return;
  const ticketId = Array.isArray(req.params.ticketId)
    ? req.params.ticketId[0]
    : req.params.ticketId;
  if (!ticketId) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const ticket = getAdminTicket(ticketId);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const emails = getEmailsFor("support_ticket", ticket.ticket_id);
  res.json({ ticket, emails });
});

app.get("/api/admin/reorders", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  const reorders = getAdminReorders();
  res.json({ reorders });
});

app.get("/api/admin/reorders/:reorderId", (req: Request, res: Response) => {
  if (!requireAdminDemoAccess(req, res)) return;
  const reorderId = Array.isArray(req.params.reorderId)
    ? req.params.reorderId[0]
    : req.params.reorderId;
  if (!reorderId) {
    res.status(404).json({ error: "Reorder not found" });
    return;
  }
  const reorder = getAdminReorder(reorderId);
  if (!reorder) {
    res.status(404).json({ error: "Reorder not found" });
    return;
  }
  const emails = getEmailsFor("supplier_reorder", reorder.reorder_id);
  res.json({ reorder, emails });
});

app.get("/api/admin/emails", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  const emails = db
    .prepare("SELECT * FROM sent_emails ORDER BY created_at DESC")
    .all() as EmailRow[];
  res.json({ emails });
});

app.post("/api/admin/reset-demo", (req: Request, res: Response) => {
  if (!requireAdminDemoAccess(req, res)) return;
  res.json(resetBackOfficeDemoState());
});

// ── Checkout API ─────────────────────────────────────────────
interface OrderRow {
  order_id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  delivery_estimate: string | null;
  order_date: string;
  items: string;
  total: number;
  currency: string;
  eligible_for_return: number;
  return_deadline: string | null;
  user_id: string | null;
}

app.post("/api/checkout", async (req: Request, res: Response) => {
  if (!auth) {
    res.status(401).json({ error: "Authentication not configured" });
    return;
  }
  const user = await getSessionUser(auth, req.headers);
  if (!user) {
    res.status(401).json({ error: "Sign in required", loginUrl: "/login" });
    return;
  }

  const cartItems = db
    .prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at DESC")
    .all(user.id) as CartItem[];

  if (cartItems.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const { shipping_address, city, zip, country, phone, payment_method } = req.body;

  const subtotal = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const shipping = subtotal >= 50 ? 0 : 4.99;
  const tax = +(subtotal * 0.21).toFixed(2);
  const total = +(subtotal + shipping + tax).toFixed(2);

  const orderId = `ACM-${new Date().getFullYear()}-${randomUUID().substring(0, 5).toUpperCase()}`;
  const orderItems = cartItems.map((i) => ({
    sku: i.sku,
    name: i.name,
    quantity: i.quantity,
    price: i.unit_price,
    image_url: i.image_url,
  }));

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 3);

  // Simulate payment processing delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  db.prepare(
    `INSERT INTO orders (order_id, status, delivery_estimate, order_date, items, total, currency, eligible_for_return, return_deadline, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    orderId,
    "processing",
    deliveryDate.toISOString().split("T")[0],
    new Date().toISOString().split("T")[0],
    JSON.stringify(orderItems),
    total,
    "USD",
    1,
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    user.id,
  );

  db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(user.id);

  res.json({
    order_id: orderId,
    status: "processing",
    total,
    subtotal,
    shipping,
    tax,
    items: orderItems,
    delivery_estimate: deliveryDate.toISOString().split("T")[0],
    shipping_address: `${shipping_address}, ${city} ${zip}, ${country}`,
    payment_method: payment_method || "credit_card",
    user: { name: user.name, email: user.email },
  });
});

// ── Orders API ───────────────────────────────────────────────
app.get("/api/orders", async (req: Request, res: Response) => {
  if (!auth) {
    res.status(401).json({ error: "Authentication not configured" });
    return;
  }
  const user = await getSessionUser(auth, req.headers);
  if (!user) {
    res.status(401).json({ error: "Sign in required", loginUrl: "/login" });
    return;
  }

  const orders = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC")
    .all(user.id) as OrderRow[];

  const parsed = orders.map((o) => ({
    ...o,
    items: JSON.parse(o.items),
    eligible_for_return: !!o.eligible_for_return,
  }));

  res.json({ orders: parsed });
});

app.get("/api/orders/:orderId", async (req: Request, res: Response) => {
  if (!auth) {
    res.status(401).json({ error: "Authentication not configured" });
    return;
  }
  const user = await getSessionUser(auth, req.headers);
  if (!user) {
    res.status(401).json({ error: "Sign in required", loginUrl: "/login" });
    return;
  }

  const order = db
    .prepare("SELECT * FROM orders WHERE order_id = ? AND user_id = ?")
    .get(req.params.orderId, user.id) as OrderRow | undefined;

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({
    ...order,
    items: JSON.parse(order.items),
    eligible_for_return: !!order.eligible_for_return,
  });
});

app.delete("/api/orders/:orderId", async (req: Request, res: Response) => {
  if (!auth) {
    res.status(401).json({ error: "Authentication not configured" });
    return;
  }
  const user = await getSessionUser(auth, req.headers);
  if (!user) {
    res.status(401).json({ error: "Sign in required", loginUrl: "/login" });
    return;
  }

  const order = db
    .prepare("SELECT order_id FROM orders WHERE order_id = ? AND user_id = ?")
    .get(req.params.orderId, user.id) as { order_id: string } | undefined;

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // Remove the order and any rows that reference it, so nothing is orphaned.
  const removeOrder = db.transaction((orderId: string, userId: string) => {
    db.prepare("DELETE FROM returns WHERE order_id = ? AND user_id = ?").run(orderId, userId);
    db.prepare("DELETE FROM support_tickets WHERE order_id = ? AND user_id = ?").run(orderId, userId);
    db.prepare("DELETE FROM orders WHERE order_id = ? AND user_id = ?").run(orderId, userId);
  });
  removeOrder(order.order_id, user.id);

  res.json({ success: true, order_id: order.order_id });
});

// ── Checkout page ────────────────────────────────────────────
app.get("/checkout", async (req: Request, res: Response) => {
  if (!auth) { res.redirect("/login"); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.redirect("/login"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(renderCheckoutPage());
});

// ── Orders pages ─────────────────────────────────────────────
app.get("/orders", async (req: Request, res: Response) => {
  if (!auth) { res.redirect("/login"); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.redirect("/login"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(renderOrdersPage());
});

app.get("/orders/:orderId", async (req: Request, res: Response) => {
  if (!auth) { res.redirect("/login"); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.redirect("/login"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(renderOrderDetailPage());
});

// ── Support Tickets API ──────────────────────────────────────
interface TicketRow {
  ticket_id: string;
  order_id: string;
  issue_type: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolution: string | null;
  session_id: string | null;
  user_id: string | null;
}

app.get("/api/tickets", async (req: Request, res: Response) => {
  if (!auth) { res.status(401).json({ error: "Authentication not configured" }); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.status(401).json({ error: "Sign in required", loginUrl: "/login" }); return; }

  const tickets = db
    .prepare("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id) as TicketRow[];

  res.json({ tickets });
});

app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  if (!auth) { res.status(401).json({ error: "Authentication not configured" }); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.status(401).json({ error: "Sign in required", loginUrl: "/login" }); return; }

  const ticket = db
    .prepare("SELECT * FROM support_tickets WHERE ticket_id = ? AND user_id = ?")
    .get(req.params.ticketId, user.id) as TicketRow | undefined;

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  // Fetch the related order
  const order = db
    .prepare("SELECT order_id, status, order_date, total, currency FROM orders WHERE order_id = ?")
    .get(ticket.order_id) as { order_id: string; status: string; order_date: string; total: number; currency: string } | undefined;

  res.json({ ...ticket, order: order || null });
});

app.delete("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  if (!auth) { res.status(401).json({ error: "Authentication not configured" }); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.status(401).json({ error: "Sign in required", loginUrl: "/login" }); return; }

  const ticket = db
    .prepare("SELECT ticket_id FROM support_tickets WHERE ticket_id = ? AND user_id = ?")
    .get(req.params.ticketId, user.id) as { ticket_id: string } | undefined;

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  db.prepare("DELETE FROM support_tickets WHERE ticket_id = ? AND user_id = ?").run(ticket.ticket_id, user.id);

  res.json({ success: true, ticket_id: ticket.ticket_id });
});

app.post("/api/tickets", async (req: Request, res: Response) => {
  if (!auth) { res.status(401).json({ error: "Authentication not configured" }); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.status(401).json({ error: "Sign in required", loginUrl: "/login" }); return; }

  const { order_id, issue_type, description } = req.body;
  if (!order_id || !issue_type || !description) {
    res.status(400).json({ error: "order_id, issue_type, and description are required" });
    return;
  }

  const order = db.prepare("SELECT * FROM orders WHERE order_id = ? AND user_id = ?")
    .get(order_id, user.id) as OrderRow | undefined;
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const priority = (issue_type === "damaged" || issue_type === "missing_item") ? "high" : "normal";
  const ticketId = `TKT-${randomUUID().substring(0, 8).toUpperCase()}`;

  db.prepare(
    "INSERT INTO support_tickets (ticket_id, order_id, issue_type, description, status, priority, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(ticketId, order_id, issue_type, description, "open", priority, user.id);

  res.json({
    ticket_id: ticketId,
    order_id,
    issue_type,
    description,
    status: "open",
    priority,
    url: `/support/${ticketId}`,
  });
});

// ── Support pages ────────────────────────────────────────────
app.get("/support", async (req: Request, res: Response) => {
  if (!auth) { res.redirect("/login"); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.redirect("/login"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(renderTicketsPage());
});

app.get("/support/:ticketId", async (req: Request, res: Response) => {
  if (!auth) { res.redirect("/login"); return; }
  const user = await getSessionUser(auth, req.headers);
  if (!user) { res.redirect("/login"); return; }
  res.setHeader("Content-Type", "text/html");
  res.send(renderTicketDetailPage());
});

// ── Admin demo pages ────────────────────────────────────────
app.get("/admin", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.setHeader("Content-Type", "text/html");
  res.send(renderAdminDashboardPage());
});

app.get("/admin/analytics", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.setHeader("Content-Type", "text/html");
  res.send(renderAdminAnalyticsPage());
});

app.get("/admin/support", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.setHeader("Content-Type", "text/html");
  res.send(renderAdminSupportPage());
});

app.get("/admin/support/:ticketId", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.setHeader("Content-Type", "text/html");
  res.send(renderAdminSupportTicketPage());
});

app.get("/admin/suppliers", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.setHeader("Content-Type", "text/html");
  res.send(renderAdminSuppliersPage());
});

app.get("/admin/suppliers/:reorderId", (_req: Request, res: Response) => {
  if (!requireAdminDemoAccess(_req, res)) return;
  res.setHeader("Content-Type", "text/html");
  res.send(renderAdminSupplierConversationPage());
});

// ── Product Detail API ───────────────────────────────────────
app.get("/api/products/:sku", (req: Request, res: Response) => {
  const product = db
    .prepare("SELECT * FROM products WHERE sku = ?")
    .get(req.params.sku) as Record<string, unknown> | undefined;

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Parse JSON fields
  for (const key of ["features", "frequently_bought_together", "images", "variations"]) {
    if (product[key] && typeof product[key] === "string") {
      try {
        product[key] = JSON.parse(product[key] as string);
      } catch { /* keep as string */ }
    }
  }

  // Fetch FBT products
  let fbtProducts: Record<string, unknown>[] = [];
  if (Array.isArray(product.frequently_bought_together) && (product.frequently_bought_together as string[]).length > 0) {
    const fbtSkus = product.frequently_bought_together as string[];
    const placeholders = fbtSkus.map(() => "?").join(",");
    fbtProducts = db
      .prepare(
        `SELECT sku, name, brand, price, original_price, discount, image_url, rating, review_count, stock_status FROM products WHERE sku IN (${placeholders})`,
      )
      .all(...fbtSkus) as Record<string, unknown>[];
  }

  // Fetch reviews
  const reviews = db
    .prepare("SELECT * FROM reviews WHERE sku = ? ORDER BY created_at DESC LIMIT 10")
    .all(req.params.sku);

  res.json({ product, fbtProducts, reviews });
});

// ── Product Detail Page ──────────────────────────────────────
app.get("/product/:sku", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(renderProductDetailPage());
});

// ── Homepage (Products page) ─────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(renderProductsPage());
});

start();
