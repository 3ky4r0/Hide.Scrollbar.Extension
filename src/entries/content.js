(function () {
  const { STYLE_ID } = globalThis.ScrollHideConstants;
  const { getSyncState } = globalThis.ScrollHideStorage;
  const { isWhitelisted } = globalThis.ScrollHideWhitelist;

  const applyStyle = (hide) => {
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

  const update = async () => {
    try {
      const state = await getSyncState();
      const shouldHide = state.scrollbarHidden && !isWhitelisted(window.location.hostname, state.whitelist);
      
      const styleBefore = document.getElementById(STYLE_ID);
      applyStyle(shouldHide);
      const styleAfter = document.getElementById(STYLE_ID);

      if (shouldHide && !styleBefore && styleAfter && window === window.top) {
        chrome.storage.local.get({ hideCount: 0 }, (res) => {
          chrome.storage.local.set({ hideCount: res.hideCount + 1 });
        });
      }
    } catch (err) {
      console.error('[Content] Failed to read sync state', { error: err });
    }
  };

  update();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.scrollbarHidden || changes.whitelist)) {
      update();
    }
  });
})();

