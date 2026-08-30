(() => {
  const { RESTRICTED_HOSTS, RESTRICTED_PROTOCOLS } = globalThis.ScrollHideConstants;

  const sanitizeDomain = (raw) => {
    const str = String(raw || '').trim();
    if (!str || str.startsWith('!') || str.startsWith('#')) return '';
    return str
      .toLowerCase()
      .replace(/^(https?:\/\/)?/, '')
      .replace(/[/?#].*$/, '');
  };

  const normalizeWhitelist = (domains) =>
    [...new Set(
      (Array.isArray(domains) ? domains : [])
        .map((domain) => sanitizeDomain(domain))
        .filter(Boolean)
    )].sort();

  const serializeDomains = (domains) => normalizeWhitelist(domains).join('\n');

  let cachedWhitelist = null;
  let cachedSet = new Set();

  const isWhitelisted = (hostname, whitelist) => {
    if (!hostname) return false;
    if (whitelist !== cachedWhitelist) {
      cachedWhitelist = whitelist;
      cachedSet = new Set(Array.isArray(whitelist) ? whitelist : []);
    }
    if (cachedSet.has(hostname)) return true;

    // Check parent domains (e.g., mail.google.com -> google.com)
    const parts = hostname.split('.');
    while (parts.length > 2) {
      parts.shift();
      if (cachedSet.has(parts.join('.'))) return true;
    }
    return false;
  };

  const isRestrictedUrl = (url) => {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      return RESTRICTED_PROTOCOLS.includes(parsed.protocol) || RESTRICTED_HOSTS.includes(parsed.hostname);
    } catch (_) {
      return true;
    }
  };

  globalThis.ScrollHideWhitelist = {
    isRestrictedUrl,
    isWhitelisted,
    normalizeWhitelist,
    sanitizeDomain,
    serializeDomains,
  };
})();
