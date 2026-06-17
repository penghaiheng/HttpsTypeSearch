import { fetchOtp, fetchPassword, searchByTerm } from './api.js';
import { collectMatchedFields } from './resultMatching.js';
import { getSettings } from './settings.js';
import type { SearchItem, TabState } from './types.js';
import { buildSearchTerms } from './urlMatching.js';

const stateByTab = new Map<number, TabState>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === 'PAGE_LOADED') {
        const tabId = sender.tab?.id;
        const url = message.url as string;
        if (typeof tabId === 'number' && typeof url === 'string') {
          const settings = await getSettings();
          if (settings.autoSearchOnLoad) {
            const currentState = await runSearch(tabId, url);
            if (settings.autoFillSingleResult && currentState.results.length === 1) {
              await autofillTab(tabId, currentState.results[0]);
            }
          }
        }
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'RUN_SEARCH') {
        const tabId = Number(message.tabId);
        const url = String(message.url || '');
        const currentState = await runSearch(tabId, url);
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

async function runSearch(tabId: number, url: string): Promise<TabState> {
  const settings = await getSettings();
  const built = buildSearchTerms(url, settings);

  const aggregated: SearchItem[] = [];
  const seen = new Set<string>();
  let hitTerm: string | undefined;
  let lastError = built.error;

  for (const term of built.terms) {
    const found = await searchByTerm(settings.endpoint, settings.token, term, settings.maxResults);
    for (const item of found) {
      const id = String(item.Uuid || '');
      if (!id || seen.has(id)) continue;
      const matchedFields = collectMatchedFields(item, settings);
      if (matchedFields.length === 0) continue;
      seen.add(id);
      aggregated.push({ ...item, MatchedFields: matchedFields });
    }
    if (found.length > 0) {
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

  await chrome.tabs.sendMessage(tabId, {
    type: 'AUTOFILL_ENTRY',
    item: fillItem,
    allowOverwrite: settings.allowOverwrite
  });
}
