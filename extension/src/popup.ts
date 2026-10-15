// Popup script for crumbs extension

const DEFAULT_API_URL = 'https://crumbsbypixel.vercel.app';

interface ExtractedData {
  product_url: string;
  page_title: string;
  image_candidates: string[];
  selected_image_url: string | null;
}

let activeToken: string | null = null;
let apiUrl: string = DEFAULT_API_URL;
let currentTab: chrome.tabs.Tab | null = null;
let selectedImage: string | null = null;
let candidateImages: string[] = [];

// Elements
const viewUnauth = document.getElementById('view-unauthenticated') as HTMLDivElement;
const viewCapture = document.getElementById('view-capture') as HTMLDivElement;
const btnConnect = document.getElementById('btn-connect') as HTMLButtonElement;
const btnManualToken = document.getElementById('btn-manual-token') as HTMLButtonElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const candidateGrid = document.getElementById('candidate-grid') as HTMLDivElement;
const inputTitle = document.getElementById('input-title') as HTMLInputElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnSaveText = document.getElementById('btn-save-text') as HTMLSpanElement;
const statusContainer = document.getElementById('status-container') as HTMLDivElement;

async function init() {
  const sync = await chrome.storage.sync.get(['crumbs_token', 'crumbs_api_url']);
  activeToken = sync.crumbs_token || null;
  apiUrl = (sync.crumbs_api_url || DEFAULT_API_URL).replace(/\/$/, '');

  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  btnManualToken.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  btnConnect.addEventListener('click', () => {
    chrome.tabs.create({ url: `${apiUrl}/connect?ext_id=${chrome.runtime.id}` });
    window.close();
  });

  if (!activeToken) {
    viewUnauth.classList.remove('hidden');
    viewCapture.classList.add('hidden');
    return;
  }

  viewUnauth.classList.add('hidden');
  viewCapture.classList.remove('hidden');

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;

  if (!tab || !tab.id || !tab.url) {
    showStatus('error', 'Cannot capture from this browser view.');
    return;
  }

  // Inject or message content script to extract candidates
  chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_DATA' }, (response: ExtractedData | undefined) => {
    if (chrome.runtime.lastError || !response) {
      // Content script may not be injected on this page; use tab info
      handleExtractedData({
        product_url: tab.url!,
        page_title: tab.title || '',
        image_candidates: [],
        selected_image_url: null,
      });
    } else {
      handleExtractedData(response);
    }
  });

  btnSave.addEventListener('click', handleSave);
}

function handleExtractedData(data: ExtractedData) {
  inputTitle.value = data.page_title || '';
  candidateImages = data.image_candidates.slice(0, 6);
  selectedImage = data.selected_image_url || (candidateImages.length > 0 ? candidateImages[0] : null);

  renderCandidates();
}

function renderCandidates() {
  candidateGrid.innerHTML = '';

  if (candidateImages.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.gridColumn = '1 / -1';
    emptyMsg.style.padding = '16px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = '#736f68';
    emptyMsg.style.fontSize = '12px';
    emptyMsg.textContent = 'No product images detected. Our server will scrape the best image on save.';
    candidateGrid.appendChild(emptyMsg);
    return;
  }

  candidateImages.forEach((imgUrl) => {
    const item = document.createElement('div');
    item.className = 'candidate-item' + (imgUrl === selectedImage ? ' selected' : '');

    const img = document.createElement('img');
    img.src = imgUrl;
    img.loading = 'lazy';
    item.appendChild(img);

    if (imgUrl === selectedImage) {
      const badge = document.createElement('div');
      badge.className = 'selected-badge';
      badge.innerHTML = '✓';
      item.appendChild(badge);
    }

    item.addEventListener('click', () => {
      selectedImage = imgUrl;
      renderCandidates();
    });

    candidateGrid.appendChild(item);
  });
}

async function handleSave() {
  if (!activeToken || !currentTab?.url) return;

  btnSave.disabled = true;
  btnSaveText.textContent = 'Saving...';
  statusContainer.classList.add('hidden');

  try {
    const res = await fetch(`${apiUrl}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        product_url: currentTab.url,
        page_title: inputTitle.value.trim() || currentTab.title || undefined,
        selected_image_url: selectedImage || undefined,
        image_candidates: candidateImages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save piece');
    }

    showStatus(
      'success',
      data.deduplicated ? 'Already saved on your board!' : '✓ Saved to crumbs!',
      true
    );
    btnSaveText.textContent = 'Saved';
  } catch (err) {
    showStatus('error', err instanceof Error ? err.message : 'Failed to capture piece');
    btnSave.disabled = false;
    btnSaveText.textContent = 'Save piece';
  }
}

function showStatus(type: 'success' | 'error', message: string, showLink = false) {
  statusContainer.className = `status-badge ${type}`;
  statusContainer.innerHTML = '';

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  statusContainer.appendChild(msgSpan);

  if (showLink) {
    const link = document.createElement('a');
    link.className = 'view-link';
    link.textContent = 'View your board →';
    link.href = '#';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: apiUrl });
      window.close();
    });
    statusContainer.appendChild(link);
  }

  statusContainer.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', init);
