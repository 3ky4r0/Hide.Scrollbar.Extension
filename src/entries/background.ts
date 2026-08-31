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
  if (tabId === undefined || !getSyncState) return;
  const { scrollbarHidden, whitelist } = await getSyncState();
  await updateBadge(tabId, scrollbarHidden, whitelist);
};

const updateAllBadges = async (): Promise<void> => {
  if (!getSyncState) return;
  const { scrollbarHidden, whitelist } = await getSyncState();

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => updateBadge(tab.id, scrollbarHidden, whitelist));
  });
};

const injectAllTabs = async (): Promise<void> => {
  if (!getSyncState) return;
  const { scrollbarHidden, whitelist } = await getSyncState();

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      updateBadge(tab.id, scrollbarHidden, whitelist);

      if (tab.id && tab.url && (!isRestrictedUrl || !isRestrictedUrl(tab.url)) && chrome.scripting) {
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

injectAllTabs().catch((err: unknown) => {
  console.error('[Background] Startup injectAllTabs failed', { error: err });
});

/* ── Context Menu ────────────────────────────────────────── */

const COLOR_PICKER_MENU_ID = 'scroll-hide-pick-color';
const FAVICON_MENU_ID      = 'scroll-hide-get-favicon';
const RULER_MENU_ID        = 'scroll-hide-page-ruler';
const DRAW_MENU_ID         = 'scroll-hide-page-draw';

const CONTEXT_MENU_PATTERNS = ['http://*/*', 'https://*/*', 'file://*/*'];

const setupContextMenus = (): void => {
  if (chrome.sidePanel && chrome.sidePanel.setOptions) {
    chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
  }
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: COLOR_PICKER_MENU_ID,
      title: chrome.i18n.getMessage('pickColor') || 'Pick Color',
      contexts: ['all'],
      documentUrlPatterns: CONTEXT_MENU_PATTERNS,
    });
    chrome.contextMenus.create({
      id: RULER_MENU_ID,
      title: chrome.i18n.getMessage('pageRuler') || 'Page Ruler',
      contexts: ['all'],
      documentUrlPatterns: CONTEXT_MENU_PATTERNS,
    });
    chrome.contextMenus.create({
      id: DRAW_MENU_ID,
      title: chrome.i18n.getMessage('pageDraw') || 'Draw on Page',
      contexts: ['all'],
      documentUrlPatterns: CONTEXT_MENU_PATTERNS,
    });
    chrome.contextMenus.create({
      id: FAVICON_MENU_ID,
      title: chrome.i18n.getMessage('getFavicon') || 'Get Favicon',
      contexts: ['all'],
      documentUrlPatterns: CONTEXT_MENU_PATTERNS,
    });
  });
};

chrome.runtime.onInstalled.addListener(setupContextMenus);
chrome.runtime.onStartup.addListener(setupContextMenus);
setupContextMenus();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === COLOR_PICKER_MENU_ID) {
    try {
      const syncData = await new Promise<{ theme?: string }>((resolve) => {
        chrome.storage.sync.get({ theme: 'system' }, (res) => resolve(res));
      });
      const currentTheme = syncData?.theme || 'system';

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [currentTheme],
        func: async (themePref: string) => {
          if (!('EyeDropper' in window)) {
            alert('EyeDropper is not supported on this page.');
            return;
          }
          try {
            const dropper = new (window as any).EyeDropper();
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

            // Show glassmorphic toast notification
            const oldToast = document.getElementById('scrollhide-color-toast-root');
            if (oldToast) oldToast.remove();

            const isLight = themePref === 'light' || (themePref === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);

            const host = document.createElement('div');
            host.id = 'scrollhide-color-toast-root';
            host.setAttribute('data-theme', isLight ? 'light' : 'dark');
            const shadow = host.attachShadow({ mode: 'open' });

            const style = document.createElement('style');
            style.textContent = `
              .toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: rgba(28, 28, 30, 0.88);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 10px;
                padding: 8px 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                font-weight: 500;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: 2147483647;
              }
              :host([data-theme="light"]) .toast {
                background: rgba(255, 255, 255, 0.92);
                border: 1px solid rgba(0, 0, 0, 0.12);
                color: #1c1c1e;
              }
              .toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
              .swatch {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: ${hex};
                border: 2px solid rgba(255, 255, 255, 0.7);
                flex-shrink: 0;
              }
              :host([data-theme="light"]) .swatch {
                border: 2px solid rgba(0, 0, 0, 0.2);
              }
              .hex {
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                font-weight: 700;
                letter-spacing: 0.5px;
              }
              .check {
                color: #34c759;
                display: flex;
                align-items: center;
                margin-left: 2px;
              }
            `;

            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `
              <div class="swatch"></div>
              <span class="hex">${hex}</span>
              <span style="opacity: 0.65; font-size: 12px;">Đã sao chép</span>
              <span class="check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            `;

            shadow.appendChild(style);
            shadow.appendChild(toast);
            document.documentElement.appendChild(host);

            requestAnimationFrame(() => {
              toast.classList.add('show');
            });

            setTimeout(() => {
              toast.classList.remove('show');
              setTimeout(() => host.remove(), 300);
            }, 2200);
          } catch (err: any) {
            if (err && err.name === 'AbortError') {
              return;
            }
          }
        },
      });
    } catch (_) {}
  }

  if (info.menuItemId === FAVICON_MENU_ID) {
    openFaviconViewer(tab);
  }

  if (info.menuItemId === RULER_MENU_ID) {
    if (tab.id && chrome.scripting) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/features/ruler/ruler.js'],
      }).catch(() => {});
    }
  }

  if (info.menuItemId === DRAW_MENU_ID) {
    if (tab.id && chrome.scripting) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/features/draw/draw.js'],
      }).catch(() => {});
    }
  }
});

/* ── Favicon Viewer (Side Panel) ──────────────────────────── */

const openFaviconViewer = (tab: chrome.tabs.Tab): void => {
  if (chrome.sidePanel && chrome.sidePanel.open && tab) {
    if (tab.id) {
      chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'src/features/favicon/favicon.html',
        enabled: true,
      }).catch(() => {});
    }

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

const openTabFallback = (tab: chrome.tabs.Tab): void => {
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
