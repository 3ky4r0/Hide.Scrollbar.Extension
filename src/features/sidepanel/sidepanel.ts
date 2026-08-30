export {};

const textarea = document.getElementById('whitelistTextarea') as HTMLTextAreaElement;
const saveStatus = document.getElementById('saveStatus') as HTMLDivElement;

const { applyI18n } = (globalThis as any).ScrollHideI18n;
const { DEFAULT_SYNC_STATE } = (globalThis as any).ScrollHideConstants;
const { getSyncState, setSyncValue } = (globalThis as any).ScrollHideStorage;
const { normalizeWhitelist, serializeDomains } = (globalThis as any).ScrollHideWhitelist;

let lastSavedValue = '';
let lastKnownStorageValue = '';

const setSaveStatus = (message: string): void => {
  if (!saveStatus) return;
  saveStatus.textContent = message;
  saveStatus.classList.toggle('visible', Boolean(message));
};

const renderWhitelist = (domains: string[] | unknown): void => {
  if (!textarea) return;
  const nextValue = serializeDomains(domains);
  textarea.value = nextValue;
  lastSavedValue = nextValue;
  lastKnownStorageValue = nextValue;
};

const save = (): void => {
  if (!textarea) return;
  const draftDomains = normalizeWhitelist(textarea.value.split('\n'));

  getSyncState()
    .then((data: { whitelist: string[] }) => {
      const remoteValue = serializeDomains(data.whitelist);
      const nextDomains = remoteValue === lastKnownStorageValue
        ? draftDomains
        : normalizeWhitelist([...data.whitelist, ...draftDomains]);

      if (remoteValue !== lastKnownStorageValue) {
        renderWhitelist(nextDomains);
      }

      return setSyncValue({ whitelist: nextDomains }).then(() => {
        lastSavedValue = serializeDomains(nextDomains);
        lastKnownStorageValue = lastSavedValue;
        setSaveStatus(chrome.i18n.getMessage('saved') || 'Saved');
        setTimeout(() => setSaveStatus(''), 1500);
      });
    })
    .catch(() => {
      setSaveStatus(chrome.i18n.getMessage('error') || 'Error');
    });
};

if (textarea) {
  getSyncState()
    .then((data: { whitelist: string[] }) => {
      renderWhitelist(data.whitelist);
    })
    .catch(() => {
      renderWhitelist(DEFAULT_SYNC_STATE.whitelist);
    });

  let saveTimer: ReturnType<typeof setTimeout>;
  textarea.addEventListener('input', () => {
    setSaveStatus(chrome.i18n.getMessage('saving') || 'Saving...');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  });
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'sync' || !changes.whitelist || !textarea) return;

    const nextDomains = changes.whitelist.newValue || [];
    const nextValue = serializeDomains(nextDomains);
    lastKnownStorageValue = nextValue;

    if (textarea.value === lastSavedValue || textarea.value === nextValue) {
      renderWhitelist(nextDomains);
    }
  });
}

if (applyI18n) {
  applyI18n();
}
