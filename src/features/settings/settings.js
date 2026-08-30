document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const { BACKUP_FILENAME, DEFAULT_SYNC_STATE } = globalThis.ScrollHideConstants;
  const { getSyncState, setSyncValue } = globalThis.ScrollHideStorage;
  const { normalizeWhitelist, sanitizeDomain } = globalThis.ScrollHideWhitelist;

  // Tabs
  const navTabs = document.querySelectorAll('.nav-tab[data-tab]');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Settings elements
  const settingHideScrollbar = document.getElementById('settingHideScrollbar');
  const statCleanedCount = document.getElementById('statCleanedCount');
  const btnResetCleaned = document.getElementById('btnResetCleaned');
  const btnExportSettings = document.getElementById('btnExportSettings');
  const btnImportSettings = document.getElementById('btnImportSettings');
  const settingsFileInput = document.getElementById('settingsFileInput');
  const btnResetDefaults = document.getElementById('btnResetDefaults');

  // Whitelist elements
  const btnApplyWhitelist = document.getElementById('btnApplyWhitelist');
  const btnRevertWhitelist = document.getElementById('btnRevertWhitelist');
  const btnImportWhitelist = document.getElementById('btnImportWhitelist');
  const btnExportWhitelist = document.getElementById('btnExportWhitelist');
  const whitelistFileInput = document.getElementById('whitelistFileInput');
  const saveIndicator = document.getElementById('saveIndicator');
  const lineNumbers = document.getElementById('lineNumbers');
  const whitelistEditor = document.getElementById('whitelistEditor');

  let lastSavedWhitelistText = '';

  /* ── Tab Switching ────────────────────────────────────────── */

  function switchTab(tabName) {
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

  const validTabs = ['settings', 'whitelist', 'guide'];
  const initialTab = location.hash.replace('#', '');
  switchTab(validTabs.includes(initialTab) ? initialTab : 'settings');

  /* ── Line Numbers & Editor Helper ─────────────────────────── */

  function updateLineNumbers() {
    if (!whitelistEditor || !lineNumbers) return;
    const lines = whitelistEditor.value.split('\n');
    const count = Math.max(lines.length, 1);
    const nums = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    lineNumbers.textContent = nums;
  }

  function checkWhitelistDirty() {
    const isDirty = whitelistEditor.value !== lastSavedWhitelistText;
    btnApplyWhitelist.disabled = !isDirty;
    btnRevertWhitelist.disabled = !isDirty;
  }

  whitelistEditor.addEventListener('input', () => {
    updateLineNumbers();
    checkWhitelistDirty();
  });

  whitelistEditor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = whitelistEditor.scrollTop;
  });

  // Support Ctrl+S / Cmd+S to apply changes
  whitelistEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!btnApplyWhitelist.disabled) {
        applyWhitelistChanges();
      }
    }
  });

  function showSavedToast(msg = 'Changes saved') {
    saveIndicator.textContent = msg;
    saveIndicator.classList.add('visible');
    setTimeout(() => {
      saveIndicator.classList.remove('visible');
    }, 2000);
  }

  /* ── Parse & Normalize Lines ──────────────────────────────── */

  function parseEditorContent(text) {
    const lines = text.split('\n');
    const domains = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) {
        return;
      }
      const cleaned = sanitizeDomain(trimmed);
      if (cleaned) {
        domains.push(cleaned);
      }
    });

    return normalizeWhitelist(domains);
  }

  /* ── Load State ───────────────────────────────────────────── */

  function loadAllState() {
    getSyncState().then((state) => {
      // Settings
      if (settingHideScrollbar) {
        settingHideScrollbar.checked = Boolean(state.scrollbarHidden);
      }

      // Whitelist
      const domains = normalizeWhitelist(state.whitelist || []);
      const text = domains.join('\n');
      whitelistEditor.value = text;
      lastSavedWhitelistText = text;
      updateLineNumbers();
      checkWhitelistDirty();
    });

    // Cleaned counter
    if (statCleanedCount && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get({ hideCount: 0 }, (res) => {
        statCleanedCount.textContent = (res.hideCount || 0).toLocaleString();
      });
    }
  }

  loadAllState();

  /* ── Settings Event Listeners ─────────────────────────────── */

  if (settingHideScrollbar) {
    settingHideScrollbar.addEventListener('change', () => {
      setSyncValue({ scrollbarHidden: settingHideScrollbar.checked });
    });
  }

  if (btnResetCleaned) {
    btnResetCleaned.addEventListener('click', () => {
      chrome.storage.local.set({ hideCount: 0 }, () => {
        statCleanedCount.textContent = '0';
      });
    });
  }

  if (btnExportSettings) {
    btnExportSettings.addEventListener('click', () => {
      getSyncState().then((data) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = BACKUP_FILENAME;
        anchor.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  if (btnImportSettings && settingsFileInput) {
    btnImportSettings.addEventListener('click', () => settingsFileInput.click());

    settingsFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (!data || typeof data !== 'object') {
            alert('Invalid configuration file.');
            return;
          }
          const nextState = {};
          if (typeof data.scrollbarHidden === 'boolean') {
            nextState.scrollbarHidden = data.scrollbarHidden;
          }
          if (Array.isArray(data.whitelist)) {
            nextState.whitelist = normalizeWhitelist(data.whitelist);
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

  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all settings and whitelist to default?')) {
        setSyncValue(DEFAULT_SYNC_STATE).then(() => {
          loadAllState();
        });
      }
    });
  }

  /* ── Whitelist Tab Event Listeners ────────────────────────── */

  function applyWhitelistChanges() {
    const domains = parseEditorContent(whitelistEditor.value);
    setSyncValue({ whitelist: domains }).then(() => {
      lastSavedWhitelistText = whitelistEditor.value;
      checkWhitelistDirty();
      showSavedToast('Changes applied');
    });
  }

  btnApplyWhitelist.addEventListener('click', applyWhitelistChanges);

  btnRevertWhitelist.addEventListener('click', () => {
    whitelistEditor.value = lastSavedWhitelistText;
    updateLineNumbers();
    checkWhitelistDirty();
  });

  if (btnExportWhitelist) {
    btnExportWhitelist.addEventListener('click', () => {
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

    whitelistFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        let importedLines = [];

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

        const currentVal = whitelistEditor.value.trim();
        const appendText = importedLines.map((l) => String(l).trim()).filter(Boolean).join('\n');

        whitelistEditor.value = currentVal ? `${currentVal}\n${appendText}` : appendText;
        updateLineNumbers();
        checkWhitelistDirty();
      };

      reader.readAsText(file);
      whitelistFileInput.value = '';
    });
  }

  // Listen to remote changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.scrollbarHidden && settingHideScrollbar) {
        settingHideScrollbar.checked = Boolean(changes.scrollbarHidden.newValue);
      }
    }
  });
});
