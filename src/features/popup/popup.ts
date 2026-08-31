document.addEventListener('DOMContentLoaded', () => {
  const { applyI18n } = (globalThis as any).ScrollHideI18n || {};
  const { openPanelForCurrentTab, getActiveTab } = (globalThis as any).ScrollHideBrowserApi || {};
  const { getSyncState, getSyncValue, setSyncValue, applyTheme } = (globalThis as any).ScrollHideStorage || {};
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
  const pageDrawBtn = document.getElementById('pageDrawBtn') as HTMLButtonElement | null;

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
    if (pageDrawBtn) pageDrawBtn.disabled = true;
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
      .then((data: { scrollbarHidden?: boolean; whitelist?: string[]; theme?: string }) => {
        if (toggle) toggle.classList.toggle('active', !isRestricted && Boolean(data.scrollbarHidden));
        if (applyTheme) applyTheme(data.theme);
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
      let currentTheme = 'system';
      if (getSyncValue) {
        try {
          const syncData = (await getSyncValue({ theme: 'system' })) as { theme?: string };
          currentTheme = syncData?.theme || 'system';
        } catch (_) {}
      }
      window.close();
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [currentTheme],
          func: async (themePref: string) => {
            const win = window as any;
            if (win.__SCROLLHIDE_PAGE_RULER__) {
              win.__SCROLLHIDE_PAGE_RULER__.destroy();
              win.__SCROLLHIDE_PAGE_RULER__ = null;
            }
            if (win.__SCROLLHIDE_PAGE_DRAW__) {
              win.__SCROLLHIDE_PAGE_DRAW__.destroy();
              win.__SCROLLHIDE_PAGE_DRAW__ = null;
            }
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

              // Show glassmorphic toast notification
              const oldToast = document.getElementById('scrollhide-color-toast-root');
              if (oldToast) oldToast.remove();

              const isLight = themePref === 'light' || (themePref === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);

              const host = document.createElement('div');
              host.id = 'scrollhide-color-toast-root';
              host.setAttribute('data-theme', isLight ? 'light' : 'dark');
              const shadow = host.attachShadow({ mode: 'open' });

              const style = document.createElement('style');
              style.textContent = `
                .toast {
                  position: fixed;
                  bottom: 24px;
                  left: 50%;
                  transform: translateX(-50%) translateY(20px);
                  background: rgba(28, 28, 30, 0.88);
                  backdrop-filter: blur(20px);
                  -webkit-backdrop-filter: blur(20px);
                  border: 1px solid rgba(255, 255, 255, 0.12);
                  border-radius: 10px;
                  padding: 8px 16px;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  color: #ffffff;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  font-size: 13px;
                  font-weight: 500;
                  opacity: 0;
                  pointer-events: none;
                  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                  z-index: 2147483647;
                }
                :host([data-theme="light"]) .toast {
                  background: rgba(255, 255, 255, 0.92);
                  border: 1px solid rgba(0, 0, 0, 0.12);
                  color: #1c1c1e;
                }
                .toast.show {
                  opacity: 1;
                  transform: translateX(-50%) translateY(0);
                }
                .swatch {
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: ${hex};
                  border: 2px solid rgba(255, 255, 255, 0.7);
                  flex-shrink: 0;
                }
                :host([data-theme="light"]) .swatch {
                  border: 2px solid rgba(0, 0, 0, 0.2);
                }
                .hex {
                  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                  font-weight: 700;
                  letter-spacing: 0.5px;
                }
                .check {
                  color: #34c759;
                  display: flex;
                  align-items: center;
                  margin-left: 2px;
                }
              `;

              const toast = document.createElement('div');
              toast.className = 'toast';
              toast.innerHTML = `
                <div class="swatch"></div>
                <span class="hex">${hex}</span>
                <span style="opacity: 0.65; font-size: 12px;">Đã sao chép</span>
                <span class="check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              `;

              shadow.appendChild(style);
              shadow.appendChild(toast);
              document.documentElement.appendChild(host);

              requestAnimationFrame(() => {
                toast.classList.add('show');
              });

              setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => host.remove(), 300);
              }, 2200);
            } catch (err: any) {
              if (err && err.name === 'AbortError') return;
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

  if (pageDrawBtn) {
    pageDrawBtn.addEventListener('click', async () => {
      if (isRestricted || !getActiveTab) return;
      const tab = await getActiveTab();
      if (!tab || !tab.id) return;
      window.close();
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/features/draw/draw.js'],
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
      if (namespace === 'sync' && changes.theme) {
        if (applyTheme) applyTheme(changes.theme.newValue as string);
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
