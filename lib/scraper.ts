import { isSafePublicUrl } from './security';

export interface ScrapedProductData {
  title: string | null;
  brand: string | null;
  price: string | null;
  sourceDomain: string;
  imageCandidates: string[];
}

const DISALLOWED_IMAGE_SUBSTRINGS = [
  'favicon',
  'logo',
  'icon',
  'sprite',
  'avatar',
  'badge',
  'tracking',
  '1x1',
  'pixel',
  '.svg',
  'spinner',
  'loader',
  'banner',
  'placeholder',
  'blank',
];

export async function scrapeProductPage(
  url: string
): Promise<ScrapedProductData> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      title: null,
      brand: null,
      price: null,
      sourceDomain: 'unknown',
      imageCandidates: [],
    };
  }

  const sourceDomain = parsedUrl.hostname.replace(/^www\./, '');

  if (!isSafePublicUrl(url)) {
    return {
      title: null,
      brand: null,
      price: null,
      sourceDomain,
      imageCandidates: [],
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    // Authentic desktop browser headers to prevent bot-shield blocks (Cloudflare, Akamai, Amazon)
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        title: null,
        brand: null,
        price: null,
        sourceDomain,
        imageCandidates: [],
      };
    }

    // Read up to 768KB of HTML for rich metadata
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 768 * 1024) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel();
    } else {
      html = (await res.text()).slice(0, 768 * 1024);
    }

    const imageCandidates: string[] = [];
    let title: string | null = null;
    let brand: string | null = null;
    let price: string | null = null;

    // Helper to collect images safely
    const addImage = (src?: string | null) => {
      if (!src) return;
      const clean = src.trim();
      if (clean && !imageCandidates.includes(clean)) {
        imageCandidates.push(clean);
      }
    };

    // 1. JSON-LD Extraction (supports standard, arrays, and @graph segments)
    const jsonLdMatches = html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    for (const match of jsonLdMatches) {
      try {
        const rawJson = JSON.parse(match[1]);
        const entries: Record<string, unknown>[] = [];

        if (Array.isArray(rawJson)) {
          entries.push(...rawJson);
        } else if (rawJson && typeof rawJson === 'object') {
          if (Array.isArray(rawJson['@graph'])) {
            entries.push(...rawJson['@graph']);
          } else {
            entries.push(rawJson);
          }
        }

        for (const item of entries) {
          const type = String(item['@type'] || '').toLowerCase();
          if (
            type.includes('product') ||
            type.includes('itempage') ||
            type.includes('offer')
          ) {
            if (item.name && !title) title = String(item.name).trim();

            if (item.brand && !brand) {
              brand =
                typeof item.brand === 'object' && item.brand !== null
                  ? String((item.brand as any).name || '')
                  : String(item.brand);
            }

            if (item.offers && !price) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price) {
                price = `${offer.priceCurrency || '$'}${offer.price}`;
              }
            }

            if (item.image) {
              const imgs = Array.isArray(item.image) ? item.image : [item.image];
              for (const img of imgs) {
                const imgUrl = typeof img === 'object' && img !== null ? (img as any).url : String(img);
                addImage(imgUrl);
              }
            }
          }
        }
      } catch {
        // Skip unparseable JSON-LD
      }
    }

    // 2. OpenGraph / Twitter meta tags
    const ogImage =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i)?.[1];
    addImage(ogImage);

    const twitterImage =
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i)?.[1];
    addImage(twitterImage);

    const linkImage = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1];
    addImage(linkImage);

    // 3. E-Commerce Specific Gallery Attributes (Myntra, Zara, Shopify, Amazon)
    // Matches high-resolution image zoom and original sources
    const galleryMatches = html.matchAll(
      /<img[^>]+(?:data-zoom-image|data-original|data-high-res-src|data-large_image|data-src)=["']([^"']+\.(?:jpg|jpeg|png|webp|avif)[^"']*)["']/gi
    );
    for (const gMatch of galleryMatches) {
      if (gMatch[1] && !gMatch[1].startsWith('data:')) {
        addImage(gMatch[1]);
      }
    }

    // 4. Title & Brand Fallbacks
    if (!title) {
      const ogTitle =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
      if (ogTitle) {
        title = ogTitle.trim();
      } else {
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        if (titleTag) title = titleTag.trim();
      }
    }

    if (!brand) {
      const ogSiteName =
        html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
      if (ogSiteName) brand = ogSiteName.trim();
    }

    // 5. Clean Title (strip site suffixes like " | Myntra", " - Buy Online at Zara")
    if (title) {
      title = title
        .replace(/\s*([|•–—-])\s*(Myntra|Zara|Amazon|Flipkart|Ajio|ASOS|SSENSE|Nykaa|H&M|Uniqlo|Urbanic).*$/i, '')
        .trim();
    }

    // 6. Resolve relative URLs & filter out low-quality/icon images
    const resolvedCandidates = Array.from(new Set(imageCandidates))
      .map((img) => {
        try {
          // Handle protocol-relative URLs (e.g. //assets.myntassets.com/...)
          if (img.startsWith('//')) {
            return `https:${img}`;
          }
          return new URL(img, url).toString();
        } catch {
          return null;
        }
      })
      .filter((img): img is string => {
        if (!img) return false;
        if (!isSafePublicUrl(img)) return false;
        const lower = img.toLowerCase();
        return !DISALLOWED_IMAGE_SUBSTRINGS.some((sub) => lower.includes(sub));
      });

    return {
      title,
      brand,
      price,
      sourceDomain,
      imageCandidates: resolvedCandidates,
    };
  } catch (err) {
    console.warn(`[lib/scraper] Scraping failed for ${url}:`, err);
    return {
      title: null,
      brand: null,
      price: null,
      sourceDomain,
      imageCandidates: [],
    };
  }
}
