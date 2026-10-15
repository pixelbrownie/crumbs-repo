// Content script for crumbs extension

interface PageData {
  product_url: string;
  page_title: string;
  image_candidates: string[];
  selected_image_url: string | null;
}

// 1. Listen for authentication handoff on crumbs website (crumbsbypixel.vercel.app or localhost)
if (
  window.location.hostname.includes('crumbsbypixel.vercel.app') ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
) {
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'CRUMBS_CONNECT_TOKEN' && event.data?.token) {
      const token = event.data.token;
      const email = event.data.email || '';
      try {
        await chrome.storage.sync.set({
          crumbs_token: token,
          crumbs_email: email,
          connected_at: new Date().toISOString(),
        });
        window.postMessage({ type: 'CRUMBS_CONNECT_ACK', success: true }, '*');
      } catch (err) {
        console.error('[crumbs] Failed to save token to storage:', err);
      }
    }
  });
}

// 2. Page data extractor for candidate images and product meta
export function extractPageData(): PageData {
  const currentUrl = window.location.href;
  const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const canonicalUrl = canonicalEl?.href || currentUrl;

  // Title
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
  const h1Text = document.querySelector('h1')?.textContent?.trim();
  const rawTitle = ogTitle || twitterTitle || h1Text || document.title || 'Untitled Piece';
  const page_title = rawTitle.replace(/\s+/g, ' ').trim();

  // Candidates
  const candidates: string[] = [];

  const addCandidate = (url: string | null | undefined) => {
    if (!url) return;
    try {
      const resolved = new URL(url, currentUrl).href;
      // Skip data URIs, SVGs, badges, tracking pixels
      if (
        resolved.startsWith('data:') ||
        resolved.endsWith('.svg') ||
        resolved.includes('tracking') ||
        resolved.includes('pixel') ||
        resolved.includes('logo') ||
        resolved.includes('favicon') ||
        resolved.includes('sprite') ||
        resolved.includes('icon')
      ) {
        return;
      }
      if (!candidates.includes(resolved)) {
        candidates.push(resolved);
      }
    } catch {
      // ignore invalid URLs
    }
  };

  // Check JSON-LD
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent || '');
      const findImages = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj['@type'] === 'Product' || obj.image) {
          if (typeof obj.image === 'string') addCandidate(obj.image);
          if (Array.isArray(obj.image)) {
            obj.image.forEach((img: any) => {
              if (typeof img === 'string') addCandidate(img);
              if (img?.url) addCandidate(img.url);
            });
          }
        }
        for (const key of Object.keys(obj)) {
          findImages(obj[key]);
        }
      };
      findImages(data);
    } catch {
      // skip invalid JSON
    }
  }

  // Check meta tags
  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const twitterImg = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  const imageSrc = document.querySelector('link[rel="image_src"]')?.getAttribute('href');
  addCandidate(ogImg);
  addCandidate(twitterImg);
  addCandidate(imageSrc);

  // Check DOM <img> elements
  const imgs = Array.from(document.querySelectorAll('img'));
  const scoredImgs: { url: string; score: number }[] = [];

  for (const img of imgs) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-zoom-image');
    if (!src) continue;

    const width = img.naturalWidth || img.clientWidth || img.width || 0;
    const height = img.naturalHeight || img.clientHeight || img.height || 0;

    // Reject tiny thumbnails or banner graphics
    if (width > 0 && width < 160) continue;
    if (height > 0 && height < 160) continue;

    let score = width * height;

    // Prioritize product gallery markers
    const parentClasses = (img.parentElement?.className || '') + ' ' + (img.className || '');
    if (/product|hero|gallery|zoom|primary|main|featured|carousel/i.test(parentClasses)) {
      score *= 2.5;
    }

    scoredImgs.push({ url: src, score });
  }

  // Sort images by calculated score descending
  scoredImgs.sort((a, b) => b.score - a.score);
  for (const item of scoredImgs) {
    addCandidate(item.url);
  }

  const image_candidates = candidates.slice(0, 8);
  const selected_image_url = image_candidates.length > 0 ? image_candidates[0] : null;

  return {
    product_url: canonicalUrl,
    page_title,
    image_candidates,
    selected_image_url,
  };
}

// 3. Listen for message from popup or background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE_DATA') {
    const data = extractPageData();
    sendResponse(data);
  }
  return true;
});
