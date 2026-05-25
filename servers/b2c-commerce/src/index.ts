import { createServerApp } from "@mcp-demos/shared";
import { seedB2CData } from "./data/seed.js";
import { registerB2CTools } from "./tools.js";
import type { Request, Response } from "express";

const PORT = parseInt(process.env["PORT"] || "3001", 10);

interface CartItem {
  id: string;
  cart_id: string;
  sku: string;
  name: string;
  color: string | null;
  size: number | null;
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
    serverName: "Acme Sports — Shop, search, and track orders",
    serverVersion: "1.0.0",
    port: PORT,
  },
);

seedB2CData(db);

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

app.get("/cart/:cartId", (req: Request, res: Response) => {
  const { cartId } = req.params;

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Cart — Acme Sports</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f7; color: #1d1d1f; }
    .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 24px 0; text-align: center; }
    .header h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: #a0a0b0; font-size: 14px; margin-top: 4px; }
    .container { max-width: 860px; margin: 30px auto; padding: 0 20px; }
    .cart-card { background: white; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); overflow: hidden; }
    .item-row { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; gap: 16px; transition: background 0.2s; }
    .item-row:hover { background: #fafbff; }
    .item-img { width: 80px; height: 80px; object-fit: cover; border-radius: 12px; flex-shrink: 0; background: #f0f0f0; }
    .item-info { flex: 1; min-width: 0; }
    .item-name { font-weight: 600; font-size: 15px; margin-bottom: 2px; }
    .item-meta { color: #888; font-size: 13px; }
    .item-price { text-align: right; min-width: 90px; }
    .item-unit { color: #888; font-size: 13px; }
    .item-subtotal { font-weight: 700; font-size: 16px; }
    .qty-control { display: flex; align-items: center; gap: 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
    .qty-btn { width: 34px; height: 34px; border: none; background: #f5f5f7; cursor: pointer; font-size: 18px; color: #333; transition: background 0.15s; display: flex; align-items: center; justify-content: center; }
    .qty-btn:hover { background: #e8e8ed; }
    .qty-btn:active { background: #d5d5db; }
    .qty-val { width: 40px; height: 34px; text-align: center; font-size: 15px; font-weight: 600; border: none; background: white; border-left: 1px solid #ddd; border-right: 1px solid #ddd; }
    .remove-btn { background: none; border: none; color: #ff3b30; cursor: pointer; font-size: 13px; margin-top: 6px; padding: 2px 0; }
    .remove-btn:hover { text-decoration: underline; }
    .summary { padding: 24px; background: #fafafa; border-top: 2px solid #eee; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .total { font-size: 24px; font-weight: 700; }
    .count { color: #666; font-size: 14px; }
    .checkout-btn { background: linear-gradient(135deg, #0071e3, #005bb5); color: white; border: none; padding: 14px 44px; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.1s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(0,113,227,0.3); }
    .checkout-btn:hover { transform: scale(1.02); box-shadow: 0 4px 14px rgba(0,113,227,0.4); }
    .empty { text-align: center; padding: 80px 20px; }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .empty h2 { font-size: 20px; margin-bottom: 8px; color: #333; }
    .empty p { color: #888; }
    .refreshing { opacity: 0.6; pointer-events: none; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #1d1d1f; color: white; padding: 12px 20px; border-radius: 10px; font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 100; }
    .toast.show { opacity: 1; }
    .demo-banner { background: linear-gradient(135deg, #fff3cd, #fff8e1); border: 1px solid #ffca28; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 12px; }
    .demo-banner-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
    .demo-banner h3 { font-size: 14px; font-weight: 700; color: #8d6e00; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .demo-banner p { font-size: 13px; color: #6d5600; line-height: 1.5; }
    @media (max-width: 600px) {
      .item-row { flex-wrap: wrap; }
      .item-price { width: 100%; text-align: left; display: flex; justify-content: space-between; margin-top: 8px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Acme Sports</h1>
    <p>Your Shopping Cart</p>
  </div>
  <div class="container">
    <div class="demo-banner">
      <div class="demo-banner-icon">⚠️</div>
      <div>
        <h3>Demo Mode</h3>
        <p>This is a demo store. All products and cart items are stored per session only — they will be lost when the session ends or the server restarts. Nothing is broken in the MCP server.</p>
      </div>
    </div>
    <div id="cart" class="cart-card">
      <div class="empty"><div class="empty-icon">⏳</div><h2>Loading cart...</h2></div>
    </div>
  </div>
  <div id="toast" class="toast"></div>

  <script>
    const CART_ID = '${cartId}';
    const API = '/api/cart/' + CART_ID;

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }

    function renderCart(data) {
      const el = document.getElementById('cart');
      if (!data.items.length) {
        el.innerHTML = '<div class="empty"><div class="empty-icon">🛒</div><h2>Your cart is empty</h2><p>Add items through your AI assistant to see them here.</p></div>';
        return;
      }
      const rows = data.items.map(item => {
        const sub = (item.unit_price * item.quantity).toFixed(2);
        const img = item.image_url ? '<img class="item-img" src="' + item.image_url + '" alt="' + item.name + '">' : '<div class="item-img"></div>';
        const sizeTxt = item.size ? ' · Size ' + item.size : '';
        return '<div class="item-row" data-id="' + item.id + '">'
          + img
          + '<div class="item-info">'
          + '  <div class="item-name">' + item.name + '</div>'
          + '  <div class="item-meta">SKU: ' + item.sku + '</div>'
          + '  <div class="item-meta">' + (item.color || '') + sizeTxt + '</div>'
          + '  <button class="remove-btn" onclick="removeItem(\\'' + item.id + '\\')">Remove</button>'
          + '</div>'
          + '<div class="qty-control">'
          + '  <button class="qty-btn" onclick="updateQty(\\'' + item.id + '\\',' + (item.quantity - 1) + ')">−</button>'
          + '  <input class="qty-val" value="' + item.quantity + '" readonly>'
          + '  <button class="qty-btn" onclick="updateQty(\\'' + item.id + '\\',' + (item.quantity + 1) + ')">+</button>'
          + '</div>'
          + '<div class="item-price">'
          + '  <div class="item-unit">€' + item.unit_price.toFixed(2) + ' each</div>'
          + '  <div class="item-subtotal">€' + sub + '</div>'
          + '</div>'
          + '</div>';
      }).join('');

      el.innerHTML = rows
        + '<div class="summary">'
        + '  <div><span class="count">' + data.totalItems + ' item' + (data.totalItems !== 1 ? 's' : '') + ' in cart</span>'
        + '  <div class="total">€' + data.totalPrice.toFixed(2) + '</div></div>'
        + '  <button class="checkout-btn" onclick="alert(\\'This is a demo — checkout would happen here!\\')">Proceed to Checkout</button>'
        + '</div>';
    }

    async function loadCart() {
      const res = await fetch(API);
      const data = await res.json();
      renderCart(data);
    }

    async function updateQty(itemId, qty) {
      document.getElementById('cart').classList.add('refreshing');
      if (qty <= 0) {
        await removeItem(itemId);
        return;
      }
      const res = await fetch(API + '/item/' + itemId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty })
      });
      const data = await res.json();
      renderCart(data);
      document.getElementById('cart').classList.remove('refreshing');
      showToast('Cart updated');
    }

    async function removeItem(itemId) {
      document.getElementById('cart').classList.add('refreshing');
      const res = await fetch(API + '/item/' + itemId, { method: 'DELETE' });
      const data = await res.json();
      renderCart(data);
      document.getElementById('cart').classList.remove('refreshing');
      showToast('Item removed');
    }

    loadCart();
    setInterval(loadCart, 5000);
  </script>
</body>
</html>`);
});

start();
