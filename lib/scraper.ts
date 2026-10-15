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
];

export async function scrapeProductPage(
  url: string
): Promise<ScrapedProductData> {
  const parsedUrl = new URL(url);
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
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (crumbs-bot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
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

    // Limit read size to 512KB for security & speed
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 512 * 1024) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel();
    } else {
      html = (await res.text()).slice(0, 512 * 1024);
    }

    const imageCandidates: string[] = [];
    let title: string | null = null;
    let brand: string | null = null;
    let price: string | null = null;

    // 1. Check JSON-LD
    const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const type = String(item['@type'] || '');
          if (type.toLowerCase().includes('product')) {
            if (item.name && !title) title = String(item.name).trim();
            if (item.brand) {
              brand = typeof item.brand === 'object' ? item.brand.name : String(item.brand);
            }
            if (item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price) {
                price = `${offer.priceCurrency || '$'}${offer.price}`;
              }
            }
            if (item.image) {
              const imgs = Array.isArray(item.image) ? item.image : [item.image];
              for (const img of imgs) {
                const imgUrl = typeof img === 'object' ? img.url : String(img);
                if (imgUrl && isSafePublicUrl(imgUrl)) imageCandidates.push(imgUrl);
              }
            }
          }
        }
      } catch {
        // invalid JSON-LD segment
      }
    }

    // 2. OpenGraph / Twitter meta tags
    const ogImage = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i)?.[1];
    if (ogImage) imageCandidates.push(ogImage);

    const twitterImage = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i)?.[1];
    if (twitterImage) imageCandidates.push(twitterImage);

    // 3. Title fallback
    if (!title) {
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
      if (ogTitle) {
        title = ogTitle.trim();
      } else {
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        if (titleTag) title = titleTag.trim();
      }
    }

    // 4. Resolve relative URLs & filter low-quality images
    const resolvedCandidates = Array.from(new Set(imageCandidates))
      .map((img) => {
        try {
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
