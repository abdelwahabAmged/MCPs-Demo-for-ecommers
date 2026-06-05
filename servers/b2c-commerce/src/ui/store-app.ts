import { App } from "@modelcontextprotocol/ext-apps";

interface ProductData {
  sku: string;
  name: string;
  brand: string;
  price: number;
  original_price?: number | null;
  discount?: string | null;
  image_url: string;
  rating: number;
  review_count: number;
  stock_status: string;
  delivery_estimate: string;
  description?: string;
  weight?: string;
  dimensions?: string;
}

interface CartItemData {
  name: string;
  sku: string;
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

const selectedSkus = new Set<string>();
let currentProducts: ProductData[] = [];
let currentTitle = "";

const app = new App({ name: "Acme Store App", version: "1.0.0" });
app.connect();

app.ontoolresult = (result) => {
  const data = result.structuredContent as StoreViewData | undefined;
  if (!data?.viewType) {
    appEl.innerHTML = "<p>No visual data available.</p>";
    return;
  }
  selectedSkus.clear();
  render(data);
};

function render(data: StoreViewData) {
  switch (data.viewType) {
    case "product-grid":
      currentProducts = data.products ?? [];
      currentTitle = data.title;
      renderProductGrid(currentTitle, currentProducts);
      break;
    case "product-detail":
      if (data.product) renderProductDetail(data.product);
      break;
    case "cart":
      renderCart(data.cartItems ?? [], data.cartTotal ?? 0);
      break;
  }
}

function toggleSelect(sku: string) {
  if (selectedSkus.has(sku)) selectedSkus.delete(sku);
  else selectedSkus.add(sku);
  renderProductGrid(currentTitle, currentProducts);
}

function showCompare() {
  const selected = currentProducts.filter((p) => selectedSkus.has(p.sku));
  if (selected.length < 2) return;
  renderCompareView(selected);
}

function backToGrid() {
  renderProductGrid(currentTitle, currentProducts);
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
  const count = selectedSkus.size;
  const cards = products
    .map(
      (p) => `
    <div class="card ${selectedSkus.has(p.sku) ? "card-selected" : ""}" data-sku="${esc(p.sku)}">
      <div class="card-check">${selectedSkus.has(p.sku) ? "✓" : ""}</div>
      ${imgWithFallback(p.image_url, p.name, "card-img")}
      <div class="card-body">
        <div class="card-title">${esc(p.name)}</div>
        <div class="card-brand">${esc(p.brand)}</div>
        <div class="card-price">$${p.price.toFixed(2)}${p.original_price ? ` <span class="price-original">$${p.original_price.toFixed(2)}</span>` : ""}${p.discount ? ` <span class="badge-discount">${esc(p.discount)}</span>` : ""}</div>
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

  const actionBar = count > 0
    ? `<div class="action-bar">
        <span class="action-count">${count} selected</span>
        <div class="action-buttons">
          <button class="btn btn-compare" ${count < 2 ? "disabled" : ""} id="compare-btn">Compare</button>
          <button class="btn btn-cart" id="cart-btn">Add to Cart</button>
        </div>
      </div>`
    : "";

  appEl.innerHTML = `<h2>${esc(title)}</h2><div class="grid" style="padding-bottom:${count > 0 ? "72px" : "0"}">${cards}</div>${actionBar}`;

  appEl.querySelectorAll<HTMLElement>(".card[data-sku]").forEach((el) => {
    el.addEventListener("click", () => {
      const sku = el.dataset.sku;
      if (sku) toggleSelect(sku);
    });
  });

  document.getElementById("compare-btn")?.addEventListener("click", showCompare);
  document.getElementById("cart-btn")?.addEventListener("click", addSelectedToCart);
}

async function addSelectedToCart() {
  const btn = document.getElementById("cart-btn") as HTMLButtonElement | null;
  if (!btn || btn.disabled) return;

  const skus = [...selectedSkus];
  btn.disabled = true;
  btn.textContent = "Adding...";

  let success = 0;
  let failed = 0;

  for (const sku of skus) {
    try {
      const result = await app.callServerTool({ name: "add_to_cart", arguments: { sku, quantity: 1 } });
      const text = result.content?.find((c: { type: string }) => c.type === "text") as { text?: string } | undefined;
      if (text?.text?.includes("not found") || text?.text?.includes("out of stock")) {
        failed++;
      } else {
        success++;
      }
    } catch {
      failed++;
    }
  }

  btn.disabled = false;
  btn.textContent = "Add to Cart";

  if (failed === 0) {
    showToast(`✓ ${success} item${success > 1 ? "s" : ""} added to cart`, "success");
  } else if (success > 0) {
    showToast(`${success} added, ${failed} couldn't be added`, "warning");
  } else {
    showToast(`Failed to add items to cart`, "error");
  }
}

function showToast(message: string, type: "success" | "warning" | "error") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === "success" ? "✓" : type === "warning" ? "⚠" : "✕"}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3000);
}

function renderCompareView(products: ProductData[]) {
  const headerCells = products
    .map((p) => `
      <th class="cmp-header">
        ${imgWithFallback(p.image_url, p.name, "cmp-img")}
        <div class="cmp-name">${esc(p.name)}</div>
        <div class="cmp-brand">${esc(p.brand)}</div>
        <div class="cmp-price">$${p.price.toFixed(2)}</div>
      </th>`)
    .join("");

  const row = (label: string, cells: string[]) =>
    `<tr><td class="cmp-label">${esc(label)}</td>${cells.map((c) => `<td class="cmp-cell">${c}</td>`).join("")}</tr>`;

  const rows = [
    row("Rating", products.map((p) => `${stars(p.rating)} (${p.review_count})`)),
    row("Stock", products.map((p) => stockBadge(p.stock_status))),
    row("Delivery", products.map((p) => esc(p.delivery_estimate))),
    ...(products.some((p) => p.weight) ? [row("Weight", products.map((p) => p.weight ? esc(p.weight) : "—"))] : []),
    ...(products.some((p) => p.dimensions) ? [row("Dimensions", products.map((p) => p.dimensions ? esc(p.dimensions) : "—"))] : []),
    ...(products.some((p) => p.discount) ? [row("Discount", products.map((p) => p.discount ? esc(p.discount) : "—"))] : []),
  ].join("");

  appEl.innerHTML = `
    <div class="cmp-top">
      <button class="btn btn-back" id="back-btn">← Back to results</button>
      <h2>Comparing ${products.length} Products</h2>
    </div>
    <div class="cmp-scroll">
      <table class="cmp-table">
        <thead><tr><th class="cmp-label"></th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.getElementById("back-btn")?.addEventListener("click", backToGrid);
}

function renderProductDetail(p: ProductData) {
  const priceHtml = p.original_price
    ? `<div class="detail-price">$${p.price.toFixed(2)} <span class="price-original">$${p.original_price.toFixed(2)}</span>${p.discount ? ` <span class="badge-discount">${esc(p.discount)}</span>` : ""}</div>`
    : `<div class="detail-price">$${p.price.toFixed(2)}</div>`;

  appEl.innerHTML = `
    <div class="detail">
      ${imgWithFallback(p.image_url, p.name, "detail-img")}
      <div class="detail-info">
        <div class="detail-name">${esc(p.name)}</div>
        <div class="detail-brand">${esc(p.brand)}</div>
        ${priceHtml}
        <div class="detail-meta">${stars(p.rating)} (${p.review_count} reviews) ${stockBadge(p.stock_status)}</div>
        <div class="detail-meta">📦 ${esc(p.delivery_estimate)}</div>
        ${p.description ? `<div class="detail-desc">${esc(p.description)}</div>` : ""}
        ${p.weight ? `<div class="detail-meta">Weight: ${esc(p.weight)}</div>` : ""}
        ${p.dimensions ? `<div class="detail-meta">Dimensions: ${esc(p.dimensions)}</div>` : ""}
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
        <div class="sku">${esc(i.sku)}</div>
      </div>
      <div class="cart-qty">×${i.quantity}</div>
      <div class="cart-price">$${(i.unit_price * i.quantity).toFixed(2)}</div>
    </div>`,
    )
    .join("");

  appEl.innerHTML = `
    <h2>🛒 Your Cart</h2>
    ${rows}
    <div class="cart-total">
      <span>Total (${totalQty} items)</span>
      <span class="cart-total-price">$${total.toFixed(2)}</span>
    </div>`;
}

// Inject styles
const style = document.createElement("style");
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a2e; padding: 16px; }
  h2 { font-size: 18px; font-weight: 600; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: box-shadow 0.2s, border-color 0.2s; cursor: pointer; position: relative; border: 2px solid transparent; }
  .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
  .card-selected { border-color: #4f46e5; box-shadow: 0 0 0 1px #4f46e5, 0 4px 12px rgba(79,70,229,0.15); }
  .card-check { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.85); border: 2px solid #d1d5db; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; z-index: 2; transition: all 0.15s; }
  .card-selected .card-check { background: #4f46e5; border-color: #4f46e5; }
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
  .price-original { text-decoration: line-through; color: #999; font-size: 0.85em; font-weight: 400; }
  .badge-discount { display: inline-block; background: #dc2626; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-left: 4px; }
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

  .action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e5e7eb; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 100; box-shadow: 0 -2px 10px rgba(0,0,0,0.08); }
  .action-count { font-size: 14px; font-weight: 600; color: #4f46e5; }
  .action-buttons { display: flex; gap: 10px; }
  .btn { padding: 10px 22px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s, opacity 0.15s; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-compare { background: #4f46e5; color: #fff; }
  .btn-compare:hover:not(:disabled) { background: #4338ca; }
  .btn-cart { background: #16a34a; color: #fff; min-width: 130px; transition: background 0.2s, transform 0.1s; }
  .btn-cart:hover:not(:disabled) { background: #15803d; }
  .btn-cart:disabled { opacity: 0.7; }
  .btn-cart-done { background: #059669 !important; opacity: 1 !important; }
  .btn-back { background: #f3f4f6; color: #374151; margin-bottom: 8px; }
  .btn-back:hover { background: #e5e7eb; }

  .cmp-top { margin-bottom: 12px; }
  .cmp-scroll { overflow-x: auto; padding-bottom: 16px; }
  .cmp-table { border-collapse: collapse; width: 100%; min-width: 500px; }
  .cmp-table th, .cmp-table td { padding: 10px 14px; text-align: center; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
  .cmp-header { min-width: 180px; background: #fafafa; }
  .cmp-img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; margin-bottom: 8px; }
  .cmp-name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .cmp-brand { font-size: 12px; color: #666; margin-bottom: 4px; }
  .cmp-price { font-size: 16px; font-weight: 700; color: #16a34a; }
  .cmp-label { text-align: left; font-weight: 600; color: #555; background: #fafafa; min-width: 100px; white-space: nowrap; }
  .cmp-cell { font-size: 13px; color: #333; }

  .toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-80px); padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; z-index: 200; box-shadow: 0 6px 20px rgba(0,0,0,0.15); opacity: 0; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s; pointer-events: none; }
  .toast-visible { transform: translateX(-50%) translateY(0); opacity: 1; }
  .toast-success { background: #059669; color: #fff; }
  .toast-warning { background: #d97706; color: #fff; }
  .toast-error { background: #dc2626; color: #fff; }
  .toast-icon { font-size: 16px; }
`;
document.head.appendChild(style);
