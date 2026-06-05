import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = "/home/abdelwahab/Downloads/amazon-products.csv";
const OUT_PRODUCTS = join(__dirname, "..", "src", "data", "products_1.json");
const OUT_REVIEWS = join(__dirname, "..", "src", "data", "reviews_1.json");

// ── CSV Parsing ──────────────────────────────────────────────
function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      lines.push(current);
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  // Restructure flat cells into rows using header count
  const headerLine = text.split("\n")[0];
  const headerCells = [];
  let hCur = "";
  let hInQ = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      hInQ = !hInQ;
    } else if (ch === "," && !hInQ) {
      headerCells.push(hCur.trim());
      hCur = "";
    } else if (ch !== "\r") {
      hCur += ch;
    }
  }
  headerCells.push(hCur.trim());

  const numCols = headerCells.length;
  const rows = [];
  for (let i = numCols; i < lines.length; i += numCols) {
    const row = {};
    for (let j = 0; j < numCols; j++) {
      row[headerCells[j]] = lines[i + j] ?? "";
    }
    rows.push(row);
  }

  return { headers: headerCells, rows };
}

// ── Currency Conversion ──────────────────────────────────────
const FX = { USD: 1.0, GBP: 1.27, INR: 1 / 83.0 };

function toUSD(priceStr, currency) {
  if (!priceStr || priceStr === "null" || priceStr === "") return null;
  const num = parseFloat(String(priceStr).replace(/[^0-9.eE+-]/g, ""));
  if (isNaN(num) || num <= 0) return null;
  const rate = FX[currency] || 1.0;
  return Math.round(num * rate * 100) / 100;
}

// ── Category Code Generation ─────────────────────────────────
const CATEGORY_CODES = {};
function getCategoryCode(category) {
  if (CATEGORY_CODES[category]) return CATEGORY_CODES[category];
  const words = category
    .replace(/[^a-zA-Z\s&]/g, "")
    .split(/[\s&]+/)
    .filter(Boolean);
  let code;
  if (words.length === 1) {
    code = words[0].substring(0, 4).toUpperCase();
  } else {
    code = words
      .map((w) => w[0])
      .join("")
      .substring(0, 4)
      .toUpperCase();
  }
  if (!code || code.length < 2) code = "GEN";
  CATEGORY_CODES[category] = code;
  return code;
}

// ── Product Content Filter ───────────────────────────────
const BLOCKED_SUBCATS = new Set([
  "Everyday Bras", "Sports Bras", "Bras",
  "Panties", "Hipsters", "Briefs",
  "Bodysuits", "Lingerie", "Intimates",
  "Nightgowns & Sleepshirts",
  "One-Pieces", "Cover-Ups", "Bikinis",
  "Dresses", "Cocktail", "Formal", "Suit Sets",
  "Rompers", "Platforms & Wedges", "Heeled Sandals",
]);
const WOMEN_ONLY_SUBCATS = new Set(["Sets", "Casual"]);
const MENS_KIDS_RE = /\b(men'?s|boys'?|kid'?s|unisex|toddler|little boy)\b/i;

// Any product in clothing category with "women/womens/for women" in the name
const WOMEN_CLOTHING_RE = /\b(women'?s?|womens|for women|woman within)\b/i;

// Explicit title fragments to block (non-clothing misc items)
const BLOCKED_TITLE_FRAGMENTS = [
  "Extra Large Heavy Duty Moving Bags",
  "Electric Heated Blanket",
  "Hannah Linen Fleece Throw Blankets",
  "KERDOM Office Chair",
  "Kitdacnin Mothers Day for Wife Gifts",
  "J.west Galaxy S10 Plus Case",
  "Bocasal Crossbody Wallet Case",
  "The Definitive Vince Guaraldi",
  "FYORR 15ML Quick Dry",
  "Fine Foxy Fro Wig",
  "Maternity Maxi Dress",
];

function isBlockedProduct(name, category, subcategory) {
  // Always block explicit title fragments regardless of category
  const nameLower = name.toLowerCase();
  for (const frag of BLOCKED_TITLE_FRAGMENTS) {
    if (nameLower.includes(frag.toLowerCase())) return true;
  }

  const cat = (category || "").toLowerCase();
  if (cat !== "clothing, shoes & jewelry" && cat !== "women") return false;

  // Block entire subcategories (unless product is for men/boys/kids)
  if (BLOCKED_SUBCATS.has(subcategory || "")) {
    return !MENS_KIDS_RE.test(name);
  }

  // Block ANY women's clothing item by name pattern
  if (WOMEN_CLOTHING_RE.test(name) && !MENS_KIDS_RE.test(name)) {
    return true;
  }

  return false;
}

// ── Stock Generation ─────────────────────────────────────────
function generateStock(availability, isAvailable) {
  const avail = (availability || "").toLowerCase();
  const isBool =
    isAvailable === "true" || isAvailable === true || isAvailable === "True";

  if (
    avail.includes("out of stock") ||
    avail.includes("unavailable") ||
    isAvailable === "false" ||
    isAvailable === false
  ) {
    return { stock_qty: 0, stock_status: "out_of_stock" };
  }

  if (
    avail.includes("in stock") ||
    avail.includes("available") ||
    isBool ||
    !avail
  ) {
    const rand = Math.random();
    if (rand < 0.15) {
      return {
        stock_qty: Math.floor(Math.random() * 5) + 1,
        stock_status: "low_stock",
      };
    }
    return {
      stock_qty: Math.floor(Math.random() * 191) + 10,
      stock_status: "in_stock",
    };
  }

  return {
    stock_qty: Math.floor(Math.random() * 100) + 10,
    stock_status: "in_stock",
  };
}

// ── Delivery Estimate ────────────────────────────────────────
const DELIVERY_OPTIONS = [
  "1-3 business days",
  "2-5 business days",
  "3-7 business days",
  "5-10 business days",
  "1-2 weeks",
];

function generateDelivery() {
  return DELIVERY_OPTIONS[Math.floor(Math.random() * DELIVERY_OPTIONS.length)];
}

// ── Parse JSON-like fields safely ────────────────────────────
function safeParseJSON(str) {
  if (!str || str === "null" || str === "") return null;
  try {
    return JSON.parse(str);
  } catch {
    try {
      return JSON.parse(str.replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
}

// ── Clean description text ───────────────────────────────────
function cleanDescription(desc) {
  if (!desc || desc === "null") return "";
  return desc
    .replace(/amazon\.com/gi, "")
    .replace(/amazon/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Badge Mapping ───────────────────────────────────────────
function mapBadge(raw) {
  if (!raw || raw === "null" || raw === "false" || raw === "") return null;
  const s = raw.trim().toLowerCase();
  if (s.includes("choice")) return "Staff Pick";
  if (s.includes("best seller")) return "Best Seller";
  if (s.includes("new release")) return "New Arrival";
  return null;
}

// ── Variations Extraction ───────────────────────────────────
function extractVariations(raw) {
  const parsed = safeParseJSON(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const names = parsed
    .map((v) => (typeof v === "object" && v.name ? v.name : null))
    .filter(Boolean)
    .slice(0, 10);
  return names.length > 0 ? names : null;
}

// ── Delivery Parsing ────────────────────────────────────────
function parseDelivery(raw) {
  const parsed = safeParseJSON(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  let first = parsed[0] || "";
  first = first
    .replace(/amazon/gi, "")
    .replace(/\.com/gi, "")
    .replace(/orders shipped by\s+over \$\d+/gi, "")
    .replace(/Order within[\s\S]*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!first) return null;
  return first;
}

// ── Date Parsing ────────────────────────────────────────────
function parseDate(raw) {
  if (!raw || raw === "null" || raw === "") return null;
  const d = new Date(raw.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

// ── Images Extraction ───────────────────────────────────────
function extractImages(rawImages, mainUrl) {
  const parsed = safeParseJSON(rawImages);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 8);
  }
  if (!mainUrl) return null;
  return [mainUrl];
}

// ── Main Conversion ──────────────────────────────────────────
console.log("Reading CSV...");
const csvText = readFileSync(CSV_PATH, "utf-8");
const { rows } = parseCSV(csvText);
console.log(`Parsed ${rows.length} rows from CSV`);

// First pass: convert all products
const skuCounters = {};
const products = [];

for (const row of rows) {
  const currency = (row.currency || "USD").toUpperCase();
  const price = toUSD(row.final_price, currency);
  if (price === null || price <= 0) continue;

  const title = (row.title || "").trim();
  if (!title) continue;

  const categories = safeParseJSON(row.categories);
  const category =
    categories && categories.length > 0
      ? categories[0]
      : row.department || "General";
  const subcategory =
    categories && categories.length > 1
      ? categories[categories.length - 1]
      : null;

  if (isBlockedProduct(title, category, subcategory)) continue;

  const catCode = getCategoryCode(category);
  skuCounters[catCode] = (skuCounters[catCode] || 0) + 1;
  const sku = `ACM-${catCode}-${String(skuCounters[catCode]).padStart(3, "0")}`;

  const originalPrice = toUSD(row.initial_price, currency);
  let discount = null;
  if (originalPrice && originalPrice > price) {
    const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
    if (pct >= 1) discount = `-${pct}%`;
  }

  const { stock_qty, stock_status } = generateStock(
    row.availability,
    row.is_available,
  );

  const features = safeParseJSON(row.features);
  const featuresList =
    features && Array.isArray(features) ? features.slice(0, 8) : null;

  const description = cleanDescription(row.description);
  const imageUrl =
    row.image_url && row.image_url !== "null" ? row.image_url.trim() : null;
  const rating = parseFloat(row.rating) || 0;
  const reviewCount = parseInt(row.reviews_count) || 0;
  const weight =
    row.item_weight && row.item_weight !== "null"
      ? row.item_weight.trim()
      : null;
  const dimensions =
    row.product_dimensions && row.product_dimensions !== "null"
      ? row.product_dimensions.trim()
      : null;
  const manufacturer =
    row.manufacturer && row.manufacturer !== "null"
      ? row.manufacturer.trim()
      : null;
  const department =
    row.department && row.department !== "null" ? row.department.trim() : null;
  const boughtPastMonth = parseInt(row.bought_past_month) || null;
  const countryOfOrigin =
    row.country_of_origin && row.country_of_origin !== "null"
      ? row.country_of_origin.trim()
      : null;
  const brand =
    row.brand && row.brand !== "null" ? row.brand.trim() : "Acme";

  const images = extractImages(row.images, imageUrl);
  const topReview =
    row.top_review && row.top_review !== "null"
      ? row.top_review
          .replace(/amazon/gi, "")
          .replace(/\.com/gi, "")
          .trim()
          .substring(0, 500)
      : null;
  const badge = mapBadge(row.badge);
  const variations = extractVariations(row.variations);
  const delivery = parseDelivery(row.delivery);
  const modelNumber =
    row.model_number && row.model_number !== "null"
      ? row.model_number.trim()
      : null;
  const dateFirstAvailable = parseDate(row.date_first_available);

  products.push({
    sku,
    name: title,
    brand,
    category,
    subcategory,
    description,
    price,
    original_price: originalPrice,
    discount,
    currency: "USD",
    stock_qty,
    stock_status,
    delivery_estimate: generateDelivery(),
    image_url: imageUrl,
    images,
    rating: Math.round(rating * 10) / 10,
    review_count: reviewCount,
    weight,
    dimensions,
    features: featuresList,
    manufacturer,
    department,
    bought_past_month: boughtPastMonth,
    country_of_origin: countryOfOrigin,
    top_review: topReview,
    badge,
    variations,
    delivery,
    model_number: modelNumber,
    date_first_available: dateFirstAvailable,
    frequently_bought_together: null, // filled in second pass
  });
}

console.log(`Converted ${products.length} valid products`);

// ── Generate FBT Links ───────────────────────────────────────
// Build indices by category, subcategory, and department
const byCat = {};
const bySub = {};
const byDept = {};

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  if (!byCat[p.category]) byCat[p.category] = [];
  byCat[p.category].push(i);

  if (p.subcategory) {
    const key = `${p.category}::${p.subcategory}`;
    if (!bySub[key]) bySub[key] = [];
    bySub[key].push(i);
  }

  if (p.department) {
    if (!byDept[p.department]) byDept[p.department] = [];
    byDept[p.department].push(i);
  }
}

function pickRandom(arr, exclude, count) {
  const candidates = arr.filter((i) => i !== exclude);
  const result = [];
  const used = new Set();
  while (result.length < count && result.length < candidates.length) {
    const idx = Math.floor(Math.random() * candidates.length);
    if (!used.has(candidates[idx])) {
      used.add(candidates[idx]);
      result.push(candidates[idx]);
    }
  }
  return result;
}

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  const fbtIndices = new Set();

  // Same subcategory: pick 2
  const subKey = p.subcategory ? `${p.category}::${p.subcategory}` : null;
  if (subKey && bySub[subKey] && bySub[subKey].length > 1) {
    for (const idx of pickRandom(bySub[subKey], i, 2)) {
      fbtIndices.add(idx);
    }
  }

  // Same category (different subcategory): pick 1
  if (byCat[p.category] && byCat[p.category].length > 1) {
    for (const idx of pickRandom(byCat[p.category], i, 1)) {
      if (!fbtIndices.has(idx)) fbtIndices.add(idx);
    }
  }

  // Cross-category within same department: pick 1-2
  if (p.department && byDept[p.department] && byDept[p.department].length > 1) {
    const crossCat = byDept[p.department].filter(
      (idx) => products[idx].category !== p.category,
    );
    if (crossCat.length > 0) {
      for (const idx of pickRandom(crossCat, i, 2)) {
        if (fbtIndices.size < 5) fbtIndices.add(idx);
      }
    }
  }

  // Fallback: if < 2 FBT, pick from same category
  if (fbtIndices.size < 2 && byCat[p.category]) {
    for (const idx of pickRandom(byCat[p.category], i, 3)) {
      if (fbtIndices.size < 4 && !fbtIndices.has(idx)) fbtIndices.add(idx);
    }
  }

  if (fbtIndices.size > 0) {
    p.frequently_bought_together = Array.from(fbtIndices).map(
      (idx) => products[idx].sku,
    );
  }
}

// ── Write products_1.json ────────────────────────────────────
writeFileSync(OUT_PRODUCTS, JSON.stringify(products, null, 2), "utf-8");
console.log(`Wrote ${products.length} products to ${OUT_PRODUCTS}`);

// ── Generate Reviews ─────────────────────────────────────────
const REVIEW_TITLES_POSITIVE = [
  "Great product!", "Excellent quality", "Highly recommend",
  "Worth every penny", "Love it!", "Perfect for my needs",
  "Exceeded expectations", "Very satisfied", "Amazing value",
  "Best purchase this year", "Solid quality", "Works perfectly",
  "Really impressed", "Fantastic!", "Just what I needed",
];
const REVIEW_TITLES_MIXED = [
  "Good but could be better", "Decent quality", "Okay product",
  "Not bad, not great", "Average", "Has some issues",
  "Mixed feelings", "Works but...", "Room for improvement",
];
const REVIEW_TITLES_NEGATIVE = [
  "Disappointed", "Not as expected", "Could be better",
  "Would not buy again", "Below average quality",
];

const REVIEW_BODIES_POSITIVE = [
  "I've been using this for a few weeks now and I'm really happy with the purchase. The quality is excellent and it works exactly as described.",
  "This product exceeded my expectations. Great build quality and fast shipping. Would definitely recommend to friends and family.",
  "Really impressed with the quality for the price. It does everything I need it to do and then some. Very happy with this purchase.",
  "After researching several options, I went with this one and I'm glad I did. It's well-made and performs beautifully.",
  "Five stars! This is exactly what I was looking for. The quality is top-notch and it arrived in perfect condition.",
  "I was hesitant at first but this product really delivers. Great value for the money and the quality is better than I expected.",
  "Absolutely love this product. It's well-designed, functional, and looks great. Can't recommend it enough!",
  "Best purchase I've made in a while. The attention to detail and overall quality is impressive. Definitely worth the price.",
];
const REVIEW_BODIES_MIXED = [
  "The product is decent overall but has some minor issues. It works for what I need but I expected better quality at this price point.",
  "It's okay. Does what it's supposed to do but nothing special. The build quality could be improved.",
  "Mixed feelings about this one. Some aspects are great but others fall short. It's an average product for the price.",
];
const REVIEW_BODIES_NEGATIVE = [
  "Not what I expected based on the description. The quality is below average and I'm considering returning it.",
  "Disappointed with this purchase. It doesn't perform as well as advertised and the build quality is lacking.",
];

const AUTHOR_FIRST = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
  "Avery", "Harper", "Reese", "Skyler", "Jamie", "Drew", "Sam",
  "Charlie", "Frankie", "Pat", "Lee", "Chris", "Dana", "Robin",
  "Kelly", "Jessie", "Peyton", "Cameron", "Bailey", "Emery",
  "Hayden", "Rowan", "Sage", "Phoenix", "Remy", "River", "Blake",
  "Finley", "Kendall", "Elliot", "Jude", "Wren", "Tatum", "Nico",
];
const AUTHOR_LAST_INIT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomAuthor() {
  const first = AUTHOR_FIRST[Math.floor(Math.random() * AUTHOR_FIRST.length)];
  const last = AUTHOR_LAST_INIT[Math.floor(Math.random() * 26)];
  return `${first} ${last}.`;
}

function randomDate() {
  const start = new Date("2024-01-01");
  const end = new Date("2026-05-30");
  const d = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
  return d.toISOString().split("T")[0];
}

const reviews = [];
let reviewCounter = 0;

// Generate 2-4 reviews per ~100 random products, 1 review for ~200 more
const reviewProductIndices = [];
for (let i = 0; i < products.length; i++) reviewProductIndices.push(i);
// Shuffle
for (let i = reviewProductIndices.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [reviewProductIndices[i], reviewProductIndices[j]] = [
    reviewProductIndices[j],
    reviewProductIndices[i],
  ];
}

// Also use top_review from CSV for first pass
const topReviewMap = {};
for (let i = 0; i < rows.length; i++) {
  if (i < products.length && rows[i].top_review && rows[i].top_review !== "null") {
    topReviewMap[i] = rows[i].top_review
      .replace(/amazon/gi, "")
      .replace(/\.com/gi, "")
      .trim();
  }
}

// First 100 products: 2-4 reviews each
for (let idx = 0; idx < Math.min(100, reviewProductIndices.length); idx++) {
  const pi = reviewProductIndices[idx];
  const p = products[pi];
  const numReviews = Math.floor(Math.random() * 3) + 2;

  for (let r = 0; r < numReviews; r++) {
    reviewCounter++;
    const rating =
      Math.random() < 0.7
        ? Math.floor(Math.random() * 2) + 4
        : Math.floor(Math.random() * 3) + 2;

    let title, body;
    if (r === 0 && topReviewMap[pi]) {
      title = rating >= 4 ? REVIEW_TITLES_POSITIVE[Math.floor(Math.random() * REVIEW_TITLES_POSITIVE.length)] : REVIEW_TITLES_MIXED[Math.floor(Math.random() * REVIEW_TITLES_MIXED.length)];
      body = topReviewMap[pi].substring(0, 500);
    } else if (rating >= 4) {
      title = REVIEW_TITLES_POSITIVE[Math.floor(Math.random() * REVIEW_TITLES_POSITIVE.length)];
      body = REVIEW_BODIES_POSITIVE[Math.floor(Math.random() * REVIEW_BODIES_POSITIVE.length)];
    } else if (rating >= 3) {
      title = REVIEW_TITLES_MIXED[Math.floor(Math.random() * REVIEW_TITLES_MIXED.length)];
      body = REVIEW_BODIES_MIXED[Math.floor(Math.random() * REVIEW_BODIES_MIXED.length)];
    } else {
      title = REVIEW_TITLES_NEGATIVE[Math.floor(Math.random() * REVIEW_TITLES_NEGATIVE.length)];
      body = REVIEW_BODIES_NEGATIVE[Math.floor(Math.random() * REVIEW_BODIES_NEGATIVE.length)];
    }

    reviews.push({
      review_id: `REV-${String(reviewCounter).padStart(4, "0")}`,
      sku: p.sku,
      author: randomAuthor(),
      rating,
      title,
      body,
      created_at: randomDate(),
      verified_purchase: Math.random() < 0.8,
    });
  }
}

// Next 200 products: 1 review each
for (
  let idx = 100;
  idx < Math.min(300, reviewProductIndices.length);
  idx++
) {
  const pi = reviewProductIndices[idx];
  const p = products[pi];
  reviewCounter++;
  const rating = Math.floor(Math.random() * 2) + 4;

  reviews.push({
    review_id: `REV-${String(reviewCounter).padStart(4, "0")}`,
    sku: p.sku,
    author: randomAuthor(),
    rating,
    title:
      REVIEW_TITLES_POSITIVE[
        Math.floor(Math.random() * REVIEW_TITLES_POSITIVE.length)
      ],
    body: REVIEW_BODIES_POSITIVE[
      Math.floor(Math.random() * REVIEW_BODIES_POSITIVE.length)
    ],
    created_at: randomDate(),
    verified_purchase: Math.random() < 0.85,
  });
}

writeFileSync(OUT_REVIEWS, JSON.stringify(reviews, null, 2), "utf-8");
console.log(`Wrote ${reviews.length} reviews to ${OUT_REVIEWS}`);
console.log("\nDone! Summary:");
console.log(`  Products: ${products.length}`);
console.log(`  Reviews: ${reviews.length}`);
console.log(`  Categories: ${Object.keys(byCat).length}`);
console.log(
  `  SKU prefixes: ${Object.entries(CATEGORY_CODES)
    .map(([k, v]) => `${v}(${k})`)
    .join(", ")}`,
);
