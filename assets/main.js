/* ==========================================================================
   THE KINGDOM (הממלכה) — MAIN JAVASCRIPT
   Static site · GSAP 3 + ScrollTrigger · Lenis · Canvas particles
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   0. PROGRESSIVE ENHANCEMENT — swap .no-js → .js immediately
   -------------------------------------------------------------------------- */
document.documentElement.classList.replace('no-js', 'js');

/* --------------------------------------------------------------------------
   1. CONSTANTS & FEATURE DETECTION
   -------------------------------------------------------------------------- */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = window.innerWidth < 768;
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const COLORS = {
  ink: '#0D0C0A',
  parchment: '#F2EBDD',
  gold: '#C9A24A',
  goldLight: '#E8CF8A',
  oxblood: '#6B1E1E',
};
/* Entry donation notice — set to false to switch it off without touching
   anything else. To remove it for good, delete the three blocks marked
   "NOTICE" in index.html, assets/style.css and assets/main.js. */
const NOTICE_ENABLED = true;

const GOLD_PALETTE = ['#C9A24A', '#E8CF8A', '#D4AC5C', '#B8922F', '#F0D890'];

/* --------------------------------------------------------------------------
   2. GLOBAL STATE
   -------------------------------------------------------------------------- */
let lenis = null;
let heroParticles = null;

/* --------------------------------------------------------------------------
   3. UTILITY HELPERS
   -------------------------------------------------------------------------- */
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/** Lerp between two hex colors. t ∈ [0,1] */
function lerpColor(a, b, t) {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

/* --------------------------------------------------------------------------
   4. WAIT FOR DOM READY, THEN INIT
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Set footer year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // If libraries didn't load, still show content
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    // CDN failed: fall back to the static no-JS presentation (visible title, quote, words)
    document.documentElement.classList.replace('js', 'no-js');
    document.getElementById('preloader')?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Initialize Lenis if available
  if (typeof Lenis !== 'undefined' && !REDUCED_MOTION) {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: IS_MOBILE ? 1.5 : 2,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Wait for fonts before initializing particle canvas (needs Karantina metrics)
  document.fonts.ready.then(() => {
    if (REDUCED_MOTION) {
      skipPreloader();
      initManifesto();
      initBrothers();
      initMemorial();
      initChapters();
      initActivity();
      initMarquee();
      initDonate();
      initFooter();
      initSignatures();
      initNotice();
    } else {
      runPreloader(() => {
        initHeroParticles();
        initHeroDedication();
        initSpotlight();
        initManifesto();
        initBrothers();
        initMemorial();
        initChapters();
        initActivity();
        initMarquee();
        initDonate();
        initFooter();
        initSignatures();
        initNotice();
      });
    }
  });
});

/* ==========================================================================
   5. PRELOADER — crown SVG draws, curtains split
   ========================================================================== */
function skipPreloader() {
  const el = document.getElementById('preloader');
  if (el) el.remove();
  // Make hero title visible as fallback
  const title = document.querySelector('.hero__title');
  if (title) title.style.opacity = '1';
}

function runPreloader(onComplete) {
  const preloader = document.getElementById('preloader');
  if (!preloader) { onComplete(); return; }

  const lines = preloader.querySelectorAll('.crown-line');
  const curtainL = preloader.querySelector('.preloader__curtain--left');
  const curtainR = preloader.querySelector('.preloader__curtain--right');

  // Prepare SVG stroke-dash for drawing
  lines.forEach(line => {
    const len = line.tagName === 'circle'
      ? 2 * Math.PI * parseFloat(line.getAttribute('r'))
      : line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
  });

  const tl = gsap.timeline({
    onComplete: () => {
      preloader.remove();
      onComplete();
    }
  });

  // 0 → 0.9s — draw crown paths
  tl.to(lines, {
    strokeDashoffset: 0,
    duration: 0.7,
    stagger: 0.08,
    ease: 'power2.inOut',
  });

  // Crown glow + scale
  tl.to(preloader.querySelector('.preloader__crown'), {
    scale: 1.15,
    opacity: 0,
    duration: 0.35,
    ease: 'power2.in',
  }, '-=0.1');

  // Curtains split
  tl.to(curtainL, {
    x: '-100%',
    duration: 0.55,
    ease: 'power3.inOut',
  }, '-=0.35');
  tl.to(curtainR, {
    x: '100%',
    duration: 0.55,
    ease: 'power3.inOut',
  }, '<'); // same start as curtainL
}

/* ==========================================================================
   6. HERO — PARTICLE SYSTEM (Canvas)
   ========================================================================== */
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.mouse = { x: -9999, y: -9999 };
    this.isMobile = window.innerWidth < 768;
    this.maxCount = this.isMobile ? 1800 : 4000;
    this.running = false;
    this.isVisible = true;
    this.lastWidth = window.innerWidth;
    this._resizeCanvas();

    // Pause offscreen
    this.observer = new IntersectionObserver(entries => {
      this.isVisible = entries[0].isIntersecting;
    });
    this.observer.observe(this.canvas);
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
    });
  }

  _resizeCanvas() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.w = w;
    this.h = h;
  }

  _sampleText() {
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const c = off.getContext('2d');
    const fs = this.isMobile ? this.w * 0.3 : this.w * 0.2;
    c.font = `700 ${fs}px Karantina`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText('הממלכה', this.w / 2, this.h / 2);
    const data = c.getImageData(0, 0, this.w, this.h).data;
    const pts = [];
    const gap = 2; // Denser
    let maxY = 0;
    for (let y = 0; y < this.h; y += gap) {
      for (let x = 0; x < this.w; x += gap) {
        if (data[(y * this.w + x) * 4 + 3] > 128) {
          pts.push({ x, y });
          if (y > maxY) maxY = y;
        }
      }
    }
    // Expose word bottom to CSS so dedication/tagline can position below
    this._setWordBottom(maxY);
    return pts;
  }

  _setWordBottom(maxY) {
    const hero = document.getElementById('hero');
    if (!hero) return;
    // maxY is in canvas logical pixels (same as CSS px since we use clientWidth/Height)
    hero.style.setProperty('--word-bottom', maxY + 'px');
  }

  init() {
    this._resizeCanvas();
    const pts = this._sampleText();
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const count = Math.min(this.maxCount, pts.length);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      // Start from center/edges as a swirl
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.w + this.w / 2;
      this.particles.push({
        x: this.w / 2 + Math.cos(angle) * radius,
        y: this.h / 2 + Math.sin(angle) * radius,
        tx: pts[i].x,
        ty: pts[i].y,
        vx: 0,
        vy: 0,
        size: Math.random() * 2.8 + 1.2, // larger
        color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
        baseAlpha: Math.random() * 0.5 + 0.5,
        alphaPhase: Math.random() * Math.PI * 2,
        ease: Math.random() * 0.05 + 0.02, // faster settle
        friction: 0.85,
      });
    }
  }

  _update() {
    const mr = this.isMobile ? 50 : 100;
    const mf = 6;
    for (const p of this.particles) {
      p.vx += (p.tx - p.x) * p.ease;
      p.vy += (p.ty - p.y) * p.ease;
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < mr && d > 0) {
        const f = ((mr - d) / mr) * mf;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      
      // Gentle living shimmer
      p.alphaPhase += 0.05;
      p.alpha = p.baseAlpha * (0.8 + 0.2 * Math.sin(p.alphaPhase));
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  _loop() {
    if (!this.running) return;
    if (this.isVisible) {
      this._update();
      this._draw();
    }
    requestAnimationFrame(() => this._loop());
  }

  start() {
    this.init();
    this.running = true;
    this._loop();
  }

  resize() {
    if (window.innerWidth === this.lastWidth) return; // ignore height-only changes
    this.lastWidth = window.innerWidth;
    this.isMobile = window.innerWidth < 768;
    this.maxCount = this.isMobile ? 1800 : 4000;
    
    this._resizeCanvas();
    const pts = this._sampleText();
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    for (let i = 0; i < this.particles.length; i++) {
      if (pts[i]) {
        this.particles[i].tx = pts[i].x;
        this.particles[i].ty = pts[i].y;
      }
    }
  }

  destroy() {
    this.running = false;
    this.observer.disconnect();
  }
}

function initHeroParticles() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  heroParticles = new ParticleSystem(canvas);
  heroParticles.start();

  // Mouse / touch tracking (relative to canvas)
  const hero = document.getElementById('hero');
  const updateMouse = (ex, ey) => {
    const r = hero.getBoundingClientRect();
    heroParticles.mouse.x = ex - r.left;
    heroParticles.mouse.y = ey - r.top;
  };
  hero.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
  hero.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    updateMouse(t.clientX, t.clientY);
  }, { passive: true });
  hero.addEventListener('mouseleave', () => {
    heroParticles.mouse.x = -9999;
    heroParticles.mouse.y = -9999;
  });
}

/* ==========================================================================
   7. CURSOR SPOTLIGHT (desktop only)
   ========================================================================== */
function initSpotlight() {
  if (IS_MOBILE || IS_TOUCH) return;
  const spot = document.querySelector('.hero__spotlight');
  if (!spot) return;
  const hero = document.getElementById('hero');
  hero.addEventListener('mousemove', (e) => {
    gsap.to(spot, {
      left: e.clientX,
      top: e.clientY,
      duration: 0.35,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  });
}

/* ==========================================================================
   8. MANIFESTO — word-by-word reveal on scroll
   ========================================================================== */
function initManifesto() {
  const el = document.querySelector('.manifesto__text');
  if (!el) return;

  // Read gold keywords from data attribute
  const goldWords = (el.dataset.gold || '').split(',').map(w => w.trim()).filter(Boolean);

  /** Strip trailing/leading punctuation (geresh, maqaf, colon, comma, period, dash, ״) */
  function stripPunct(s) {
    return s.replace(/^[\u05F3\u05F4\u201C\u201D"'«»\-–—:,.؟،؛!?]+|[\u05F3\u05F4\u201C\u201D"'«»\-–—:,.؟،؛!?]+$/gu, '');
  }

  // Split text into word spans
  const rawText = el.textContent;
  el.innerHTML = '';
  rawText.split(/(\s+)/).forEach(token => {
    if (/^\s+$/.test(token)) {
      el.appendChild(document.createTextNode(' '));
      return;
    }
    const span = document.createElement('span');
    span.classList.add('word');
    span.textContent = token;
    // Exact-token match: strip punctuation from both token and keyword
    const stripped = stripPunct(token);
    const isGold = goldWords.some(gw => gw && stripPunct(gw) === stripped);
    if (isGold) {
      span.classList.add('word--gold');
    }
    el.appendChild(span);
  });

  if (REDUCED_MOTION) return; // CSS handles visibility

  const words = el.querySelectorAll('.word');
  gsap.to(words, {
    opacity: 1,
    stagger: 0.05,
    ease: 'none',
    scrollTrigger: {
      trigger: '#manifesto',
      start: 'top 70%',
      end: 'bottom 40%',
      scrub: 1,
    }
  });

  // Draw underlines on gold words via inline style width
  const goldEls = el.querySelectorAll('.word--gold');
  goldEls.forEach(w => {
    gsap.to(w, {
      '--underline-w': '100%',
      scrollTrigger: {
        trigger: w,
        start: 'top 80%',
        end: 'top 50%',
        scrub: 1,
      }
    });
    // Use the CSS custom property for the ::after width
    w.style.setProperty('--underline-w', '0%');
  });
}

/* ==========================================================================
   9. BROTHERS — SVG path convergence on scroll
   ========================================================================== */
function initBrothers() {
  const paths = document.querySelectorAll('.brothers__path');
  if (!paths.length) return;

  // Prepare dash arrays
  paths.forEach(p => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });

  if (REDUCED_MOTION) {
    paths.forEach(p => { p.style.strokeDashoffset = '0'; });
    return;
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#brothers',
      start: 'top 75%',
      end: 'center center',
      scrub: 1,
    }
  });

  const leftPaths = document.querySelectorAll('.brothers__path--left');
  const rightPaths = document.querySelectorAll('.brothers__path--right');
  const crownPaths = document.querySelectorAll('.brothers__path--crown');

  if (leftPaths.length) tl.to(leftPaths, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0);
  if (rightPaths.length) tl.to(rightPaths, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0);
  if (crownPaths.length) tl.to(crownPaths, { strokeDashoffset: 0, duration: 0.6, ease: 'none' }, 1);

  // Fade in bios
  gsap.utils.toArray('.brothers__bio').forEach((bio, i) => {
    gsap.from(bio, {
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: bio,
        start: 'top 85%',
      }
    });
  });

  // Parallax on initials
  gsap.utils.toArray('.brothers__initial').forEach(el => {
    gsap.to(el, {
      y: -60,
      ease: 'none',
      scrollTrigger: {
        trigger: '#brothers',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      }
    });
  });
}

/* ==========================================================================
   10. CHAPTERS — staggered fade-up reveal (editorial grid, no pin)
   ========================================================================== */
function initChapters() {
  const panels = gsap.utils.toArray('.chapter');
  if (!panels.length) return;

  if (REDUCED_MOTION) {
    // Show immediately — CSS opacity:0 already set so we override
    panels.forEach(panel => {
      panel.style.opacity = '1';
      panel.style.transform = 'none';
    });
    return;
  }

  // Staggered fade-up: each chapter triggers individually, fires once
  panels.forEach((panel, i) => {
    gsap.to(panel, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: panel,
        start: 'top 85%',
        once: true,
      },
      delay: i * 0.08, // slight stagger within same viewport
    });
  });
}

/* ==========================================================================
   11. MARQUEE — speed reacts to scroll velocity
   ========================================================================== */
function initMarquee() {
  const track = document.querySelector('.marquee__track');
  if (!track) return;

  if (REDUCED_MOTION) {
    // Static, no animation
    track.style.animation = 'none';
    return;
  }

  // Override CSS animation — we drive it with rAF for velocity modulation
  track.style.animation = 'none';

  let posX = 0;
  const baseSpeed = 1.2;
  const firstText = track.querySelector('.marquee__text');
  if (!firstText) return;

  function marqueeLoop() {
    const scrollVel = lenis ? Math.abs(lenis.velocity) : 0;
    const speed = baseSpeed + scrollVel * 0.08;
    posX -= speed;

    // Seamless reset: when we've scrolled one text-block width, reset
    const blockW = firstText.offsetWidth;
    if (blockW > 0 && Math.abs(posX) >= blockW) {
      posX += blockW;
    }

    track.style.transform = `translateX(${posX}px)`;
    requestAnimationFrame(marqueeLoop);
  }
  requestAnimationFrame(marqueeLoop);
}

/* ==========================================================================
   12. DONATE — magnetic button, copy, burst, redirect
   ========================================================================== */
function initDonate() {
  const section = document.getElementById('donate');
  const btn = document.querySelector('.donate__btn');
  const copyBtn = document.querySelector('.donate__copy');
  if (!section) return;

  // -- Background color transition (ink → oxblood) --
  if (!REDUCED_MOTION) {
    ScrollTrigger.create({
      trigger: '#donate',
      start: 'top 80%',
      end: 'top 20%',
      scrub: true,
      onUpdate: (self) => {
        section.style.backgroundColor = lerpColor(COLORS.ink, COLORS.oxblood, self.progress);
      },
    });
  } else {
    section.style.backgroundColor = COLORS.oxblood;
  }

  // -- Magnetic button (desktop only) --
  if (btn && !IS_MOBILE && !IS_TOUCH && !REDUCED_MOTION) {
    const wrap = btn.closest('.donate__btn-wrap');
    let btnRect = btn.getBoundingClientRect();
    // Refresh rect on scroll
    ScrollTrigger.addEventListener('refresh', () => { btnRect = btn.getBoundingClientRect(); });

    document.addEventListener('mousemove', (e) => {
      // Recalc on every move for accuracy
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 200;

      if (dist < maxDist) {
        const pull = (maxDist - dist) / maxDist;
        gsap.to(btn, {
          x: dx * pull * 0.35,
          y: dy * pull * 0.35,
          duration: 0.4,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      } else {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.3)',
          overwrite: 'auto',
        });
      }
    });
  }

  // -- Main donate button click --
  if (btn) {
    btn.addEventListener('click', () => {
      track('donate_bit_click');
      handleDonate();
    });
  }

  // -- Copy button (copy only, no redirect) --
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      track('donate_copy_number');
      await copyNumber();
      copyBtn.textContent = 'הועתק ✓';
      setTimeout(() => { copyBtn.textContent = 'העתק'; }, 2000);
    });
  }
}

/** Send a Google Analytics event (no-op if analytics is blocked) */
function track(name, params) {
  if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
}

/** Copy the Bit phone number to clipboard */
async function copyNumber() {
  const num = '0533104418';
  try {
    await navigator.clipboard.writeText(num);
  } catch {
    // Fallback for non-HTTPS or older browsers
    const ta = document.createElement('textarea');
    ta.value = num;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch { /* silent */ }
    document.body.removeChild(ta);
  }
}

/** Full donate flow: copy → burst → toast → redirect */
async function handleDonate() {
  await copyNumber();

  // Gold particle burst
  burstParticles();

  // Show toast
  const toast = document.querySelector('.donate__toast');
  if (toast) {
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 3500);
  }

  // Open Bit after short delay
  setTimeout(() => {
    const url = 'https://www.bitpay.co.il/app/';
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, 900);
}

/** Burst gold particles from the donate button center */
function burstParticles() {
  const canvas = document.getElementById('burst-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = 600;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const center = size / 2;
  const parts = [];
  const count = 70;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5);
    const speed = Math.random() * 10 + 4;
    parts.push({
      x: center, y: center,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 6,
      sizeX: Math.random() * 8 + 5,
      sizeY: Math.random() * 6 + 4,
      color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
      alpha: 1,
      gravity: 0.15,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
      flip: 0,
      flipSpeed: (Math.random() - 0.5) * 0.5
    });
  }

  function animateBurst() {
    ctx.clearRect(0, 0, size, size);
    let alive = false;
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.spin;
      p.flip += p.flipSpeed;
      p.alpha -= 0.015;
      if (p.alpha > 0) {
        alive = true;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(Math.cos(p.flip), 1); // 3D flip effect
        ctx.beginPath();
        ctx.ellipse(0, 0, p.sizeX, p.sizeY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(animateBurst);
    else ctx.clearRect(0, 0, size, size);
  }
  requestAnimationFrame(animateBurst);
}

/* ==========================================================================
   13. FOOTER — scroll to top
   ========================================================================== */
function initFooter() {
  const btn = document.querySelector('.footer__top');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (lenis) {
      lenis.scrollTo(0, { duration: 2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}


/* ==========================================================================
   15. SIGNATURES (Cursor, Mobile Bar, Scroll Crown)
   ========================================================================== */
function initSignatures() {
  // Cursor
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const cursor = document.getElementById('custom-cursor');
    if (cursor) {
      let mouse = { x: -100, y: -100 };
      let ring = { x: -100, y: -100 };
      document.body.classList.add('has-custom-cursor');
      
      window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      });
      
      const dot = cursor.querySelector('.cursor__dot');
      const ringEl = cursor.querySelector('.cursor__ring');
      
      function renderCursor() {
        ring.x += (mouse.x - ring.x) * 0.15;
        ring.y += (mouse.y - ring.y) * 0.15;
        dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
        ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;
        requestAnimationFrame(renderCursor);
      }
      requestAnimationFrame(renderCursor);

      const interactives = document.querySelectorAll('a, button, .donate__btn');
      interactives.forEach(el => {
        el.addEventListener('mouseenter', () => {
          if (el.classList.contains('donate__btn')) {
            cursor.classList.add('is-hovering-donate');
          } else {
            cursor.classList.add('is-hovering');
          }
        });
        el.addEventListener('mouseleave', () => {
          cursor.classList.remove('is-hovering', 'is-hovering-donate');
        });
      });
    }
  }

  // Mobile Bar
  if (IS_MOBILE) {
    const bar = document.querySelector('.mobile-donate-bar');
    if (bar) {
      ScrollTrigger.create({
        trigger: '#manifesto',
        start: 'top bottom',
        endTrigger: '#donate',
        end: 'top bottom',
        onToggle: self => {
          if (self.isActive) bar.classList.add('is-visible');
          else bar.classList.remove('is-visible');
        }
      });
      bar.addEventListener('click', e => {
        e.preventDefault();
        lenis ? lenis.scrollTo('#donate') : document.getElementById('donate').scrollIntoView({behavior: 'smooth'});
      });
    }
  }

  // Scroll Crown
  const crownFill = document.querySelector('.scroll-crown-fill');
  if (crownFill) {
    gsap.to(crownFill, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true
      }
    });
    document.querySelector('.scroll-crown').addEventListener('click', () => {
      lenis ? lenis.scrollTo(0, {duration: 2}) : window.scrollTo({top:0, behavior:'smooth'});
    });
  }
}

/* ==========================================================================
   14. HERO DEDICATION — fade in after particles settle (~2s), tagline after
   ========================================================================== */
function initHeroDedication() {
  const ded = document.querySelector('.hero__dedication');
  const tagline = document.querySelector('.hero__tagline');
  if (REDUCED_MOTION) {
    if (ded) ded.style.opacity = '1';
    if (tagline) tagline.style.opacity = '1';
    return;
  }
  if (ded) {
    gsap.to(ded, {
      opacity: 1,
      duration: 1.2,
      ease: 'power2.out',
      delay: 2,
    });
  }
  if (tagline) {
    gsap.to(tagline, {
      opacity: 1,
      duration: 1,
      ease: 'power2.out',
      delay: 2.6,
    });
  }
}

/* ==========================================================================
   15. MEMORIAL — frame draw-in on scroll
   ========================================================================== */
function initMemorial() {
  const section = document.getElementById('memorial');
  if (!section) return;

  // Reduced motion: CSS handles visibility
  if (REDUCED_MOTION) return;

  const headline = section.querySelector('.memorial__headline');
  const lead = section.querySelector('.memorial__lead');
  const divider = section.querySelector('.memorial__divider');
  const cols = section.querySelectorAll('.memorial__col');

  // 1. Headline rises in, lead fades up
  if (headline) {
    gsap.from(headline, {
      opacity: 0,
      y: 60,
      duration: 1,
      ease: 'power2.out',
      scrollTrigger: { trigger: section, start: 'top 75%' }
    });
  }
  if (lead) {
    gsap.from(lead, {
      opacity: 0,
      duration: 1,
      ease: 'power2.out',
      delay: 0.2,
      scrollTrigger: { trigger: section, start: 'top 75%' }
    });
  }

  // 2. Divider draws (scrubbed)
  if (divider) {
    gsap.from(divider, {
      scaleY: IS_MOBILE ? 1 : 0,
      scaleX: IS_MOBILE ? 0 : 1,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top 60%',
        end: 'bottom 80%',
        scrub: true,
      }
    });
  }

  // 3. Columns fade up staggered, ghost parallax, candle line + flame
  cols.forEach((col, i) => {
    gsap.from(col, {
      opacity: 0,
      y: 40,
      duration: 0.9,
      ease: 'power2.out',
      delay: i * 0.2 + 0.1,
      scrollTrigger: { trigger: section, start: 'top 60%' }
    });

    const line = col.querySelector('.memorial__candle-line');
    const flame = col.querySelector('.memorial__candle-flame');
    if (line) {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: col, start: 'top 55%' }
      });
      tl.from(line, { scaleY: 0, duration: 1, ease: 'power2.out' });
      if (flame) {
        tl.from(flame, { opacity: 0, duration: 0.5, ease: 'power1.inOut' }, '-=0.3');
      }
    }

    const ghost = col.querySelector('.memorial__ghost');
    if (ghost) {
      gsap.to(ghost, {
        y: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: col,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });
    }
  });
}

/* ==========================================================================
   16. ACTIVITY — chairs reveal one by one on scroll
   ========================================================================== */
function initActivity() {
  const section = document.getElementById('activity');
  if (!section) return;

  if (!REDUCED_MOTION) {
    gsap.from('.activity__content', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '#activity',
        start: 'top 80%',
      }
    });
  }

  const lines = section.querySelectorAll('.chair-line, .chair-floor');
  const sashes = section.querySelectorAll('.chair-sash');
  if (!lines.length) return;

  if (REDUCED_MOTION) {
    sashes.forEach(s => s.style.opacity = '1');
    return;
  }

  lines.forEach(line => {
    // try-catch for cases where getTotalLength might fail if display:none
    try {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
    } catch (e) {}
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#activity',
      start: 'top 70%',
    }
  });

  tl.to('.chair-floor', {
    strokeDashoffset: 0,
    duration: 0.6,
    ease: 'power2.out'
  });

  tl.to('.chair-line', {
    strokeDashoffset: 0,
    duration: 1,
    stagger: 0.05,
    ease: 'power2.out'
  }, '-=0.2');

  tl.to(sashes, {
    opacity: 1,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power1.inOut'
  }, '-=0.5');
}

/* ==========================================================================
   18. NOTICE — entry donation appeal
   Shown once per session, after the preloader curtains have lifted so it
   never competes with the crown reveal.
   ========================================================================== */
function initNotice() {
  if (!NOTICE_ENABLED) return;

  const notice = document.getElementById('donate-notice');
  if (!notice) return;

  // Once per session — a reload mid-visit shouldn't ask again
  try {
    if (sessionStorage.getItem('notice-seen')) return;
    sessionStorage.setItem('notice-seen', '1');
  } catch { /* private mode throws: show it anyway */ }

  const scrim = notice.querySelector('.notice__scrim');
  const card = notice.querySelector('.notice__card');
  const closeBtn = notice.querySelector('.notice__close');
  const cta = notice.querySelector('.notice__cta');

  const lastFocus = document.activeElement;
  let isOpen = false;

  function open() {
    notice.hidden = false;
    isOpen = true;
    document.body.classList.add('notice-open');
    if (lenis) lenis.stop();

    if (REDUCED_MOTION) {
      gsap.set([scrim, card], { opacity: 1, y: 0 });
    } else {
      gsap.set(card, { y: 16 });
      const tl = gsap.timeline();
      tl.to(scrim, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      tl.to(card, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.25');
    }

    // Focus the dialog itself, not the gold bar — focusing a button would
    // paint the browser's default (blue) focus ring over the palette
    card?.focus({ preventScroll: true });
    track('donate_notice_view');
  }

  function close(reason) {
    if (!isOpen) return;
    isOpen = false;
    // A donate click already reports itself — don't double-count it as a dismissal
    if (reason !== 'donate') track('donate_notice_close', { method: reason });

    let torn = false;
    const done = () => {
      if (torn) return;
      torn = true;
      gsap.set(notice, { opacity: 1 });
      notice.hidden = true;
      document.body.classList.remove('notice-open');
      if (lenis) lenis.start();
      if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true });
    };

    if (REDUCED_MOTION) { done(); return; }
    gsap.to(notice, { opacity: 0, duration: 0.35, ease: 'power2.inOut', onComplete: done });
    // GSAP's ticker sleeps while the tab is backgrounded, which would strand the
    // close mid-tween and leave the page scroll-locked. setTimeout still fires
    // there, so it guarantees the teardown regardless.
    setTimeout(done, 600);
  }

  cta?.addEventListener('click', () => {
    track('donate_notice_click');
    handleDonate();          // copy → toast → Bit, the same flow as the finale
    close('donate');
  });

  closeBtn?.addEventListener('click', () => close('x'));
  scrim?.addEventListener('click', () => close('scrim'));

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { close('escape'); return; }
    // Keep focus inside the notice while it's up
    if (e.key === 'Tab') {
      const items = [closeBtn, cta].filter(Boolean); // DOM order
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Let the hero settle before asking
  gsap.delayedCall(REDUCED_MOTION ? 0.2 : 0.8, open);
}
/* ---- end NOTICE ---- */

/* ==========================================================================
   17. RESIZE HANDLING
   ========================================================================== */
window.addEventListener('resize', debounce(() => {
  if (heroParticles) heroParticles.resize();
  ScrollTrigger.refresh();
}, 250));
