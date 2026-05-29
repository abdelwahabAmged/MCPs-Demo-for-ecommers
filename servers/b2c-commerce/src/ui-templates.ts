interface ProductCardData {
  sku: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  color: string;
  size: string | null;
  image_url: string;
  rating: number;
  review_count: number;
  stock_status: string;
  delivery_estimate: string;
  description?: string;
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

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8f9fa;
    color: #1a1a2e;
    padding: 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }
  .card {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    transition: box-shadow 0.2s;
  }
  .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
  .card-img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    background: #eee;
  }
  .card-body { padding: 12px 14px; }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    margin-bottom: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-brand { font-size: 12px; color: #666; margin-bottom: 6px; }
  .card-price { font-size: 16px; font-weight: 700; color: #16a34a; }
  .card-meta { font-size: 11px; color: #888; margin-top: 6px; display: flex; gap: 8px; align-items: center; }
  .stars { color: #f59e0b; }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .badge-stock { background: #dcfce7; color: #166534; }
  .badge-low { background: #fef3c7; color: #92400e; }
  .badge-out { background: #fee2e2; color: #991b1b; }
  .sku { font-size: 10px; color: #aaa; font-family: monospace; }
  .placeholder-img {
    width: 100%;
    height: 180px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
  }
`;

function stockBadge(status: string): string {
  if (status === "in_stock")
    return '<span class="badge badge-stock">In Stock</span>';
  if (status === "low_stock")
    return '<span class="badge badge-low">Low Stock</span>';
  return '<span class="badge badge-out">Out of Stock</span>';
}

function starRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    "★".repeat(full) +
    (half ? "½" : "") +
    "☆".repeat(empty) +
    ` ${rating}`
  );
}

function imgTag(url: string, alt: string): string {
  return `<img class="card-img" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" onerror="this.outerHTML='<div class=\\'placeholder-img\\'>🛍️</div>'" loading="lazy" />`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildProductGridHtml(
  products: ProductCardData[],
  title: string,
): string {
  const cards = products
    .map(
      (p) => `
    <div class="card">
      ${imgTag(p.image_url, p.name)}
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.name)}</div>
        <div class="card-brand">${escapeHtml(p.brand)} · ${escapeHtml(p.color)}</div>
        <div class="card-price">€${p.price.toFixed(2)}</div>
        <div class="card-meta">
          <span class="stars">${starRating(p.rating)}</span>
          <span>(${p.review_count})</span>
          ${stockBadge(p.stock_status)}
        </div>
        <div class="card-meta">
          <span>📦 ${escapeHtml(p.delivery_estimate)}</span>
        </div>
        <div class="sku">${escapeHtml(p.sku)}</div>
      </div>
    </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${SHARED_STYLES}
  h2 { font-size: 18px; font-weight: 600; margin-bottom: 14px; color: #1a1a2e; }
</style></head><body>
  <h2>${escapeHtml(title)}</h2>
  <div class="grid">${cards}</div>
</body></html>`;
}

export function buildProductDetailHtml(product: ProductCardData & { description?: string; material?: string; weight_grams?: number; specs?: Record<string, string> }): string {
  const specsHtml = product.specs
    ? Object.entries(product.specs)
        .map(([k, v]) => `<tr><td class="spec-key">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
        .join("")
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${SHARED_STYLES}
  .detail { display: flex; gap: 24px; flex-wrap: wrap; }
  .detail-img {
    flex: 0 0 320px;
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    object-fit: cover;
    background: #eee;
  }
  .detail-info { flex: 1; min-width: 240px; }
  .detail-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .detail-brand { font-size: 14px; color: #666; margin-bottom: 12px; }
  .detail-price { font-size: 24px; font-weight: 700; color: #16a34a; margin-bottom: 12px; }
  .detail-desc { font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 16px; }
  .detail-meta { font-size: 13px; color: #555; margin-bottom: 8px; }
  .specs-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  .specs-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .spec-key { font-weight: 600; color: #444; width: 40%; }
</style></head><body>
  <div class="detail">
    <img class="detail-img" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" onerror="this.style.display='none'" />
    <div class="detail-info">
      <div class="detail-name">${escapeHtml(product.name)}</div>
      <div class="detail-brand">${escapeHtml(product.brand)} · ${escapeHtml(product.color)}${product.size ? ` · Size ${escapeHtml(product.size)}` : ""}</div>
      <div class="detail-price">€${product.price.toFixed(2)}</div>
      <div class="detail-meta"><span class="stars">${starRating(product.rating)}</span> (${product.review_count} reviews) ${stockBadge(product.stock_status)}</div>
      <div class="detail-meta">📦 ${escapeHtml(product.delivery_estimate)}</div>
      ${product.description ? `<div class="detail-desc">${escapeHtml(product.description)}</div>` : ""}
      ${product.material ? `<div class="detail-meta">Material: ${escapeHtml(product.material)}</div>` : ""}
      ${product.weight_grams ? `<div class="detail-meta">Weight: ${product.weight_grams}g</div>` : ""}
      ${specsHtml ? `<table class="specs-table">${specsHtml}</table>` : ""}
      <div class="sku" style="margin-top:12px">${escapeHtml(product.sku)}</div>
    </div>
  </div>
</body></html>`;
}

export function buildCartHtml(
  items: CartItemData[],
  total: number,
): string {
  const rows = items
    .map(
      (i) => `
    <div class="cart-item">
      ${i.image_url ? `<img class="cart-img" src="${escapeHtml(i.image_url)}" alt="${escapeHtml(i.name)}" onerror="this.outerHTML='<div class=\\'cart-placeholder\\'>🛍️</div>'" />` : '<div class="cart-placeholder">🛍️</div>'}
      <div class="cart-info">
        <div class="cart-name">${escapeHtml(i.name)}</div>
        <div class="cart-variant">${escapeHtml(i.color)}${i.size ? ` · Size ${escapeHtml(i.size)}` : ""}</div>
        <div class="cart-sku">${escapeHtml(i.sku)}</div>
      </div>
      <div class="cart-qty">×${i.quantity}</div>
      <div class="cart-price">€${(i.unit_price * i.quantity).toFixed(2)}</div>
    </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${SHARED_STYLES}
  h2 { font-size: 18px; font-weight: 600; margin-bottom: 14px; }
  .cart-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fff;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  }
  .cart-img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; }
  .cart-placeholder { width: 56px; height: 56px; border-radius: 8px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .cart-info { flex: 1; }
  .cart-name { font-size: 14px; font-weight: 600; }
  .cart-variant { font-size: 12px; color: #666; }
  .cart-sku { font-size: 10px; color: #aaa; font-family: monospace; }
  .cart-qty { font-size: 14px; color: #666; min-width: 30px; text-align: center; }
  .cart-price { font-size: 15px; font-weight: 700; color: #16a34a; min-width: 70px; text-align: right; }
  .cart-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: #fff;
    border-radius: 10px;
    margin-top: 12px;
    font-size: 16px;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
</style></head><body>
  <h2>🛒 Your Cart</h2>
  ${rows}
  <div class="cart-total">
    <span>Total (${items.reduce((s, i) => s + i.quantity, 0)} items)</span>
    <span style="color:#16a34a">€${total.toFixed(2)}</span>
  </div>
</body></html>`;
}

export function wrapAsUiResource(
  html: string,
  uriPath: string,
): {
  type: "resource";
  resource: { uri: string; mimeType: string; text: string };
} {
  return {
    type: "resource" as const,
    resource: {
      uri: `ui://b2c-commerce/${uriPath}`,
      mimeType: "text/html;profile=mcp-app",
      text: html,
    },
  };
}
