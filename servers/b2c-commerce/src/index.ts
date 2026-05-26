import { createServerApp, getSessionUser } from "@mcp-demos/shared";
import type { AuthConfig } from "@mcp-demos/shared";
import { seedB2CData } from "./data/seed.js";
import { registerB2CTools } from "./tools.js";
import {
  renderCartPage,
  renderLoginPage,
  renderProductsPage,
  renderCheckoutPage,
  renderOrdersPage,
  renderOrderDetailPage,
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
  color: string | null;
  size: string | null;
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
  },
);

seedB2CData(db);

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use("/static", express.static(join(__dirname, "public")));

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
  image_url: string | null;
  stock_status: string;
  rating: number;
  review_count: number;
}

app.get("/api/products", (_req: Request, res: Response) => {
  const products = db
    .prepare(
      "SELECT sku, name, brand, category, subcategory, price, image_url, stock_status, rating, review_count FROM products ORDER BY category, name",
    )
    .all() as ProductRow[];

  const categorySet = new Set<string>();
  for (const p of products) {
    categorySet.add(p.category);
  }
  const categories = Array.from(categorySet).sort();

  res.json({ products, categories });
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
    color: i.color,
    size: i.size,
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
    "EUR",
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

// ── Homepage (Products page) ─────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(renderProductsPage());
});

start();
