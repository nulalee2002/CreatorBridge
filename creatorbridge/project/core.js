// CreatorBridge — Shared chrome: cursor, scroll progress, reveals, parallax, nav scroll
(function() {
  // ===== Smooth scroll via Lenis (loaded dynamically) =====
  function initLenis() {
    if (window.__lenisInit) return;
    window.__lenisInit = true;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js';
    s.onload = () => {
      if (typeof Lenis === 'undefined') return;
      const lenis = new Lenis({
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.9
      });
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
      window.__lenis = lenis;
      // Sync GSAP ScrollTrigger if present
      lenis.on('scroll', () => {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      });
    };
    document.head.appendChild(s);
  }
  initLenis();

  // ===== Cursor + mouse-tracked glow (called after mountChrome creates elements) =====
  window.CB = window.CB || {};
  window.CB._initCursor = function() {
    if (window.__cursorInit) return;
    const ring = document.querySelector('.cursor-ring');
    const dot = document.querySelector('.cursor-dot');
    const glow = document.querySelector('.mouse-glow');
    if (!ring || !dot) return;
    if (window.innerWidth <= 768) return;
    window.__cursorInit = true;
    let mx = window.innerWidth/2, my = window.innerHeight/2, rx = mx, ry = my, gx = mx, gy = my;
    let active = false;
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
      if (!active) { active = true; document.body.classList.add('mouse-active'); }
      document.body.style.setProperty('--mx', ((mx / window.innerWidth) * 100) + '%');
      document.body.style.setProperty('--my', ((my / window.innerHeight) * 100) + '%');
    });
    document.addEventListener('mouseleave', () => {
      document.body.classList.remove('mouse-active');
      active = false;
    });
    (function tick() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      gx += (mx - gx) * 0.08;
      gy += (my - gy) * 0.08;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      if (glow) {
        glow.style.left = gx + 'px';
        glow.style.top = gy + 'px';
      }
      requestAnimationFrame(tick);
    })();
    document.querySelectorAll('a, button, .liquid-glass, .lane-card, .parallax-wrap, input, textarea, select').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('hover'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
    });
  };

  // Scroll progress
  const prog = document.querySelector('.scroll-progress');
  if (prog) {
    window.addEventListener('scroll', () => {
      const top = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = `scaleX(${h > 0 ? top / h : 0})`;
    }, { passive: true });
  }

  // Nav background on scroll
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.style.background = window.scrollY > 80
        ? 'rgba(13,13,15,0.94)'
        : 'rgba(13,13,15,0.78)';
    }, { passive: true });
  }

  // Reveals via IntersectionObserver (fail-open: content visible by default, hidden+animated only when JS confirms)
  function initReveals() {
    const els = document.querySelectorAll('.reveal-up');
    if (!els.length) return;
    els.forEach(el => {
      el.classList.add('js-hidden');
      el.style.transition = 'opacity 0.85s cubic-bezier(0.23,1,0.32,1), transform 0.85s cubic-bezier(0.23,1,0.32,1)';
    });
    const reveal = (el, i = 0) => {
      setTimeout(() => el.classList.remove('js-hidden'), i * 60);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          reveal(entry.target, i % 4);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.01 });
    els.forEach(el => io.observe(el));
    // Safety net: force all visible after 1.5s regardless of IO state
    setTimeout(() => {
      document.querySelectorAll('.reveal-up.js-hidden').forEach(el => el.classList.remove('js-hidden'));
    }, 1500);
  }
  // ===== Animated number counters =====
  function initCounters() {
    const stats = document.querySelectorAll('.stat-num[data-target]');
    if (!stats.length) return;
    const animate = (el) => {
      if (el.__counted) return; el.__counted = true;
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      const useCommas = target >= 1000;
      const duration = 2200;
      const start = performance.now();
      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      function step(now) {
        const p = Math.min(1, (now - start) / duration);
        const v = Math.round(target * easeOut(p));
        el.textContent = (useCommas ? v.toLocaleString() : v) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    stats.forEach(s => io.observe(s));
  }
  initCounters();

  // GSAP parallax + magnetic buttons (only if GSAP is loaded)
  function initGsap() {
    if (typeof gsap === 'undefined') return;
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.parallax-img').forEach(img => {
      const wrap = img.closest('.parallax-wrap');
      if (!wrap) return;
      gsap.to(img, {
        scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: 1.5 },
        y: '-15%', ease: 'none'
      });
    });

    // Magnetic buttons
    document.querySelectorAll('.btn-gold, .btn-ghost').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)'; });
    });
  }
  if (document.readyState === 'complete') initGsap();
  else window.addEventListener('load', initGsap);
})();

// Shared NAV markup helper — call CB.mountNav('find') with active page key
window.CB = window.CB || {};
window.CB.NAV_LINKS = [
  { key: 'find',     label: 'Find Creators',  href: 'Find Creators.html' },
  { key: 'projects', label: 'Project Board',  href: 'Project Board.html' },
  { key: 'network',  label: 'Network',        href: 'Creator Network.html' },
  { key: 'rate',     label: 'Rate Calculator',href: 'Rate Calculator.html' }
];
window.CB.mountNav = function(active) {
  const el = document.getElementById('nav-root');
  if (!el) return;
  const links = window.CB.NAV_LINKS.map(l =>
    `<a href="${l.href}" class="nav-link${l.key === active ? ' active' : ''}">${l.label}</a>`
  ).join('');
  el.innerHTML = `
  <nav class="nav">
    <div class="nav-inner">
      <a href="Landing.html" class="logo-mark">
        <img src="logo.png" alt="CreatorBridge — Verified Media Marketplace" class="logo-img">
      </a>
      <div class="nav-links">${links}</div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <a href="#" class="btn-ghost" style="display:none" data-show-md>Join</a>
        <a href="#" class="btn-gold">Sign In</a>
      </div>
    </div>
  </nav>`;
};

// Footer helper
window.CB.mountFooter = function() {
  const el = document.getElementById('footer-root');
  if (!el) return;
  el.innerHTML = `
  <footer class="site">
    <div class="inner">
      <div class="grid">
        <div>
          <a href="Landing.html" class="logo-mark" style="margin-bottom:1.25rem;">
            <img src="logo.png" alt="CreatorBridge" class="logo-img">
          </a>
          <p style="font-size:12px;color:var(--text-secondary);max-width:24rem;line-height:1.6;">
            The verified marketplace connecting brands with professional media specialists. Video, photo, podcast, drone, events, and post-production — without building an internal department.
          </p>
        </div>
        <div>
          <h4>Platform</h4>
          <a href="Find Creators.html">Find Creators</a>
          <a href="Project Board.html">Project Board</a>
          <a href="Creator Network.html">Creator Network</a>
          <a href="Rate Calculator.html">Rate Calculator</a>
        </div>
        <div>
          <h4>For Creators</h4>
          <a href="Creator Profile.html">Sample profile</a>
          <a href="#">Apply to join</a>
          <a href="#">Verification standards</a>
          <a href="#">Creator handbook</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Press</a>
          <a href="#">Careers</a>
          <a href="#">Contact</a>
        </div>
      </div>
      <div class="bottom">
        <div>CreatorBridge — connecting content creators with brands seeking media production.</div>
        <div style="display:flex;gap:1.5rem;">
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
          <a href="#">Support</a>
        </div>
      </div>
    </div>
  </footer>`;
};

// Chrome helper — mounts cursor, scroll bar, ambient bg, nav, footer
window.CB.mountChrome = function(activeNav) {
  // Ambient background layers (grid + orbs + mouse glow)
  if (!document.querySelector('.bg-grid')) {
    const grid = document.createElement('div'); grid.className = 'bg-grid';
    const orbs = document.createElement('div'); orbs.className = 'bg-orbs';
    orbs.innerHTML = '<span></span><span></span><span></span>';
    const glow = document.createElement('div'); glow.className = 'mouse-glow';
    document.body.append(grid, orbs, glow);
  }
  // Cursor + progress
  if (!document.querySelector('.cursor-ring')) {
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    const dot = document.createElement('div'); dot.className = 'cursor-dot';
    const prog = document.createElement('div'); prog.className = 'scroll-progress';
    document.body.append(ring, dot, prog);
  }
  window.CB.mountNav(activeNav);
  window.CB.mountFooter();
  // After elements exist, init cursor + glow tracking
  window.CB._initCursor();
};
