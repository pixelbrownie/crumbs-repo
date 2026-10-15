// Options script for crumbs extension

const DEFAULT_API_URL = 'https://crumbsbypixel.vercel.app';

const statusDot = document.getElementById('status-dot') as HTMLSpanElement;
const statusLabel = document.getElementById('status-label') as HTMLSpanElement;
const inputToken = document.getElementById('input-token') as HTMLInputElement;
const inputApiUrl = document.getElementById('input-api-url') as HTMLInputElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnDisconnect = document.getElementById('btn-disconnect') as HTMLButtonElement;
const feedback = document.getElementById('feedback') as HTMLDivElement;
const linkDashboard = document.getElementById('link-dashboard-token') as HTMLAnchorElement;

async function init() {
  const sync = await chrome.storage.sync.get(['crumbs_token', 'crumbs_api_url', 'crumbs_email']);
  const token = sync.crumbs_token || '';
  const apiUrl = (sync.crumbs_api_url || DEFAULT_API_URL).replace(/\/$/, '');

  inputToken.value = token;
  inputApiUrl.value = apiUrl;
  linkDashboard.href = `${apiUrl}/settings`;

  if (token) {
    statusDot.className = 'status-dot connected';
    statusLabel.textContent = sync.crumbs_email ? `Connected as ${sync.crumbs_email}` : 'Connected with capture token';
  } else {
    statusDot.className = 'status-dot';
    statusLabel.textContent = 'Not connected';
  }

  btnSave.addEventListener('click', handleSave);
  btnDisconnect.addEventListener('click', handleDisconnect);
}

async function handleSave() {
  const token = inputToken.value.trim();
  const rawApiUrl = inputApiUrl.value.trim() || DEFAULT_API_URL;
  const apiUrl = rawApiUrl.replace(/\/$/, '');

  if (!token) {
    showFeedback('error', 'Please enter a valid capture token.');
    return;
  }

  showFeedback('neutral', 'Verifying token...');

  try {
    const res = await fetch(`${apiUrl}/api/capture/token`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      showFeedback('error', 'Token verification failed. Please check your token and URL.');
      return;
    }

    await chrome.storage.sync.set({
      crumbs_token: token,
      crumbs_api_url: apiUrl,
    });

    statusDot.className = 'status-dot connected';
    statusLabel.textContent = 'Connected with capture token';
    showFeedback('success', '✓ Settings saved and verified!');
  } catch (err) {
    // If CORS or offline, still allow saving
    await chrome.storage.sync.set({
      crumbs_token: token,
      crumbs_api_url: apiUrl,
    });
    showFeedback('success', 'Settings saved.');
  }
}

async function handleDisconnect() {
  await chrome.storage.sync.remove(['crumbs_token', 'crumbs_email']);
  inputToken.value = '';
  statusDot.className = 'status-dot';
  statusLabel.textContent = 'Not connected';
  showFeedback('neutral', 'Disconnected from crumbs.');
}

function showFeedback(type: 'success' | 'error' | 'neutral', message: string) {
  feedback.className = `feedback ${type === 'neutral' ? '' : type}`;
  feedback.textContent = message;
  feedback.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', init);
