import { App } from "@modelcontextprotocol/ext-apps";

interface ProductData {
  sku: string;
  name: string;
  brand: string;
  price: number;
  color: string;
  size: string | null;
  image_url: string;
  rating: number;
  review_count: number;
  stock_status: string;
  delivery_estimate: string;
  description?: string;
  material?: string;
  weight_grams?: number;
  specs?: Record<string, string>;
}

interface CartItemData {
  name: string;
  sku: string;
  color: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  image_url?: string;
}

interface StoreViewData {
  viewType: "product-grid" | "product-detail" | "cart";
  title: string;
  products?: ProductData[];
  product?: ProductData;
  cartItems?: CartItemData[];
  cartTotal?: number;
}

const appEl = document.getElementById("app")!;

const app = new App({ name: "Acme Store App", version: "1.0.0" });
app.connect();

app.ontoolresult = (result) => {
  const data = result.structuredContent as StoreViewData | undefined;
  if (!data?.viewType) {
    appEl.innerHTML = "<p>No visual data available.</p>";
    return;
  }
  render(data);
};

function render(data: StoreViewData) {
  switch (data.viewType) {
    case "product-grid":
      renderProductGrid(data.title, data.products ?? []);
      break;
    case "product-detail":
      if (data.product) renderProductDetail(data.product);
      break;
    case "cart":
      renderCart(data.cartItems ?? [], data.cartTotal ?? 0);
      break;
  }
}

function stockBadge(status: string): string {
  const cls =
    status === "in_stock"
      ? "badge-stock"
      : status === "low_stock"
        ? "badge-low"
        : "badge-out";
  const label =
    status === "in_stock"
      ? "In Stock"
      : status === "low_stock"
        ? "Low Stock"
        : "Out of Stock";
  return `<span class="badge ${cls}">${label}</span>`;
}

function stars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return `<span class="stars">${"★".repeat(full)}${half ? "½" : ""}${"☆".repeat(empty)} ${rating}</span>`;
}

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function imgWithFallback(url: string, alt: string, cls: string): string {
  return `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.outerHTML='<div class=\\'${cls} placeholder\\'>🛍️</div>'" />`;
}

function renderProductGrid(title: string, products: ProductData[]) {
  const cards = products
    .map(
      (p) => `
    <div class="card">
      ${imgWithFallback(p.image_url, p.name, "card-img")}
      <div class="card-body">
        <div class="card-title">${esc(p.name)}</div>
        <div class="card-brand">${esc(p.brand)} · ${esc(p.color)}</div>
        <div class="card-price">€${p.price.toFixed(2)}</div>
        <div class="card-meta">
          ${stars(p.rating)} <span>(${p.review_count})</span>
          ${stockBadge(p.stock_status)}
        </div>
        <div class="card-meta">📦 ${esc(p.delivery_estimate)}</div>
        <div class="sku">${esc(p.sku)}</div>
      </div>
    </div>`,
    )
    .join("");

  appEl.innerHTML = `<h2>${esc(title)}</h2><div class="grid">${cards}</div>`;
}

function renderProductDetail(p: ProductData) {
  const specsHtml = p.specs
    ? `<table class="specs-table">${Object.entries(p.specs)
        .map(([k, v]) => `<tr><td class="spec-key">${esc(k)}</td><td>${esc(v)}</td></tr>`)
        .join("")}</table>`
    : "";

  appEl.innerHTML = `
    <div class="detail">
      ${imgWithFallback(p.image_url, p.name, "detail-img")}
      <div class="detail-info">
        <div class="detail-name">${esc(p.name)}</div>
        <div class="detail-brand">${esc(p.brand)} · ${esc(p.color)}${p.size ? ` · Size ${esc(p.size)}` : ""}</div>
        <div class="detail-price">€${p.price.toFixed(2)}</div>
        <div class="detail-meta">${stars(p.rating)} (${p.review_count} reviews) ${stockBadge(p.stock_status)}</div>
        <div class="detail-meta">📦 ${esc(p.delivery_estimate)}</div>
        ${p.description ? `<div class="detail-desc">${esc(p.description)}</div>` : ""}
        ${p.material ? `<div class="detail-meta">Material: ${esc(p.material)}</div>` : ""}
        ${p.weight_grams ? `<div class="detail-meta">Weight: ${p.weight_grams}g</div>` : ""}
        ${specsHtml}
        <div class="sku" style="margin-top:12px">${esc(p.sku)}</div>
      </div>
    </div>`;
}

function renderCart(items: CartItemData[], total: number) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const rows = items
    .map(
      (i) => `
    <div class="cart-item">
      ${i.image_url ? imgWithFallback(i.image_url, i.name, "cart-img") : '<div class="cart-placeholder">🛍️</div>'}
      <div class="cart-info">
        <div class="cart-name">${esc(i.name)}</div>
        <div class="cart-variant">${esc(i.color)}${i.size ? ` · Size ${esc(i.size)}` : ""}</div>
        <div class="sku">${esc(i.sku)}</div>
      </div>
      <div class="cart-qty">×${i.quantity}</div>
      <div class="cart-price">€${(i.unit_price * i.quantity).toFixed(2)}</div>
    </div>`,
    )
    .join("");

  appEl.innerHTML = `
    <h2>🛒 Your Cart</h2>
    ${rows}
    <div class="cart-total">
      <span>Total (${totalQty} items)</span>
      <span class="cart-total-price">€${total.toFixed(2)}</span>
    </div>`;
}

// Inject styles
const style = document.createElement("style");
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a2e; padding: 16px; }
  h2 { font-size: 18px; font-weight: 600; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: box-shadow 0.2s; }
  .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
  .card-img { width: 100%; height: 180px; object-fit: cover; background: #eee; display: block; }
  .card-img.placeholder { display: flex; align-items: center; justify-content: center; font-size: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  .card-body { padding: 12px 14px; }
  .card-title { font-size: 14px; font-weight: 600; line-height: 1.3; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-brand { font-size: 12px; color: #666; margin-bottom: 6px; }
  .card-price { font-size: 16px; font-weight: 700; color: #16a34a; }
  .card-meta { font-size: 11px; color: #888; margin-top: 6px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .stars { color: #f59e0b; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
  .badge-stock { background: #dcfce7; color: #166534; }
  .badge-low { background: #fef3c7; color: #92400e; }
  .badge-out { background: #fee2e2; color: #991b1b; }
  .sku { font-size: 10px; color: #aaa; font-family: monospace; }
  .detail { display: flex; gap: 24px; flex-wrap: wrap; }
  .detail-img { flex: 0 0 320px; max-width: 100%; height: auto; border-radius: 12px; object-fit: cover; background: #eee; }
  .detail-info { flex: 1; min-width: 240px; }
  .detail-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .detail-brand { font-size: 14px; color: #666; margin-bottom: 12px; }
  .detail-price { font-size: 24px; font-weight: 700; color: #16a34a; margin-bottom: 12px; }
  .detail-desc { font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 16px; }
  .detail-meta { font-size: 13px; color: #555; margin-bottom: 8px; }
  .specs-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  .specs-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .spec-key { font-weight: 600; color: #444; width: 40%; }
  .cart-item { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
  .cart-img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; }
  .cart-placeholder { width: 56px; height: 56px; border-radius: 8px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .cart-info { flex: 1; }
  .cart-name { font-size: 14px; font-weight: 600; }
  .cart-variant { font-size: 12px; color: #666; }
  .cart-qty { font-size: 14px; color: #666; min-width: 30px; text-align: center; }
  .cart-price { font-size: 15px; font-weight: 700; color: #16a34a; min-width: 70px; text-align: right; }
  .cart-total { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #fff; border-radius: 10px; margin-top: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .cart-total-price { color: #16a34a; }
`;
document.head.appendChild(style);
