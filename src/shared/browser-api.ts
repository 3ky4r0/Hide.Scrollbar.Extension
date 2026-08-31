export const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }
  return null;
};

export const openPanelForCurrentTab = async (): Promise<boolean> => {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return false;

    if (chrome.sidePanel.setOptions) {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'src/features/favicon/favicon.html',
        enabled: true,
      }).catch(() => {});
    }

    await chrome.sidePanel.open({ tabId: tab.id });
    return true;
  }

  return false;
};

export const ScrollHideBrowserApi = {
  getActiveTab,
  openPanelForCurrentTab,
};

// Global assignment for HTML script tags
(globalThis as unknown as { ScrollHideBrowserApi: typeof ScrollHideBrowserApi }).ScrollHideBrowserApi = ScrollHideBrowserApi;
