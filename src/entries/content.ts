(function () {
  const { STYLE_ID } = (globalThis as any).ScrollHideConstants || { STYLE_ID: 'hide-scrollbar-style' };
  const { getSyncState } = (globalThis as any).ScrollHideStorage || {};
  const { isWhitelisted, isRestrictedUrl } = (globalThis as any).ScrollHideWhitelist || {};

  const CSS_TEXT = `
    ::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent !important;
    }
    ::-webkit-scrollbar-thumb,
    ::-webkit-scrollbar-track,
    ::-webkit-scrollbar-corner,
    ::-webkit-scrollbar-button {
      display: none !important;
      background: transparent !important;
    }
    html, body, * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    div[data-visualcompletion="ignore"][data-thumb="1"],
    .os-scrollbar,
    .os-scrollbar-track,
    .os-scrollbar-handle,
    .simplebar-scrollbar,
    .simplebar-track,
    .ps__rail-x,
    .ps__rail-y,
    .nicescroll-rails,
    .mCSB_scrollTools,
    .mCSB_dragger,
    .nano-pane,
    .nano-slider,
    .mac-scrollbar {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
    }
  `;

  const SESSION_CACHE_KEY = '__scrollhide_state__';

  const readSessionCache = (): boolean | null => {
    try {
      const val = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (val === '0') return false;
      if (val === '1') return true;
    } catch (_) {}
    return null;
  };

  const writeSessionCache = (hide: boolean): void => {
    try {
      sessionStorage.setItem(SESSION_CACHE_KEY, hide ? '1' : '0');
    } catch (_) {}
  };

  const applyStyle = (hide: boolean): void => {
    let style = document.getElementById(STYLE_ID);
    if (hide) {
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS_TEXT;
        const target = document.head || document.documentElement;
        if (target) {
          target.appendChild(style);
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            if (!document.getElementById(STYLE_ID)) {
              (document.head || document.documentElement)?.appendChild(style!);
            }
          }, { once: true });
        }
      }
    } else if (style) {
      style.remove();
    }
  };

  // Instant zero-latency injection at document_start to eliminate Flash of Scrollbar
  const isRestricted = isRestrictedUrl ? isRestrictedUrl(window.location.href) : false;
  if (!isRestricted) {
    const cached = readSessionCache();
    if (cached !== false) {
      applyStyle(true);
    }
  }

  const update = async (): Promise<void> => {
    if (!getSyncState || typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    try {
      const state = await getSyncState();
      if (!state) return;
      const isWhite = isWhitelisted ? isWhitelisted(window.location.hostname, state.whitelist) : false;
      const shouldHide = state.scrollbarHidden !== false && !isWhite && !isRestricted;

      writeSessionCache(shouldHide);
      applyStyle(shouldHide);

      // Defer analytics counter write to browser idle time so it never competes with initial page rendering
      if (shouldHide && window === window.top && typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
        const incrementCounter = () => {
          try {
            if (typeof chrome === 'undefined' || !chrome.runtime?.id || !chrome.storage?.local) return;
            chrome.storage.local.get({ hideCount: 0 }, (res) => {
              if (chrome.runtime?.lastError || !chrome.runtime?.id) return;
              chrome.storage.local.set({ hideCount: ((res?.hideCount as number) || 0) + 1 });
            });
          } catch (_) {}
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(incrementCounter, { timeout: 3000 });
        } else {
          setTimeout(incrementCounter, 1000);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Extension context invalidated')) {
        return;
      }
      console.error('[Content] Failed to read sync state', { error: err });
    }
  };

  update();

  if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.onChanged) {
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
        if (namespace === 'sync' && (changes.scrollbarHidden || changes.whitelist)) {
          update();
        }
      });
    } catch (_) {}
  }
})();
