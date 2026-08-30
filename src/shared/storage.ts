const getDefaultSyncState = () => {
  const g = globalThis as unknown as { ScrollHideConstants?: { DEFAULT_SYNC_STATE: Record<string, unknown> } };
  return g.ScrollHideConstants?.DEFAULT_SYNC_STATE ?? {};
};

const toPromise = <T>(executor: (done: (result: T) => void) => void): Promise<T> =>
  new Promise((resolve, reject) => {
    executor((result: T) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result);
    });
  });

export const getSyncState = (): Promise<Record<string, unknown>> =>
  toPromise((done) => chrome.storage.sync.get(getDefaultSyncState(), done));

export const getSyncValue = <T = Record<string, unknown>>(defaults: string | string[] | Record<string, unknown> | null): Promise<T> =>
  toPromise((done) => chrome.storage.sync.get(defaults, done as (items: Record<string, unknown>) => void));

export const setSyncValue = (value: Record<string, unknown>): Promise<void> =>
  toPromise((done) => chrome.storage.sync.set(value, done as () => void));

export const ScrollHideStorage = {
  getSyncState,
  getSyncValue,
  setSyncValue,
};

// Global assignment for HTML script tags
(globalThis as unknown as { ScrollHideStorage: typeof ScrollHideStorage }).ScrollHideStorage = ScrollHideStorage;
