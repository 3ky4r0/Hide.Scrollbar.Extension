if (typeof importScripts === 'function') {
  importScripts(
    '/src/shared/constants.js',
    '/src/shared/storage.js',
    '/src/features/whitelist/whitelist-service.js'
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

/* ── Color Picker — Context Menu ─────────────────────────── */

const COLOR_PICKER_MENU_ID = 'scroll-hide-pick-color';
const FAVICON_MENU_ID      = 'scroll-hide-get-favicon';

const setupContextMenus = () => {
  if (chrome.sidePanel && chrome.sidePanel.setOptions) {
    // Disable side panel globally by default so it never leaks to other tabs
    chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
  }
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: COLOR_PICKER_MENU_ID,
      title: 'Pick Color',
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: FAVICON_MENU_ID,
      title: 'Get Favicon',
      contexts: ['all'],
    });
  });
};

chrome.runtime.onInstalled.addListener(setupContextMenus);
chrome.runtime.onStartup.addListener(setupContextMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === COLOR_PICKER_MENU_ID) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          if (!('EyeDropper' in window)) {
            alert('EyeDropper is not supported on this page.');
            return;
          }
          try {
            const dropper = new window.EyeDropper();
            const result = await dropper.open();
            const hex = (result.sRGBHex || '').toUpperCase();
            try {
              await navigator.clipboard.writeText(hex);
            } catch (_) {
              const ta = document.createElement('textarea');
              ta.value = hex;
              ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            alert(`${hex}\nHex code copied to clipboard!`);
          } catch (err) {
            if (err && err.name === 'AbortError') {
              return;
            }
            alert('Could not pick a color. Please try again.');
          }
        },
      });
    } catch (_) {
      // Ignored for internal browser pages where script injection is restricted
    }
  }

  if (info.menuItemId === FAVICON_MENU_ID) {
    openFaviconViewer(tab);
  }
});

/* ── Favicon Viewer (Side Panel) ──────────────────────────── */

const openFaviconViewer = (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open && tab) {
    // Set path for this tab
    if (tab.id) {
      chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'src/features/favicon/favicon.html',
        enabled: true,
      }).catch(() => {});
    }

    // Call open immediately to preserve the synchronous user gesture
    const openPromise = tab.id
      ? chrome.sidePanel.open({ tabId: tab.id })
      : chrome.sidePanel.open({ windowId: tab.windowId });

    openPromise.catch((err) => {
      console.warn('[Background] sidePanel.open with tabId failed, trying windowId:', err);
      if (tab.windowId) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch((err2) => {
          console.warn('[Background] sidePanel.open with windowId failed, falling back to tab:', err2);
          openTabFallback(tab);
        });
      } else {
        openTabFallback(tab);
      }
    });

    return;
  }

  openTabFallback(tab);
};

const openTabFallback = (tab) => {
  const favUrl = tab?.favIconUrl || '';
  const tabUrl = tab?.url || '';

  if (!favUrl && !tabUrl) {
    if (tab?.id && chrome.scripting) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert('No favicon found on this page.'),
      }).catch(() => {});
    }
    return;
  }

  const viewerUrl = chrome.runtime.getURL('src/features/favicon/favicon.html')
    + `?favUrl=${encodeURIComponent(favUrl)}&tabUrl=${encodeURIComponent(tabUrl)}`;

  chrome.tabs.create({ url: viewerUrl });
};

