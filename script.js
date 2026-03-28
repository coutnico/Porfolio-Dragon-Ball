(() => {
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  class Sidebar {
    constructor() {
      this.sidebar = $("#dbzSidebar");
      this.toggle = $("#sidebarToggle");
      this.closeBtn = $("#sidebarClose");
      this.overlay = $("#sidebarOverlay");
      this.navLinks = $$(".nav-link");
      this.desktopQuery = window.matchMedia("(min-width: 1181px)");

      this.enabled = !!(this.sidebar && this.toggle && this.closeBtn && this.overlay);
      if (!this.enabled) return;

      this.bind();
      this.syncWithViewport();
      this.desktopQuery.addEventListener("change", () => this.syncWithViewport());
    }

    bind() {
      this.toggle.addEventListener("click", () => {
        if (this.desktopQuery.matches) return;
        this.isOpen() ? this.close() : this.open();
      });

      this.closeBtn.addEventListener("click", () => this.close());
      this.overlay.addEventListener("click", () => this.close());

      this.navLinks.forEach((link) => {
        link.addEventListener("click", () => {
          if (!this.desktopQuery.matches) this.close();
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.isOpen()) this.close();
      });
    }

    isOpen() {
      return this.sidebar.classList.contains("open");
    }

    open() {
      this.sidebar.classList.add("open");
      this.toggle.setAttribute("aria-expanded", "true");
      this.overlay.hidden = false;
      requestAnimationFrame(() => this.overlay.classList.add("show"));
    }

    close() {
      this.sidebar.classList.remove("open");
      this.toggle.setAttribute("aria-expanded", "false");
      this.overlay.classList.remove("show");
      window.setTimeout(() => {
        if (!this.isOpen()) this.overlay.hidden = true;
      }, 220);
    }

    syncWithViewport() {
      if (!this.desktopQuery.matches) return;
      this.sidebar.classList.remove("open");
      this.overlay.hidden = true;
      this.overlay.classList.remove("show");
      this.toggle.setAttribute("aria-expanded", "false");
    }
  }

  class SectionObserver {
    constructor() {
      this.sections = $$("main section[id]");
      this.navLinks = $$(".nav-link");
      this.revealNodes = $$("[data-reveal]");
      this.prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    init() {
      this.initReveal();
      this.initNavigationState();
    }

    initReveal() {
      if (this.prefersReduced) {
        this.revealNodes.forEach((node) => node.classList.add("is-visible"));
        return;
      }

      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
      );

      this.revealNodes.forEach((node) => revealObserver.observe(node));
    }

    initNavigationState() {
      if (!this.sections.length || !this.navLinks.length) return;

      const setActive = (id) => {
        this.navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
        });
      };

      const sectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (visible?.target?.id) setActive(visible.target.id);
        },
        { threshold: [0.2, 0.4, 0.65], rootMargin: "-18% 0px -45% 0px" }
      );

      this.sections.forEach((section) => sectionObserver.observe(section));
    }
  }

  class CursorTrail {
    constructor(canvas) {
      this.canvas = canvas;
      this.enabled = !!this.canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!this.enabled) return;

      this.ctx = this.canvas.getContext("2d");
      this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      this.mouseMoved = false;
      this.params = {
        pointsNumber: 28,
        widthFactor: 0.2,
        spring: 0.35,
        friction: 0.52,
      };
      this.trail = Array.from({ length: this.params.pointsNumber }, () => ({
        x: this.pointer.x,
        y: this.pointer.y,
        dx: 0,
        dy: 0,
      }));

      this.resize = this.resize.bind(this);
      this.render = this.render.bind(this);
    }

    init() {
      if (!this.enabled) return;

      this.resize();
      window.addEventListener("resize", this.resize);

      const move = (x, y) => {
        this.mouseMoved = true;
        this.pointer.x = x;
        this.pointer.y = y;
      };

      window.addEventListener("mousemove", (event) => move(event.clientX, event.clientY), { passive: true });
      window.addEventListener(
        "touchmove",
        (event) => {
          const touch = event.targetTouches[0];
          if (touch) move(touch.clientX, touch.clientY);
        },
        { passive: true }
      );

      requestAnimationFrame(this.render);
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    render(time) {
      if (!this.enabled) return;

      if (!this.mouseMoved) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.pointer.x = (0.48 + 0.1 * Math.cos(time * 0.0012)) * width;
        this.pointer.y = (0.28 + 0.08 * Math.sin(time * 0.0016)) * height;
      }

      const { ctx } = this;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.trail.forEach((point, index) => {
        const previous = index === 0 ? this.pointer : this.trail[index - 1];
        const spring = index === 0 ? this.params.spring * 0.46 : this.params.spring;

        point.dx += (previous.x - point.x) * spring;
        point.dy += (previous.y - point.y) * spring;
        point.dx *= this.params.friction;
        point.dy *= this.params.friction;
        point.x += point.dx;
        point.y += point.dy;
      });

      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);

      for (let index = 1; index < this.trail.length - 1; index++) {
        const xc = 0.5 * (this.trail[index].x + this.trail[index + 1].x);
        const yc = 0.5 * (this.trail[index].y + this.trail[index + 1].y);
        ctx.quadraticCurveTo(this.trail[index].x, this.trail[index].y, xc, yc);
      }

      const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
      gradient.addColorStop(0, "rgba(255, 184, 77, 0.18)");
      gradient.addColorStop(0.5, "rgba(106, 217, 210, 0.24)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.06)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.params.widthFactor * this.params.pointsNumber;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      requestAnimationFrame(this.render);
    }
  }

  class Starfield {
    constructor(canvas) {
      this.canvas = canvas;
      this.enabled = !!this.canvas;
      if (!this.enabled) return;

      this.ctx = this.canvas.getContext("2d");
      this.stars = [];
      this.resize = this.resize.bind(this);
      this.tick = this.tick.bind(this);
    }

    init() {
      if (!this.enabled) return;
      this.resize();
      window.addEventListener("resize", this.resize);
      requestAnimationFrame(this.tick);
    }

    resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = window.innerWidth * ratio;
      this.canvas.height = window.innerHeight * ratio;
      this.canvas.style.width = `${window.innerWidth}px`;
      this.canvas.style.height = `${window.innerHeight}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.min(Math.floor(window.innerWidth * 0.72), 1100);
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 1.15,
        alpha: Math.random() * 0.65 + 0.15,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
      }));
    }

    tick() {
      if (!this.enabled) return;
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      this.stars.forEach((star) => {
        star.x += star.vx;
        star.y += star.vy;

        if (star.x < 0) star.x = window.innerWidth;
        if (star.x > window.innerWidth) star.x = 0;
        if (star.y < 0) star.y = window.innerHeight;
        if (star.y > window.innerHeight) star.y = 0;

        this.ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        this.ctx.fill();
      });

      requestAnimationFrame(this.tick);
    }
  }

  function initAudio() {
    const audio = $("#dragonBallAudio");
    if (!audio) return;
    audio.volume = 0.12;
  }

  const boot = () => {
    new Sidebar();
    new SectionObserver().init();
    new CursorTrail($("#vuelo")).init();
    new Starfield($("#galaxy")).init();
    initAudio();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
