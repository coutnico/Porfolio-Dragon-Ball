/* =========================================================================
   DBZ Portfolio – JS Refactor
   =========================================================================
   - A prueba de nulos (canvases / audio / sidebar).
   - Módulos independientes: Lightning, CursorTrail, Sidebar.
   - Sin variables globales sueltas; todo bajo DOMContentLoaded.
   - Logs útiles en consola para diagnosticar.
========================================================================== */

(() => {
  // Utilidad mínima
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  // -----------------------------------------------------------------------
  // 1) LIGHTNING (rayos) — usa <canvas id="canvas"> si existe
  // -----------------------------------------------------------------------
  class Lightning {
    constructor(canvas) {
      this.c = canvas;
      this.enabled = !!this.c;
      if (!this.enabled) {
        console.warn('[Lightning] Canvas #canvas no encontrado. Módulo desactivado.');
        return;
      }
      this.ctx = this.c.getContext('2d');
      this.cw = (this.c.width = window.innerWidth);
      this.ch = (this.c.height = window.innerHeight);

      this.now = performance.now();
      this.then = this.now;
      this.delta = 0;

      this.lightning = [];
      this.lightTimeCurrent = 10;
      this.lightTimeTotal = 50;

      this._rand = (min, max) => (Math.random() * (max - min + 1) + min) | 0;
      this._onResize = this._onResize.bind(this);
      this._loop = this._loop.bind(this);

      // Resize (debounced)
      let resizeTimer = null;
      on(window, 'resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(this._onResize, 100);
      });
    }

    init() {
      if (!this.enabled) return;
      requestAnimationFrame(this._loop);
    }

    _onResize() {
      if (!this.enabled) return;
      this.cw = this.c.width = window.innerWidth;
      this.ch = this.c.height = window.innerHeight;
    }

    _create(x, y, canSpawn) {
      this.lightning.push({
        x, y,
        xRange: this._rand(5, 30),
        yRange: this._rand(5, 25),
        path: [{ x, y }],
        pathLimit: this._rand(10, 35),
        canSpawn,
        hasFired: false,
        grower: 0,
        growerLimit: 5
      });
    }

    _update() {
      for (let i = this.lightning.length - 1; i >= 0; i--) {
        const L = this.lightning[i];
        L.grower += this.delta;

        if (L.grower >= L.growerLimit) {
          L.grower = 0;
          L.growerLimit *= 1.05;

          const last = L.path[L.path.length - 1];
          L.path.push({
            x: last.x + (this._rand(0, L.xRange) - L.xRange / 2),
            y: last.y + this._rand(0, L.yRange)
          });

          if (L.path.length > L.pathLimit) {
            this.lightning.splice(i, 1);
          }
          L.hasFired = true;
        }
      }
    }

    _render() {
      for (let i = this.lightning.length - 1; i >= 0; i--) {
        const L = this.lightning[i];
        this.ctx.strokeStyle = `hsla(0, 100%, 100%, ${this._rand(10, 100) / 100})`;

        // grosor aleatorio esporádico
        const r = this._rand(0, 90);
        this.ctx.lineWidth = r === 0 ? 4 : r < 30 ? 2 : r < 60 ? 3 : 1;

        this.ctx.beginPath();
        this.ctx.moveTo(L.x, L.y);
        for (let p = 0; p < L.path.length; p++) {
          const node = L.path[p];
          this.ctx.lineTo(node.x, node.y);

          if (L.canSpawn && this._rand(0, 100) === 0) {
            L.canSpawn = false;
            this._create(node.x, node.y, false);
          }
        }

        if (!L.hasFired || this._rand(0, 60) === 0) {
          // “flash” suave
          this.ctx.fillStyle = `rgba(255,255,255, ${this._rand(1, 3) / 100})`;
          this.ctx.fillRect(0, 0, this.cw, this.ch);
        }

        this.ctx.stroke();
      }
    }

    _timer() {
      this.lightTimeCurrent += this.delta;
      if (this.lightTimeCurrent >= this.lightTimeTotal) {
        const newX = this._rand(100, this.cw - 100);
        const newY = this._rand(0, this.ch / 2);
        let count = this._rand(1, 3);
        while (count--) this._create(newX, newY, true);
        this.lightTimeCurrent = 0;
        this.lightTimeTotal = this._rand(200, 1500);
      }
    }

    _fade() {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.fillStyle = `rgba(0,0,0, ${this._rand(1, 30) / 100})`;
      this.ctx.fillRect(0, 0, this.cw, this.ch);
      this.ctx.globalCompositeOperation = 'source-over';
    }

    _loop(tNow) {
      if (!this.enabled) return;
      this.now = tNow || performance.now();
      this.delta = this.now - this.then;
      this.then = this.now;

      this._fade();
      this._update();
      this._timer();
      this._render();

      requestAnimationFrame(this._loop);
    }
  }

  // -----------------------------------------------------------------------
  // 2) CURSOR TRAIL (vuelo) — usa <canvas id="vuelo">
  // -----------------------------------------------------------------------
  class CursorTrail {
    constructor(canvas) {
      this.canvas = canvas;
      this.enabled = !!this.canvas;
      if (!this.enabled) {
        console.warn('[CursorTrail] Canvas #vuelo no encontrado. Módulo desactivado.');
        return;
      }
      this.ctx = this.canvas.getContext('2d');

      this.mouseMoved = false;
      this.pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
      this.params = {
        pointsNumber: 40,
        widthFactor: 0.3,
        mouseThreshold: 0.6,
        spring: 0.4,
        friction: 0.5
      };
      this.trail = Array.from({ length: this.params.pointsNumber }, () => ({
        x: this.pointer.x, y: this.pointer.y, dx: 0, dy: 0
      }));

      this._onResize = this._onResize.bind(this);
      this._loop = this._loop.bind(this);

      on(window, 'resize', this._onResize);

      const move = (x, y) => {
        this.mouseMoved = true;
        this.pointer.x = x;
        this.pointer.y = y;
      };

      on(window, 'click', (e) => move(e.pageX, e.pageY));
      on(window, 'mousemove', (e) => move(e.pageX + 18, e.pageY + 20));
      on(window, 'touchmove', (e) => move(e.targetTouches[0].pageX, e.targetTouches[0].pageY), { passive: true });

      this._setup();
    }

    _setup() {
      if (!this.enabled) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    _onResize() { this._setup(); }

    init() {
      if (!this.enabled) return;
      requestAnimationFrame(this._loop);
    }

    _loop(t) {
      if (!this.enabled) return;

      // Animación de intro si no moviste el mouse
      if (!this.mouseMoved) {
        const w = window.innerWidth, h = window.innerHeight;
        this.pointer.x = (0.5 + 0.3 * Math.cos(0.002 * t) * Math.sin(0.005 * t)) * w;
        this.pointer.y = (0.5 + 0.2 * Math.cos(0.005 * t) + 0.1 * Math.cos(0.01 * t)) * h;
      }

      const { ctx } = this;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.trail.forEach((p, i) => {
        const prev = i === 0 ? this.pointer : this.trail[i - 1];
        const spring = i === 0 ? 0.4 * this.params.spring : this.params.spring;
        p.dx += (prev.x - p.x) * spring;
        p.dy += (prev.y - p.y) * spring;
        p.dx *= this.params.friction;
        p.dy *= this.params.friction;
        p.x += p.dx;
        p.y += p.dy;
      });

      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);

      for (let i = 1; i < this.trail.length - 1; i++) {
        const xc = 0.5 * (this.trail[i].x + this.trail[i + 1].x);
        const yc = 0.5 * (this.trail[i].y + this.trail[i + 1].y);
        ctx.quadraticCurveTo(this.trail[i].x, this.trail[i].y, xc, yc);
        ctx.lineWidth = this.params.widthFactor * (this.params.pointsNumber - i);
        ctx.strokeStyle = '#E7E5E8';
        ctx.stroke();
      }
      ctx.lineTo(this.trail[this.trail.length - 1].x, this.trail[this.trail.length - 1].y);
      ctx.stroke();

      requestAnimationFrame(this._loop);
    }
  }

  // -----------------------------------------------------------------------
  // 3) SIDEBAR (izquierda → despliega a la derecha)
  // -----------------------------------------------------------------------
  class Sidebar {
    constructor({ sidebarSel, toggleSel, closeSel, overlaySel }) {
      this.sidebar = $(sidebarSel);
      this.toggle = $(toggleSel);
      this.closeBtn = $(closeSel);
      this.overlay = $(overlaySel);

      this.enabled = !!(this.sidebar && this.toggle && this.closeBtn && this.overlay);
      if (!this.enabled) {
        console.warn('[Sidebar] Faltan nodos:', {
          sidebar: !!this.sidebar, toggle: !!this.toggle, close: !!this.closeBtn, overlay: !!this.overlay
        });
        return;
      }

      this._bind();
      this._reset();
    }

    _bind() {
      on(this.toggle, 'click', (e) => {
        e.preventDefault();
        this.isOpen() ? this.close() : this.open();
      });

      on(this.closeBtn, 'click', () => this.close());
      on(this.overlay, 'click', () => this.close());

      on(document, 'keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
      });

      // Focus trap
      on(this.sidebar, 'keydown', (e) => {
        if (e.key !== 'Tab') return;
        const selector = 'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
        const focusables = [...this.sidebar.querySelectorAll(selector)]
          .filter(el => !el.disabled && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }

    _reset() {
      this.sidebar.classList.remove('open');
      this.sidebar.setAttribute('aria-hidden', 'true');
      this.toggle.setAttribute('aria-expanded', 'false');
      this.overlay.classList.remove('show');
      this.overlay.hidden = true;
      this.toggle.textContent = '☰';
    }

    isOpen() { return this.sidebar.classList.contains('open'); }

    open() {
      this._lastFocused = document.activeElement;
      this.sidebar.classList.add('open');
      this.sidebar.setAttribute('aria-hidden', 'false');
      this.toggle.setAttribute('aria-expanded', 'true');
      this.overlay.hidden = false;
      // Forzar reflow antes de animar overlay
      void this.overlay.offsetHeight;
      this.overlay.classList.add('show');
      const first = this.sidebar.querySelector('a, button');
      first && first.focus();
      this.toggle.textContent = '✕';
      // document.body.style.overflow = 'hidden'; // opcional
    }

    close() {
      this.sidebar.classList.remove('open');
      this.sidebar.setAttribute('aria-hidden', 'true');
      this.toggle.setAttribute('aria-expanded', 'false');
      this.overlay.classList.remove('show');
      setTimeout(() => { this.overlay.hidden = true; }, 250);
      this._lastFocused && this._lastFocused.focus();
      this.toggle.textContent = '☰';
      // document.body.style.overflow = ''; // opcional
    }
  }
  // -----------------------------------------------------------------------
  // 4) MODALS (gestiona <dialog> con fallback para mobile)
  // -----------------------------------------------------------------------
  class ModalManager {
    constructor({ selectorBtn = '[command][commandfor]', selectorDlg = 'dialog' } = {}) {
      this.supportsDialog = typeof HTMLDialogElement === 'function' &&
                            'showModal' in HTMLDialogElement.prototype;

      this.selectorBtn = selectorBtn;
      this.selectorDlg = selectorDlg;

      this.overlay = null;       // overlay fallback
      this.openDialogRef = null; // dialog actualmente abierto (1 a la vez)
      this.lastFocused = null;

      this.enabled = true;
      this._bind();
    }

    _bind() {
      // Abrir con [command="show-modal"] y [commandfor="idDelDialog"]
      document.addEventListener('click', (e) => {
        const btn = e.target.closest(this.selectorBtn);
        if (!btn) return;

        const cmd = (btn.getAttribute('command') || '').toLowerCase();
        if (cmd !== 'show-modal') return;
        const targetId = btn.getAttribute('commandfor');
        const dialog = document.getElementById(targetId);
        if (!dialog || dialog.nodeName.toLowerCase() !== 'dialog') {
          console.warn('[ModalManager] No se encontró <dialog> con id:', targetId);
          return;
        }
        this.open(dialog);
      });

      // Cierre por botones internos con [data-close]
      document.addEventListener('click', (e) => {
        const closer = e.target.closest('[data-close]');
        if (!closer) return;
        const dlg = closer.closest('dialog');
        if (dlg && dlg === this.openDialogRef) this.close(dlg);
      });

      // Cierre por ESC (nativo y fallback)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.openDialogRef) this.close(this.openDialogRef);
      });

      // Click “afuera” para cerrar (respeta closedby="any")
      document.querySelectorAll(this.selectorDlg).forEach((dlg) => {
        dlg.addEventListener('mousedown', (e) => {
          if (!this._canCloseByOutside(dlg)) return;
          const r = dlg.getBoundingClientRect();
          const outside =
            e.clientX < r.left || e.clientX > r.right ||
            e.clientY < r.top  || e.clientY > r.bottom;
          if (outside) this.close(dlg);
        });
      });
    }

    _canCloseByOutside(dlg) {
      // Usa tu atributo `closedby="any"` para permitir click afuera
      const attr = (dlg.getAttribute('closedby') || '').toLowerCase();
      return attr === 'any' || attr === 'outside' || attr === 'true';
    }

    open(dialog) {
      if (this.openDialogRef) this.close(this.openDialogRef);

      this.lastFocused = document.activeElement;
      this.openDialogRef = dialog;

      if (this.supportsDialog) {
        dialog.showModal();
        this._trapFocus(dialog);
        return;
      }

      // Fallback sin CSS adicional (overlay inline)
      this._createOverlay();
      dialog.setAttribute('open', '');
      dialog.style.position = 'fixed';
      dialog.style.inset = '50% auto auto 50%';
      dialog.style.transform = 'translate(-50%, -50%)';
      dialog.style.zIndex = '1001';

      this._lockScroll(true);
      this._trapFocus(dialog);
    }

    close(dialog) {
      if (!dialog) return;

      if (this.supportsDialog) {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute('open');
        dialog.style.position = '';
        dialog.style.inset = '';
        dialog.style.transform = '';
        dialog.style.zIndex = '';
        this._removeOverlay();
        this._lockScroll(false);
      }

      this._releaseFocus();
      if (this.lastFocused) { try { this.lastFocused.focus(); } catch(_){} }
      this.lastFocused = null;
      this.openDialogRef = null;
    }

    _createOverlay() {
      if (this.overlay) return;
      const ov = document.createElement('div');
      ov.setAttribute('data-modal-overlay', '');
      // Estilos inline para no tocar tu CSS
      Object.assign(ov.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(3px)',
        zIndex: '1000'
      });
      ov.addEventListener('click', () => this.openDialogRef && this.close(this.openDialogRef));
      document.body.appendChild(ov);
      this.overlay = ov;
    }

    _removeOverlay() {
      if (!this.overlay) return;
      this.overlay.remove();
      this.overlay = null;
    }

    _lockScroll(locked) {
      if (locked) {
        this._scrollTop = window.scrollY || document.documentElement.scrollTop;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._scrollTop}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        return;
      }
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, this._scrollTop || 0);
    }

    _trapFocus(dialog) {
      // Focus inicial
      const firstFocusable = dialog.querySelector('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
      (firstFocusable || dialog).focus({ preventScroll: true });

      // Ciclo de tabulación
      const selector = 'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
      const enforce = (e) => {
        if (e.key !== 'Tab') return;
        const list = [...dialog.querySelectorAll(selector)].filter(el => !el.disabled && el.offsetParent !== null);
        if (!list.length) { e.preventDefault(); return; }
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      dialog.addEventListener('keydown', enforce);
      dialog._trapHandler = enforce;
    }

    _releaseFocus() {
      const dlg = this.openDialogRef;
      if (!dlg || !dlg._trapHandler) return;
      dlg.removeEventListener('keydown', dlg._trapHandler);
      delete dlg._trapHandler;
    }
  }

  // -----------------------------------------------------------------------
  // 5) AUDIO volumen (si existe)
  // -----------------------------------------------------------------------
  function initAudio() {
    const audio = $('#dragonBallAudio');
    if (!audio) {
      console.info('[Audio] #dragonBallAudio no encontrado. Saltando ajuste de volumen.');
      return;
    }
    try { audio.volume = 0.03; } catch { /* noop */ }
  }
  // -----------------------------------------------------------------------
  // 6) Fondo Estrellado
  // -----------------------------------------------------------------------
  class Estrellado {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = this.canvas.getContext("2d");

      // Propiedades iniciales
      this.stars = [];
      this.FPS = 60;
      this.numStars = window.innerWidth;

      // Ajusta el tamaño del canvas
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    // Inicialización del cielo estrellado
    init() {
      this.createStars();
      this.tick(); // Comienza la animación
    }

    // Crea las estrellas iniciales
    createStars() {
      this.stars = [];

      for (let i = 0; i < this.numStars; i++) {
        this.stars.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          radius: Math.random() * 1.2, // estrellas más suaves
          vx: Math.floor(Math.random() * 10) - 5,
          vy: Math.floor(Math.random() * 10) - 5
        });
      }
    }

    // Dibuja todas las estrellas
    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalCompositeOperation = "lighter";

      for (let s of this.stars) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Actualiza posiciones
    update() {
      for (let s of this.stars) {
        s.x += s.vx / this.FPS;
        s.y += s.vy / this.FPS;

        // Rebote en bordes
        if (s.x < 0 || s.x > this.canvas.width) s.vx *= -1;
        if (s.y < 0 || s.y > this.canvas.height) s.vy *= -1;
      }
    }

    // Ciclo principal de animación
    tick() {
      this.draw();
      this.update();
      requestAnimationFrame(() => this.tick());
    }

    // Ajuste dinámico del tamaño del canvas
    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }
  // -----------------------------------------------------------------------
  // 7) BOOTSTRAP
  // -----------------------------------------------------------------------
  const boot = () => {
    console.clear();
    console.log('[DBZ] Bootstrap…');

    const canvas = document.getElementById("galaxy");
    const estrellas = new Estrellado(canvas);
    estrellas.init();

    // Inicializa rayos si existe #canvas
    const lightning = new Lightning($('#canvas'));
    lightning.init();

    // Inicializa estela en #vuelo
    const trail = new CursorTrail($('#vuelo'));
    trail.init();

    // Sidebar (IDs deben existir en tu HTML)
    const sidebar = new Sidebar({
      sidebarSel: '#dbzSidebar',
      toggleSel: '#sidebarToggle',
      closeSel: '#sidebarClose',
      overlaySel: '#sidebarOverlay'
    });

    const modals = new ModalManager();

    initAudio();

    console.log('[DBZ] Listo ✓');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
