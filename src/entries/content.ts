(function () {
  const { STYLE_ID } = (globalThis as any).ScrollHideConstants || { STYLE_ID: 'hide-scrollbar-style' };
  const { getSyncState } = (globalThis as any).ScrollHideStorage || {};
  const { isWhitelisted } = (globalThis as any).ScrollHideWhitelist || {};

  const applyStyle = (hide: boolean): void => {
    let style = document.getElementById(STYLE_ID);
    if (hide && !style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
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
      (document.head || document.documentElement).appendChild(style);
    } else if (!hide && style) {
      style.remove();
    }
  };

  const update = async (): Promise<void> => {
    if (!getSyncState) return;
    try {
      const state = await getSyncState();
      const isWhite = isWhitelisted ? isWhitelisted(window.location.hostname, state.whitelist) : false;
      const shouldHide = state.scrollbarHidden && !isWhite;

      const styleBefore = document.getElementById(STYLE_ID);
      applyStyle(shouldHide);
      const styleAfter = document.getElementById(STYLE_ID);

      if (shouldHide && !styleBefore && styleAfter && window === window.top && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ hideCount: 0 }, (res) => {
          chrome.storage.local.set({ hideCount: ((res.hideCount as number) || 0) + 1 });
        });
      }
    } catch (err) {
      console.error('[Content] Failed to read sync state', { error: err });
    }
  };

  update();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && (changes.scrollbarHidden || changes.whitelist)) {
        update();
      }
    });
  }
})();
