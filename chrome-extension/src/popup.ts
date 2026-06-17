import type { SearchItem, TabState } from './types.js';

const statusEl = required<HTMLParagraphElement>('#status');
const resultsEl = required<HTMLDivElement>('#results');
const searchBtn = required<HTMLButtonElement>('#searchBtn');

void initialize();

async function initialize(): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url) {
    status('No active tab URL.');
    return;
  }

  const current = await sendMessage<{ ok: boolean; state: TabState | null }>({ type: 'GET_TAB_STATE', tabId: tab.id });
  if (current.ok && current.state) {
    renderState(current.state);
  }

  searchBtn.addEventListener('click', async () => {
    status('Searching...');
    const response = await sendMessage<{ ok: boolean; state?: TabState; error?: string }>({ type: 'RUN_SEARCH', tabId: tab.id, url: tab.url });
    if (!response.ok || !response.state) {
      status(response.error ?? 'Search failed.');
      return;
    }
    renderState(response.state);
  });
}

function renderState(state: TabState): void {
  if (state.results.length === 0) {
    const termsText = state.terms.length > 0 ? `Searched ${state.terms.length} terms.` : 'No valid URL terms.';
    status(state.lastError ? `${state.lastError} ${termsText}` : `No match. ${termsText}`);
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

    div.append(title, meta, user, matched, btn);
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

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
