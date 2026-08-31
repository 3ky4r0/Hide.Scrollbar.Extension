import { RulerMode, SelectionRect } from '../../shared/types';

(() => {
  const win = window as unknown as {
    __SCROLLHIDE_PAGE_RULER__?: PageRuler | null;
    __SCROLLHIDE_PAGE_DRAW__?: { destroy: () => void } | null;
  };

  if (win.__SCROLLHIDE_PAGE_DRAW__) {
    win.__SCROLLHIDE_PAGE_DRAW__.destroy();
    win.__SCROLLHIDE_PAGE_DRAW__ = null;
  }

  if (win.__SCROLLHIDE_PAGE_RULER__) {
    win.__SCROLLHIDE_PAGE_RULER__.destroy();
    win.__SCROLLHIDE_PAGE_RULER__ = null;
    return;
  }

  class PageRuler {
    mode: RulerMode;
    locked: boolean;
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: string | null;
    resizeStart: { x: number; y: number; width: number; height: number; mx: number; my: number } | null;
    startX: number;
    startY: number;
    selection: SelectionRect | null;
    hoveredElement: Element | null;

    // DOM
    host!: HTMLDivElement;
    shadow!: ShadowRoot;
    interactiveLayer!: HTMLDivElement;
    highlightBox!: HTMLDivElement;
    highlightBadge!: HTMLDivElement;
    badgeTagSpan!: HTMLSpanElement;
    badgeDimSpan!: HTMLSpanElement;
    lockDot!: HTMLSpanElement;
    selectionBox!: HTMLDivElement;
    selectionLabelW!: HTMLDivElement;
    selectionLabelH!: HTMLDivElement;
    hud!: HTMLDivElement;

    rafMoveId: number | null = null;
    rafScrollId: number | null = null;

    sW!: HTMLElement | null;
    sH!: HTMLElement | null;
    sX!: HTMLElement | null;
    sY!: HTMLElement | null;
    btnInspect!: HTMLButtonElement | null;
    btnSelect!: HTMLButtonElement | null;
    btnCopy!: HTMLButtonElement | null;
    btnClose!: HTMLButtonElement | null;

    // Dragging HUD
    isDraggingToolbar: boolean = false;
    dragOffsetX: number = 0;
    dragOffsetY: number = 0;
    _onToolbarDragStart!: (e: PointerEvent) => void;
    _onToolbarDragMove!: (e: PointerEvent) => void;
    _onToolbarDragEnd!: () => void;

    _onMove!: (e: PointerEvent) => void;
    _onDown!: (e: PointerEvent) => void;
    _onUp!: (e: PointerEvent) => void;
    _onKey!: (e: KeyboardEvent) => void;
    _onScroll!: () => void;
    _onClick!: (e: MouseEvent) => void;

    constructor() {
      this.mode = 'selection';
      this.locked = false;
      this.isDragging = false;
      this.isResizing = false;
      this.resizeHandle = null;
      this.resizeStart = null;
      this.startX = 0;
      this.startY = 0;
      this.selection = null;
      this.hoveredElement = null;

      this.init();
    }

    init(): void {
      this.createHost();
      this.render();
      this.bindEvents();
    }

    createHost(): void {
      this.host = document.createElement('div');
      this.host.id = 'scrollhide-page-ruler-root';
      this.host.style.cssText = 'all:initial;position:absolute;top:0;left:0;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity 0.08s ease;';

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ theme: 'system' }, (res) => {
          if (res.theme === 'light' || res.theme === 'dark') {
            this.host.setAttribute('data-theme', res.theme);
          }
        });
      }

      this.shadow = this.host.attachShadow({ mode: 'open' });
      (document.body || document.documentElement).appendChild(this.host);
    }

    render(): void {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/features/ruler/ruler.css');
      link.onload = () => {
        if (this.host) this.host.style.opacity = '1';
      };
      setTimeout(() => {
        if (this.host) this.host.style.opacity = '1';
      }, 50);
      this.shadow.appendChild(link);

      // Interactive layer
      this.interactiveLayer = document.createElement('div');
      this.interactiveLayer.className = 'interactive-layer active';

      // Highlight box
      this.highlightBox = document.createElement('div');
      this.highlightBox.className = 'highlight-box';
      this.highlightBadge = document.createElement('div');
      this.highlightBadge.className = 'highlight-badge';
      this.lockDot = document.createElement('span');
      this.lockDot.className = 'badge-lock';

      this.badgeTagSpan = document.createElement('span');
      this.badgeTagSpan.className = 'badge-tag';
      this.badgeDimSpan = document.createElement('span');
      this.badgeDimSpan.className = 'badge-dim';

      this.highlightBadge.appendChild(this.lockDot);
      this.highlightBadge.appendChild(this.badgeTagSpan);
      this.highlightBadge.appendChild(this.badgeDimSpan);
      this.highlightBox.appendChild(this.highlightBadge);

      // Selection box
      this.selectionBox = document.createElement('div');
      this.selectionBox.className = 'selection-box';
      this.selectionLabelW = document.createElement('div');
      this.selectionLabelW.className = 'selection-label-w';
      this.selectionLabelH = document.createElement('div');
      this.selectionLabelH.className = 'selection-label-h';
      this.selectionBox.appendChild(this.selectionLabelW);
      this.selectionBox.appendChild(this.selectionLabelH);

      ['nw','n','ne','e','se','s','sw','w'].forEach(h => {
        const el = document.createElement('div');
        el.className = `handle handle-${h}`;
        el.dataset.handle = h;
        this.selectionBox.appendChild(el);
      });

      // HUD toolbar matching PageDraw design
      this.hud = document.createElement('div');
      this.hud.className = 'hud';
      this.hud.innerHTML = `
        <div class="drag-handle" title="Kéo để di chuyển">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
            <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
            <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
          </svg>
        </div>

        <div class="stats-group">
          <div class="stat-item">
            <span class="stat-lbl">W:</span>
            <span id="sW" class="stat-val">—</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-lbl">H:</span>
            <span id="sH" class="stat-val">—</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-lbl">X:</span>
            <span id="sX" class="stat-val">—</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-item">
            <span class="stat-lbl">Y:</span>
            <span id="sY" class="stat-val">—</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="btn-group">
          <button id="btnInspect" class="tool-btn" title="Kiểm tra phần tử (I)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/>
              <path d="m14 14 7 7-3 1-1 3-3-11Z"/>
            </svg>
          </button>

          <button id="btnSelect" class="tool-btn active" title="Vẽ vùng chọn (S)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
          </button>

          <button id="btnCopy" class="tool-btn" title="Sao chép kích thước (C)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>

          <button id="btnClose" class="tool-btn" title="Đóng thước đo (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;

      this.shadow.appendChild(this.interactiveLayer);
      this.shadow.appendChild(this.highlightBox);
      this.shadow.appendChild(this.selectionBox);
      this.shadow.appendChild(this.hud);

      // Refs
      this.sW = this.shadow.getElementById('sW');
      this.sH = this.shadow.getElementById('sH');
      this.sX = this.shadow.getElementById('sX');
      this.sY = this.shadow.getElementById('sY');
      this.btnInspect = this.shadow.getElementById('btnInspect') as HTMLButtonElement | null;
      this.btnSelect  = this.shadow.getElementById('btnSelect') as HTMLButtonElement | null;
      this.btnCopy    = this.shadow.getElementById('btnCopy') as HTMLButtonElement | null;
      this.btnClose   = this.shadow.getElementById('btnClose') as HTMLButtonElement | null;
    }

    bindEvents(): void {
      this._onMove  = this.onMove.bind(this);
      this._onDown  = this.onDown.bind(this);
      this._onUp    = this.onUp.bind(this);
      this._onKey   = this.onKey.bind(this);
      this._onScroll = this.onScroll.bind(this);

      window.addEventListener('pointermove', this._onMove, { passive: true, capture: true });
      window.addEventListener('pointerdown', this._onDown, { capture: true });
      window.addEventListener('pointerup',   this._onUp,   { capture: true });
      window.addEventListener('keydown',     this._onKey,  { capture: true });
      window.addEventListener('scroll',      this._onScroll, { passive: true });

      this.btnInspect?.addEventListener('click', e => { e.stopPropagation(); this.setMode('inspect'); });
      this.btnSelect?.addEventListener('click',  e => { e.stopPropagation(); this.setMode('selection'); });
      this.btnCopy?.addEventListener('click',    e => { e.stopPropagation(); this.copy(); });
      this.btnClose?.addEventListener('click',   e => { e.stopPropagation(); this.destroy(); });

      // Dragging HUD handle
      const dragHandle = this.shadow.querySelector<HTMLDivElement>('.drag-handle');
      if (dragHandle) {
        this._onToolbarDragStart = (e: PointerEvent) => {
          this.isDraggingToolbar = true;
          const rect = this.hud.getBoundingClientRect();
          this.dragOffsetX = e.clientX - rect.left;
          this.dragOffsetY = e.clientY - rect.top;
          dragHandle.setPointerCapture(e.pointerId);
          e.stopPropagation();
        };

        this._onToolbarDragMove = (e: PointerEvent) => {
          if (!this.isDraggingToolbar) return;
          const x = Math.max(10, Math.min(window.innerWidth - this.hud.offsetWidth - 10, e.clientX - this.dragOffsetX));
          const y = Math.max(10, Math.min(window.innerHeight - this.hud.offsetHeight - 10, e.clientY - this.dragOffsetY));
          this.hud.style.left = `${x}px`;
          this.hud.style.top = `${y}px`;
          this.hud.style.bottom = 'auto';
          this.hud.style.right = 'auto';
          this.hud.style.transform = 'none';
        };

        this._onToolbarDragEnd = () => {
          this.isDraggingToolbar = false;
        };

        dragHandle.addEventListener('pointerdown', this._onToolbarDragStart);
        dragHandle.addEventListener('pointermove', this._onToolbarDragMove);
        dragHandle.addEventListener('pointerup', this._onToolbarDragEnd);
      }

      // Block all click events on page in inspect mode
      this._onClick = (e: MouseEvent) => {
        if (this.mode !== 'inspect') return;
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(this.host)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      window.addEventListener('click', this._onClick, { capture: true });
    }

    setMode(m: RulerMode): void {
      this.mode = m;
      this.locked = false;
      this.btnInspect?.classList.toggle('active', m === 'inspect');
      this.btnSelect?.classList.toggle('active',  m === 'selection');

      if (m === 'inspect') {
        this.interactiveLayer.classList.add('active');
        this.selectionBox.style.display = 'none';
        this.selection = null;
        this.highlightBox.classList.remove('locked');
      } else {
        this.interactiveLayer.classList.add('active');
        this.highlightBox.style.display = 'none';
        this.highlightBox.classList.remove('locked');
      }
    }

    updateStats(w: number | null, h: number | null, x: number | null, y: number | null): void {
      if (this.sW) this.sW.textContent = w != null ? `${w}px` : '—';
      if (this.sH) this.sH.textContent = h != null ? `${h}px` : '—';
      if (this.sX) this.sX.textContent = x != null ? `${x}px` : '—';
      if (this.sY) this.sY.textContent = y != null ? `${y}px` : '—';
    }

    copy(): void {
      const w = this.sW?.textContent;
      const h = this.sH?.textContent;
      if (!w || !h || w === '—') return;
      const text = `${w} × ${h}`;
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
        document.body.appendChild(ta);
        ta.focus({ preventScroll: true });
        ta.select();
        document.execCommand('copy');
        ta.remove();
      } catch (_) {
        navigator.clipboard?.writeText(text).catch(() => {});
      }
    }

    /* ── Events ── */

    onMove(e: PointerEvent): void {
      if (this.rafMoveId !== null) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const pageX = e.pageX;
      const pageY = e.pageY;

      this.rafMoveId = requestAnimationFrame(() => {
        this.rafMoveId = null;

        if (this.mode === 'inspect') {
          if (!this.locked) {
            this.inspectAt(clientX, clientY);
          }
          return;
        }

        if (this.isDragging) {
          const x = Math.min(this.startX, pageX);
          const y = Math.min(this.startY, pageY);
          const w = Math.abs(pageX - this.startX);
          const h = Math.abs(pageY - this.startY);
          this.setSelection(x, y, w, h);
        } else if (this.isResizing && this.resizeStart) {
          this.doResize(pageX, pageY);
        }
      });
    }

    onDown(e: PointerEvent): void {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this.host) && path.some(n => n === this.hud)) return;

      if (this.mode === 'inspect') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.locked = false;
        this.inspectAt(e.clientX, e.clientY);
        if (this.hoveredElement) {
          this.locked = true;
          this.highlightBox.classList.add('locked');
        }
        return;
      }

      // selection mode
      const targetEl = e.target as HTMLElement | null;
      const handle = targetEl?.dataset?.handle;
      if (handle && this.selection) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.resizeStart = { ...this.selection, mx: e.pageX, my: e.pageY };
        e.preventDefault();
        return;
      }

      this.isDragging = true;
      this.startX = e.pageX;
      this.startY = e.pageY;
      this.setSelection(this.startX, this.startY, 0, 0);
      e.preventDefault();
    }

    onUp(): void {
      this.isDragging = false;
      this.isResizing = false;
      this.resizeHandle = null;
    }

    onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.locked) {
          this.locked = false;
          this.highlightBox.classList.remove('locked');
        } else {
          this.destroy();
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'i') this.setMode('inspect');
        else if (key === 's') this.setMode('selection');
        else if (key === 'c') this.copy();
      }
    }

    onScroll(): void {
      if (this.rafScrollId !== null) return;
      this.rafScrollId = requestAnimationFrame(() => {
        this.rafScrollId = null;
        if (this.mode === 'inspect' && this.hoveredElement) {
          const r = this.hoveredElement.getBoundingClientRect();
          const sx = window.scrollX || 0, sy = window.scrollY || 0;
          this.highlightBox.style.top  = `${r.top  + sy}px`;
          this.highlightBox.style.left = `${r.left + sx}px`;
        } else if (this.mode === 'selection' && this.selection) {
          this.setSelection(this.selection.x, this.selection.y, this.selection.width, this.selection.height);
        }
      });
    }

    /* ── Inspect ── */

    inspectAt(cx: number, cy: number): void {
      // Find the element without toggling visibility to prevent layout thrashing
      const elements = document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : [];
      let el: Element | null = null;
      for (const candidate of elements) {
        if (candidate === this.host || (this.host && this.host.contains(candidate))) continue;
        if (candidate === document.documentElement || candidate === document.body) continue;
        el = candidate;
        break;
      }

      if (!el) return;

      this.hoveredElement = el;
      const r  = el.getBoundingClientRect();
      const sx = window.scrollX || 0, sy = window.scrollY || 0;
      const w  = Math.round(r.width);
      const h  = Math.round(r.height);

      this.highlightBox.style.display = 'block';
      this.highlightBox.style.top     = `${r.top  + sy}px`;
      this.highlightBox.style.left    = `${r.left + sx}px`;
      this.highlightBox.style.width   = `${w}px`;
      this.highlightBox.style.height  = `${h}px`;

      this.highlightBadge.classList.toggle('below', r.top < 80);

      const tag  = el.tagName.toLowerCase();
      const id   = el.id ? `#${el.id}` : '';
      const cls  = typeof el.className === 'string'
        ? el.className.split(' ').filter(Boolean).slice(0,2).map(c => `.${c}`).join('')
        : '';

      this.badgeTagSpan.textContent = `${tag}${id}${cls}`;
      this.badgeDimSpan.textContent = `${w} × ${h}`;

      this.updateStats(w, h, Math.round(r.left), Math.round(r.top));
    }

    /* ── Selection ── */

    setSelection(x: number, y: number, w: number, h: number): void {
      w = Math.round(w); h = Math.round(h);
      this.selection = { x, y, width: w, height: h };

      this.selectionBox.style.display = 'block';
      this.selectionBox.style.top     = `${y}px`;
      this.selectionBox.style.left    = `${x}px`;
      this.selectionBox.style.width   = `${w}px`;
      this.selectionBox.style.height  = `${h}px`;

      this.selectionLabelW.textContent = `${w}px`;
      this.selectionLabelH.textContent = `${h}px`;

      const sy = window.scrollY || window.pageYOffset || 0;
      const sx = window.scrollX || window.pageXOffset || 0;
      const vTop = y - sy;
      const vBottom = vTop + h;
      const vLeft = x - sx;
      const vRight = vLeft + w;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // ── Position Width Label (Horizontal) ──
      if (vTop < 32) {
        if (vBottom + 32 <= vh) {
          // Below the box
          this.selectionLabelW.style.top = 'calc(100% + 6px)';
          this.selectionLabelW.style.bottom = 'auto';
        } else {
          // Inside at top of the box
          this.selectionLabelW.style.top = '6px';
          this.selectionLabelW.style.bottom = 'auto';
        }
      } else {
        // Normal: above the box
        this.selectionLabelW.style.top = 'auto';
        this.selectionLabelW.style.bottom = 'calc(100% + 6px)';
      }

      // Clamp horizontally so it never goes off screen
      const centerX = vLeft + w / 2;
      if (centerX < 35) {
        this.selectionLabelW.style.left = `${Math.max(6, 30 - vLeft)}px`;
        this.selectionLabelW.style.right = 'auto';
        this.selectionLabelW.style.transform = 'none';
      } else if (centerX > vw - 35) {
        this.selectionLabelW.style.left = 'auto';
        this.selectionLabelW.style.right = `${Math.max(6, vRight - (vw - 30))}px`;
        this.selectionLabelW.style.transform = 'none';
      } else {
        this.selectionLabelW.style.left = '50%';
        this.selectionLabelW.style.right = 'auto';
        this.selectionLabelW.style.transform = 'translateX(-50%)';
      }

      // ── Position Height Label (Vertical) ──
      if (vLeft < 55) {
        if (vRight + 55 <= vw) {
          // Right outside the box
          this.selectionLabelH.style.left = 'calc(100% + 6px)';
          this.selectionLabelH.style.right = 'auto';
        } else {
          // Inside at left of the box
          this.selectionLabelH.style.left = '6px';
          this.selectionLabelH.style.right = 'auto';
        }
      } else {
        // Normal: left outside the box
        this.selectionLabelH.style.left = 'auto';
        this.selectionLabelH.style.right = 'calc(100% + 6px)';
      }

      // Clamp vertically so it never goes off screen
      const centerY = vTop + h / 2;
      if (centerY < 25) {
        this.selectionLabelH.style.top = `${Math.max(6, 20 - vTop)}px`;
        this.selectionLabelH.style.bottom = 'auto';
        this.selectionLabelH.style.transform = 'none';
      } else if (centerY > vh - 25) {
        this.selectionLabelH.style.top = 'auto';
        this.selectionLabelH.style.bottom = `${Math.max(6, vBottom - (vh - 20))}px`;
        this.selectionLabelH.style.transform = 'none';
      } else {
        this.selectionLabelH.style.top = '50%';
        this.selectionLabelH.style.bottom = 'auto';
        this.selectionLabelH.style.transform = 'translateY(-50%)';
      }

      this.updateStats(w, h, Math.round(x), Math.round(y));
    }

    doResize(px: number, py: number): void {
      if (!this.resizeStart || !this.resizeHandle) return;
      const { x, y, width, height, mx, my } = this.resizeStart;
      const dx = px - mx, dy = py - my;
      let nx = x, ny = y, nw = width, nh = height;

      const h = this.resizeHandle;
      if (h.includes('e')) nw = Math.max(1, width + dx);
      if (h.includes('s')) nh = Math.max(1, height + dy);
      if (h.includes('w')) { nw = Math.max(1, width - dx); nx = x + dx; }
      if (h.includes('n')) { nh = Math.max(1, height - dy); ny = y + dy; }

      this.setSelection(nx, ny, nw, nh);
    }

    /* ── Cleanup ── */

    destroy(): void {
      if (this.rafMoveId !== null) {
        cancelAnimationFrame(this.rafMoveId);
        this.rafMoveId = null;
      }
      if (this.rafScrollId !== null) {
        cancelAnimationFrame(this.rafScrollId);
        this.rafScrollId = null;
      }
      window.removeEventListener('pointermove', this._onMove, { capture: true });
      window.removeEventListener('pointerdown', this._onDown, { capture: true });
      window.removeEventListener('pointerup',   this._onUp,   { capture: true });
      window.removeEventListener('keydown',     this._onKey,  { capture: true });
      window.removeEventListener('click',       this._onClick, { capture: true });
      window.removeEventListener('scroll',      this._onScroll);
      this.host?.parentNode?.removeChild(this.host);
      (window as unknown as { __SCROLLHIDE_PAGE_RULER__?: PageRuler | null }).__SCROLLHIDE_PAGE_RULER__ = null;
    }
  }

  (window as unknown as { __SCROLLHIDE_PAGE_RULER__: PageRuler }).__SCROLLHIDE_PAGE_RULER__ = new PageRuler();
})();
