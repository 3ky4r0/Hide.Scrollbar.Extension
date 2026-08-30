document.addEventListener('DOMContentLoaded', () => {
  const { applyI18n } = globalThis.ScrollHideI18n;
  const { BACKUP_FILENAME } = globalThis.ScrollHideConstants;
  const { openPanelForCurrentTab, getActiveTab } = globalThis.ScrollHideBrowserApi;
  const { getSyncState, getSyncValue, setSyncValue } = globalThis.ScrollHideStorage;
  const { isRestrictedUrl, isWhitelisted, normalizeWhitelist, sanitizeDomain } = globalThis.ScrollHideWhitelist;
  const toggle = document.getElementById('toggleScroll');
  const addCurrentBtn = document.getElementById('addCurrentBtn');
  const addCurrentVertical = document.getElementById('addCurrentVertical');
  const whitelistedNotice = document.getElementById('whitelistedNotice');
  const restrictedNotice = document.getElementById('restrictedNotice');
  const openSettingsBtn = document.getElementById('openSettingsBtn') || document.getElementById('toggleWhitelist');
  const domainDisplay = document.getElementById('domainDisplay');
  const pickColorBtn = document.getElementById('pickColorBtn');
  const getFaviconBtn = document.getElementById('getFaviconBtn');

  let currentHostname = '';
  let isRestricted = false;

  const applyRestrictedState = () => {
    toggle.classList.remove('active');
    toggle.disabled = true;
    toggle.style.opacity = '0.4';
    toggle.style.pointerEvents = 'none';
    restrictedNotice.style.display = 'flex';
    addCurrentBtn.disabled = true;
    if (pickColorBtn) pickColorBtn.disabled = true;
    if (getFaviconBtn) getFaviconBtn.disabled = true;
  };

  const updateAddButtonState = (inList) => {
    const labelKey = inList ? 'removeCurrentHost' : 'addCurrentHost';
    const label = chrome.i18n.getMessage(labelKey) || (inList ? 'Remove site from whitelist' : 'Add site to whitelist');
    addCurrentVertical.style.display = inList ? 'none' : 'block';
    addCurrentBtn.setAttribute('aria-label', label);
    addCurrentBtn.title = label;
  };

  const updateStats = (whitelist, scrollbarHidden) => {
    const statusVal = document.getElementById('statusValue');
    const exceptionsCnt = document.getElementById('exceptionsCount');
    const cleanedCnt = document.getElementById('cleanedCount');

    if (exceptionsCnt) {
      exceptionsCnt.textContent = Array.isArray(whitelist) ? whitelist.length : 0;
    }

    if (cleanedCnt) {
      chrome.storage.local.get({ hideCount: 0 }, (res) => {
        cleanedCnt.textContent = res.hideCount.toLocaleString();
      });
    }

    if (statusVal) {
      statusVal.className = 'status-dot';
      statusVal.textContent = ''; // No text, only color dot

      let statusText = '';
      if (isRestricted) {
        statusText = chrome.i18n.getMessage('statusRestricted') || 'Restricted';
        statusVal.classList.add('restricted');
      } else if (isWhitelisted(currentHostname, whitelist)) {
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

  const updateNotice = (whitelist) => {
    if (!currentHostname) {
      whitelistedNotice.style.display = 'none';
      domainDisplay.textContent = chrome.i18n.getMessage('cantAddPage') || 'Invalid Page';
      addCurrentBtn.disabled = true;
      updateAddButtonState(false);
      updateStats(whitelist, false);
      return;
    }

    domainDisplay.textContent = currentHostname;

    const inList = isWhitelisted(currentHostname, whitelist);
    whitelistedNotice.style.display = inList ? 'flex' : 'none';
    updateAddButtonState(inList);

    if (inList || isRestricted) {
      toggle.classList.remove('active');
      toggle.disabled = true;
      toggle.style.opacity = '0.4';
      toggle.style.pointerEvents = 'none';
      updateStats(whitelist, false);
    } else {
      getSyncValue({ scrollbarHidden: true })
        .then((data) => {
          if (isRestricted) return;
          toggle.classList.toggle('active', Boolean(data.scrollbarHidden));
          toggle.disabled = false;
          toggle.style.opacity = '1';
          toggle.style.pointerEvents = 'auto';
          updateStats(whitelist, data.scrollbarHidden);
        })
        .catch((err) => {
          console.error('[Popup] getSyncValue failed', { context: 'updateNotice', error: err });
        });
    }

    addCurrentBtn.disabled = isRestricted;
    if (pickColorBtn) pickColorBtn.disabled = isRestricted;
    if (getFaviconBtn) getFaviconBtn.disabled = isRestricted;
  };

  const loadState = () => {
    getSyncState()
      .then((data) => {
        toggle.classList.toggle('active', !isRestricted && Boolean(data.scrollbarHidden));
        updateNotice(data.whitelist);
      })
      .catch((err) => {
        console.error('[Popup] getSyncState failed', { context: 'loadState', error: err });
      });
  };

  const addDomain = (raw) => {
    const domain = sanitizeDomain(raw);
    if (!domain) return;

    getSyncValue({ whitelist: [] })
      .then((data) => {
        if (data.whitelist.includes(domain)) return;
        const newList = [...data.whitelist, domain].sort();
        return setSyncValue({ whitelist: newList }).then(() => {
          updateNotice(newList);
        });
      })
      .catch((err) => {
        console.error('[Popup] Failed to add domain', { domain, error: err });
      });
  };

  const removeDomain = (raw) => {
    const domain = sanitizeDomain(raw);
    if (!domain) return;

    getSyncValue({ whitelist: [] })
      .then((data) => {
        const newList = data.whitelist.filter((item) => item !== domain);
        return setSyncValue({ whitelist: newList }).then(() => {
          updateNotice(newList);
        });
      })
      .catch((err) => {
        console.error('[Popup] Failed to remove domain', { domain, error: err });
      });
  };

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    const hidden = toggle.classList.contains('active');
    setSyncValue({ scrollbarHidden: hidden })
      .then(() => {
        return getSyncValue({ whitelist: [] });
      })
      .then((data) => {
        updateStats(data.whitelist, hidden);
      })
      .catch((err) => {
        console.error('[Popup] Failed to toggle scrollbar state', { hidden, error: err });
      });
  });

  addCurrentBtn.addEventListener('click', () => {
    if (!currentHostname || isRestricted) return;

    getSyncValue({ whitelist: [] })
      .then((data) => {
        if (isWhitelisted(currentHostname, data.whitelist)) {
          removeDomain(currentHostname);
        } else {
          addDomain(currentHostname);
        }
      })
      .catch((err) => {
        console.error('[Popup] Failed to toggle domain whitelist', { currentHostname, error: err });
      });
  });

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
      if (isRestricted) return;
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
              const dropper = new window.EyeDropper();
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
            } catch (err) {
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
      if (isRestricted) return;
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

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.hideCount) {
      const cleanedCnt = document.getElementById('cleanedCount');
      if (cleanedCnt) {
        cleanedCnt.textContent = (changes.hideCount.newValue || 0).toLocaleString();
      }
    }
  });

  applyI18n();

  getActiveTab()
    .then((tab) => {
      const tabUrl = tab?.url || '';
      isRestricted = isRestrictedUrl(tabUrl);

      if (tabUrl) {
        try {
          const parsed = new URL(tabUrl);
          const RESTRICTED_PROTOCOLS = globalThis.ScrollHideConstants.RESTRICTED_PROTOCOLS;
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
    .catch((err) => {
      console.error('[Popup] getActiveTab failed', { error: err });
      loadState();
    });
});
