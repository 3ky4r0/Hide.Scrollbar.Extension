document.addEventListener('DOMContentLoaded', () => {
  const { applyI18n } = (globalThis as any).ScrollHideI18n || {};
  const { openPanelForCurrentTab, getActiveTab } = (globalThis as any).ScrollHideBrowserApi || {};
  const { getSyncState, getSyncValue, setSyncValue } = (globalThis as any).ScrollHideStorage || {};
  const { isRestrictedUrl, isWhitelisted, normalizeWhitelist, sanitizeDomain } = (globalThis as any).ScrollHideWhitelist || {};

  const toggle = document.getElementById('toggleScroll') as HTMLButtonElement;
  const addCurrentBtn = document.getElementById('addCurrentBtn') as HTMLButtonElement;
  const addCurrentVertical = document.getElementById('addCurrentVertical') as HTMLElement;
  const whitelistedNotice = document.getElementById('whitelistedNotice') as HTMLElement;
  const restrictedNotice = document.getElementById('restrictedNotice') as HTMLElement;
  const openSettingsBtn = document.getElementById('openSettingsBtn') as HTMLButtonElement | null;
  const domainDisplay = document.getElementById('domainDisplay') as HTMLElement;
  const pickColorBtn = document.getElementById('pickColorBtn') as HTMLButtonElement | null;
  const getFaviconBtn = document.getElementById('getFaviconBtn') as HTMLButtonElement | null;
  const pageRulerBtn = document.getElementById('pageRulerBtn') as HTMLButtonElement | null;

  let currentHostname = '';
  let isRestricted = false;

  const applyRestrictedState = (): void => {
    if (toggle) {
      toggle.classList.remove('active');
      toggle.disabled = true;
      toggle.style.opacity = '0.4';
      toggle.style.pointerEvents = 'none';
    }
    if (restrictedNotice) restrictedNotice.style.display = 'flex';
    if (addCurrentBtn) addCurrentBtn.disabled = true;
    if (pickColorBtn) pickColorBtn.disabled = true;
    if (getFaviconBtn) getFaviconBtn.disabled = true;
    if (pageRulerBtn) pageRulerBtn.disabled = true;
  };

  const updateAddButtonState = (inList: boolean): void => {
    if (!addCurrentBtn || !addCurrentVertical) return;
    const labelKey = inList ? 'removeCurrentHost' : 'addCurrentHost';
    const label = chrome.i18n.getMessage(labelKey) || (inList ? 'Remove site from whitelist' : 'Add site to whitelist');
    addCurrentVertical.style.display = inList ? 'none' : 'block';
    addCurrentBtn.setAttribute('aria-label', label);
    addCurrentBtn.title = label;
  };

  const updateStats = (whitelist: string[] | unknown, scrollbarHidden: boolean): void => {
    const statusVal = document.getElementById('statusValue');
    const exceptionsCnt = document.getElementById('exceptionsCount');
    const cleanedCnt = document.getElementById('cleanedCount');

    if (exceptionsCnt) {
      exceptionsCnt.textContent = String(Array.isArray(whitelist) ? whitelist.length : 0);
    }

    if (cleanedCnt && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get({ hideCount: 0 }, (res) => {
        cleanedCnt.textContent = (res.hideCount || 0).toLocaleString();
      });
    }

    if (statusVal) {
      statusVal.className = 'status-dot';
      statusVal.textContent = ''; // No text, only color dot

      let statusText = '';
      if (isRestricted) {
        statusText = chrome.i18n.getMessage('statusRestricted') || 'Restricted';
        statusVal.classList.add('restricted');
      } else if (isWhitelisted && isWhitelisted(currentHostname, whitelist)) {
        statusText = chrome.i18n.getMessage('statusWhitelisted') || 'Whitelisted';
        statusVal.classList.add('whitelisted');
      } else if (scrollbarHidden) {
        statusText = chrome.i18n.getMessage('statusActive') || 'Active';
        statusVal.classList.add('active');
      } else {
        statusText = chrome.i18n.getMessage('statusDisabled') || 'Disabled';
        statusVal.classList.add('disabled');
      }
      statusVal.title = statusText;
    }
  };

  const updateNotice = (whitelist: string[] | unknown): void => {
    if (!currentHostname) {
      if (whitelistedNotice) whitelistedNotice.style.display = 'none';
      if (domainDisplay) domainDisplay.textContent = chrome.i18n.getMessage('cantAddPage') || 'Invalid Page';
      if (addCurrentBtn) addCurrentBtn.disabled = true;
      updateAddButtonState(false);
      updateStats(whitelist, false);
      return;
    }

    if (domainDisplay) domainDisplay.textContent = currentHostname;

    const inList = isWhitelisted ? isWhitelisted(currentHostname, whitelist) : false;
    if (whitelistedNotice) whitelistedNotice.style.display = inList ? 'flex' : 'none';
    updateAddButtonState(inList);

    if (inList || isRestricted) {
      if (toggle) {
        toggle.classList.remove('active');
        toggle.disabled = true;
        toggle.style.opacity = '0.4';
        toggle.style.pointerEvents = 'none';
      }
      updateStats(whitelist, false);
    } else if (getSyncValue) {
      getSyncValue({ scrollbarHidden: true })
        .then((data: { scrollbarHidden?: boolean }) => {
          if (isRestricted || !toggle) return;
          toggle.classList.toggle('active', Boolean(data.scrollbarHidden));
          toggle.disabled = false;
          toggle.style.opacity = '1';
          toggle.style.pointerEvents = 'auto';
          updateStats(whitelist, Boolean(data.scrollbarHidden));
        })
        .catch((err: unknown) => {
          console.error('[Popup] getSyncValue failed', { context: 'updateNotice', error: err });
        });
    }

    if (addCurrentBtn) addCurrentBtn.disabled = isRestricted;
    if (pickColorBtn) pickColorBtn.disabled = isRestricted;
    if (getFaviconBtn) getFaviconBtn.disabled = isRestricted;
    if (pageRulerBtn) pageRulerBtn.disabled = isRestricted;
  };

  const loadState = (): void => {
    if (!getSyncState) return;
    getSyncState()
      .then((data: { scrollbarHidden?: boolean; whitelist?: string[] }) => {
        if (toggle) toggle.classList.toggle('active', !isRestricted && Boolean(data.scrollbarHidden));
        updateNotice(data.whitelist);
      })
      .catch((err: unknown) => {
        console.error('[Popup] getSyncState failed', { context: 'loadState', error: err });
      });
  };

  const addDomain = (raw: string): void => {
    const domain = sanitizeDomain ? sanitizeDomain(raw) : raw.trim();
    if (!domain || !getSyncValue || !setSyncValue) return;

    getSyncValue({ whitelist: [] })
      .then((data: { whitelist: string[] }) => {
        if (data.whitelist.includes(domain)) return;
        const newList = [...data.whitelist, domain].sort();
        return setSyncValue({ whitelist: newList }).then(() => {
          updateNotice(newList);
        });
      })
      .catch((err: unknown) => {
        console.error('[Popup] Failed to add domain', { domain, error: err });
      });
  };

  const removeDomain = (raw: string): void => {
    const domain = sanitizeDomain ? sanitizeDomain(raw) : raw.trim();
    if (!domain || !getSyncValue || !setSyncValue) return;

    getSyncValue({ whitelist: [] })
      .then((data: { whitelist: string[] }) => {
        const newList = data.whitelist.filter((item) => item !== domain);
        return setSyncValue({ whitelist: newList }).then(() => {
          updateNotice(newList);
        });
      })
      .catch((err: unknown) => {
        console.error('[Popup] Failed to remove domain', { domain, error: err });
      });
  };

  if (toggle && setSyncValue && getSyncValue) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      const hidden = toggle.classList.contains('active');
      setSyncValue({ scrollbarHidden: hidden })
        .then(() => {
          return getSyncValue({ whitelist: [] });
        })
        .then((data: { whitelist: string[] }) => {
          updateStats(data.whitelist, hidden);
        })
        .catch((err: unknown) => {
          console.error('[Popup] Failed to toggle scrollbar state', { hidden, error: err });
        });
    });
  }

  if (addCurrentBtn && getSyncValue) {
    addCurrentBtn.addEventListener('click', () => {
      if (!currentHostname || isRestricted) return;

      getSyncValue({ whitelist: [] })
        .then((data: { whitelist: string[] }) => {
          if (isWhitelisted && isWhitelisted(currentHostname, data.whitelist)) {
            removeDomain(currentHostname);
          } else {
            addDomain(currentHostname);
          }
        })
        .catch((err: unknown) => {
          console.error('[Popup] Failed to toggle domain whitelist', { currentHostname, error: err });
        });
    });
  }

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/features/settings/settings.html') });
      }
    });
  }

  if (pickColorBtn) {
    pickColorBtn.addEventListener('click', async () => {
      if (isRestricted || !getActiveTab) return;
      const tab = await getActiveTab();
      if (!tab || !tab.id) return;
      window.close();
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            if (!('EyeDropper' in window)) {
              alert('EyeDropper is not supported on this page.');
              return;
            }
            try {
              const dropper = new (window as any).EyeDropper();
              const result = await dropper.open();
              const hex = (result.sRGBHex || '').toUpperCase();
              try {
                await navigator.clipboard.writeText(hex);
              } catch (_) {
                const ta = document.createElement('textarea');
                ta.value = hex;
                ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                ta.remove();
              }
              alert(`${hex}\nHex code copied to clipboard!`);
            } catch (err: any) {
              if (err && err.name === 'AbortError') return;
              alert('Could not pick a color. Please try again.');
            }
          },
        });
      } catch (_) {}
    });
  }

  if (getFaviconBtn) {
    getFaviconBtn.addEventListener('click', async () => {
      if (isRestricted || !getActiveTab) return;
      const tab = await getActiveTab();
      const favUrl = tab?.favIconUrl || '';
      const tabUrl = tab?.url || '';

      if (chrome.sidePanel && chrome.sidePanel.open && tab?.id) {
        try {
          await chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: 'src/features/favicon/favicon.html',
            enabled: true,
          });
          await chrome.sidePanel.open({ tabId: tab.id });
          window.close();
          return;
        } catch (_) {}
      }

      const viewerUrl = chrome.runtime.getURL('src/features/favicon/favicon.html')
        + `?favUrl=${encodeURIComponent(favUrl)}&tabUrl=${encodeURIComponent(tabUrl)}`;
      chrome.tabs.create({ url: viewerUrl });
      window.close();
    });
  }

  if (pageRulerBtn) {
    pageRulerBtn.addEventListener('click', async () => {
      if (isRestricted || !getActiveTab) return;
      const tab = await getActiveTab();
      if (!tab || !tab.id) return;
      window.close();
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/features/ruler/ruler.js'],
        });
      } catch (_) {}
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.hideCount) {
        const cleanedCnt = document.getElementById('cleanedCount');
        if (cleanedCnt) {
          cleanedCnt.textContent = ((changes.hideCount.newValue as number) || 0).toLocaleString();
        }
      }
    });
  }

  if (applyI18n) {
    applyI18n();
  }

  if (getActiveTab) {
    getActiveTab()
      .then((tab: chrome.tabs.Tab | null) => {
        const tabUrl = tab?.url || '';
        isRestricted = isRestrictedUrl ? isRestrictedUrl(tabUrl) : false;

        if (tabUrl) {
          try {
            const parsed = new URL(tabUrl);
            const RESTRICTED_PROTOCOLS = (globalThis as any).ScrollHideConstants?.RESTRICTED_PROTOCOLS || [];
            if (RESTRICTED_PROTOCOLS.includes(parsed.protocol) || parsed.protocol === 'file:') {
              if (parsed.protocol === 'about:') {
                currentHostname = parsed.href;
              } else {
                currentHostname = parsed.protocol + '//' + parsed.hostname;
              }
            } else {
              currentHostname = parsed.hostname;
            }
          } catch (_) {
            currentHostname = '';
          }
        }

        if (isRestricted) {
          applyRestrictedState();
        }

        loadState();
      })
      .catch((err: unknown) => {
        console.error('[Popup] getActiveTab failed', { error: err });
        loadState();
      });
  }
});
