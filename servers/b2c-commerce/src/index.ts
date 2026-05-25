import { createServerApp } from "@mcp-demos/shared";
import { seedB2CData } from "./data/seed.js";
import { registerB2CTools } from "./tools.js";
import { renderCartPage } from "./pages.js";
import type { Request, Response } from "express";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PORT = parseInt(process.env["PORT"] || "3001", 10);

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

const { app, db, start } = createServerApp(
  (server, db, getSessionId) => {
    registerB2CTools(server, db, getSessionId);
  },
  {
    serverName: "Acme Store — Shop, search, and track orders",
    serverVersion: "1.0.0",
    port: PORT,
  },
);

seedB2CData(db);

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use("/static", express.static(join(__dirname, "public")));

app.get("/api/cart/:cartId", (req: Request, res: Response) => {
  const items = db
    .prepare(
      "SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at DESC",
    )
    .all(req.params.cartId) as CartItem[];
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  res.json({ items, totalItems, totalPrice });
});

app.patch("/api/cart/:cartId/item/:itemId", (req: Request, res: Response) => {
  const { quantity } = req.body;
  if (typeof quantity !== "number" || quantity < 0) {
    res.status(400).json({ error: "Invalid quantity" });
    return;
  }
  if (quantity === 0) {
    db.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(
      req.params.itemId,
      req.params.cartId,
    );
  } else {
    db.prepare(
      "UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?",
    ).run(quantity, req.params.itemId, req.params.cartId);
  }
  const items = db
    .prepare(
      "SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at DESC",
    )
    .all(req.params.cartId) as CartItem[];
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  res.json({ items, totalItems, totalPrice });
});

app.delete("/api/cart/:cartId/item/:itemId", (req: Request, res: Response) => {
  db.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(
    req.params.itemId,
    req.params.cartId,
  );
  const items = db
    .prepare(
      "SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at DESC",
    )
    .all(req.params.cartId) as CartItem[];
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  res.json({ items, totalItems, totalPrice });
});

app.get("/cart/:cartId", (req: Request<{ cartId: string }>, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(renderCartPage(req.params.cartId));
});

start();
