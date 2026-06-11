// ============================================================================
// CreatorBridge Motion System — GSAP + ScrollTrigger
//
// Design brief (June 2026): premium-subtle, cinematic and weighty, landing
// page gets the showcase, public pages get light scroll reveals, phones get
// a reduced treatment, and prefers-reduced-motion gets a static page.
//
// This module is lazy-loaded by App.jsx after first paint so it never
// blocks initial load. Call initPageMotion(pathname) on every route change;
// it cleans up after itself.
// ============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Public routes that receive motion. Dashboards, messages, checkout, and
// admin stay intentionally still — those are work surfaces, not stages.
const MOTION_ROUTES = new Set([
  '/', '/find', '/projects', '/network', '/join-as-creator',
  '/calculator', '/rate-calculator', '/terms', '/terms-of-service',
  '/creator-agreement', '/dispute-policy', '/privacy', '/search',
]);

const CINEMATIC_EASE = 'power3.out';

let activeTweens = [];
let activeTriggers = [];
let activeSplits = [];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function track(tween) {
  if (tween) activeTweens.push(tween);
  return tween;
}

export function killPageMotion() {
  activeTweens.forEach(t => t.kill());
  activeTriggers.forEach(t => t.kill());
  activeSplits.forEach(s => { try { s.revert(); } catch { /* noop */ } });
  activeTweens = [];
  activeTriggers = [];
  activeSplits = [];
  ScrollTrigger.getAll().forEach(t => t.kill());
}

// ── Generic reveal units ─────────────────────────────────────────────────
// Elements explicitly tagged `.reveal-up` (the original design's intent)
// plus auto-detected tile grids: any visible grid inside <main> gets its
// children staggered in as it scrolls into view.

function collectRevealUnits(root) {
  const units = new Set();

  root.querySelectorAll('.reveal-up').forEach(el => units.add(el));

  root.querySelectorAll('main [class*="grid-cols"]').forEach(grid => {
    // Skip grids inside fixed chrome, tiny grids, or grids already tagged.
    if (grid.closest('[data-no-reveal], header, nav, footer')) return;
    const children = [...grid.children].filter(c => c.nodeType === 1);
    if (children.length < 2 || children.length > 24) return;
    children.forEach(c => { if (!c.classList.contains('reveal-up')) units.add(c); });
  });

  return [...units].filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0; // skip display:none
  });
}

function revealOnScroll(el, { index = 0, mobile }) {
  const distance = mobile ? 18 : 34;
  const duration = mobile ? 0.6 : 1.0;
  const delay = Math.min(index * (mobile ? 0.05 : 0.09), 0.45);

  const tween = gsap.fromTo(el,
    { autoAlpha: 0, y: distance },
    {
      autoAlpha: 1, y: 0, duration, delay,
      ease: CINEMATIC_EASE,
      clearProps: 'transform',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    }
  );
  track(tween);
  if (tween.scrollTrigger) activeTriggers.push(tween.scrollTrigger);
}

function initGenericReveals(mobile) {
  const units = collectRevealUnits(document);

  // Group siblings so tiles in the same row stagger relative to each other.
  const byParent = new Map();
  units.forEach(el => {
    const key = el.parentElement || document.body;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(el);
  });

  byParent.forEach(group => {
    group.forEach((el, i) => revealOnScroll(el, { index: i, mobile }));
  });
}

// ── Landing page showcase ────────────────────────────────────────────────

function splitHeadlineLines(h1) {
  // Wrap each rendered line of the h1 in a masked span so lines can rise
  // in one after another. Handles the nested .gold-text span by working
  // with word-level wrapping first, then grouping words by line position.
  const original = h1.innerHTML;
  const wordWrap = (node, insideGold) => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'cb-w';
          w.style.display = 'inline-block';
          // Gradient-clipped text (.gold-text) does not survive being split:
          // child spans lose the background but inherit the transparent
          // fill, turning words invisible. Give gold words a solid gold
          // fill during the animation; the original markup (and its
          // animated gradient) is restored by revert() after the intro.
          if (insideGold) w.style.webkitTextFillColor = 'var(--gold, #c9a84c)';
          w.textContent = part;
          frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        wordWrap(child, insideGold || child.classList.contains('gold-text'));
      }
    });
  };
  wordWrap(h1, false);

  // Group words into visual lines by offsetTop.
  const words = [...h1.querySelectorAll('.cb-w')];
  const lines = new Map();
  words.forEach(w => {
    const top = Math.round(w.offsetTop / 8) * 8;
    if (!lines.has(top)) lines.set(top, []);
    lines.get(top).push(w);
  });

  return {
    lines: [...lines.values()],
    revert: () => { h1.innerHTML = original; },
  };
}

function initLandingShowcase(mobile) {
  const main = document.querySelector('main');
  if (!main) return;

  // 1. Signature: the headline builds the brand.
  const h1 = main.querySelector('h1');
  if (h1 && !mobile) {
    const split = splitHeadlineLines(h1);
    activeSplits.push(split);
    const tl = gsap.timeline();
    split.lines.forEach((lineWords, i) => {
      tl.fromTo(lineWords,
        { autoAlpha: 0, y: 56 },
        { autoAlpha: 1, y: 0, duration: 1.05, ease: CINEMATIC_EASE, stagger: 0.012 },
        0.15 + i * 0.16
      );
    });
    // After the intro settles, restore the original markup so the gold
    // gradient (and its slow goldShift animation) returns, then ignite.
    tl.add(() => {
      split.revert();
      const idx = activeSplits.indexOf(split);
      if (idx !== -1) activeSplits.splice(idx, 1);
      h1.querySelector('.gold-text')?.classList.add('cb-gold-ignite');
    }, '+=0.05');
    track(tl);
  } else if (h1 && mobile) {
    track(gsap.fromTo(h1, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: CINEMATIC_EASE, delay: 0.1 }));
  }

  // 2. Hero media breathes: a very slow, subtle zoom (desktop only).
  if (!mobile) {
    const heroSection = h1?.closest('section');
    heroSection?.querySelectorAll('img').forEach(img => {
      if (img.closest('[data-no-reveal]')) return;
      track(gsap.fromTo(img, { scale: 1.045 }, {
        scale: 1, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1,
      }));
    });
  }

  // 3. Parallax drift on tagged media (desktop only): images tagged by the
  // design system drift gently against the scroll for depth.
  if (!mobile) {
    main.querySelectorAll('.parallax-img').forEach(img => {
      const tween = gsap.fromTo(img, { yPercent: 4 }, {
        yPercent: -4, ease: 'none',
        scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
      });
      track(tween);
      if (tween.scrollTrigger) activeTriggers.push(tween.scrollTrigger);
    });
  }
}

// ── Entry point ──────────────────────────────────────────────────────────

export function initPageMotion(pathname) {
  killPageMotion();

  if (prefersReducedMotion()) return;
  const isCreatorProfile = pathname.startsWith('/creator/');
  if (!MOTION_ROUTES.has(pathname) && !isCreatorProfile) return;

  const mobile = isMobile();

  // Defer two frames so the route's DOM (including lazy components and
  // injected handoff HTML) is committed before we measure and animate.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (pathname === '/') initLandingShowcase(mobile);
    initGenericReveals(mobile);
    ScrollTrigger.refresh();
  }));
}
