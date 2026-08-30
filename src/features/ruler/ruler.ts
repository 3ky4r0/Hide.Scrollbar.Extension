import { CornerPosition, ResizeStartState, RulerMode, SelectionRect } from '../../shared/types';

(() => {
  const win = window as unknown as { __SCROLLHIDE_PAGE_RULER__?: PageRuler | null };
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
    resizeStart: ResizeStartState | null;
    startX: number;
    startY: number;
    selection: SelectionRect | null;
    hoveredElement: Element | null;

    host!: HTMLDivElement;
    shadow!: ShadowRoot;
    interactiveLayer!: HTMLDivElement;
    highlightBox!: HTMLDivElement;
    highlightBadge!: HTMLDivElement;
    lockDot!: HTMLSpanElement;
    selectionBox!: HTMLDivElement;
    selectionLabel!: HTMLDivElement;
    hud!: HTMLDivElement;
    toast!: HTMLDivElement;

    sW!: HTMLElement | null;
    sH!: HTMLElement | null;
    sX!: HTMLElement | null;
    sY!: HTMLElement | null;
    btnInspect!: HTMLButtonElement | null;
    btnSelect!: HTMLButtonElement | null;
    btnCopy!: HTMLButtonElement | null;
    btnMove!: HTMLButtonElement | null;
    btnClose!: HTMLButtonElement | null;

    positionIdx: number;
    positions: CornerPosition[];

    _toastT?: ReturnType<typeof setTimeout>;
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

      this.positionIdx = 0;
      this.positions = [
        { bottom: '14px', left: '14px',  top: 'auto', right: 'auto'  },
        { bottom: '14px', right: '14px', top: 'auto', left: 'auto'   },
        { top:    '14px', right: '14px', bottom: 'auto', left: 'auto' },
        { top:    '14px', left: '14px',  bottom: 'auto', right: 'auto' },
      ];

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
      this.host.style.cssText = 'all:initial;position:absolute;top:0;left:0;z-index:2147483647;pointer-events:none;';
      this.shadow = this.host.attachShadow({ mode: 'open' });
      (document.body || document.documentElement).appendChild(this.host);
    }

    render(): void {
      const style = document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Color tokens — auto light/dark matching tokens.css ── */
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          /* dark defaults */
          --bg:        #282828;
          --bg2:       #282828;
          --text:      #ffffff;
          --muted:     #8b949e;
          --accent:    #58a6ff;
          --border:    rgba(255,255,255,0.1);
          --sep:       rgba(255,255,255,0.15);
          --btn-hover: rgba(255,255,255,0.1);
          --shadow:    rgba(0,0,0,0.55);
          --badge-tag: #ff7b72;
          --badge-dim: #7ee787;
        }
        @media (prefers-color-scheme: light) {
          :host {
            --bg:        #ffffff;
            --bg2:       #ffffff;
            --text:      #2f3446;
            --muted:     #8b949e;
            --accent:    #2772ed;
            --border:    rgba(0,0,0,0.1);
            --sep:       rgba(0,0,0,0.12);
            --btn-hover: rgba(0,0,0,0.06);
            --shadow:    rgba(0,0,0,0.2);
            --badge-tag: #cf222e;
            --badge-dim: #1a7f37;
          }
        }

        /* ── Interactive capture layer (selection mode only) ── */
        .interactive-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          cursor: crosshair;
          z-index: 90;
        }
        .interactive-layer.active {
          pointer-events: auto;
        }

        /* ── Element highlight box ── */
        .highlight-box {
          position: absolute;
          display: none;
          border: 2px solid #2772ed;
          background: rgba(39, 114, 237, 0.14);
          pointer-events: none;
          z-index: 105;
          transition: border-color 0.15s;
        }
        .highlight-box.locked {
          border-color: #00e676;
          background: rgba(0, 230, 118, 0.1);
        }

        .highlight-badge {
          position: absolute;
          top: -25px;
          left: 0;
          background: var(--bg);
          color: var(--text);
          border: none;
          box-shadow: 0 2px 8px var(--shadow);
          border-radius: 1px;
          padding: 2px 7px;
          white-space: nowrap;
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        /* flip badge below when element is near top of viewport */
        .highlight-badge.below {
          top: auto;
          bottom: -25px;
        }

        .badge-lock {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #00e676;
          flex-shrink: 0;
          display: none;
        }
        .highlight-box.locked .badge-lock { display: block; }

        .badge-tag  { color: var(--badge-tag); font-weight: 600; }
        .badge-dim  { color: var(--badge-dim); font-weight: 700; }

        /* ── Selection box ── */
        .selection-box {
          position: absolute;
          display: none;
          border: 2px dashed #00e676;
          background: rgba(0, 230, 118, 0.1);
          pointer-events: none;
          cursor: crosshair;
          z-index: 110;
        }

        .selection-label {
          position: absolute;
          bottom: calc(100% + 5px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg);
          border: none;
          box-shadow: 0 2px 8px var(--shadow);
          border-radius: 1px;
          padding: 2px 8px;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--badge-dim);
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none;
        }

        /* ── 8 resize handles ── */
        .handle {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #fff;
          border: 2px solid #00c853;
          border-radius: 2px;
          pointer-events: auto;
        }
        .handle-nw { top:-4px; left:-4px; cursor:nwse-resize; }
        .handle-n  { top:-4px; left:calc(50% - 4px); cursor:ns-resize; }
        .handle-ne { top:-4px; right:-4px; cursor:nesw-resize; }
        .handle-e  { top:calc(50% - 4px); right:-4px; cursor:ew-resize; }
        .handle-se { bottom:-4px; right:-4px; cursor:nwse-resize; }
        .handle-s  { bottom:-4px; left:calc(50% - 4px); cursor:ns-resize; }
        .handle-sw { bottom:-4px; left:-4px; cursor:nesw-resize; }
        .handle-w  { top:calc(50% - 4px); left:-4px; cursor:ew-resize; }

        /* ── Floating HUD — single row, bottom-left ── */
        .hud {
          position: fixed;
          bottom: 14px;
          left: 14px;
          background: var(--bg);
          border: none;
          box-shadow: 0 4px 20px var(--shadow);
          border-radius: 1px;
          display: flex;
          flex-direction: row;
          align-items: center;
          overflow: hidden;
          pointer-events: auto;
          z-index: 200;
          user-select: none;
          height: 32px;
          transition: top 0.18s, bottom 0.18s, left 0.18s, right 0.18s;
        }

        .hud-stats-group {
          display: flex;
          align-items: center;
          height: 100%;
          background: var(--bg2);
        }

        .hud-stat {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 0 8px;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          background: transparent;
        }

        .hud-stat-lbl { color: var(--muted); font-weight: 500; }
        .hud-stat-val { color: var(--text); font-weight: 700; min-width: 38px; }

        .hud-sep {
          width: 1px;
          height: 14px;
          background: var(--sep);
          flex-shrink: 0;
        }

        .hud-btn {
          height: 100%;
          padding: 0 10px;
          background: transparent;
          border: none;
          color: var(--muted);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: nowrap;
        }
        .hud-btn:hover { background: var(--btn-hover); color: var(--text); }
        .hud-btn.active { color: var(--text); font-weight: 700; background: var(--btn-hover); }

        /* toast */
        .toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(6px);
          background: #238636;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 20px;
          opacity: 0;
          transition: opacity 0.18s, transform 0.18s;
          pointer-events: none;
          z-index: 250;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .toast.show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `;

      this.shadow.appendChild(style);

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
      this.highlightBadge.appendChild(this.lockDot);
      this.highlightBox.appendChild(this.highlightBadge);

      // Selection box
      this.selectionBox = document.createElement('div');
      this.selectionBox.className = 'selection-box';
      this.selectionLabel = document.createElement('div');
      this.selectionLabel.className = 'selection-label';
      this.selectionBox.appendChild(this.selectionLabel);

      ['nw','n','ne','e','se','s','sw','w'].forEach(h => {
        const el = document.createElement('div');
        el.className = `handle handle-${h}`;
        el.dataset.handle = h;
        this.selectionBox.appendChild(el);
      });

      // HUD
      this.hud = document.createElement('div');
      this.hud.className = 'hud';
      this.hud.innerHTML = `
        <div class="hud-stats-group">
          <div class="hud-stat">
            <span class="hud-stat-lbl">W</span>
            <span id="sW" class="hud-stat-val">—</span>
          </div>
          <div class="hud-sep"></div>
          <div class="hud-stat">
            <span class="hud-stat-lbl">H</span>
            <span id="sH" class="hud-stat-val">—</span>
          </div>
          <div class="hud-sep"></div>
          <div class="hud-stat">
            <span class="hud-stat-lbl">X</span>
            <span id="sX" class="hud-stat-val">—</span>
          </div>
          <div class="hud-sep"></div>
          <div class="hud-stat">
            <span class="hud-stat-lbl">Y</span>
            <span id="sY" class="hud-stat-val">—</span>
          </div>
        </div>
        <button id="btnInspect" class="hud-btn" title="Inspect element">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/><path d="m14 14 7 7-3 1-1 3-3-11Z"/></svg>
          Inspect
        </button>
        <button id="btnSelect" class="hud-btn active" title="Draw selection">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          Select
        </button>
        <button id="btnCopy" class="hud-btn" title="Copy dimensions">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy
        </button>
        <button id="btnMove" class="hud-btn" title="Move to next corner">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>
        </button>
        <button id="btnClose" class="hud-btn" title="Close ruler">✕</button>
      `;

      this.toast = document.createElement('div');
      this.toast.className = 'toast';

      this.shadow.appendChild(this.interactiveLayer);
      this.shadow.appendChild(this.highlightBox);
      this.shadow.appendChild(this.selectionBox);
      this.shadow.appendChild(this.hud);
      this.shadow.appendChild(this.toast);

      // Refs
      this.sW = this.shadow.getElementById('sW');
      this.sH = this.shadow.getElementById('sH');
      this.sX = this.shadow.getElementById('sX');
      this.sY = this.shadow.getElementById('sY');
      this.btnInspect = this.shadow.getElementById('btnInspect') as HTMLButtonElement | null;
      this.btnSelect  = this.shadow.getElementById('btnSelect') as HTMLButtonElement | null;
      this.btnCopy    = this.shadow.getElementById('btnCopy') as HTMLButtonElement | null;
      this.btnMove    = this.shadow.getElementById('btnMove') as HTMLButtonElement | null;
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
      this.btnMove?.addEventListener('click',    e => { e.stopPropagation(); this.cyclePosition(); });
      this.btnClose?.addEventListener('click',   e => { e.stopPropagation(); this.destroy(); });

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

    cyclePosition(): void {
      this.positionIdx = (this.positionIdx + 1) % this.positions.length;
      const pos = this.positions[this.positionIdx];
      Object.assign(this.hud.style, pos);
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
        const ok = document.execCommand('copy');
        ta.remove();
        this.showToast(ok ? `Copied ${text}` : `${text}`);
      } catch (_) {
        navigator.clipboard?.writeText(text).catch(() => {});
        this.showToast(`Copied ${text}`);
      }
    }

    showToast(msg: string): void {
      this.toast.textContent = msg;
      this.toast.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => this.toast.classList.remove('show'), 1600);
    }

    /* ── Events ── */

    onMove(e: PointerEvent): void {
      if (this.mode === 'inspect') {
        if (!this.locked) {
          this.inspectAt(e.clientX, e.clientY);
        }
        return;
      }

      if (this.isDragging) {
        const x = Math.min(this.startX, e.pageX);
        const y = Math.min(this.startY, e.pageY);
        const w = Math.abs(e.pageX - this.startX);
        const h = Math.abs(e.pageY - this.startY);
        this.setSelection(x, y, w, h);
      } else if (this.isResizing && this.resizeStart) {
        this.doResize(e.pageX, e.pageY);
      }
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
      }
    }

    onScroll(): void {
      if (this.mode === 'inspect' && this.hoveredElement) {
        const r = this.hoveredElement.getBoundingClientRect();
        const sx = window.scrollX, sy = window.scrollY;
        this.highlightBox.style.top  = `${r.top  + sy}px`;
        this.highlightBox.style.left = `${r.left + sx}px`;
      }
    }

    /* ── Inspect ── */

    inspectAt(cx: number, cy: number): void {
      this.host.style.visibility = 'hidden';
      const el = document.elementFromPoint(cx, cy);
      this.host.style.visibility = '';

      if (!el || el === document.documentElement || el === document.body) return;

      this.hoveredElement = el;
      const r  = el.getBoundingClientRect();
      const sx = window.scrollX, sy = window.scrollY;
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

      const tagSpan = `<span class="badge-tag">${tag}${id}${cls}</span>`;
      const dimSpan = `<span class="badge-dim">${w} × ${h}</span>`;
      while (this.highlightBadge.children.length > 1) {
        this.highlightBadge.removeChild(this.highlightBadge.lastChild!);
      }
      this.highlightBadge.insertAdjacentHTML('beforeend', tagSpan + dimSpan);

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

      this.selectionLabel.textContent = `${w} × ${h} px`;
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
      window.removeEventListener('pointermove', this._onMove, { capture: true });
      window.removeEventListener('pointerdown', this._onDown, { capture: true });
      window.removeEventListener('pointerup',   this._onUp,   { capture: true });
      window.removeEventListener('keydown',     this._onKey,  { capture: true });
      window.removeEventListener('click',       this._onClick, { capture: true });
      window.removeEventListener('scroll',      this._onScroll);
      clearTimeout(this._toastT);
      this.host?.parentNode?.removeChild(this.host);
      (window as unknown as { __SCROLLHIDE_PAGE_RULER__?: PageRuler | null }).__SCROLLHIDE_PAGE_RULER__ = null;
    }
  }

  (window as unknown as { __SCROLLHIDE_PAGE_RULER__: PageRuler }).__SCROLLHIDE_PAGE_RULER__ = new PageRuler();
})();
