export const applyI18n = (): void => {
  if (typeof document === 'undefined' || typeof chrome === 'undefined' || !chrome.i18n) return;

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    const message = chrome.i18n.getMessage(key);
    if (!message) return;

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      element.placeholder = message;
    } else {
      element.textContent = message;
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title');
    if (!key) return;
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.title = message;
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
    const key = element.getAttribute('data-i18n-aria-label');
    if (!key) return;
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.setAttribute('aria-label', message);
    }
  });
};

export const ScrollHideI18n = { applyI18n };

// Global assignment for HTML script tags
(globalThis as unknown as { ScrollHideI18n: typeof ScrollHideI18n }).ScrollHideI18n = ScrollHideI18n;
