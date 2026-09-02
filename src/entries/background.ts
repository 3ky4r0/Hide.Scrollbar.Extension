export {};

declare function importScripts(...urls: string[]): void;

if (typeof importScripts === 'function') {
  importScripts(
    '/src/shared/constants.js',
    '/src/shared/storage.js',
    '/src/features/whitelist/whitelist-service.js'
  );
}

const { BADGE_ACTIVE_COLOR, BADGE_INACTIVE_COLOR } = (globalThis as any).ScrollHideConstants || {
  BADGE_ACTIVE_COLOR: '#2772ed',
  BADGE_INACTIVE_COLOR: '#888',
};
const { getSyncState } = (globalThis as any).ScrollHideStorage || {};
const { isRestrictedUrl, isWhitelisted } = (globalThis as any).ScrollHideWhitelist || {};

// In-memory cache for Service Worker lifespan to avoid repeated storage disk/IPC reads
let cachedState: { scrollbarHidden: boolean; whitelist: string[] } | null = null;

const getCachedSyncState = async (): Promise<{ scrollbarHidden: boolean; whitelist: string[] }> => {
  if (cachedState) return cachedState;
  if (!getSyncState) return { scrollbarHidden: true, whitelist: [] };
  const state = await getSyncState();
  cachedState = {
    scrollbarHidden: state.scrollbarHidden !== false,
    whitelist: Array.isArray(state.whitelist) ? state.whitelist : [],
  };
  return cachedState;
};

const updateBadge = async (tabId: number | undefined, scrollbarHidden: boolean, whitelist: string[]): Promise<void> => {
  if (tabId === undefined) return;
  let restricted = false;
  let whitelisted = false;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      restricted = isRestrictedUrl ? isRestrictedUrl(tab.url) : false;
      if (!restricted && isWhitelisted) {
        whitelisted = isWhitelisted(new URL(tab.url).hostname, whitelist);
      }
    } else {
      restricted = true;
    }
  } catch (_) {
    restricted = true;
  }

  if (restricted) {
    chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
    return;
  }

  const active = scrollbarHidden && !whitelisted;
  chrome.action.setBadgeText({ text: active ? 'ON' : 'OFF', tabId }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({
    color: active ? BADGE_ACTIVE_COLOR : BADGE_INACTIVE_COLOR,
    tabId,
  }).catch(() => {});
};

const updateBadgeForTab = async (tabId: number | undefined): Promise<void> => {
  if (tabId === undefined) return;
  const { scrollbarHidden, whitelist } = await getCachedSyncState();
  await updateBadge(tabId, scrollbarHidden, whitelist);
};

const updateAllBadges = async (): Promise<void> => {
  const { scrollbarHidden, whitelist } = await getCachedSyncState();
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => updateBadge(tab.id, scrollbarHidden, whitelist));
  });
};

const injectAllTabs = async (): Promise<void> => {
  const { scrollbarHidden, whitelist } = await getCachedSyncState();

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      updateBadge(tab.id, scrollbarHidden, whitelist);

      if (tab.id && tab.url && (!isRestrictedUrl || !isRestrictedUrl(tab.url)) && chrome.scripting) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'src/shared/constants.js',
            'src/shared/storage.js',
            'src/features/whitelist/whitelist-service.js',
            'src/entries/content.js',
          ],
        }).catch(() => {});
      }
    });
  });
};

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId));

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' || info.status === 'complete' || info.url) {
    updateBadgeForTab(tabId);
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    cachedState = null; // Invalidate cache
    updateAllBadges();
  }
});

// Initialize tabs injection upon installation or update
chrome.runtime.onInstalled.addListener(() => {
  injectAllTabs().catch(() => {});
});

/* ── Keyboard Shortcuts & Messages ────────────────────────── */

const handleToggleScrollbar = async (): Promise<void> => {
  const syncData = await new Promise<{ scrollbarHidden?: boolean }>((resolve) => {
    chrome.storage.sync.get({ scrollbarHidden: true }, resolve);
  });
  const newState = !(syncData.scrollbarHidden ?? true);
  await chrome.storage.sync.set({ scrollbarHidden: newState });
  cachedState = null;
  updateAllBadges();
};

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-scrollbar') {
    handleToggleScrollbar();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.action === 'toggle-scrollbar') {
    handleToggleScrollbar();
  }
});

