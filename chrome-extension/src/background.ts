import { fetchOtp, fetchPassword, searchByTerm } from './api.js';
import { resolveSearchUrl, shouldRefreshSearchState } from './backgroundHelpers.js';
import { collectMatchedFields } from './resultMatching.js';
import { getSettings } from './settings.js';
import type { SearchItem, TabState } from './types.js';
import { buildSearchTerms } from './urlMatching.js';

const stateByTab = new Map<number, TabState>();
const activeFrameByTab = new Map<number, number>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      const tabId = sender.tab?.id;
      if (message?.type === 'PAGE_LOADED') {
        const url = resolveSearchUrl(sender.tab?.url, message.url);
        if (typeof tabId === 'number' && url) {
          const settings = await getSettings();
          if (settings.autoSearchOnLoad && shouldRefreshSearchState(stateByTab.get(tabId), url)) {
            await ensureSearchState(tabId, url, true);
          }
        }
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'FIELD_INTERACTION') {
        if (typeof tabId !== 'number') {
          sendResponse({ ok: false, error: 'No active tab.' });
          return;
        }
        if (typeof sender.frameId === 'number') {
          activeFrameByTab.set(tabId, sender.frameId);
        }
        const url = resolveSearchUrl(sender.tab?.url, message.url);
        if (!url) {
          sendResponse({ ok: false, error: 'No tab URL.' });
          return;
        }
        const currentState = await ensureSearchState(tabId, url, false);
        sendResponse({ ok: true, state: currentState });
        return;
      }

      if (message?.type === 'RUN_SEARCH') {
        const tabId = Number(message.tabId);
        const url = String(message.url || '');
        const currentState = await ensureSearchState(tabId, url, true, false);
        sendResponse({ ok: true, state: currentState });
        return;
      }

      if (message?.type === 'GET_TAB_STATE') {
        const tabId = Number(message.tabId);
        sendResponse({ ok: true, state: stateByTab.get(tabId) ?? null });
        return;
      }

      if (message?.type === 'APPLY_RESULT') {
        const tabId = Number(message.tabId);
        const item = message.item as SearchItem;
        await autofillTab(tabId, item);
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown message type.' });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error.' });
    }
  })();

  return true;
});

async function ensureSearchState(tabId: number, url: string, forceRefresh: boolean, allowAutoFill = true): Promise<TabState> {
  const existingState = stateByTab.get(tabId);
  if (existingState && !forceRefresh && !shouldRefreshSearchState(existingState, url)) {
    return existingState;
  }

  const currentState = await runSearch(tabId, url);
  notifyStateUpdated(tabId, currentState);

  if (allowAutoFill) {
    const settings = await getSettings();
    if (settings.autoFillSingleResult && currentState.results.length === 1) {
      await autofillTab(tabId, currentState.results[0]);
    }
  }

  return currentState;
}

async function runSearch(tabId: number, url: string): Promise<TabState> {
  const settings = await getSettings();
  const built = buildSearchTerms(url, settings);

  const aggregated: SearchItem[] = [];
  const seen = new Set<string>();
  let hitTerm: string | undefined;
  let lastError = built.error;

  for (const term of built.terms) {
    const found = await searchByTerm(settings.endpoint, settings.token, term, settings.maxResults);
    let termHasVisibleMatch = false;
    for (const item of found) {
      const id = String(item.Uuid || '');
      if (!id || seen.has(id)) continue;
      const matchedFields = collectMatchedFields(item, settings);
      if (matchedFields.length === 0) continue;
      seen.add(id);
      aggregated.push({ ...item, MatchedFields: matchedFields });
      termHasVisibleMatch = true;
    }
    if (termHasVisibleMatch && !hitTerm) {
      hitTerm = term;
    }
  }

  const tabState: TabState = {
    tabId,
    url,
    terms: built.terms,
    lastMatchTerm: hitTerm,
    results: aggregated,
    lastError,
    updatedAt: Date.now()
  };
  stateByTab.set(tabId, tabState);
  return tabState;
}

function notifyStateUpdated(tabId: number, state: TabState): void {
  chrome.runtime.sendMessage({
    type: 'TAB_STATE_UPDATED',
    tabId,
    state
  }).catch(() => {
    // ignore when popup/options are not listening
  });
}

async function autofillTab(tabId: number, item: SearchItem): Promise<void> {
  const settings = await getSettings();
  const fillItem = { ...item };

  if (settings.fetchSensitiveOnDemand && fillItem.Uuid) {
    if (!fillItem.Password) {
      fillItem.Password = await fetchPassword(settings.endpoint, settings.token, fillItem.Uuid).catch(() => undefined);
    }
    if (!fillItem.OtpCurrent) {
      fillItem.OtpCurrent = await fetchOtp(settings.endpoint, settings.token, fillItem.Uuid).catch(() => undefined);
    }
  }

  const message = {
    type: 'AUTOFILL_ENTRY',
    item: fillItem,
    allowOverwrite: settings.allowOverwrite
  };
  const activeFrameId = activeFrameByTab.get(tabId);

  if (typeof activeFrameId === 'number') {
    await chrome.tabs.sendMessage(tabId, message, { frameId: activeFrameId }).catch(async () => {
      await chrome.tabs.sendMessage(tabId, message);
    });
    return;
  }

  await chrome.tabs.sendMessage(tabId, message);
}
