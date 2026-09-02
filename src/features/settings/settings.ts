const initSettings = () => {
  'use strict';

  const { applyI18n } = (globalThis as any).ScrollHideI18n || {};
  const { BACKUP_FILENAME, DEFAULT_SYNC_STATE } = (globalThis as any).ScrollHideConstants || {};
  const { getSyncState, setSyncValue, applyTheme } = (globalThis as any).ScrollHideStorage || {};
  const { normalizeWhitelist, sanitizeDomain } = (globalThis as any).ScrollHideWhitelist || {};

  if (applyI18n) {
    applyI18n();
  }

  // Tabs
  const navTabs = document.querySelectorAll<HTMLElement>('.nav-tab[data-tab]');
  const tabPanes = document.querySelectorAll<HTMLElement>('.tab-pane');

  // Settings elements
  const settingHideScrollbar = document.getElementById('settingHideScrollbar') as HTMLInputElement | null;
  const settingTheme = document.getElementById('settingTheme') as HTMLSelectElement | null;
  const statCleanedCount = document.getElementById('statCleanedCount') as HTMLElement | null;
  const btnResetCleaned = document.getElementById('btnResetCleaned') as HTMLButtonElement | null;
  const btnExportSettings = document.getElementById('btnExportSettings') as HTMLButtonElement | null;
  const btnImportSettings = document.getElementById('btnImportSettings') as HTMLButtonElement | null;
  const settingsFileInput = document.getElementById('settingsFileInput') as HTMLInputElement | null;
  const btnResetDefaults = document.getElementById('btnResetDefaults') as HTMLButtonElement | null;

  // Whitelist elements
  const btnApplyWhitelist = document.getElementById('btnApplyWhitelist') as HTMLButtonElement | null;
  const btnRevertWhitelist = document.getElementById('btnRevertWhitelist') as HTMLButtonElement | null;
  const btnImportWhitelist = document.getElementById('btnImportWhitelist') as HTMLButtonElement | null;
  const btnExportWhitelist = document.getElementById('btnExportWhitelist') as HTMLButtonElement | null;
  const whitelistFileInput = document.getElementById('whitelistFileInput') as HTMLInputElement | null;
  const saveIndicator = document.getElementById('saveIndicator') as HTMLElement | null;
  const lineNumbers = document.getElementById('lineNumbers') as HTMLElement | null;
  const whitelistEditor = document.getElementById('whitelistEditor') as HTMLTextAreaElement | null;

  let lastSavedWhitelistText = '';

  /* ── Tab Switching ────────────────────────────────────────── */

  function switchTab(tabName: string | undefined): void {
    if (!tabName) return;
    navTabs.forEach((tab) => {
      const isTarget = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', String(isTarget));
    });

    tabPanes.forEach((pane) => {
      pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    if (location.hash !== `#${tabName}`) {
      history.replaceState(null, '', `#${tabName}`);
    }

    if (tabName === 'whitelist') {
      updateLineNumbers();
    }
  }

  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const validTabs = ['settings', 'whitelist', 'guide', 'report', 'about'];
  const initialTab = location.hash.replace('#', '');
  switchTab(validTabs.includes(initialTab) ? initialTab : 'settings');

  window.addEventListener('hashchange', () => {
    const currentTab = location.hash.replace('#', '');
    if (validTabs.includes(currentTab)) {
      switchTab(currentTab);
    }
  });

  /* ── Line Numbers & Editor Helper ─────────────────────────── */

  function updateLineNumbers(): void {
    if (!whitelistEditor || !lineNumbers) return;
    const lines = whitelistEditor.value.split('\n');
    const count = Math.max(lines.length, 1);
    const nums = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    lineNumbers.textContent = nums;
  }

  function checkWhitelistDirty(): void {
    if (!whitelistEditor || !btnApplyWhitelist || !btnRevertWhitelist) return;
    const isDirty = whitelistEditor.value !== lastSavedWhitelistText;
    btnApplyWhitelist.disabled = !isDirty;
    btnRevertWhitelist.disabled = !isDirty;
  }

  if (whitelistEditor) {
    whitelistEditor.addEventListener('input', () => {
      updateLineNumbers();
      checkWhitelistDirty();
    });

    whitelistEditor.addEventListener('scroll', () => {
      if (lineNumbers && whitelistEditor) {
        lineNumbers.scrollTop = whitelistEditor.scrollTop;
      }
    });

    // Support Ctrl+S / Cmd+S to apply changes
    whitelistEditor.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (btnApplyWhitelist && !btnApplyWhitelist.disabled) {
          applyWhitelistChanges();
        }
      }
    });
  }

  function showSavedToast(msg: string = 'Changes saved'): void {
    if (!saveIndicator) return;
    saveIndicator.textContent = msg;
    saveIndicator.classList.add('visible');
    setTimeout(() => {
      saveIndicator?.classList.remove('visible');
    }, 2000);
  }

  /* ── Parse & Normalize Lines ──────────────────────────────── */

  function parseEditorContent(text: string): string[] {
    const lines = text.split('\n');
    const domains: string[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) {
        return;
      }
      const cleaned = sanitizeDomain ? sanitizeDomain(trimmed) : trimmed;
      if (cleaned) {
        domains.push(cleaned);
      }
    });

    return normalizeWhitelist ? normalizeWhitelist(domains) : domains;
  }

  /* ── Load State ───────────────────────────────────────────── */

  function loadAllState(): void {
    if (getSyncState) {
      getSyncState().then((state: { scrollbarHidden?: boolean; whitelist?: string[]; theme?: string }) => {
        // Settings
        if (settingHideScrollbar) {
          settingHideScrollbar.checked = Boolean(state.scrollbarHidden);
        }

        // Theme
        const theme = state.theme || 'system';
        if (settingTheme) {
          settingTheme.value = theme;
        }
        if (applyTheme) {
          applyTheme(theme);
        }

        // Whitelist
        const domains = normalizeWhitelist ? normalizeWhitelist(state.whitelist || []) : (state.whitelist || []);
        const text = domains.join('\n');
        if (whitelistEditor) {
          whitelistEditor.value = text;
          lastSavedWhitelistText = text;
          updateLineNumbers();
          checkWhitelistDirty();
        }
      });
    }

    // Cleaned counter
    if (statCleanedCount && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get({ hideCount: 0 }, (res) => {
        statCleanedCount.textContent = (res.hideCount || 0).toLocaleString();
      });
    }

    // Version display
    const version = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
      ? chrome.runtime.getManifest().version
      : '2.1';
    const versionText = `v${version}`;
    const extVersionEl = document.getElementById('extVersion');
    if (extVersionEl) extVersionEl.textContent = versionText;
    document.querySelectorAll<HTMLElement>('.ext-version-badge').forEach((el) => {
      el.textContent = versionText;
    });
  }

  loadAllState();

  /* ── Settings Event Listeners ─────────────────────────────── */

  if (settingHideScrollbar && setSyncValue) {
    settingHideScrollbar.addEventListener('change', () => {
      setSyncValue({ scrollbarHidden: settingHideScrollbar.checked });
    });
  }

  if (settingTheme && setSyncValue) {
    settingTheme.addEventListener('change', () => {
      const themeVal = settingTheme.value;
      if (applyTheme) applyTheme(themeVal);
      setSyncValue({ theme: themeVal });
    });
  }

  const btnConfigureShortcuts = document.getElementById('btnConfigureShortcuts') as HTMLButtonElement | null;
  if (btnConfigureShortcuts) {
    btnConfigureShortcuts.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      }
    });
  }

  if (btnResetCleaned && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    btnResetCleaned.addEventListener('click', () => {
      chrome.storage.local.set({ hideCount: 0 }, () => {
        if (statCleanedCount) statCleanedCount.textContent = '0';
      });
    });
  }

  if (btnExportSettings && getSyncState) {
    btnExportSettings.addEventListener('click', () => {
      getSyncState().then((data: unknown) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = BACKUP_FILENAME || 'scrollhide-backup.json';
        anchor.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  if (btnImportSettings && settingsFileInput && setSyncValue) {
    btnImportSettings.addEventListener('click', () => settingsFileInput.click());

    settingsFileInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (!data || typeof data !== 'object') {
            alert('Invalid configuration file.');
            return;
          }
          const nextState: Record<string, unknown> = {};
          if (typeof data.scrollbarHidden === 'boolean') {
            nextState.scrollbarHidden = data.scrollbarHidden;
          }
          if (Array.isArray(data.whitelist)) {
            nextState.whitelist = normalizeWhitelist ? normalizeWhitelist(data.whitelist) : data.whitelist;
          }
          if (typeof data.theme === 'string' && ['system', 'light', 'dark'].includes(data.theme)) {
            nextState.theme = data.theme;
          }

          setSyncValue(nextState).then(() => {
            loadAllState();
            alert('Settings restored successfully!');
          });
        } catch (_) {
          alert('Failed to parse backup JSON file.');
        }
      };
      reader.readAsText(file);
      settingsFileInput.value = '';
    });
  }

  if (btnResetDefaults && setSyncValue) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all settings and whitelist to default?')) {
        setSyncValue(DEFAULT_SYNC_STATE).then(() => {
          loadAllState();
        });
      }
    });
  }

  /* ── Whitelist Tab Event Listeners ────────────────────────── */

  function applyWhitelistChanges(): void {
    if (!whitelistEditor || !setSyncValue) return;
    const domains = parseEditorContent(whitelistEditor.value);
    setSyncValue({ whitelist: domains }).then(() => {
      lastSavedWhitelistText = whitelistEditor.value;
      checkWhitelistDirty();
      showSavedToast('Changes applied');
    });
  }

  if (btnApplyWhitelist) {
    btnApplyWhitelist.addEventListener('click', applyWhitelistChanges);
  }

  if (btnRevertWhitelist) {
    btnRevertWhitelist.addEventListener('click', () => {
      if (whitelistEditor) {
        whitelistEditor.value = lastSavedWhitelistText;
        updateLineNumbers();
        checkWhitelistDirty();
      }
    });
  }

  if (btnExportWhitelist) {
    btnExportWhitelist.addEventListener('click', () => {
      if (!whitelistEditor) return;
      const content = whitelistEditor.value;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'scrollhide-whitelist.txt';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  if (btnImportWhitelist && whitelistFileInput) {
    btnImportWhitelist.addEventListener('click', () => whitelistFileInput.click());

    whitelistFileInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        let importedLines: string[] = [];

        try {
          // Try JSON format first
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.whitelist)) {
            importedLines = parsed.whitelist;
          } else if (Array.isArray(parsed)) {
            importedLines = parsed;
          }
        } catch (_) {
          // Plain text format
          importedLines = text.split('\n');
        }

        if (whitelistEditor) {
          const currentVal = whitelistEditor.value.trim();
          const appendText = importedLines.map((l) => String(l).trim()).filter(Boolean).join('\n');

          whitelistEditor.value = currentVal ? `${currentVal}\n${appendText}` : appendText;
          updateLineNumbers();
          checkWhitelistDirty();
        }
      };

      reader.readAsText(file);
      whitelistFileInput.value = '';
    });
  }

  // Report Tab: Copy System Info
  const btnCopyReportInfo = document.getElementById('btnCopyReportInfo') as HTMLButtonElement | null;
  const copyReportInfoText = document.getElementById('copyReportInfoText') as HTMLElement | null;
  if (btnCopyReportInfo) {
    btnCopyReportInfo.addEventListener('click', async () => {
      const info = [
        '### Environment Details',
        `- **Extension:** ScrollHide`,
        `- **User Agent:** ${navigator.userAgent}`,
        `- **Platform:** ${navigator.platform || 'Unknown'}`,
        `- **Screen Resolution:** ${window.screen.width}x${window.screen.height}`,
      ].join('\n');

      try {
        await navigator.clipboard.writeText(info);
        if (copyReportInfoText) {
          const original = copyReportInfoText.textContent;
          copyReportInfoText.textContent = 'Copied!';
          setTimeout(() => {
            if (copyReportInfoText) copyReportInfoText.textContent = original;
          }, 2000);
        }
      } catch (_) {}
    });
  }

  // Listen to remote changes
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        if (changes.scrollbarHidden && settingHideScrollbar) {
          settingHideScrollbar.checked = Boolean(changes.scrollbarHidden.newValue);
        }
        if (changes.theme) {
          const newTheme = String(changes.theme.newValue || 'system');
          if (settingTheme) settingTheme.value = newTheme;
          if (applyTheme) applyTheme(newTheme);
        }
      }
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettings);
} else {
  initSettings();
}
