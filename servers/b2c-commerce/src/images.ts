const imageCache = new Map<string, { data: string; mimeType: string }>();

const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_SIZE = 800_000; // ~800KB base64 limit (well under 1MB client limit)

function resizeUnsplashUrl(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "75");
      u.searchParams.set("fm", "jpg");
      return u.toString();
    }
  } catch {
    /* not a valid URL */
  }
  return url;
}

export async function fetchImageAsBase64(
  imageUrl: string,
  width = 400,
): Promise<{ data: string; mimeType: string } | null> {
  const url = resizeUnsplashUrl(imageUrl, width);
  const cached = imageCache.get(url);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Acme-Store-MCP/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");
    if (base64.length > MAX_IMAGE_SIZE) return null;

    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "image/jpeg";

    const result = { data: base64, mimeType };
    imageCache.set(url, result);
    return result;
  } catch {
    return null;
  }
}

export async function fetchMultipleImages(
  items: Array<{ imageUrl: string; width?: number }>,
): Promise<Array<{ data: string; mimeType: string } | null>> {
  return Promise.all(
    items.map((item) => fetchImageAsBase64(item.imageUrl, item.width ?? 300)),
  );
}
