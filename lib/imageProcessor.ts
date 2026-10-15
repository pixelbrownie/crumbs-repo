import sizeOf from 'image-size';
import { isSafePublicUrl } from './security';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  blurDataUrl: string;
}

/**
 * Downloads an image server-side with Referer header and fallback retry.
 */
export async function downloadImageWithReferer(
  imageUrl: string,
  refererUrl?: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // Support direct base64 data URIs (e.g. from screen snips & rectangle crops)
  if (imageUrl.startsWith('data:image/')) {
    try {
      const commaIdx = imageUrl.indexOf(',');
      if (commaIdx > -1) {
        const meta = imageUrl.slice(0, commaIdx);
        const mimeType = meta.split(';')[0].replace('data:', '') || 'image/png';
        const base64Data = imageUrl.slice(commaIdx + 1);
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length > 50) {
          return { buffer, mimeType };
        }
      }
    } catch (e) {
      console.warn('[imageProcessor] Failed to parse data URI:', e);
      return null;
    }
  }

  if (!isSafePublicUrl(imageUrl)) {
    return null;
  }

  const attempts: Record<string, string>[] = [
    // Attempt 1: With Referer header (mimics clicking image on store page)
    ...(refererUrl ? [{ Referer: refererUrl }] : []),
    // Attempt 2: Without Referer (direct CDN request)
    {},
  ];

  for (const headers of attempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/png,*/*;q=0.8',
          ...headers,
        },
      });

      clearTimeout(timeout);

      if (!res.ok) continue;

      const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
      if (!mimeType.startsWith('image/')) continue;

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 500) {
        // Likely an empty pixel or blocked captcha
        continue;
      }

      return { buffer, mimeType };
    } catch {
      // try next header configuration
    }
  }

  return null;
}

/**
 * Extracts width and height, and generates a tiny lightweight blurDataUrl.
 */
export function inspectImage(buffer: Buffer, mimeType: string): {
  width: number;
  height: number;
  blurDataUrl: string;
} {
  let width = 600;
  let height = 800;

  try {
    const dimensions = sizeOf(buffer);
    if (dimensions.width && dimensions.height) {
      width = dimensions.width;
      height = dimensions.height;
    }
  } catch {
    // default dimensions
  }

  // Lightweight 16x16 soft sand blur SVG data URL
  const aspectRatio = width / height;
  const svgWidth = 16;
  const svgHeight = Math.round(16 / (aspectRatio || 1));
  const blurSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}"><rect width="100%" height="100%" fill="#EFEBE4"/><rect width="100%" height="100%" fill="#E2DFD8" opacity="0.3"/></svg>`;
  const blurDataUrl = `data:image/svg+xml;base64,${Buffer.from(blurSvg).toString('base64')}`;

  return { width, height, blurDataUrl };
}

/**
 * Creates a beautiful fallback placeholder image tile for items whose images fail to load.
 */
export function createFallbackPlaceholderTile(domain: string): {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  blurDataUrl: string;
} {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const initial = cleanDomain.charAt(0).toUpperCase() || 'C';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <rect width="100%" height="100%" fill="#EFEBE4"/>
  <circle cx="300" cy="380" r="70" fill="#E2DFD8"/>
  <text x="300" y="405" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="500" fill="#262523" text-anchor="middle">${initial}</text>
  <text x="300" y="490" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="400" fill="#9C978F" text-anchor="middle" letter-spacing="1">${cleanDomain}</text>
</svg>`;

  const buffer = Buffer.from(svg, 'utf-8');
  const mimeType = 'image/svg+xml';
  const blurDataUrl = `data:image/svg+xml;base64,${buffer.toString('base64')}`;

  return {
    buffer,
    mimeType,
    width: 600,
    height: 800,
    blurDataUrl,
  };
}
