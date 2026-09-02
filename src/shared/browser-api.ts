export const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }
  return null;
};

export const ScrollHideBrowserApi = {
  getActiveTab,
};

// Global assignment for HTML script tags
(globalThis as unknown as { ScrollHideBrowserApi: typeof ScrollHideBrowserApi }).ScrollHideBrowserApi = ScrollHideBrowserApi;
