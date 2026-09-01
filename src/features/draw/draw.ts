import { DrawPoint, DrawStroke, DrawToolMode } from '../../shared/types';

(() => {
  const win = window as unknown as {
    __SCROLLHIDE_PAGE_DRAW__?: PageDraw | null;
    __SCROLLHIDE_PAGE_RULER__?: { destroy: () => void } | null;
  };

  if (win.__SCROLLHIDE_PAGE_RULER__) {
    win.__SCROLLHIDE_PAGE_RULER__.destroy();
    win.__SCROLLHIDE_PAGE_RULER__ = null;
  }

  if (win.__SCROLLHIDE_PAGE_DRAW__) {
    win.__SCROLLHIDE_PAGE_DRAW__.destroy();
    win.__SCROLLHIDE_PAGE_DRAW__ = null;
    return;
  }

  const PALETTE = [
    '#ff3b30', // Red
    '#ff9500', // Orange
    '#ffcc00', // Yellow
    '#34c759', // Green
    '#00c7be', // Teal
    '#007aff', // Blue
    '#af52de', // Purple
    '#ffffff', // White
    '#1c1c1e', // Dark / Black
  ];

  const SIZES = [2, 4, 8, 16];

  class PageDraw {
    host!: HTMLDivElement;
    shadow!: ShadowRoot;
    canvas!: HTMLCanvasElement;
    ctx!: CanvasRenderingContext2D;
    toolbar!: HTMLDivElement;

    currentTool: DrawToolMode = 'pen';
    currentColor: string = '#ff3b30';
    currentSize: number = 4;
    isDrawing: boolean = false;
    startX: number = 0;
    startY: number = 0;
    currentPoints: DrawPoint[] = [];

    // History
    history: DrawStroke[] = [];
    redoList: DrawStroke[] = [];

    rafDrawId: number | null = null;
    rafScrollId: number | null = null;

    // Toolbar drag state
    isDraggingToolbar: boolean = false;
    dragOffsetX: number = 0;
    dragOffsetY: number = 0;

    // Event handlers bound
    _onPointerDown!: (e: PointerEvent) => void;
    _onPointerMove!: (e: PointerEvent) => void;
    _onPointerUp!: (e: PointerEvent) => void;
    _onKeyDown!: (e: KeyboardEvent) => void;
    _onResize!: () => void;
    _onScroll!: () => void;
    _onWheel!: (e: WheelEvent) => void;
    _onToolbarDragStart!: (e: PointerEvent) => void;
    _onToolbarDragMove!: (e: PointerEvent) => void;
    _onToolbarDragEnd!: () => void;

    constructor() {
      this.init();
    }

    init(): void {
      this.createHost();
      this.render();
      this.initCanvas();
      this.bindEvents();
    }

    getScroll(): { x: number; y: number } {
      const doc = document.documentElement;
      const body = document.body;
      return {
        x: window.scrollX || window.pageXOffset || (doc && doc.scrollLeft) || (body && body.scrollLeft) || 0,
        y: window.scrollY || window.pageYOffset || (doc && doc.scrollTop) || (body && body.scrollTop) || 0,
      };
    }

    createHost(): void {
      this.host = document.createElement('div');
      this.host.id = 'scrollhide-page-draw-root';
      this.host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483646;pointer-events:none;user-select:none;opacity:0;transition:opacity 0.08s ease;';

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ theme: 'system' }, (res) => {
          if (res.theme === 'light' || res.theme === 'dark') {
            this.host.setAttribute('data-theme', res.theme);
          }
        });
      }

      this.shadow = this.host.attachShadow({ mode: 'open' });
      (document.documentElement || document.body).appendChild(this.host);
    }

    render(): void {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/features/draw/draw.css');
      link.onload = () => {
        if (this.host) this.host.style.opacity = '1';
      };
      setTimeout(() => {
        if (this.host) this.host.style.opacity = '1';
      }, 50);

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'canvas-layer';

      this.toolbar = document.createElement('div');
      this.toolbar.className = 'toolbar';
      this.toolbar.innerHTML = `
        <div class="drag-handle" title="Kéo để di chuyển">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
            <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
            <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
          </svg>
        </div>

        <div class="btn-group">
          <button class="tool-btn active" data-tool="pen" title="Bút vẽ (P)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </button>

          <button class="tool-btn" data-tool="highlighter" title="Bút dạ quang (H)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 11-6 6v3h3l6-6"/>
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
            </svg>
          </button>

          <button class="tool-btn" data-tool="line" title="Đường thẳng (L)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="19" x2="19" y2="5"/>
            </svg>
          </button>

          <button class="tool-btn" data-tool="arrow" title="Mũi tên (A)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="19" x2="19" y2="5"/>
              <polyline points="10 5 19 5 19 14"/>
            </svg>
          </button>

          <button class="tool-btn" data-tool="rect" title="Hình chữ nhật (R)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
          </button>

          <button class="tool-btn" data-tool="circle" title="Hình tròn (C)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
            </svg>
          </button>

          <button class="tool-btn" data-tool="eraser" title="Tẩy nét (E)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
              <path d="M22 21H7"/>
              <path d="m5 11 9 9"/>
            </svg>
          </button>
        </div>

        <div class="divider"></div>

        <div class="color-palette">
          ${PALETTE.map(
            (c) =>
              `<div class="color-swatch ${c === this.currentColor ? 'active' : ''}" style="background:${c};" data-color="${c}"></div>`
          ).join('')}
          <div class="custom-color-btn" title="Chọn màu tùy ý">
            <input type="color" class="custom-color-input" value="${this.currentColor}" />
          </div>
        </div>

        <div class="divider"></div>

        <div class="size-selector">
          ${SIZES.map(
            (s) => `
            <button class="size-btn ${s === this.currentSize ? 'active' : ''}" data-size="${s}" title="Cỡ nét: ${s}px">
              <div class="size-dot" style="width:${Math.max(4, s)}px;height:${Math.max(4, s)}px;"></div>
            </button>
          `
          ).join('')}
        </div>

        <div class="divider"></div>

        <div class="btn-group">
          <button class="tool-btn" id="btnUndo" title="Hoàn tác (Ctrl+Z)" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
          </button>

          <button class="tool-btn" id="btnRedo" title="Làm lại (Ctrl+Y)" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 7v6h-6"/>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
            </svg>
          </button>

          <button class="tool-btn" id="btnClear" title="Xóa toàn bộ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>

          <button class="tool-btn" id="btnSave" title="Lưu ảnh vẽ (PNG)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          <button class="tool-btn" id="btnClose" title="Đóng chế độ vẽ (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;

      this.shadow.appendChild(link);
      this.shadow.appendChild(this.canvas);
      this.shadow.appendChild(this.toolbar);
    }

    initCanvas(): void {
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;
      this.ctx = ctx;
      this.resizeCanvas();
    }

    resizeCanvas(): void {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.redraw();
    }

    bindEvents(): void {
      this._onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
      this._onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
      this._onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
      this._onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
      this._onResize = () => this.resizeCanvas();
      this._onScroll = () => {
        if (this.rafScrollId !== null) return;
        this.rafScrollId = requestAnimationFrame(() => {
          this.rafScrollId = null;
          this.redraw();
        });
      };

      this._onWheel = (e: WheelEvent) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(this.toolbar)) return;

        const elements = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
        for (const el of elements) {
          if (el === this.host || (this.host && this.host.contains(el))) continue;
          if (el === document.documentElement || el === document.body) continue;

          try {
            const style = window.getComputedStyle(el);
            const oy = style.overflowY;
            const ox = style.overflowX;
            const canScrollY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight;
            const canScrollX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth;

            if (canScrollY || canScrollX) {
              el.scrollBy({
                left: e.deltaX,
                top: e.deltaY,
                behavior: 'instant' as ScrollBehavior,
              });
              return;
            }
          } catch (_) {}
        }

        window.scrollBy({
          left: e.deltaX,
          top: e.deltaY,
          behavior: 'instant' as ScrollBehavior,
        });
      };

      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('scroll', this._onScroll, { passive: true });
      document.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
      window.addEventListener('wheel', this._onWheel, { passive: true, capture: true });

      // Tool clicks
      this.toolbar.querySelectorAll<HTMLButtonElement>('.tool-btn[data-tool]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tool = btn.getAttribute('data-tool') as DrawToolMode;
          if (tool) this.setTool(tool);
        });
      });

      // Color clicks
      this.toolbar.querySelectorAll<HTMLDivElement>('.color-swatch').forEach((swatch) => {
        swatch.addEventListener('click', () => {
          const color = swatch.getAttribute('data-color');
          if (color) this.setColor(color);
        });
      });

      // Custom color picker
      const customColorInput = this.shadow.querySelector<HTMLInputElement>('.custom-color-input');
      if (customColorInput) {
        customColorInput.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          this.setColor(target.value);
        });
      }

      // Size clicks
      this.toolbar.querySelectorAll<HTMLButtonElement>('.size-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const size = Number(btn.getAttribute('data-size'));
          if (size) this.setSize(size);
        });
      });

      // Action buttons
      this.shadow.getElementById('btnUndo')?.addEventListener('click', () => this.undo());
      this.shadow.getElementById('btnRedo')?.addEventListener('click', () => this.redo());
      this.shadow.getElementById('btnClear')?.addEventListener('click', () => this.clearAll());
      this.shadow.getElementById('btnSave')?.addEventListener('click', () => this.saveImage());
      this.shadow.getElementById('btnClose')?.addEventListener('click', () => this.destroy());

      // Toolbar dragging
      const dragHandle = this.shadow.querySelector<HTMLDivElement>('.drag-handle');
      if (dragHandle) {
        this._onToolbarDragStart = (e: PointerEvent) => {
          this.isDraggingToolbar = true;
          const rect = this.toolbar.getBoundingClientRect();
          this.dragOffsetX = e.clientX - rect.left;
          this.dragOffsetY = e.clientY - rect.top;
          dragHandle.setPointerCapture(e.pointerId);
          e.stopPropagation();
        };

        this._onToolbarDragMove = (e: PointerEvent) => {
          if (!this.isDraggingToolbar) return;
          const x = Math.max(10, Math.min(window.innerWidth - this.toolbar.offsetWidth - 10, e.clientX - this.dragOffsetX));
          const y = Math.max(10, Math.min(window.innerHeight - this.toolbar.offsetHeight - 10, e.clientY - this.dragOffsetY));
          this.toolbar.style.left = `${x}px`;
          this.toolbar.style.top = `${y}px`;
          this.toolbar.style.bottom = 'auto';
          this.toolbar.style.transform = 'none';
        };

        this._onToolbarDragEnd = () => {
          this.isDraggingToolbar = false;
        };

        dragHandle.addEventListener('pointerdown', this._onToolbarDragStart);
        dragHandle.addEventListener('pointermove', this._onToolbarDragMove);
        dragHandle.addEventListener('pointerup', this._onToolbarDragEnd);
      }
    }

    setTool(tool: DrawToolMode): void {
      this.currentTool = tool;
      this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
      });

      this.canvas.className = 'canvas-layer';
      if (tool === 'eraser') {
        this.canvas.classList.add('eraser-mode');
      }
    }

    setColor(color: string): void {
      this.currentColor = color;
      this.toolbar.querySelectorAll('.color-swatch').forEach((s) => {
        s.classList.toggle('active', s.getAttribute('data-color') === color);
      });
    }

    setSize(size: number): void {
      this.currentSize = size;
      this.toolbar.querySelectorAll('.size-btn').forEach((b) => {
        b.classList.toggle('active', Number(b.getAttribute('data-size')) === size);
      });
    }

    handlePointerDown(e: PointerEvent): void {
      if (e.button !== 0) return; // Only left click

      const scroll = this.getScroll();
      const docX = e.clientX + scroll.x;
      const docY = e.clientY + scroll.y;

      this.isDrawing = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.startX = docX;
      this.startY = docY;
      this.currentPoints = [{ x: docX, y: docY }];

      if (this.currentTool === 'eraser') {
        this.eraseAt(docX, docY);
      } else if (this.currentTool === 'pen') {
        // Draw starting dot immediately
        this.ctx.save();
        this.ctx.translate(-scroll.x, -scroll.y);
        this.ctx.fillStyle = this.currentColor;
        this.ctx.beginPath();
        this.ctx.arc(docX, docY, this.currentSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    handlePointerMove(e: PointerEvent): void {
      if (!this.isDrawing) return;

      const scroll = this.getScroll();
      const docX = e.clientX + scroll.x;
      const docY = e.clientY + scroll.y;

      if (this.currentTool === 'eraser') {
        this.eraseAt(docX, docY);
        return;
      }

      if (this.currentTool === 'pen') {
        const prev = this.currentPoints[this.currentPoints.length - 1];
        this.currentPoints.push({ x: docX, y: docY });

        // Incremental draw: O(1) rendering without touching history
        if (prev) {
          this.ctx.save();
          this.ctx.translate(-scroll.x, -scroll.y);
          this.ctx.strokeStyle = this.currentColor;
          this.ctx.fillStyle = this.currentColor;
          this.ctx.lineWidth = this.currentSize;
          this.ctx.lineCap = 'round';
          this.ctx.lineJoin = 'round';
          this.ctx.beginPath();
          this.ctx.moveTo(prev.x, prev.y);
          this.ctx.lineTo(docX, docY);
          this.ctx.stroke();
          this.ctx.restore();
        }
      } else {
        // Shapes and highlighter live preview throttled by RAF
        this.currentPoints.push({ x: docX, y: docY });

        if (this.rafDrawId !== null) return;
        this.rafDrawId = requestAnimationFrame(() => {
          this.rafDrawId = null;
          if (!this.isDrawing) return;

          this.redraw();
          const freshScroll = this.getScroll();
          const lastPt = this.currentPoints[this.currentPoints.length - 1];
          this.ctx.save();
          this.ctx.translate(-freshScroll.x, -freshScroll.y);

          if (this.currentTool === 'highlighter') {
            this.renderStroke({
              tool: 'highlighter',
              color: this.currentColor,
              size: this.currentSize,
              opacity: 0.35,
              points: this.currentPoints,
            });
          } else if (lastPt) {
            this.renderStroke({
              tool: this.currentTool,
              color: this.currentColor,
              size: this.currentSize,
              opacity: 1,
              x: this.startX,
              y: this.startY,
              endX: lastPt.x,
              endY: lastPt.y,
            });
          }
          this.ctx.restore();
        });
      }
    }

    handlePointerUp(e: PointerEvent): void {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.rafDrawId !== null) {
        cancelAnimationFrame(this.rafDrawId);
        this.rafDrawId = null;
      }

      const scroll = this.getScroll();
      const docX = e.clientX + scroll.x;
      const docY = e.clientY + scroll.y;

      if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
        if (this.currentPoints.length > 0) {
          const stroke: DrawStroke = {
            tool: this.currentTool,
            color: this.currentColor,
            size: this.currentSize,
            opacity: this.currentTool === 'highlighter' ? 0.35 : 1,
            points: [...this.currentPoints],
          };
          this.history.push(stroke);
          this.redoList = [];
        }
      } else if (['rect', 'circle', 'line', 'arrow'].includes(this.currentTool)) {
        const stroke: DrawStroke = {
          tool: this.currentTool,
          color: this.currentColor,
          size: this.currentSize,
          opacity: 1,
          x: this.startX,
          y: this.startY,
          endX: docX,
          endY: docY,
        };
        this.history.push(stroke);
        this.redoList = [];
      }

      this.currentPoints = [];
      this.updateHistoryButtons();
      this.redraw();
    }

    eraseAt(x: number, y: number): void {
      const radius = Math.max(16, this.currentSize * 3);
      const initialLength = this.history.length;

      this.history = this.history.filter((stroke) => {
        if (stroke.points) {
          return !stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) <= radius);
        }
        if (stroke.x !== undefined && stroke.y !== undefined) {
          if (stroke.endX !== undefined && stroke.endY !== undefined) {
            const minX = Math.min(stroke.x, stroke.endX) - radius;
            const maxX = Math.max(stroke.x, stroke.endX) + radius;
            const minY = Math.min(stroke.y, stroke.endY) - radius;
            const maxY = Math.max(stroke.y, stroke.endY) + radius;
            return !(x >= minX && x <= maxX && y >= minY && y <= maxY);
          }
          return Math.hypot(stroke.x - x, stroke.y - y) > radius;
        }
        return true;
      });

      if (this.history.length !== initialLength) {
        this.redoList = [];
        this.updateHistoryButtons();
        this.redraw();
      }
    }

    redraw(): void {
      if (!this.ctx) return;
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
      const scroll = this.getScroll();
      this.ctx.save();
      this.ctx.translate(-scroll.x, -scroll.y);
      this.history.forEach((stroke) => this.renderStroke(stroke));
      this.ctx.restore();
    }

    renderStroke(stroke: DrawStroke): void {
      if (!this.ctx) return;
      const { tool, color, size, opacity } = stroke;

      this.ctx.save();
      try {
        this.ctx.globalAlpha = opacity;
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if ((tool === 'pen' || tool === 'highlighter') && stroke.points && stroke.points.length > 0) {
          const pts = stroke.points;
          if (pts.length === 1) {
            this.ctx.beginPath();
            this.ctx.arc(pts[0].x, pts[0].y, size / 2, 0, Math.PI * 2);
            this.ctx.fill();
          } else {
            this.ctx.beginPath();
            this.ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              this.ctx.lineTo(pts[i].x, pts[i].y);
            }
            this.ctx.stroke();
          }
        } else if (tool === 'line' && stroke.x !== undefined && stroke.y !== undefined && stroke.endX !== undefined && stroke.endY !== undefined) {
          this.ctx.beginPath();
          this.ctx.moveTo(stroke.x, stroke.y);
          this.ctx.lineTo(stroke.endX, stroke.endY);
          this.ctx.stroke();
        } else if (tool === 'arrow' && stroke.x !== undefined && stroke.y !== undefined && stroke.endX !== undefined && stroke.endY !== undefined) {
          const dx = stroke.endX - stroke.x;
          const dy = stroke.endY - stroke.y;
          const len = Math.hypot(dx, dy);

          if (len > 5) {
            const angle = Math.atan2(dy, dx);
            const headLen = Math.max(12, size * 3.5);
            const headAngle = Math.PI / 6;

            const shaftEndX = stroke.endX - headLen * 0.7 * Math.cos(angle);
            const shaftEndY = stroke.endY - headLen * 0.7 * Math.sin(angle);

            this.ctx.beginPath();
            this.ctx.moveTo(stroke.x, stroke.y);
            this.ctx.lineTo(shaftEndX, shaftEndY);
            this.ctx.stroke();

            // Draw crisp arrowhead
            const p1x = stroke.endX - headLen * Math.cos(angle - headAngle);
            const p1y = stroke.endY - headLen * Math.sin(angle - headAngle);
            const p2x = stroke.endX - headLen * Math.cos(angle + headAngle);
            const p2y = stroke.endY - headLen * Math.sin(angle + headAngle);

            this.ctx.beginPath();
            this.ctx.moveTo(stroke.endX, stroke.endY);
            this.ctx.lineTo(p1x, p1y);
            this.ctx.lineTo(p2x, p2y);
            this.ctx.closePath();
            this.ctx.fill();
          }
        } else if (tool === 'rect' && stroke.x !== undefined && stroke.y !== undefined && stroke.endX !== undefined && stroke.endY !== undefined) {
          const rx = Math.min(stroke.x, stroke.endX);
          const ry = Math.min(stroke.y, stroke.endY);
          const rw = Math.abs(stroke.endX - stroke.x);
          const rh = Math.abs(stroke.endY - stroke.y);
          this.ctx.strokeRect(rx, ry, rw, rh);
        } else if (tool === 'circle' && stroke.x !== undefined && stroke.y !== undefined && stroke.endX !== undefined && stroke.endY !== undefined) {
          const rx = Math.abs(stroke.endX - stroke.x) / 2;
          const ry = Math.abs(stroke.endY - stroke.y) / 2;
          const cx = Math.min(stroke.x, stroke.endX) + rx;
          const cy = Math.min(stroke.y, stroke.endY) + ry;

          this.ctx.beginPath();
          this.ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      } finally {
        this.ctx.restore();
      }
    }

    undo(): void {
      if (this.history.length === 0) return;
      const popped = this.history.pop();
      if (popped) {
        this.redoList.push(popped);
        this.updateHistoryButtons();
        this.redraw();
      }
    }

    redo(): void {
      if (this.redoList.length === 0) return;
      const popped = this.redoList.pop();
      if (popped) {
        this.history.push(popped);
        this.updateHistoryButtons();
        this.redraw();
      }
    }

    clearAll(): void {
      if (this.history.length === 0) return;
      this.history = [];
      this.redoList = [];
      this.updateHistoryButtons();
      this.redraw();
    }

    updateHistoryButtons(): void {
      const btnUndo = this.shadow.getElementById('btnUndo') as HTMLButtonElement | null;
      const btnRedo = this.shadow.getElementById('btnRedo') as HTMLButtonElement | null;
      if (btnUndo) btnUndo.disabled = this.history.length === 0;
      if (btnRedo) btnRedo.disabled = this.redoList.length === 0;
    }

    saveImage(): void {
      if (this.history.length === 0) {
        return;
      }

      try {
        const link = document.createElement('a');
        link.download = `web-annotation-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('[PageDraw] Save error:', err);
      }
    }

    handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        this.destroy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'p') this.setTool('pen');
        else if (key === 'h') this.setTool('highlighter');
        else if (key === 'l') this.setTool('line');
        else if (key === 'a') this.setTool('arrow');
        else if (key === 'r') this.setTool('rect');
        else if (key === 'c') this.setTool('circle');
        else if (key === 'e') this.setTool('eraser');
      }
    }

    destroy(): void {
      if (this.rafDrawId !== null) {
        cancelAnimationFrame(this.rafDrawId);
        this.rafDrawId = null;
      }
      if (this.rafScrollId !== null) {
        cancelAnimationFrame(this.rafScrollId);
        this.rafScrollId = null;
      }
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('scroll', this._onScroll);
      document.removeEventListener('scroll', this._onScroll, true);
      window.removeEventListener('wheel', this._onWheel, { capture: true } as any);

      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }

      const win = window as unknown as { __SCROLLHIDE_PAGE_DRAW__?: PageDraw | null };
      win.__SCROLLHIDE_PAGE_DRAW__ = null;
    }
  }

  win.__SCROLLHIDE_PAGE_DRAW__ = new PageDraw();
})();
