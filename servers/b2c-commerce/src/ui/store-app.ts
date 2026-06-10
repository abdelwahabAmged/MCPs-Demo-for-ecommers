import { App } from "@modelcontextprotocol/ext-apps";

interface ProductData {
  sku: string;
  name: string;
  brand: string;
  price: number;
  original_price?: number | null;
  discount?: string | null;
  image_url: string;
  images?: string[];
  rating: number;
  review_count: number;
  stock_status: string;
  delivery_estimate: string;
  description?: string;
  weight?: string;
  dimensions?: string;
  badge?: string;
  top_review?: string;
  variations?: string[];
  delivery?: string;
  model_number?: string;
  date_first_available?: string;
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

function renderStarsInline(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= full) html += '<span class="star star-full">★</span>';
    else if (i === full + 1 && half) html += '<span class="star star-half">★</span>';
    else html += '<span class="star star-empty">★</span>';
  }
  return html;
}

function formatReviewCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function renderProductDetail(p: ProductData) {
  const deliveryText = p.delivery || p.delivery_estimate;
  const savings =
    p.original_price && p.original_price > p.price
      ? p.original_price - p.price
      : 0;

  const priceHtml = p.original_price
    ? `<div class="pdp-price-row">
        <span class="pdp-price">$${p.price.toFixed(2)}</span>
        <span class="pdp-price-was">$${p.original_price.toFixed(2)}</span>
        ${p.discount ? `<span class="pdp-discount">${esc(p.discount)}</span>` : ""}
        ${savings > 0 ? `<span class="pdp-savings">Save $${savings.toFixed(2)}</span>` : ""}
      </div>`
    : `<div class="pdp-price-row"><span class="pdp-price">$${p.price.toFixed(2)}</span></div>`;

  const variationsHtml =
    p.variations && p.variations.length > 0
      ? `<div class="pdp-section">
          <div class="pdp-section-label">${p.variations.length} option${p.variations.length > 1 ? "s" : ""}</div>
          <div class="pdp-chips-scroll">${p.variations.map((v) => `<span class="pdp-chip">${esc(v)}</span>`).join("")}</div>
        </div>`
      : "";

  const specs: [string, string][] = [];
  if (p.weight) specs.push(["Weight", p.weight]);
  if (p.dimensions) specs.push(["Dimensions", p.dimensions]);
  if (p.model_number) specs.push(["Model", p.model_number]);
  if (p.date_first_available) specs.push(["Available since", p.date_first_available]);

  const specsHtml =
    specs.length > 0
      ? `<details class="pdp-details">
          <summary class="pdp-details-summary">
            <span>Specifications</span>
            <span class="pdp-chevron">›</span>
          </summary>
          <dl class="pdp-specs">${specs.map(([k, v]) => `<div class="pdp-spec-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        </details>`
      : "";

  const reviewHtml = p.top_review
    ? `<details class="pdp-details">
        <summary class="pdp-details-summary">
          <span>Top customer review</span>
          <span class="pdp-chevron">›</span>
        </summary>
        <blockquote class="pdp-review">"${esc(p.top_review)}"</blockquote>
      </details>`
    : "";

  const descHtml = p.description
    ? `<div class="pdp-section pdp-desc-section">
        <p class="pdp-desc" id="pdp-desc">${esc(p.description)}</p>
        <button type="button" class="pdp-text-toggle" id="pdp-desc-toggle" hidden>Show more</button>
      </div>`
    : "";

  const badgeHtml = p.badge ? `<span class="pdp-promo-badge">${esc(p.badge)}</span>` : "";
  const canAdd = p.stock_status !== "out_of_stock";

  const galleryBadge =
    p.images && p.images.length > 1
      ? `<span class="pdp-gallery-count"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 5a2 2 0 00-2 2v6a2 2 0 002 2h9a2 2 0 002-2v-1.5l2.3 1.7a1 1 0 001.6-.8V6.6a1 1 0 00-1.6-.8L15 7.5V7a2 2 0 00-2-2H4z"/></svg>${p.images.length}</span>`
      : "";

  appEl.innerHTML = `
    <article class="pdp-card">
      <div class="pdp-hero">
        <div class="pdp-image-wrap">
          ${imgWithFallback(p.image_url, p.name, "pdp-img")}
          ${galleryBadge}
        </div>
        <div class="pdp-hero-content">
          <div class="pdp-brand-row">
            <span class="pdp-brand">${esc(p.brand)}</span>
            ${badgeHtml}
          </div>
          <h1 class="pdp-title">${esc(p.name)}</h1>
          <div class="pdp-rating-row">
            <span class="pdp-stars" aria-label="${p.rating} out of 5">${renderStarsInline(p.rating)}</span>
            <span class="pdp-rating-num">${p.rating.toFixed(1)}</span>
            <span class="pdp-review-count">(${formatReviewCount(p.review_count)})</span>
            ${stockBadge(p.stock_status)}
          </div>
          ${priceHtml}
          <div class="pdp-delivery">
            <svg class="pdp-delivery-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M8 16.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM15 16.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M3 4a1 1 0 00-1 1v1a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 011-1V5a1 1 0 00-1-1H3zM6 7a2.5 2.5 0 015 0v8.25A2.75 2.75 0 0110.75 18H6a2 2 0 01-2-2V7z"/></svg>
            <span>${esc(deliveryText)}</span>
          </div>
        </div>
      </div>
      ${variationsHtml}
      ${descHtml}
      ${specsHtml}
      ${reviewHtml}
      <div class="pdp-actions">
        <button type="button" class="btn btn-cart pdp-add-btn" id="pdp-add-btn" ${canAdd ? "" : "disabled"}>
          ${canAdd ? "Add to Cart" : "Out of Stock"}
        </button>
      </div>
      <div class="pdp-sku">SKU ${esc(p.sku)}</div>
    </article>`;

  setupProductDetailInteractions(p);
}

function setupProductDetailInteractions(p: ProductData) {
  const desc = document.getElementById("pdp-desc");
  const descToggle = document.getElementById("pdp-desc-toggle");
  if (desc && descToggle) {
    requestAnimationFrame(() => {
      const clamped = desc.scrollHeight > desc.clientHeight + 2;
      if (clamped) {
        descToggle.hidden = false;
        descToggle.addEventListener("click", () => {
          const expanded = desc.classList.toggle("pdp-desc-expanded");
          descToggle.textContent = expanded ? "Show less" : "Show more";
        });
      }
    });
  }

  document.getElementById("pdp-add-btn")?.addEventListener("click", () => addProductToCart(p));
}

async function addProductToCart(p: ProductData) {
  const btn = document.getElementById("pdp-add-btn") as HTMLButtonElement | null;
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Adding…";

  try {
    const result = await app.callServerTool({ name: "add_to_cart", arguments: { sku: p.sku, quantity: 1 } });
    const text = result.content?.find((c: { type: string }) => c.type === "text") as { text?: string } | undefined;
    if (text?.text?.includes("not found") || text?.text?.includes("out of stock")) {
      showToast("Couldn't add to cart", "error");
      btn.textContent = prev;
      btn.disabled = false;
    } else {
      btn.textContent = "Added ✓";
      btn.classList.add("pdp-add-done");
      showToast("Added to cart", "success");
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("pdp-add-done");
        btn.disabled = false;
      }, 2000);
    }
  } catch {
    showToast("Failed to add to cart", "error");
    btn.textContent = prev;
    btn.disabled = false;
  }
}

function renderCart(items: CartItemData[], total: number) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  if (items.length === 0) {
    appEl.innerHTML = `
      <article class="cart-card cart-empty-card">
        <div class="cart-empty-emoji">🛒</div>
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-sub">Browse products and add items to get started.</div>
      </article>`;
    return;
  }

  const rows = items
    .map((i) => {
      const sub = (i.unit_price * i.quantity).toFixed(2);
      const thumb = i.image_url
        ? imgWithFallback(i.image_url, i.name, "cart-thumb-img")
        : '<div class="cart-thumb-img placeholder">🛍️</div>';
      return `
        <div class="cart-row">
          <div class="cart-thumb">${thumb}</div>
          <div class="cart-row-info">
            <div class="cart-row-name">${esc(i.name)}</div>
            <div class="cart-row-sku">${esc(i.sku)}</div>
          </div>
          <div class="cart-row-price">
            <div class="cart-row-qty">Qty ${i.quantity} · $${i.unit_price.toFixed(2)}</div>
            <div class="cart-row-sub">$${sub}</div>
          </div>
        </div>`;
    })
    .join("");

  appEl.innerHTML = `
    <article class="cart-card">
      <div class="cart-head">
        <span class="cart-head-title">🛒 Your Cart</span>
        <span class="cart-head-count">${totalQty} item${totalQty !== 1 ? "s" : ""}</span>
      </div>
      <div class="cart-list">${rows}</div>
      <div class="cart-foot">
        <span class="cart-foot-label">Total</span>
        <span class="cart-grand">$${total.toFixed(2)}</span>
      </div>
    </article>`;
}

// Inject styles
const style = document.createElement("style");
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background: transparent; color: #111827; padding: 4px 2px; -webkit-font-smoothing: antialiased; }
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
  .badge-promo { background: #6366f1; color: #fff; margin-left: 8px; vertical-align: middle; }

  /* ── Product detail card (chat-optimized) ── */
  .pdp-card {
    max-width: 100%;
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(17,24,39,0.07);
  }
  .pdp-hero {
    display: grid;
    grid-template-columns: clamp(132px, 36%, 220px) 1fr;
    gap: 18px;
    padding: 18px 18px 16px;
    align-items: start;
  }
  .pdp-image-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    background: linear-gradient(145deg, #f9fafb 0%, #f1f2f5 100%);
    border: 1px solid #eef0f3;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .pdp-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    padding: 8px;
  }
  .pdp-gallery-count {
    position: absolute;
    bottom: 6px;
    right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px 2px 5px;
    border-radius: 999px;
    background: rgba(17,24,39,0.72);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    backdrop-filter: blur(4px);
  }
  .pdp-gallery-count svg { width: 12px; height: 12px; }
  .pdp-img.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    background: linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%);
    padding: 0;
  }
  .pdp-hero-content { min-width: 0; }
  .pdp-brand-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .pdp-brand {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .pdp-promo-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    letter-spacing: 0.02em;
  }
  .pdp-title {
    font-size: 15px;
    font-weight: 650;
    line-height: 1.32;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pdp-rating-row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .pdp-stars { display: inline-flex; gap: 1px; line-height: 1; }
  .star { font-size: 12px; }
  .star-full { color: #f59e0b; }
  .star-half { color: #f59e0b; opacity: 0.55; }
  .star-empty { color: #e5e7eb; }
  .pdp-rating-num { font-size: 12px; font-weight: 600; color: #374151; }
  .pdp-review-count { font-size: 11px; color: #9ca3af; }
  .pdp-price-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .pdp-price {
    font-size: 22px;
    font-weight: 800;
    color: #047857;
    letter-spacing: -0.03em;
  }
  .pdp-price-was {
    font-size: 12px;
    color: #9ca3af;
    text-decoration: line-through;
  }
  .pdp-discount {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: #fef2f2;
    color: #dc2626;
  }
  .pdp-savings {
    font-size: 10px;
    font-weight: 600;
    color: #059669;
    background: #ecfdf5;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .pdp-delivery {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #4b5563;
    line-height: 1.3;
  }
  .pdp-delivery-icon { width: 14px; height: 14px; color: #6366f1; flex-shrink: 0; }
  .pdp-section {
    padding: 0 18px 10px;
    border-top: 1px solid #f3f4f6;
    padding-top: 11px;
  }
  .pdp-section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  .pdp-chips-scroll {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
    mask-image: linear-gradient(to right, #000 90%, transparent);
  }
  .pdp-chips-scroll::-webkit-scrollbar { display: none; }
  .pdp-chip {
    flex-shrink: 0;
    font-size: 11px;
    padding: 5px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    white-space: nowrap;
    background: #fafafa;
    color: #374151;
  }
  .pdp-desc-section { padding-bottom: 12px; }
  .pdp-desc {
    font-size: 12.5px;
    line-height: 1.6;
    color: #4b5563;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pdp-desc-expanded {
    -webkit-line-clamp: unset;
    display: block;
  }
  .pdp-text-toggle {
    margin-top: 6px;
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    font-weight: 600;
    color: #6366f1;
    cursor: pointer;
  }
  .pdp-text-toggle:hover { text-decoration: underline; }
  .pdp-details {
    border-top: 1px solid #f3f4f6;
  }
  .pdp-details-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 18px;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .pdp-details-summary::-webkit-details-marker { display: none; }
  .pdp-chevron {
    font-size: 16px;
    color: #9ca3af;
    transition: transform 0.2s;
  }
  .pdp-details[open] .pdp-chevron { transform: rotate(90deg); }
  .pdp-specs { padding: 0 18px 12px; }
  .pdp-spec-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    font-size: 11px;
    border-bottom: 1px solid #f9fafb;
  }
  .pdp-spec-row:last-child { border-bottom: none; }
  .pdp-spec-row dt { color: #6b7280; flex-shrink: 0; }
  .pdp-spec-row dd { color: #111827; text-align: right; word-break: break-word; }
  .pdp-review {
    margin: 0 18px 12px;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.5;
    color: #4b5563;
    font-style: italic;
    background: #f9fafb;
    border-radius: 8px;
    border-left: 3px solid #c4b5fd;
  }
  .pdp-actions {
    padding: 12px 18px 14px;
    border-top: 1px solid #f3f4f6;
  }
  .pdp-add-btn {
    width: 100%;
    padding: 11px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.01em;
    min-width: unset;
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 1px 2px rgba(5,150,105,0.2);
    transition: transform 0.1s, box-shadow 0.15s, background 0.15s;
  }
  .pdp-add-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #065f46 100%);
    box-shadow: 0 2px 8px rgba(5,150,105,0.25);
  }
  .pdp-add-btn:active:not(:disabled) { transform: scale(0.98); }
  .pdp-add-done { background: linear-gradient(135deg, #10b981, #059669) !important; }
  .pdp-sku {
    padding: 0 18px 12px;
    font-size: 9px;
    color: #d1d5db;
    font-family: ui-monospace, monospace;
    text-align: center;
  }
  /* ── Cart card (chat-optimized) ── */
  .cart-card {
    max-width: 560px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(17,24,39,0.07);
  }
  .cart-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f3f4f6;
  }
  .cart-head-title { font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
  .cart-head-count {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    background: #f3f4f6;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .cart-row {
    display: grid;
    grid-template-columns: 52px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f6f7f8;
  }
  .cart-row:last-child { border-bottom: none; }
  .cart-thumb {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid #ececef;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .cart-thumb-img { width: 100%; height: 100%; object-fit: contain; padding: 5px; display: block; }
  .cart-thumb-img.placeholder {
    padding: 0;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e0e7ff, #f3e8ff);
  }
  .cart-row-info { min-width: 0; }
  .cart-row-name {
    font-size: 12.5px;
    font-weight: 600;
    color: #111827;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 3px;
  }
  .cart-row-sku { font-size: 10px; color: #9ca3af; font-family: ui-monospace, monospace; }
  .cart-row-price { text-align: right; white-space: nowrap; }
  .cart-row-qty { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
  .cart-row-sub { font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
  .cart-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: #fafbfc;
    border-top: 1px solid #eef0f3;
  }
  .cart-foot-label { font-size: 13px; font-weight: 600; color: #374151; }
  .cart-grand { font-size: 19px; font-weight: 800; color: #047857; letter-spacing: -0.02em; }
  .cart-empty-card { padding: 32px 20px; text-align: center; }
  .cart-empty-emoji { font-size: 36px; margin-bottom: 10px; }
  .cart-empty-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .cart-empty-sub { font-size: 12px; color: #6b7280; line-height: 1.5; }

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
