// Background service worker for crumbs extension

const DEFAULT_API_URL = 'https://crumbsbypixel.vercel.app';

// Set up Context Menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'crumbs-save-page',
    title: 'Save page to crumbs',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'crumbs-save-image',
    title: 'Save image to crumbs',
    contexts: ['image'],
  });

  chrome.contextMenus.create({
    id: 'crumbs-save-link',
    title: 'Save link to crumbs',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'crumbs-snip-area',
    title: '⛶ Snip rectangle on screen',
    contexts: ['page', 'image'],
  });
});

// Flash badge text to give tactile confirmation
function setBadge(text: string, color: string = '#262523', durationMs: number = 2200) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (durationMs > 0) {
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, durationMs);
  }
}

// Perform capture request to backend
async function capturePiece({
  productUrl,
  pageTitle,
  selectedImageUrl,
  imageCandidates,
}: {
  productUrl: string;
  pageTitle?: string;
  selectedImageUrl?: string;
  imageCandidates?: string[];
}) {
  const syncData = await chrome.storage.sync.get(['crumbs_token', 'crumbs_api_url']);
  const token = syncData.crumbs_token;
  const apiUrl = (syncData.crumbs_api_url || DEFAULT_API_URL).replace(/\/$/, '');

  if (!token) {
    setBadge('!', '#e11d48', 3500);
    chrome.tabs.create({ url: `${apiUrl}/connect` });
    return { error: 'Not authenticated. Please connect your crumbs account.' };
  }

  setBadge('…', '#262523', 0);

  try {
    const res = await fetch(`${apiUrl}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_url: productUrl,
        page_title: pageTitle || undefined,
        selected_image_url: selectedImageUrl || undefined,
        image_candidates: imageCandidates || (selectedImageUrl ? [selectedImageUrl] : []),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setBadge('!', '#e11d48', 3500);
      return { error: data.error || 'Failed to capture piece' };
    }

    setBadge('✓', '#262523', 2500);
    return { success: true, crumb: data.crumb, deduplicated: data.deduplicated };
  } catch (err) {
    setBadge('!', '#e11d48', 3500);
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

// Start interactive area snip on target tab
async function startAreaSnip(tab?: chrome.tabs.Tab) {
  let targetTab = tab;
  if (!targetTab || !targetTab.id) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = activeTab;
  }
  if (!targetTab?.id) return;

  try {
    const screenshotUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId, { format: 'png' });
    chrome.tabs.sendMessage(targetTab.id, {
      type: 'LAUNCH_SNIP_OVERLAY',
      screenshotUrl,
    });
  } catch (err) {
    console.error('[crumbs] Failed to start area snip:', err);
  }
}

// Handle context menus
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'crumbs-snip-area') {
    await startAreaSnip(tab);
  } else if (info.menuItemId === 'crumbs-save-image' && info.srcUrl) {
    await capturePiece({
      productUrl: tab.url || info.pageUrl || '',
      pageTitle: tab.title,
      selectedImageUrl: info.srcUrl,
      imageCandidates: [info.srcUrl],
    });
  } else if (info.menuItemId === 'crumbs-save-link' && info.linkUrl) {
    await capturePiece({
      productUrl: info.linkUrl,
      pageTitle: undefined,
    });
  } else if (info.menuItemId === 'crumbs-save-page' && tab.url) {
    try {
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_DATA' }, async (response) => {
        if (chrome.runtime.lastError || !response) {
          await capturePiece({
            productUrl: tab.url!,
            pageTitle: tab.title,
          });
        } else {
          await capturePiece({
            productUrl: response.product_url || tab.url!,
            pageTitle: response.page_title || tab.title,
            selectedImageUrl: response.selected_image_url,
            imageCandidates: response.image_candidates,
          });
        }
      });
    } catch {
      await capturePiece({
        productUrl: tab.url,
        pageTitle: tab.title,
      });
    }
  }
});

// Handle keyboard commands (Alt+Shift+S for page, Alt+Shift+X for snip)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'snip-crumbs') {
    await startAreaSnip();
  } else if (command === 'save-to-crumbs') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) return;

    try {
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_DATA' }, async (response) => {
        if (chrome.runtime.lastError || !response) {
          await capturePiece({
            productUrl: tab.url!,
            pageTitle: tab.title,
          });
        } else {
          await capturePiece({
            productUrl: response.product_url || tab.url!,
            pageTitle: response.page_title || tab.title,
            selectedImageUrl: response.selected_image_url,
            imageCandidates: response.image_candidates,
          });
        }
      });
    } catch {
      await capturePiece({
        productUrl: tab.url,
        pageTitle: tab.title,
      });
    }
  }
});

// Relay capture requests from popup / content
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_PIECE') {
    capturePiece(message.payload).then(sendResponse);
    return true;
  } else if (message.type === 'TRIGGER_SNIP_ON_ACTIVE_TAB') {
    startAreaSnip().then(() => sendResponse({ ok: true }));
    return true;
  }
});
