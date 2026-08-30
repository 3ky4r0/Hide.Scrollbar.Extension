export const STORAGE_KEYS = {
  scrollbarHidden: 'scrollbarHidden',
  whitelist: 'whitelist',
} as const;

export const DEFAULT_SYNC_STATE = {
  [STORAGE_KEYS.scrollbarHidden]: true,
  [STORAGE_KEYS.whitelist]: [] as string[],
};

export const ScrollHideConstants = {
  BACKUP_FILENAME: 'scrollhide-backup.json',
  BADGE_ACTIVE_COLOR: '#2772ed',
  BADGE_INACTIVE_COLOR: '#888',
  DEFAULT_SYNC_STATE,
  RESTRICTED_HOSTS: [] as string[],
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

// Global assignment for classic content script & HTML script tags
(globalThis as unknown as { ScrollHideConstants: typeof ScrollHideConstants }).ScrollHideConstants = ScrollHideConstants;
