if (typeof importScripts === 'function') {
  importScripts(
    '../shared/constants.js',
    '../shared/storage.js',
    '../features/whitelist/whitelist-service.js'
  );
}

const { BADGE_ACTIVE_COLOR, BADGE_INACTIVE_COLOR } = globalThis.ScrollHideConstants;
const { getSyncState } = globalThis.ScrollHideStorage;
const { isRestrictedUrl, isWhitelisted } = globalThis.ScrollHideWhitelist;

const updateBadge = async (tabId, scrollbarHidden, whitelist) => {
  let restricted = false;
  let whitelisted = false;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      restricted = isRestrictedUrl(tab.url);
      if (!restricted) {
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

const updateBadgeForTab = async (tabId) => {
  const { scrollbarHidden, whitelist } = await getSyncState();
  await updateBadge(tabId, scrollbarHidden, whitelist);
};

const updateAllBadges = async () => {
  const { scrollbarHidden, whitelist } = await getSyncState();

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => updateBadge(tab.id, scrollbarHidden, whitelist));
  });
};

const injectAllTabs = async () => {
  const { scrollbarHidden, whitelist } = await getSyncState();

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      updateBadge(tab.id, scrollbarHidden, whitelist);

      if (tab.url && !isRestrictedUrl(tab.url) && chrome.scripting) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            "src/shared/constants.js",
            "src/shared/storage.js",
            "src/features/whitelist/whitelist-service.js",
            "src/entries/content.js"
          ]
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

chrome.storage.onChanged.addListener((_, namespace) => {
  if (namespace === 'sync') updateAllBadges();
});

chrome.runtime.onStartup.addListener(injectAllTabs);
chrome.runtime.onInstalled.addListener(injectAllTabs);

injectAllTabs().catch((err) => {
  console.error('[Background] Startup injectAllTabs failed', { error: err });
});
