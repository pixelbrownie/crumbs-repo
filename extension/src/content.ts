// Content script for crumbs extension

interface PageData {
  product_url: string;
  page_title: string;
  image_candidates: string[];
  selected_image_url: string | null;
}

// 1. Listen for authentication handoff on crumbs website
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

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
  const h1Text = document.querySelector('h1')?.textContent?.trim();
  const rawTitle = ogTitle || twitterTitle || h1Text || document.title || 'Untitled Piece';
  const page_title = rawTitle.replace(/\s+/g, ' ').trim();

  const candidates: string[] = [];

  const addCandidate = (url: string | null | undefined) => {
    if (!url) return;
    try {
      const resolved = new URL(url, currentUrl).href;
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
  addCandidate(document.querySelector('meta[property="og:image"]')?.getAttribute('content'));
  addCandidate(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'));
  addCandidate(document.querySelector('link[rel="image_src"]')?.getAttribute('href'));

  // Check DOM <img> elements
  const imgs = Array.from(document.querySelectorAll('img'));
  const scoredImgs: { url: string; score: number }[] = [];

  for (const img of imgs) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-zoom-image');
    if (!src) continue;

    const width = img.naturalWidth || img.clientWidth || img.width || 0;
    const height = img.naturalHeight || img.clientHeight || img.height || 0;

    if (width > 0 && width < 160) continue;
    if (height > 0 && height < 160) continue;

    let score = width * height;
    const parentClasses = (img.parentElement?.className || '') + ' ' + (img.className || '');
    if (/product|hero|gallery|zoom|primary|main|featured|carousel/i.test(parentClasses)) {
      score *= 2.5;
    }

    scoredImgs.push({ url: src, score });
  }

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

// 3. Interactive Rectangle Drag-and-Drop Area Snip (Mouse + Touch)
let snipActive = false;

function launchSnipOverlay(screenshotUrl: string) {
  if (snipActive) return;
  snipActive = true;

  const overlay = document.createElement('div');
  overlay.id = 'crumbs-snip-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    cursor: crosshair;
    background: rgba(28, 26, 23, 0.45);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  `;

  // Instructions Banner
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #EFEBE4;
    color: #262523;
    padding: 10px 18px;
    border-radius: 9999px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    z-index: 2147483648;
  `;
  banner.innerHTML = `
    <span style="font-size: 15px;">⛶</span>
    <span>Drag a rectangle over the product to capture · <span style="opacity: 0.65;">Esc to cancel</span></span>
  `;
  overlay.appendChild(banner);

  // Selection Box
  const box = document.createElement('div');
  box.style.cssText = `
    position: absolute;
    border: 2px dashed #FAF8F5;
    outline: 2px solid #262523;
    background: rgba(239, 235, 228, 0.18);
    display: none;
    pointer-events: none;
    z-index: 2147483648;
    box-shadow: 0 0 0 99999px rgba(28, 26, 23, 0.4);
  `;

  // Dimension tag
  const dimTag = document.createElement('div');
  dimTag.style.cssText = `
    position: absolute;
    bottom: -28px;
    right: 0;
    background: #262523;
    color: #FAF8F5;
    font-family: monospace;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
    display: none;
  `;
  box.appendChild(dimTag);
  overlay.appendChild(box);

  document.body.appendChild(overlay);

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;

  const getCoords = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY };
  };

  const handleStart = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    const { clientX, clientY } = getCoords(e);
    startX = clientX;
    startY = clientY;
    currentX = clientX;
    currentY = clientY;

    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
    dimTag.style.display = 'block';
  };

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const { clientX, clientY } = getCoords(e);
    currentX = clientX;
    currentY = clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    dimTag.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
  };

  const cleanup = () => {
    snipActive = false;
    overlay.remove();
    document.removeEventListener('keydown', handleKeyDown);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const cropLeft = Math.min(startX, currentX);
    const cropTop = Math.min(startY, currentY);
    const cropWidth = Math.abs(currentX - startX);
    const cropHeight = Math.abs(currentY - startY);

    if (cropWidth < 25 || cropHeight < 25) {
      cleanup();
      return;
    }

    // Process crop from screenshot
    banner.innerHTML = `<span>Saving snip to crumbs...</span>`;

    const img = new Image();
    img.onload = () => {
      try {
        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cropWidth * scaleX);
        canvas.height = Math.round(cropHeight * scaleY);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            Math.round(cropLeft * scaleX),
            Math.round(cropTop * scaleY),
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const croppedDataUrl = canvas.toDataURL('image/png');

          // Send to background for capture
          chrome.runtime.sendMessage({
            type: 'CAPTURE_PIECE',
            payload: {
              productUrl: window.location.href,
              pageTitle: document.title || 'Screen Snip',
              selectedImageUrl: croppedDataUrl,
              imageCandidates: [croppedDataUrl],
            },
          });

          showFloatingToast('✓ Piece saved to crumbs!');
        }
      } catch (err) {
        console.error('[crumbs] Crop failed:', err);
      } finally {
        cleanup();
      }
    };
    img.src = screenshotUrl;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  overlay.addEventListener('mousedown', handleStart);
  overlay.addEventListener('mousemove', handleMove);
  overlay.addEventListener('mouseup', handleEnd);

  overlay.addEventListener('touchstart', handleStart, { passive: false });
  overlay.addEventListener('touchmove', handleMove, { passive: false });
  overlay.addEventListener('touchend', handleEnd, { passive: false });

  document.addEventListener('keydown', handleKeyDown);
}

function showFloatingToast(message: string) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    right: 28px;
    background: #262523;
    color: #FAF8F5;
    padding: 12px 20px;
    border-radius: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    z-index: 2147483647;
    animation: crumbsFadeUp 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// 4. Runtime message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE_DATA') {
    const data = extractPageData();
    sendResponse(data);
  } else if (message.type === 'LAUNCH_SNIP_OVERLAY' && message.screenshotUrl) {
    launchSnipOverlay(message.screenshotUrl);
    sendResponse({ started: true });
  }
  return true;
});
