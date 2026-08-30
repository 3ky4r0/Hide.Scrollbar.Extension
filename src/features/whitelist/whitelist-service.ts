const getConstants = () => {
  const g = globalThis as unknown as { ScrollHideConstants?: { RESTRICTED_HOSTS: string[]; RESTRICTED_PROTOCOLS: string[] } };
  return g.ScrollHideConstants || {
    RESTRICTED_HOSTS: [] as string[],
    RESTRICTED_PROTOCOLS: [
      'chrome:',
      'chrome-extension:',
      'edge:',
      'about:',
      'view-source:',
      'devtools:',
    ],
  };
};

export const sanitizeDomain = (raw: unknown): string => {
  const str = String(raw || '').trim();
  if (!str || str.startsWith('!') || str.startsWith('#')) return '';
  return str
    .toLowerCase()
    .replace(/^(https?:\/\/)?/, '')
    .replace(/[/?#].*$/, '');
};

export const normalizeWhitelist = (domains: unknown): string[] =>
  [...new Set(
    (Array.isArray(domains) ? domains : [])
      .map((domain) => sanitizeDomain(domain))
      .filter(Boolean)
  )].sort();

export const serializeDomains = (domains: unknown): string =>
  normalizeWhitelist(domains).join('\n');

let cachedWhitelist: unknown = null;
let cachedSet = new Set<string>();

export const isWhitelisted = (hostname: string | null | undefined, whitelist: string[] | unknown): boolean => {
  if (!hostname) return false;
  if (whitelist !== cachedWhitelist) {
    cachedWhitelist = whitelist;
    cachedSet = new Set(Array.isArray(whitelist) ? (whitelist as string[]) : []);
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

export const isRestrictedUrl = (url: string | null | undefined): boolean => {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const { RESTRICTED_HOSTS, RESTRICTED_PROTOCOLS } = getConstants();
    return RESTRICTED_PROTOCOLS.includes(parsed.protocol) || RESTRICTED_HOSTS.includes(parsed.hostname);
  } catch (_) {
    return true;
  }
};

export const ScrollHideWhitelist = {
  isRestrictedUrl,
  isWhitelisted,
  normalizeWhitelist,
  sanitizeDomain,
  serializeDomains,
};

// Global assignment for HTML script tags
(globalThis as unknown as { ScrollHideWhitelist: typeof ScrollHideWhitelist }).ScrollHideWhitelist = ScrollHideWhitelist;
