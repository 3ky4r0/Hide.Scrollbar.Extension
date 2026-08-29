(() => {
  const STORAGE_KEYS = {
    scrollbarHidden: 'scrollbarHidden',
    whitelist: 'whitelist',
  };

  const DEFAULT_SYNC_STATE = {
    [STORAGE_KEYS.scrollbarHidden]: true,
    [STORAGE_KEYS.whitelist]: [],
  };

  globalThis.ScrollHideConstants = {
    BACKUP_FILENAME: 'scrollhide-backup.json',
    BADGE_ACTIVE_COLOR: '#2772ed',
    BADGE_INACTIVE_COLOR: '#888',
    DEFAULT_SYNC_STATE,
    RESTRICTED_HOSTS: ['chromewebstore.google.com'],
    RESTRICTED_PROTOCOLS: [
      'chrome:',
      'chrome-extension:',
      'edge:',
      'about:',
      'view-source:',
      'devtools:',
    ],
    STORAGE_KEYS,
    STYLE_ID: 'hide-scrollbar-style',
  };
})();
