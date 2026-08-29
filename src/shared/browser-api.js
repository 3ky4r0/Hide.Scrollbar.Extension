(() => {
  const getActiveTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  };

  const openPanelForCurrentTab = async () => {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      const tab = await getActiveTab();
      if (!tab) return false;
      if (chrome.sidePanel.setOptions && tab.id) {
        await chrome.sidePanel.setOptions({
          tabId: tab.id,
          path: 'src/features/sidepanel/sidepanel.html',
          enabled: true,
        }).catch(() => {});
      }
      await chrome.sidePanel.open({ tabId: tab.id });
      return true;
    }

    return false;
  };

  globalThis.ScrollHideBrowserApi = {
    getActiveTab,
    openPanelForCurrentTab,
  };
})();
