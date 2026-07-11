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
  const toggleWhitelist = document.getElementById('toggleWhitelist');
  const domainDisplay = document.getElementById('domainDisplay');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const infoBtn = document.getElementById('infoBtn');

  let currentHostname = '';
  let isRestricted = false;

  const applyRestrictedState = () => {
    toggle.classList.remove('active');
    toggle.disabled = true;
    toggle.style.opacity = '0.4';
    toggle.style.pointerEvents = 'none';
    restrictedNotice.style.display = 'flex';
    addCurrentBtn.disabled = true;
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
      statusVal.className = 'stats-value';
      if (isRestricted) {
        statusVal.textContent = chrome.i18n.getMessage('statusRestricted') || 'Restricted';
        statusVal.classList.add('restricted');
      } else if (isWhitelisted(currentHostname, whitelist)) {
        statusVal.textContent = chrome.i18n.getMessage('statusWhitelisted') || 'Whitelisted';
        statusVal.classList.add('whitelisted');
      } else if (scrollbarHidden) {
        statusVal.textContent = chrome.i18n.getMessage('statusActive') || 'Active';
        statusVal.classList.add('active');
      } else {
        statusVal.textContent = chrome.i18n.getMessage('statusDisabled') || 'Disabled';
        statusVal.classList.add('disabled');
      }
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

    addCurrentBtn.disabled = false;
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

  toggleWhitelist.addEventListener('click', async () => {
    const opened = await openPanelForCurrentTab();
    if (!opened) return;
    window.close();
  });

  exportBtn.addEventListener('click', () => {
    getSyncState()
      .then((data) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = BACKUP_FILENAME;
        anchor.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('[Popup] Failed to export backup', { error: err });
      });
  });

  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        if (!data || !Array.isArray(data.whitelist)) return;

        const nextState = {
          whitelist: normalizeWhitelist(data.whitelist),
        };

        if (typeof data.scrollbarHidden === 'boolean') {
          nextState.scrollbarHidden = data.scrollbarHidden;
        }

        getSyncValue({ whitelist: [] })
          .then((current) => {
            const merged = normalizeWhitelist([
              ...current.whitelist,
              ...nextState.whitelist,
            ]);

            return setSyncValue({ ...nextState, whitelist: merged }).then(() => {
              loadState();
            });
          })
          .catch((err) => {
            console.error('[Popup] Failed to merge imported whitelist', { error: err });
          });
      } catch (err) {
        console.error('[Popup] Invalid JSON during import', { fileName: file.name, error: err });
        alert(chrome.i18n.getMessage('error') || 'Lỗi: Tệp tin không hợp lệ!');
      }
    };

    reader.readAsText(file);
    importFile.value = '';
  });

  infoBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/features/info/info.html') });
  });

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

      if (!isRestricted && tabUrl) {
        try {
          currentHostname = new URL(tabUrl).hostname;
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
