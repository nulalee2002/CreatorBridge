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
  // Tuned for a snappy, responsive feel — was sluggish before.
  window.CB = window.CB || {};
  window.CB._initCursor = function() {
    if (window.__cursorInit) return;
    const ring = document.querySelector('.cursor-ring');
    const dot = document.querySelector('.cursor-dot');
    const glow = document.querySelector('.mouse-glow');
    if (!ring || !dot) return;
    if (window.innerWidth <= 768) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.__cursorInit = true;
    let mx = window.innerWidth/2, my = window.innerHeight/2, rx = mx, ry = my, gx = mx, gy = my;
    let active = false;
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
      if (!active) { active = true; document.body.classList.add('mouse-active'); }
      document.body.style.setProperty('--mx', ((mx / window.innerWidth) * 100) + '%');
      document.body.style.setProperty('--my', ((my / window.innerHeight) * 100) + '%');
    }, { passive: true });
    document.addEventListener('mouseleave', () => {
      document.body.classList.remove('mouse-active');
      active = false;
    });
    // Lerp factors bumped from 0.18 / 0.08 → 0.38 / 0.28 so cursor + glow
    // track the pointer immediately instead of lagging behind it.
    (function tick() {
      const ringEase = 0.38, glowEase = 0.28;
      rx += (mx - rx) * ringEase;
      ry += (my - ry) * ringEase;
      gx += (mx - gx) * glowEase;
      gy += (my - gy) * glowEase;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      if (glow) {
        glow.style.left = gx + 'px';
        glow.style.top = gy + 'px';
      }
      requestAnimationFrame(tick);
    })();
    if (prefersReduced && glow) glow.style.display = 'none';
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

// ===== PLATFORM PILLARS =====
// CreatorBridge is built around exactly 3 primary pillars. Every page reads
// from this single source of truth so labels, filters, and chips stay in sync.
window.CB.PILLARS = [
  {
    key: 'video',
    label: 'Video Production',
    short: 'Video',
    blurb: 'Brand films, weddings, events, music videos, documentary, social, drone.',
    specialties: [
      'Brand Films & Commercials',
      'Wedding Films',
      'Event & Conference Video',
      'Music Videos',
      'Documentary & Interviews',
      'Video Podcasts',
      'Short-Form & Social (Reels/TikTok/UGC)',
      'Real Estate Video',
      'Drone & Aerial Video',
      'Corporate & Internal Video'
    ]
  },
  {
    key: 'photo',
    label: 'Photography',
    short: 'Photo',
    blurb: 'Commercial, weddings, events, portraits, product, real estate, editorial, food.',
    specialties: [
      'Brand & Commercial Photography',
      'Wedding Photography',
      'Event Photography',
      'Headshots & Portraits',
      'Product & Still Life',
      'Real Estate Photography',
      'Lifestyle & Fashion',
      'Editorial & Press',
      'Drone & Aerial Photography',
      'Food & Hospitality'
    ]
  },
  {
    key: 'post',
    label: 'Post Production',
    short: 'Post',
    blurb: 'Editing, color, motion graphics, sound design, podcast audio, retouching.',
    specialties: [
      'Video Editing (Long-Form)',
      'Short-Form Editing',
      'Color Grading',
      'Motion Graphics & VFX',
      'Sound Design & Mixing',
      'Podcast Audio Editing',
      'Photo Retouching',
      'Documentary Editing'
    ]
  }
];
window.CB.pillarByKey = (k) => window.CB.PILLARS.find(p => p.key === k);
window.CB.pillarByLabel = (l) => window.CB.PILLARS.find(p => p.label === l);

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
        <div class="brand-col">
          <a href="Landing.html" class="logo-mark" style="margin-bottom:1.25rem;">
            <img src="logo.png" alt="CreatorBridge" class="logo-img">
          </a>
          <p style="font-size:12px;color:var(--text-secondary);max-width:24rem;line-height:1.6;">
            The verified US marketplace connecting brands with professional media specialists across three production pillars — without building an internal media department.
          </p>
          <div class="footer-pillar-row">
            <span class="footer-pill">Video Production</span>
            <span class="footer-pill">Photography</span>
            <span class="footer-pill">Post Production</span>
          </div>
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
        <div>© 2026 CreatorBridge · US-only verified media marketplace · All bookings in USD.</div>
        <div class="bottom-links">
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
          <a href="#">Support</a>
        </div>
      </div>
    </div>
  </footer>`;
};

// Chrome helper — mounts cursor, scroll bar, ambient bg, nav, footer, chat
window.CB.mountChrome = function(activeNav) {
  // Ambient background layers (grid + signal traces + mouse glow)
  if (!document.querySelector('.bg-grid')) {
    const grid = document.createElement('div'); grid.className = 'bg-grid';
    const sig = document.createElement('div'); sig.className = 'bg-signals';
    sig.innerHTML = '<span class="sig h1"></span><span class="sig h2"></span><span class="sig h3"></span><span class="sig h4"></span>' +
                    '<span class="sig v1"></span><span class="sig v2"></span><span class="sig v3"></span>' +
                    '<span class="sig d1"></span><span class="sig d2"></span>';
    const glow = document.createElement('div'); glow.className = 'mouse-glow';
    document.body.append(grid, sig, glow);
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
  window.CB._mountChat();
  // After elements exist, init cursor + glow tracking
  window.CB._initCursor();
};

// ===== BRIDGE ASSISTANT — concierge chat widget =====
// Stylized lens-aperture avatar. Lives on every page.
window.CB._mountChat = function() {
  if (document.querySelector('.cb-fab')) return;

  // Bridge mascot — friendly camera-character: round face, two lens-style eyes,
  // a small smile, and a signal antenna. Eyes blink and track the cursor when
  // the chat is open. Used in the FAB (head-only is recognizable at 60px).
  const bridgeFaceSvg = `
    <svg viewBox="0 0 48 48" fill="none" class="bridge-face" aria-hidden="true">
      <!-- antenna -->
      <line x1="24" y1="3" x2="24" y2="8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.65"/>
      <circle cx="24" cy="3" r="1.8" fill="currentColor" class="antenna-dot"/>

      <!-- face — rounded camera-body silhouette with gold border -->
      <circle cx="24" cy="27" r="17.5" fill="rgba(13,13,15,0.96)" stroke="currentColor" stroke-width="1.2"/>

      <!-- viewfinder strip (subtle, hints at "camera") -->
      <rect x="14" y="15.5" width="20" height="1.4" rx="0.7" fill="currentColor" opacity="0.25"/>

      <!-- eyes — wrapped so we can blink + track -->
      <g class="bridge-eyes">
        <!-- eye sockets -->
        <circle cx="17" cy="25" r="4.2" fill="rgba(255,255,255,0.05)" stroke="currentColor" stroke-width="0.7" opacity="0.85"/>
        <circle cx="31" cy="25" r="4.2" fill="rgba(255,255,255,0.05)" stroke="currentColor" stroke-width="0.7" opacity="0.85"/>
        <!-- iris (gold) — these move with the cursor -->
        <g class="bridge-pupils">
          <circle cx="17" cy="25" r="2.4" fill="currentColor" class="pupil pupil-left"/>
          <circle cx="31" cy="25" r="2.4" fill="currentColor" class="pupil pupil-right"/>
          <!-- glints stay anchored to the iris -->
          <circle cx="18" cy="24" r="0.7" fill="rgba(255,255,255,0.9)" class="glint glint-left"/>
          <circle cx="32" cy="24" r="0.7" fill="rgba(255,255,255,0.9)" class="glint glint-right"/>
        </g>
      </g>

      <!-- mouth — small smile, gently animates while typing -->
      <path d="M19 34 Q24 37.5 29 34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="bridge-mouth"/>

      <!-- subtle cheek blush -->
      <circle cx="11" cy="31" r="1.6" fill="currentColor" opacity="0.18"/>
      <circle cx="37" cy="31" r="1.6" fill="currentColor" opacity="0.18"/>
    </svg>`;

  // Bridge — FULL BODY version. Director-character with a tiny clapperboard
  // that periodically SNAPS. The creative twist that ties to media production.
  // Shown in the panel header as a delightful reveal when the chat opens.
  const bridgeBodySvg = `
    <svg viewBox="0 0 72 110" fill="none" class="bridge-face bridge-body-svg" aria-hidden="true">

      <!-- ANTENNA -->
      <line x1="36" y1="4" x2="36" y2="11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>
      <circle cx="36" cy="4" r="1.8" fill="currentColor" class="antenna-dot"/>

      <!-- HEAD -->
      <g class="bridge-head-group">
        <circle cx="36" cy="24" r="13.5" fill="rgba(13,13,15,0.96)" stroke="currentColor" stroke-width="1.1"/>
        <!-- viewfinder strip -->
        <rect x="28" y="14.5" width="16" height="1.1" rx="0.55" fill="currentColor" opacity="0.25"/>

        <!-- eyes -->
        <g class="bridge-eyes">
          <circle cx="30.5" cy="23" r="3.2" fill="rgba(255,255,255,0.05)" stroke="currentColor" stroke-width="0.55" opacity="0.85"/>
          <circle cx="41.5" cy="23" r="3.2" fill="rgba(255,255,255,0.05)" stroke="currentColor" stroke-width="0.55" opacity="0.85"/>
          <g class="bridge-pupils">
            <circle cx="30.5" cy="23" r="1.85" fill="currentColor" class="pupil pupil-left"/>
            <circle cx="41.5" cy="23" r="1.85" fill="currentColor" class="pupil pupil-right"/>
            <circle cx="31.2" cy="22.3" r="0.55" fill="rgba(255,255,255,0.9)" class="glint"/>
            <circle cx="42.2" cy="22.3" r="0.55" fill="rgba(255,255,255,0.9)" class="glint"/>
          </g>
        </g>

        <!-- mouth -->
        <path d="M31.5 30 Q36 32.5 40.5 30" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" class="bridge-mouth"/>

        <!-- cheek blush -->
        <circle cx="24" cy="28" r="1.3" fill="currentColor" opacity="0.18"/>
        <circle cx="48" cy="28" r="1.3" fill="currentColor" opacity="0.18"/>
      </g>

      <!-- NECK -->
      <line x1="36" y1="37.5" x2="36" y2="42" stroke="currentColor" stroke-width="0.9" opacity="0.45"/>

      <!-- BODY — small camera-body torso with REC dot + CB monogram -->
      <g class="bridge-torso">
        <rect x="24" y="42" width="24" height="26" rx="6" fill="rgba(20,20,24,0.94)" stroke="currentColor" stroke-width="1"/>
        <!-- top control line -->
        <line x1="27" y1="47" x2="45" y2="47" stroke="currentColor" stroke-width="0.4" opacity="0.4"/>
        <!-- REC indicator -->
        <circle cx="29" cy="47" r="1.2" fill="#ef4444" class="rec-dot"/>
        <!-- "CB" monogram chest plate -->
        <text x="36" y="60" font-family="Playfair Display, Georgia, serif" font-size="7.5" fill="currentColor" text-anchor="middle" letter-spacing="0.5">CB</text>
      </g>

      <!-- LEFT ARM — relaxed at side -->
      <g class="bridge-arm-left">
        <path d="M25 47 Q19 54 18 64" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"/>
        <circle cx="18" cy="64.5" r="2.3" fill="currentColor"/>
      </g>

      <!-- RIGHT ARM — extended out, holding the clapperboard -->
      <g class="bridge-arm-right">
        <path d="M47 49 Q53 53 58 58" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"/>
        <circle cx="58" cy="58" r="2.3" fill="currentColor"/>
      </g>

      <!-- CLAPPERBOARD — the creative twist. Periodically snaps shut. -->
      <g class="bridge-clapper" transform="translate(50 56)">
        <!-- board slate (bottom) -->
        <rect x="0" y="3" width="20" height="13" rx="1.5" fill="rgba(13,13,15,0.96)" stroke="currentColor" stroke-width="0.9"/>
        <!-- slate text lines -->
        <line x1="2.5" y1="7" x2="17.5" y2="7" stroke="currentColor" stroke-width="0.4" opacity="0.5"/>
        <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" stroke-width="0.4" opacity="0.45"/>
        <text x="10" y="14.4" font-family="'Playfair Display', Georgia, serif" font-size="3.6" fill="currentColor" text-anchor="middle" opacity="0.85">BRIDGE</text>

        <!-- clapper STICK (top, the moving part) -->
        <g class="bridge-clapper-stick">
          <rect x="0" y="-2" width="20" height="5" rx="1" fill="rgba(13,13,15,0.96)" stroke="currentColor" stroke-width="0.9"/>
          <!-- diagonal stripes (the classic clapperboard pattern) -->
          <g stroke="currentColor" stroke-width="0.7" opacity="0.85">
            <line x1="2" y1="-2" x2="4.5" y2="3"/>
            <line x1="6" y1="-2" x2="8.5" y2="3"/>
            <line x1="10" y1="-2" x2="12.5" y2="3"/>
            <line x1="14" y1="-2" x2="16.5" y2="3"/>
            <line x1="18" y1="-2" x2="20" y2="0.5"/>
          </g>
        </g>
      </g>

      <!-- LEGS — short, sturdy with little feet -->
      <g class="bridge-legs">
        <line x1="30" y1="68" x2="30" y2="82" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="leg leg-left"/>
        <line x1="42" y1="68" x2="42" y2="82" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="leg leg-right"/>
        <ellipse cx="30" cy="84" rx="4" ry="1.6" fill="currentColor" class="foot foot-left"/>
        <ellipse cx="42" cy="84" rx="4" ry="1.6" fill="currentColor" class="foot foot-right"/>
      </g>

      <!-- soft ground shadow -->
      <ellipse cx="36" cy="91" rx="14" ry="2" fill="rgba(0,0,0,0.5)" class="bridge-shadow"/>
    </svg>`;

  // FAB — Bridge stands full-body on the page (small but noticeable).
  // The clapperboard, REC dot, and legs all visible at this size.
  const fab = document.createElement('button');
  fab.className = 'cb-fab cb-fab-body';
  fab.setAttribute('aria-label', 'Open Bridge Assistant');
  fab.innerHTML = `
    <span class="cb-fab-ring"></span>
    <span class="cb-fab-ring"></span>
    <span class="cb-fab-icon">${bridgeBodySvg}</span>
    <span class="cb-fab-close">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </span>`;
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.className = 'cb-chat-panel';
  panel.innerHTML = `
    <div class="cb-chat-header">
      <div class="cb-chat-mascot">
        ${bridgeBodySvg}
        <span class="status-dot"></span>
      </div>
      <div class="cb-chat-meta">
        <div class="cb-chat-name">Bridge <span class="cb-chat-tier">Concierge</span></div>
        <div class="cb-chat-sub">Verified production talent · US</div>
        <div class="cb-chat-takeline"><span class="cb-take-num">Take 01</span> · ready when you are</div>
      </div>
      <button class="cb-chat-close-btn" aria-label="Close chat">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="cb-chat-body" id="cb-chat-body"></div>
    <div class="cb-chat-input">
      <input type="text" id="cb-chat-input" placeholder="Ask Bridge about creators, briefs, rates…">
      <button class="cb-chat-send" aria-label="Send">
        <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12l14-7-4 7 4 7-14-7z"/>
        </svg>
      </button>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('#cb-chat-body');
  const input = panel.querySelector('#cb-chat-input');
  const sendBtn = panel.querySelector('.cb-chat-send');

  // ---- Message helpers ----
  function addBot(html, delay = 0) {
    const el = document.createElement('div');
    el.className = 'cb-chat-msg bot';
    el.innerHTML = html;
    el.style.animationDelay = delay + 'ms';
    body.appendChild(el);
    requestAnimationFrame(() => body.scrollTop = body.scrollHeight);
    return el;
  }
  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'cb-chat-msg user';
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'cb-chat-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    // Switch Bridge face to "thinking" while the dots are showing
    if (window.CB._chatSetMood) window.CB._chatSetMood('thinking', 0);
    const origRemove = el.remove.bind(el);
    el.remove = () => {
      origRemove();
      if (window.CB._chatSetMood) window.CB._chatSetMood('happy', 1100);
    };
    return el;
  }
  function showQuickPaths(paths) {
    const wrap = document.createElement('div');
    wrap.className = 'cb-chat-quick';
    wrap.innerHTML = '<div class="cb-chat-quick-label">Quick paths</div>';
    paths.forEach((p, i) => {
      const isLink = !!p.href;
      const tag = isLink ? 'a' : 'button';
      const node = document.createElement(tag);
      node.className = 'cb-chat-path';
      if (isLink) node.href = p.href;
      node.style.animationDelay = (i * 70) + 'ms';
      node.innerHTML = `<span class="num">${p.num || '·'}</span><span class="label">${p.label}</span><span class="arrow">→</span>`;
      if (!isLink && p.onClick) node.addEventListener('click', () => p.onClick(node));
      wrap.appendChild(node);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    return wrap;
  }

  // ---- Seed conversation on first open ----
  let seeded = false;
  function seed() {
    if (seeded) return;
    seeded = true;
    setTimeout(() => addBot(`Hi — I'm <strong>Bridge</strong>, your concierge for verified US production talent.`), 250);
    setTimeout(() => addBot(`Tell me what you're producing and I'll route you to the right pillar — <span class="g">Video Production</span>, <span class="g">Photography</span>, or <span class="g">Post Production</span> — or help you post a brief.`), 1100);
    setTimeout(() => showQuickPaths([
      { num: '01', label: 'Find a videographer',         href: 'Find Creators.html?pillar=video' },
      { num: '02', label: 'Find a photographer',         href: 'Find Creators.html?pillar=photo' },
      { num: '03', label: 'Find an editor / colorist',   href: 'Find Creators.html?pillar=post' },
      { num: '·',  label: 'Post a production brief',     href: 'Project Board.html' },
      { num: '·',  label: 'Calculate a rate (creators)', href: 'Rate Calculator.html' },
      { num: '?',  label: 'How CreatorBridge works',     onClick: explainHowItWorks }
    ]), 2100);
  }

  function explainHowItWorks(node) {
    // disable the button so it can't be re-clicked
    node.style.opacity = 0.5; node.style.pointerEvents = 'none';
    const t = showTyping();
    setTimeout(() => {
      t.remove();
      addBot(`Three things make CreatorBridge different:`);
      setTimeout(() => addBot(`<strong>1 · Verified-only.</strong> Every creator passes a profile gate (2+ yrs), a proof layer (3+ works), and an intro check before they're listed.`), 700);
      setTimeout(() => addBot(`<strong>2 · One pillar, real specialties.</strong> Each creator commits to one of <span class="g">Video</span>, <span class="g">Photo</span>, or <span class="g">Post</span> — plus 1–3 specialties. No generalists pretending.`), 1500);
      setTimeout(() => addBot(`<strong>3 · 50/50 escrow.</strong> Half held on booking, half on delivery approval. 5% client fee, 6–10% creator fee. All USD.`), 2300);
      setTimeout(() => addBot(`Want me to point you somewhere specific?`), 3100);
    }, 900);
  }

  // ---- Free-text input → keyword routing ----
  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    addUser(text);
    input.value = '';
    const t = showTyping();
    setTimeout(() => {
      t.remove();
      const reply = routeKeyword(text.toLowerCase());
      addBot(reply.text);
      if (reply.path) {
        setTimeout(() => showQuickPaths([{ num: '→', label: reply.path.label, href: reply.path.href }]), 500);
      }
    }, 700 + Math.random() * 500);
  }
  function routeKeyword(q) {
    if (/(video|film|reel|commercial|wedding|drone aerial|conference|documentary|music video)/.test(q))
      return { text: `Sounds like <span class="g">Video Production</span>. I can show you verified videographers right now.`,
               path: { label: 'Browse Video Production creators', href: 'Find Creators.html?pillar=video' } };
    if (/(photo|product shot|headshot|portrait|editorial|real estate photo|food)/.test(q))
      return { text: `That's <span class="g">Photography</span>. Want me to filter by specialty?`,
               path: { label: 'Browse Photography creators', href: 'Find Creators.html?pillar=photo' } };
    if (/(edit|color|grade|motion|vfx|sound|mix|retouch|post)/.test(q))
      return { text: `Sounds like <span class="g">Post Production</span> work.`,
               path: { label: 'Browse Post Production creators', href: 'Find Creators.html?pillar=post' } };
    if (/(brief|project|post a)/.test(q))
      return { text: `You can post a brief and we'll surface verified creators within 24 hrs.`,
               path: { label: 'Open the Project Board', href: 'Project Board.html' } };
    if (/(rate|quote|price|cost|how much)/.test(q))
      return { text: `For creators — the Rate Calculator builds a USD quote from your pillar, specialty, US market, and scope.`,
               path: { label: 'Open the Rate Calculator', href: 'Rate Calculator.html' } };
    if (/(how|work|escrow|fee|verified|trust)/.test(q))
      return { text: `Short version: verified-only creators, one pillar each, 50/50 escrow, US-only, USD. Want the longer version?`,
               path: { label: 'Read how it works', href: 'Landing.html' } };
    return { text: `I can route you to verified creators in <span class="g">Video</span>, <span class="g">Photo</span>, or <span class="g">Post Production</span>, help you post a brief, or build a quote. What's the project?`,
             path: null };
  }

  // ---- Open / close ----
  let open = false;
  function setOpen(o) {
    open = o;
    panel.classList.toggle('open', o);
    fab.classList.toggle('open', o);
    fab.setAttribute('aria-label', o ? 'Close Bridge Assistant' : 'Open Bridge Assistant');
    if (o) {
      seed();
      setTimeout(() => input.focus({ preventScroll: true }), 320);
      // Trigger a "wave hello" head tilt + clapper snap on first open
      const mascot = panel.querySelector('.cb-chat-mascot .bridge-face');
      if (mascot) {
        const head = mascot.querySelector('.bridge-head-group');
        if (head) {
          head.classList.remove('wave');
          void head.offsetWidth;
          head.classList.add('wave');
        }
        const clapper = mascot.querySelector('.bridge-clapper-stick');
        if (clapper) {
          clapper.classList.remove('snap-now');
          void clapper.getBoundingClientRect();
          clapper.classList.add('snap-now');
        }
      }
    }
  }
  fab.addEventListener('click', () => setOpen(!open));
  panel.querySelector('.cb-chat-close-btn').addEventListener('click', () => setOpen(false));
  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });

  // ---- Eye tracking — pupils follow the cursor when chat is open or hovering FAB ----
  const trackFaces = () => [
    ...(open ? panel.querySelectorAll('.bridge-face') : []),
    ...(fab.matches(':hover') ? fab.querySelectorAll('.bridge-face') : [])
  ];
  const MAX_PUPIL_OFFSET = 1.4; // SVG units
  document.addEventListener('mousemove', (e) => {
    const faces = trackFaces();
    if (!faces.length) return;
    faces.forEach(face => {
      // Anchor tracking to the actual eyes, not the whole-SVG bbox — that way
      // the full-body mascot's eyes still aim correctly even though they sit
      // near the top of the SVG.
      const eyes = face.querySelector('.bridge-eyes') || face;
      const r = eyes.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / Math.max(80, r.width);
      const dy = (e.clientY - cy) / Math.max(80, r.height);
      const mag = Math.min(1, Math.hypot(dx, dy) * 1.4);
      const angle = Math.atan2(dy, dx);
      const ox = Math.cos(angle) * mag * MAX_PUPIL_OFFSET;
      const oy = Math.sin(angle) * mag * MAX_PUPIL_OFFSET;
      const pupils = face.querySelector('.bridge-pupils');
      if (pupils) pupils.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
    });
  }, { passive: true });

  // ---- Mood reactions — react to user message + typing ----
  const allFaces = () => [...fab.querySelectorAll('.bridge-face'), ...panel.querySelectorAll('.bridge-face')];
  const setMood = (mood, ms = 1200) => {
    allFaces().forEach(f => {
      f.classList.remove('mood-happy', 'mood-thinking', 'mood-talking');
      if (mood) f.classList.add('mood-' + mood);
    });
    if (mood && ms) setTimeout(() => allFaces().forEach(f => f.classList.remove('mood-' + mood)), ms);
  };
  // Expose to handleSend / showTyping for reactive moments
  window.CB._chatSetMood = setMood;
};
