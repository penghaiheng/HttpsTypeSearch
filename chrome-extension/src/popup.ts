import type { SearchItem, TabState } from './types.js';

const statusEl = required<HTMLParagraphElement>('#status');
const resultsEl = required<HTMLDivElement>('#results');
const searchBtn = required<HTMLButtonElement>('#searchBtn');

let activeTabId: number | null = null;

void initialize();

async function initialize(): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url) {
    status('No active tab URL.');
    return;
  }

  const tabId = tab.id;
  const tabUrl = tab.url;
  activeTabId = tabId;
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'TAB_STATE_UPDATED') return;
    if (typeof message.tabId !== 'number' || message.tabId !== activeTabId) return;
    if (!message.state) return;
    renderState(message.state as TabState);
  });

  const current = await sendMessage<{ ok: boolean; state: TabState | null }>({ type: 'GET_TAB_STATE', tabId });
  if (current.ok && current.state) {
    renderState(current.state);
  } else {
    await refreshState(tabId, tabUrl);
  }

  searchBtn.addEventListener('click', async () => {
    await refreshState(tabId, tabUrl);
  });
}

async function refreshState(tabId: number, tabUrl: string): Promise<void> {
  status('Searching...');
  const response = await sendMessage<{ ok: boolean; state?: TabState; error?: string }>({ type: 'RUN_SEARCH', tabId, url: tabUrl });
  if (!response.ok || !response.state) {
    status(presentError(response.error ?? 'Search failed.'));
    return;
  }
  renderState(response.state);
}

function renderState(state: TabState): void {
  if (state.results.length === 0) {
    const termsText = state.terms.length > 0 ? `Searched ${state.terms.length} terms.` : 'No valid URL terms.';
    status(state.lastError ? `${presentError(state.lastError)} ${termsText}` : `No match. ${termsText}`);
    resultsEl.innerHTML = '';
    return;
  }

  status(`Matched ${state.results.length} entries${state.lastMatchTerm ? ` (term: ${state.lastMatchTerm})` : ''}.`);
  resultsEl.innerHTML = '';

  for (const item of state.results) {
    const div = document.createElement('div');
    div.className = 'item';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = String(item.Title || '(untitled)');

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${String(item.Database || '')} ${String(item.GroupPath || '')}`.trim();

    const user = document.createElement('div');
    user.className = 'meta';
    user.textContent = `User: ${String(item.UserName || '')}`;

    const matched = document.createElement('div');
    matched.className = 'meta';
    const matchedFields = Array.isArray(item.MatchedFields) ? item.MatchedFields : [];
    matched.textContent = matchedFields.map((field) => `${field.key}: ${field.value}`).join(' | ');

    const btn = document.createElement('button');
    btn.textContent = 'Fill this';
    btn.addEventListener('click', async () => {
      const tab = await getCurrentTab();
      if (!tab?.id) return;
      const response = await sendMessage<{ ok: boolean; error?: string }>({ type: 'APPLY_RESULT', tabId: tab.id, item });
      status(response.ok ? 'Fill request sent.' : `Fill failed: ${response.error ?? 'unknown'}`);
    });

    if (matchedFields.length > 0) {
      div.append(title, meta, user, matched, btn);
    } else {
      div.append(title, meta, user, btn);
    }
    resultsEl.appendChild(div);
  }
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendMessage<T>(message: unknown): Promise<T> {
  return (await chrome.runtime.sendMessage(message)) as T;
}

function status(text: string): void {
  statusEl.textContent = text;
}

function presentError(rawError: string): string {
  const text = String(rawError || '').trim();
  const signal = text.toLowerCase();
  const isCertificateOrFetchError = signal.includes('failed to fetch')
    || signal.includes('failed to reach')
    || signal.includes('certificate')
    || signal.includes('err_cert');

  if (!isCertificateOrFetchError) {
    return text;
  }

  return `请求失败：可能是本地 HTTPS 证书不受信任（浏览器扩展无法忽略证书错误）。请信任证书，或改用 http://localhost / http://127.0.0.1。${text ? ` 原始错误：${text}` : ''}`;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
