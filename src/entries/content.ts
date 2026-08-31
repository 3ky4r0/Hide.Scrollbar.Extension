(function () {
  const { STYLE_ID } = (globalThis as any).ScrollHideConstants || { STYLE_ID: 'hide-scrollbar-style' };
  const { getSyncState } = (globalThis as any).ScrollHideStorage || {};
  const { isWhitelisted, isRestrictedUrl } = (globalThis as any).ScrollHideWhitelist || {};

  const CSS_TEXT = `
    ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
    div[data-visualcompletion="ignore"][data-thumb="1"],
    .os-scrollbar,
    .simplebar-scrollbar,
    .simplebar-track,
    .ps__rail-x,
    .ps__rail-y,
    .mac-scrollbar {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
    }
  `;

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
    applyStyle(true);
  }

  const update = async (): Promise<void> => {
    if (!getSyncState || typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    try {
      const state = await getSyncState();
      if (!state) return;
      const isWhite = isWhitelisted ? isWhitelisted(window.location.hostname, state.whitelist) : false;
      const shouldHide = state.scrollbarHidden !== false && !isWhite && !isRestricted;

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
