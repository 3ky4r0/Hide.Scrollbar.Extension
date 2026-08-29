document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256];

  // DOM Elements
  const urlInput               = document.getElementById('urlInput');
  const pasteBtn               = document.getElementById('pasteBtn');
  const extractBtn             = document.getElementById('extractBtn');
  const errorMsg               = document.getElementById('errorMsg');
  const resultsContainer       = document.getElementById('resultsContainer');
  const noFaviconNotice        = document.getElementById('noFaviconNotice');
  const siteHostTitle          = document.getElementById('siteHostTitle');
  const favGrid                = document.getElementById('favGrid');
  const selectedActionsSection = document.getElementById('selectedActionsSection');
  const selectedUrlInput       = document.getElementById('selectedUrlInput');
  const copySelectedBtn        = document.getElementById('copySelectedBtn');
  const openNewTabBtn          = document.getElementById('openNewTabBtn');
  const downloadBtn            = document.getElementById('downloadBtn');
  const headerFavicon          = document.getElementById('headerFavicon');
  const headerFallback         = document.getElementById('headerFallback');

  let currentVariants = [];
  let selectedUrl = '';
  let currentHost = '';

  /* ── Helper: Normalize URL ───────────────────────────────── */

  function normalizeUrl(raw) {
    let trimmed = (raw || '').trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    try {
      return new URL(trimmed);
    } catch (_) {
      return null;
    }
  }

  /* ── Core: Extract Favicons ──────────────────────────────── */

  function extractFavicons(rawUrl, originalFaviconUrl = '') {
    if (errorMsg) {
      errorMsg.style.display = 'none';
      errorMsg.textContent = '';
    }
    if (noFaviconNotice) noFaviconNotice.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';

    const parsed = normalizeUrl(rawUrl);
    if (!parsed) {
      if (errorMsg) {
        errorMsg.textContent = 'Đường dẫn không hợp lệ. Vui lòng thử lại.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    currentHost = parsed.hostname.replace(/^www\./, '');
    if (siteHostTitle) {
      siteHostTitle.textContent = currentHost;
    }
    document.title = `Favicon — ${currentHost}`;

    // Candidates
    const candidates = [];

    // 1. Original (if provided)
    if (originalFaviconUrl && !originalFaviconUrl.startsWith('chrome://')) {
      candidates.push({
        url: originalFaviconUrl,
        label: 'Original',
      });
    }

    // 2. Google S2 multi sizes
    SIZES.forEach((s) => {
      candidates.push({
        url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(currentHost)}&sz=${s}`,
        label: `${s}px`,
      });
    });

    // 3. DuckDuckGo ICO
    candidates.push({
      url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(currentHost)}.ico`,
      label: 'DDG (ico)',
    });

    // Deduplicate
    const uniqueVariants = [];
    const seen = new Set();
    candidates.forEach((c) => {
      if (!seen.has(c.url)) {
        seen.add(c.url);
        uniqueVariants.push(c);
      }
    });

    currentVariants = uniqueVariants;
    renderVariants(uniqueVariants);
    updateHeaderLogo(currentHost, originalFaviconUrl);
  }

  /* ── Render Grid ─────────────────────────────────────────── */

  function renderVariants(variants) {
    if (!favGrid) return;
    favGrid.innerHTML = '';
    selectedUrl = '';
    if (selectedUrlInput) selectedUrlInput.value = '';
    if (selectedActionsSection) selectedActionsSection.style.display = 'none';

    if (!variants || variants.length === 0) {
      if (noFaviconNotice) noFaviconNotice.style.display = 'block';
      return;
    }

    if (resultsContainer) resultsContainer.style.display = 'block';

    let firstValidSelected = false;

    variants.forEach((v) => {
      const item = document.createElement('div');
      item.className = 'fav-item';
      item.dataset.url = v.url;

      const img = document.createElement('img');
      img.className = 'fav-image';
      img.alt = v.label;
      img.src = v.url;

      // Handle broken images
      img.onerror = () => {
        item.style.display = 'none';
      };

      img.onload = () => {
        // Select the first successfully loaded image if none selected yet
        if (!firstValidSelected) {
          firstValidSelected = true;
          selectVariant(v.url, item);
        }
      };

      const label = document.createElement('span');
      label.className = 'size-label';
      label.textContent = v.label;

      item.appendChild(img);
      item.appendChild(label);

      item.addEventListener('click', () => {
        selectVariant(v.url, item);
      });

      favGrid.appendChild(item);
    });
  }

  /* ── Selection ───────────────────────────────────────────── */

  function selectVariant(url, itemEl) {
    selectedUrl = url;
    if (selectedUrlInput) selectedUrlInput.value = url;
    if (selectedActionsSection) selectedActionsSection.style.display = 'block';

    // Highlight class
    document.querySelectorAll('.fav-item').forEach((el) => {
      el.classList.remove('selected');
    });
    if (itemEl) {
      itemEl.classList.add('selected');
    }
  }

  function updateHeaderLogo(host, fallbackUrl) {
    if (!host || !headerFavicon) return;

    // Highest quality candidate (256px)
    const highResUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`;

    const testImg = new Image();
    testImg.onload = () => {
      headerFavicon.src = highResUrl;
      headerFavicon.style.display = 'block';
      if (headerFallback) headerFallback.style.display = 'none';
    };
    testImg.onerror = () => {
      if (fallbackUrl) {
        headerFavicon.src = fallbackUrl;
        headerFavicon.style.display = 'block';
        if (headerFallback) headerFallback.style.display = 'none';
      }
    };
    testImg.src = highResUrl;
  }

  /* ── Download Helper ─────────────────────────────────────── */

  async function downloadCurrentFavicon() {
    if (!selectedUrl || !downloadBtn) return;

    downloadBtn.disabled = true;

    try {
      const resp = await fetch(selectedUrl);
      const blob = await resp.blob();
      const ext = blob.type.includes('svg') ? 'svg'
        : blob.type.includes('icon') || blob.type.includes('x-ico') ? 'ico'
          : blob.type.includes('jpeg') ? 'jpg'
            : blob.type.includes('webp') ? 'webp'
              : 'png';

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `favicon-${currentHost || 'icon'}.${ext}`;
      a.click();
      URL.revokeObjectURL(blobUrl);

      downloadBtn.classList.add('success');
      setTimeout(() => {
        downloadBtn.classList.remove('success');
      }, 1500);
    } catch (_) {
      // Fallback
      window.open(selectedUrl, '_blank');
    } finally {
      setTimeout(() => {
        downloadBtn.disabled = false;
      }, 500);
    }
  }

  /* ── Event Listeners ─────────────────────────────────────── */

  if (extractBtn && urlInput) {
    extractBtn.addEventListener('click', () => {
      extractFavicons(urlInput.value);
    });

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        extractFavicons(urlInput.value);
      }
    });
  }

  if (pasteBtn && urlInput) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          extractFavicons(urlInput.value);
        }
      } catch (_) {
        urlInput.focus();
      }
    });
  }

  if (copySelectedBtn) {
    const originalCopyIcon = copySelectedBtn.innerHTML;

    copySelectedBtn.addEventListener('click', async () => {
      if (!selectedUrl) return;
      try {
        await navigator.clipboard.writeText(selectedUrl);
        copySelectedBtn.classList.add('success');
        copySelectedBtn.innerHTML = `
          <svg class="inline-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>`;
        setTimeout(() => {
          copySelectedBtn.classList.remove('success');
          copySelectedBtn.innerHTML = originalCopyIcon;
        }, 2000);
      } catch (_) { }
    });
  }

  if (openNewTabBtn) {
    openNewTabBtn.addEventListener('click', () => {
      if (selectedUrl) {
        window.open(selectedUrl, '_blank', 'noopener,noreferrer');
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      downloadCurrentFavicon();
    });
  }

  /* ── Initial Load from Query Params ──────────────────────── */

  const params = new URLSearchParams(location.search);
  const tabUrl = params.get('tabUrl') || '';
  const favUrl = params.get('favUrl') || '';

  if (tabUrl) {
    if (urlInput) urlInput.value = tabUrl;
    extractFavicons(tabUrl, favUrl);
  }
});
