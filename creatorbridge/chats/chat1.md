# Code Import

_Started 2026-05-19 00:04 UTC_

---

## User

I started a design with another application and do have the code to what was created. Can I upload the code here?

## User

<pasted_text name="Pasted text (1609 lines)">
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CreatorBridge — Verified Media Marketplace</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0d0d0f;
  --bg-card: rgba(20,20,24,0.55);
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(201,168,76,0.25);
  --gold: #c9a84c;
  --gold-light: #ddb96a;
  --gold-dim: rgba(201,168,76,0.08);
  --text: #f0f0f0;
  --text-secondary: #a0a0a8;
  --text-dim: #6a6a72;
}
* { margin:0; padding:0; box-sizing:border-box; }
html { scroll-behavior:smooth; }
body {
  font-family:'Inter',sans-serif;
  background:var(--bg);
  color:var(--text);
  overflow-x:hidden;
  line-height:1.6;
}
.serif { font-family:'Playfair Display',serif; }

/* ===== UNIFIED BACKGROUND ===== */
body::before {
  content:'';
  position:fixed; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(201,168,76,0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(201,168,76,0.03) 0%, transparent 50%);
}
body::after {
  content:'';
  position:fixed; inset:0; z-index:1; pointer-events:none;
  opacity:0.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ===== LIQUID GLASS ===== */
.liquid-glass {
  background:rgba(20,20,24,0.45);
  backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 4px 24px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255,255,255,0.04);
  transition:all 0.5s cubic-bezier(0.23,1,0.32,1);
}
.liquid-glass:hover {
  border-color:var(--border-hover);
  box-shadow:
    0 8px 40px rgba(0,0,0,0.4),
    0 0 30px rgba(201,168,76,0.06),
    inset 0 1px 0 rgba(255,255,255,0.06);
  transform:translateY(-4px);
}

/* ===== CURSOR (V1 Style, Never Hidden) ===== */
.cursor-ring {
  position:fixed; width:40px; height:40px;
  border:1px solid rgba(201,168,76,0.35);
  border-radius:50%; pointer-events:none;
  z-index:9999; transform:translate(-50%,-50%);
  transition:width 0.3s,height 0.3s,border-color 0.3s,background 0.3s;
  mix-blend-mode:difference;
}
.cursor-ring.hover {
  width:56px; height:56px;
  border-color:var(--gold);
  background:rgba(201,168,76,0.06);
}
.cursor-dot {
  position:fixed; width:5px; height:5px;
  background:var(--gold); border-radius:50%;
  pointer-events:none; z-index:9999;
  transform:translate(-50%,-50%);
}

/* ===== PROGRESS ===== */
.scroll-progress {
  position:fixed; top:0; left:0; height:2px;
  background:linear-gradient(90deg,var(--gold),var(--gold-light));
  z-index:10000; transform-origin:left;
  transform:scaleX(0);
}

/* ===== NAV ===== */
.nav {
  position:fixed; top:0; left:0; width:100%; z-index:50;
  padding:0.75rem 2rem;
  background:rgba(13,13,15,0.75);
  backdrop-filter:blur(24px) saturate(1.3);
  -webkit-backdrop-filter:blur(24px) saturate(1.3);
  border-bottom:1px solid var(--border);
}

/* ===== LOGO ===== */
.logo-mark {
  display:flex; align-items:center; gap:0.75rem;
}
.logo-icon {
  width:40px; height:40px; position:relative;
}
.logo-icon svg {
  width:100%; height:100%;
}

/* ===== BUTTONS ===== */
.btn-gold {
  display:inline-flex; align-items:center; gap:0.5rem;
  padding:0.65rem 1.5rem; border-radius:8px;
  background:var(--gold); color:var(--bg);
  font-weight:600; font-size:0.8rem;
  letter-spacing:0.02em; cursor:pointer; border:none;
  transition:all 0.4s cubic-bezier(0.23,1,0.32,1);
}
.btn-gold:hover {
  background:var(--gold-light);
  transform:translateY(-2px);
  box-shadow:0 8px 24px rgba(201,168,76,0.25);
}
.btn-ghost {
  display:inline-flex; align-items:center; gap:0.5rem;
  padding:0.65rem 1.5rem; border-radius:8px;
  background:transparent; color:var(--text);
  font-weight:500; font-size:0.8rem;
  letter-spacing:0.02em; cursor:pointer;
  border:1px solid var(--border);
  transition:all 0.4s cubic-bezier(0.23,1,0.32,1);
}
.btn-ghost:hover {
  border-color:var(--gold); color:var(--gold);
  background:var(--gold-dim);
}

/* ===== TAGS ===== */
.tag-gold {
  display:inline-flex; align-items:center;
  padding:0.2rem 0.6rem; border-radius:6px;
  font-size:0.65rem; font-weight:500;
  background:rgba(201,168,76,0.1);
  color:var(--gold); border:1px solid rgba(201,168,76,0.15);
}
.tag-green {
  display:inline-flex; align-items:center;
  padding:0.2rem 0.6rem; border-radius:6px;
  font-size:0.65rem; font-weight:500;
  background:rgba(34,197,94,0.08);
  color:#4ade80; border:1px solid rgba(34,197,94,0.12);
}

/* ===== PRODUCTION LANE CARD ===== */
.lane-card {
  position:relative; overflow:hidden; border-radius:12px;
  cursor:pointer; transition:all 0.5s cubic-bezier(0.23,1,0.32,1);
  border:1px solid var(--border);
}
.lane-card::before {
  content:''; position:absolute; inset:0;
  background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.4) 50%,rgba(0,0,0,0.2) 100%);
  z-index:1; transition:opacity 0.5s;
}
.lane-card::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg,rgba(201,168,76,0.1),transparent 60%);
  opacity:0; transition:opacity 0.5s; z-index:2;
}
.lane-card:hover {
  border-color:var(--border-hover);
  transform:translateY(-6px) scale(1.02);
  box-shadow:0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.08);
}
.lane-card:hover::after { opacity:1; }
.lane-card img {
  width:100%; height:100%; object-fit:cover;
  transition:transform 0.8s cubic-bezier(0.23,1,0.32,1);
}
.lane-card:hover img { transform:scale(1.1); }
.lane-content {
  position:absolute; bottom:0; left:0; right:0;
  padding:1.25rem; z-index:3;
}

/* ===== GOLD TEXT ===== */
.gold-text {
  background:linear-gradient(135deg,var(--gold) 0%,var(--gold-light) 50%,#e0c87a 100%);
  background-size:200% 200%;
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text; animation:goldShift 6s ease infinite;
}
@keyframes goldShift {
  0%,100%{background-position:0% 50%;}
  50%{background-position:100% 50%;}
}

/* ===== MARQUEE ===== */
.marquee-track {
  display:flex; animation:marqueeMove 40s linear infinite;
  width:max-content;
}
@keyframes marqueeMove {
  0%{transform:translateX(0);}
  100%{transform:translateX(-50%);}
}

/* ===== HORIZONTAL SCROLL ===== */
.h-scroll-section {
  position:relative; height:100vh; overflow:hidden;
}
.h-scroll-track {
  display:flex; gap:1.5rem; will-change:transform;
}

/* ===== PARALLAX ===== */
.parallax-wrap { overflow:hidden; position:relative; }
.parallax-img {
  will-change:transform;
  transition:transform 0.15s linear;
}

/* ===== REVEALS ===== */
.reveal-up { opacity:0; transform:translateY(40px); }
.reveal-left { opacity:0; transform:translateX(-30px); }

/* ===== LINE ===== */
.gold-line {
  width:32px; height:1px;
  background:linear-gradient(90deg,var(--gold),transparent);
}

/* ===== STATS ===== */
.stat-num { font-variant-numeric:tabular-nums; }

/* ===== SCROLLBAR ===== */
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--gold); border-radius:3px; }
::selection { background:rgba(201,168,76,0.2); color:var(--text); }

/* ===== LOADER ===== */
.loader {
  position:fixed; inset:0; z-index:99999;
  background:var(--bg); display:flex;
  flex-direction:column; align-items:center; justify-content:center;
}
.loader-bar {
  width:160px; height:1px;
  background:rgba(255,255,255,0.06);
  margin-top:1.5rem; position:relative; overflow:hidden;
}
.loader-fill {
  position:absolute; top:0; left:0; height:100%; width:0%;
  background:linear-gradient(90deg,var(--gold),var(--gold-light));
  animation:loadFill 2s cubic-bezier(0.23,1,0.32,1) forwards;
}
@keyframes loadFill { 100%{width:100%;} }

/* ===== VIDEO THUMBNAIL ===== */
.video-thumb {
  position:relative; overflow:hidden; border-radius:8px;
}
.video-thumb::after {
  content:''; position:absolute; inset:0;
  background:rgba(0,0,0,0.3);
  display:flex; align-items:center; justify-content:center;
}
.video-thumb .play-btn {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  width:40px; height:40px; border-radius:50%;
  background:rgba(201,168,76,0.9); z-index:2;
  display:flex; align-items:center; justify-content:center;
}

@media(max-width:768px){
  .cursor-ring, .cursor-dot { display:none!important; }
}
</style>
<base target="_blank">
</head>
<body>

<!-- LOADER -->
<div class="loader" id="loader">
  <div class="logo-mark">
    <div class="logo-icon">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="8" fill="url(#gold)"/>
        <path d="M8 28C8 28 12 20 20 20C28 20 32 28 32 28" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M8 28L8 32" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M32 28L32 32" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M12 20C12 20 14 14 20 14C26 14 28 20 28 20" stroke="#0d0d0f" stroke-width="2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="40" y2="40">
            <stop stop-color="#c9a84c"/><stop offset="1" stop-color="#a08030"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div>
      <div class="text-lg font-medium leading-none" style="font-family:'Playfair Display',serif;">CreatorBridge</div>
      <div class="text-[9px] tracking-[0.2em] uppercase text-[var(--text-dim)]">Verified Media Marketplace</div>
    </div>
  </div>
  <div class="loader-bar"><div class="loader-fill"></div></div>
</div>

<!-- CURSOR -->
<div class="cursor-ring" id="cursor-ring"></div>
<div class="cursor-dot" id="cursor-dot"></div>

<!-- PROGRESS -->
<div class="scroll-progress" id="progress"></div>

<!-- ===== NAV ===== -->
<nav class="nav" id="nav">
  <div class="max-w-[1400px] mx-auto flex items-center justify-between">
    <a href="#" class="logo-mark">
      <div class="logo-icon">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="url(#navGold)"/>
          <path d="M8 28C8 28 12 20 20 20C28 20 32 28 32 28" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M8 28L8 32" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M32 28L32 32" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M12 20C12 20 14 14 20 14C26 14 28 20 28 20" stroke="#0d0d0f" stroke-width="2" stroke-linecap="round"/>
          <defs>
            <linearGradient id="navGold" x1="0" y1="0" x2="40" y2="40">
              <stop stop-color="#c9a84c"/><stop offset="1" stop-color="#a08030"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="hidden sm:block">
        <div class="text-base font-medium leading-none" style="font-family:'Playfair Display',serif;">CreatorBridge</div>
        <div class="text-[8px] tracking-[0.2em] uppercase text-[var(--text-dim)]">Verified Media Marketplace</div>
      </div>
    </a>
    <div class="hidden lg:flex items-center gap-1">
      <a href="#discover" class="px-3 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-white/5">Find Creators</a>
      <a href="#projects" class="px-3 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-white/5">Projects</a>
      <a href="#network" class="px-3 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-white/5">Network</a>
      <a href="#calculator" class="px-3 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-white/5">Rate Calculator</a>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn-ghost text-xs px-4 py-2 hidden sm:flex">Join</button>
      <button class="btn-gold text-xs px-4 py-2">Sign In</button>
    </div>
  </div>
</nav>

<main style="position:relative;z-index:10;">

<!-- ===== HERO ===== -->
<section class="min-h-screen flex items-center pt-20 pb-16 px-6 lg:px-16" id="hero">
  <div class="max-w-[1400px] mx-auto w-full">
    <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <div class="space-y-6">
        <div class="flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] reveal-up">
          <span>On-Demand Media Production Hub</span>
          <span class="w-6 h-px bg-[var(--border)]"></span>
          <span class="text-[var(--gold)]">National Production Reach</span>
        </div>
        <h1 class="text-5xl sm:text-6xl lg:text-7xl xl:text-[5rem] serif font-medium leading-[0.95] tracking-tight">
          <span class="block overflow-hidden"><span class="inline-block h-line">Verified</span></span>
          <span class="block overflow-hidden"><span class="inline-block h-line">creative</span></span>
          <span class="block overflow-hidden"><span class="inline-block h-line">talent for</span></span>
          <span class="block overflow-hidden"><span class="inline-block h-line">brands that</span></span>
          <span class="block overflow-hidden"><span class="inline-block h-line gold-text">need the</span></span>
          <span class="block overflow-hidden"><span class="inline-block h-line gold-text">work done</span></span>
          <span class="block overflow-hidden"><span class="inline-block h-line gold-text">right.</span></span>
        </h1>
        <p class="text-[var(--text-secondary)] text-sm max-w-md leading-relaxed reveal-up">
          CreatorBridge helps companies source vetted video, photo, podcast, drone, event, and post-production specialists without building an internal production department.
        </p>
        <div class="flex flex-wrap gap-3 reveal-up">
          <button class="btn-gold">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Find Creators
          </button>
          <button class="btn-ghost">Join as Creator</button>
        </div>
      </div>
      <div class="relative">
        <div class="grid grid-cols-2 gap-3 reveal-up">
          <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[3/4]">
            <img src="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&q=80" alt="Camera" class="parallax-img w-full h-full object-cover scale-110">
          </div>
          <div class="space-y-3">
            <div class="parallax-wrap rounded-xl overflow-hidden aspect-video">
              <img src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&q=80" alt="Photographer" class="parallax-img w-full h-full object-cover scale-110">
            </div>
            <div class="parallax-wrap rounded-xl overflow-hidden aspect-video">
              <img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80" alt="Studio" class="parallax-img w-full h-full object-cover scale-110">
            </div>
          </div>
        </div>
        <div class="absolute -bottom-4 -left-4 liquid-glass rounded-xl p-4 float-1 reveal-up">
          <div class="text-[9px] tracking-[0.2em] uppercase text-[var(--gold)] mb-2">Marketplace Pulse</div>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-[var(--text-dim)]">Profile Gate</span><span class="serif text-[var(--gold)]">2+ yrs</span></div>
            <div class="h-px bg-[var(--border)]"></div>
            <div class="flex justify-between"><span class="text-[var(--text-dim)]">Proof Layer</span><span class="serif text-[var(--gold)]">3+</span></div>
            <div class="h-px bg-[var(--border)]"></div>
            <div class="flex justify-between"><span class="text-[var(--text-dim)]">Intro Check</span><span class="serif text-[var(--gold)]">60-90s</span></div>
          </div>
        </div>
        <div class="absolute -top-3 -right-3 liquid-glass rounded-xl p-4 float-2 reveal-up">
          <div class="text-[9px] tracking-[0.2em] uppercase text-[var(--gold)] mb-2">Production Standards</div>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between"><span class="text-[var(--text-dim)]">Review</span><span class="text-[var(--gold)]">Manual</span></div>
            <div class="flex justify-between"><span class="text-[var(--text-dim)]">Payment</span><span class="text-[var(--gold)]">50/50</span></div>
            <div class="flex justify-between"><span class="text-[var(--text-dim)]">Fee</span><span class="text-[var(--gold)]">10% to 6%</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== MARQUEE ===== -->
<section class="py-10 border-y border-[var(--border)] overflow-hidden">
  <div class="marquee-track">
    <div class="flex items-center gap-10 px-5">
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Video Production</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Photography</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Podcast Production</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Drone & Aerial</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Brand Content</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Editing & Post</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Live Events</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <!-- duplicate -->
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Video Production</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Photography</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Podcast Production</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Drone & Aerial</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Brand Content</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Editing & Post</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
      <span class="text-5xl md:text-7xl serif font-medium text-white/[0.03] whitespace-nowrap">Live Events</span>
      <span class="text-[var(--gold)]/15 text-xl">&#9670;</span>
    </div>
  </div>
</section>

<!-- ===== PRODUCTION LANES ===== -->
<section class="py-24 px-6 lg:px-16" id="discover">
  <div class="max-w-[1400px] mx-auto">
    <div class="grid lg:grid-cols-12 gap-8 mb-10 items-end">
      <div class="lg:col-span-7 reveal-up">
        <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Production Lanes</div>
        <h2 class="text-3xl md:text-4xl lg:text-5xl serif font-medium leading-tight">Production coverage without building a full in-house team.</h2>
      </div>
      <div class="lg:col-span-5 reveal-up">
        <p class="text-sm text-[var(--text-secondary)] mb-3">Choose the type of production work first, then compare creators by proof, package, availability, and fit.</p>
        <button class="btn-ghost text-xs">
          Browse All Services
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" id="lanes-grid">
      <!-- All Services -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80" alt="All Services">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Browse all</div>
          <div class="font-semibold text-sm uppercase tracking-wide">All Services</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">3 available</div>
        </div>
      </div>
      <!-- Video Production -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&q=80" alt="Video">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Brand films, commercial</div>
          <div class="font-semibold text-sm uppercase tracking-wide">Video Production</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">3 available</div>
        </div>
      </div>
      <!-- Photography -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=80" alt="Photo">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Commercial, product</div>
          <div class="font-semibold text-sm uppercase tracking-wide">Photography</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">2 available</div>
        </div>
      </div>
      <!-- Podcast -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80" alt="Podcast">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Audio, video, launch</div>
          <div class="font-semibold text-sm uppercase tracking-wide">Podcast Production</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">Curated</div>
        </div>
      </div>
      <!-- Drone -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1506947411487-a56738267384?w=400&q=80" alt="Drone">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Aerial, mapping</div>
          <div class="font-semibold text-sm uppercase tracking-wide">Drone & Aerial</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">2 available</div>
        </div>
      </div>
      <!-- Events -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80" alt="Events">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Corporate, live</div>
          <div class="font-semibold text-sm uppercase tracking-wide">Events & Corporate</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">Curated</div>
        </div>
      </div>
      <!-- Editing -->
      <div class="lane-card aspect-[3/4] reveal-up">
        <img src="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&q=80" alt="Editing">
        <div class="lane-content">
          <div class="text-[10px] uppercase tracking-wider text-white/60 mb-1">Color, motion</div>
          <div class="font-semibold text-sm uppercase tracking-wide">Editing & Post</div>
          <div class="text-[10px] text-[var(--gold)] mt-2">Curated</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== PROJECT SIGNALS + DISCOVERY ===== -->
<section class="py-24 px-6 lg:px-16" id="projects">
  <div class="max-w-[1400px] mx-auto">
    <div class="grid lg:grid-cols-12 gap-10">
      <!-- Left: Signals -->
      <div class="lg:col-span-5 space-y-5">
        <div class="reveal-up">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Project Signals</div>
          <h2 class="text-3xl md:text-4xl serif font-medium leading-tight mb-3">Guide clients toward the right production path.</h2>
          <p class="text-sm text-[var(--text-secondary)]">Clear pricing signals help brands understand what level of production they need.</p>
        </div>
        <div class="space-y-3" id="signals-list">
          <div class="liquid-glass rounded-xl p-5 flex items-center justify-between cursor-pointer reveal-up">
            <div class="flex items-center gap-4">
              <div class="parallax-wrap w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src="https://images.unsplash.com/photo-1536240478700-b869070f9279?w=200&q=80" alt="Brand film" class="parallax-img w-full h-full object-cover scale-110">
              </div>
              <div>
                <div class="font-medium text-sm">Brand film</div>
                <div class="text-xs text-[var(--text-dim)]">Corporate story, event recap</div>
              </div>
            </div>
            <div class="text-[var(--gold)] font-semibold serif text-xl">$1.5k+</div>
          </div>
          <div class="liquid-glass rounded-xl p-5 flex items-center justify-between cursor-pointer reveal-up">
            <div class="flex items-center gap-4">
              <div class="parallax-wrap w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&q=80" alt="Podcast" class="parallax-img w-full h-full object-cover scale-110">
              </div>
              <div>
                <div class="font-medium text-sm">Podcast</div>
                <div class="text-xs text-[var(--text-dim)]">Edit, launch, studio recording</div>
              </div>
            </div>
            <div class="text-[var(--gold)] font-semibold serif text-xl">$350+</div>
          </div>
          <div class="liquid-glass rounded-xl p-5 flex items-center justify-between cursor-pointer reveal-up">
            <div class="flex items-center gap-4">
              <div class="parallax-wrap w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=200&q=80" alt="Photo" class="parallax-img w-full h-full object-cover scale-110">
              </div>
              <div>
                <div class="font-medium text-sm">Commercial photo</div>
                <div class="text-xs text-[var(--text-dim)]">Product, real estate, portraits</div>
              </div>
            </div>
            <div class="text-[var(--gold)] font-semibold serif text-xl">$500+</div>
          </div>
        </div>
      </div>
      <!-- Right: Discovery -->
      <div class="lg:col-span-7">
        <div class="liquid-glass rounded-2xl p-8 h-full reveal-up">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-6">Guided Discovery</div>
          <div class="grid sm:grid-cols-3 gap-6 mb-8">
            <div class="reveal-up">
              <div class="serif text-4xl text-[var(--gold)] mb-3">01</div>
              <h3 class="font-semibold text-sm mb-2">Define the need</h3>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">Choose service type, market, budget range, and delivery expectations.</p>
            </div>
            <div class="reveal-up">
              <div class="serif text-4xl text-[var(--gold)] mb-3">02</div>
              <h3 class="font-semibold text-sm mb-2">Review curated fit</h3>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">Browse verified media specialists instead of sorting through general gig profiles.</p>
            </div>
            <div class="reveal-up">
              <div class="serif text-4xl text-[var(--gold)] mb-3">03</div>
              <h3 class="font-semibold text-sm mb-2">Book protected</h3>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">50% retainer and 50% delivery structure keeps both sides accountable.</p>
            </div>
          </div>
          <div class="h-px bg-[var(--border)] mb-6"></div>
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 reveal-up">
            <div>
              <div class="text-[var(--gold)] text-sm font-medium mb-1">Daily curated preview</div>
              <div class="text-xs text-[var(--text-secondary)]">Guests see 3 verified creators each day. Create a free account to browse full profiles.</div>
            </div>
            <button class="btn-gold text-xs shrink-0">Create Free Account</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== HORIZONTAL SHOWCASE ===== -->
<section class="h-scroll-section" id="showcase">
  <div class="h-full flex flex-col justify-center px-6 lg:px-16">
    <div class="mb-8 reveal-up">
      <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-2">Featured Work</div>
      <h2 class="text-3xl md:text-4xl serif font-medium">Recent <span class="gold-text">Productions</span></h2>
    </div>
    <div class="h-scroll-track" id="h-track">
      <div class="flex-shrink-0 w-[300px] md:w-[420px] group cursor-pointer reveal-up">
        <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] mb-3">
          <img src="https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800&q=80" alt="Film" class="parallax-img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
            <div>
              <div class="text-[var(--gold)] text-[10px] mb-1">Commercial</div>
              <div class="text-lg serif font-medium">Luxe Campaign 2024</div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-shrink-0 w-[300px] md:w-[420px] group cursor-pointer reveal-up">
        <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] mb-3">
          <img src="https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80" alt="Music" class="parallax-img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
            <div>
              <div class="text-[var(--gold)] text-[10px] mb-1">Music Video</div>
              <div class="text-lg serif font-medium">Neon Dreams EP</div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-shrink-0 w-[300px] md:w-[420px] group cursor-pointer reveal-up">
        <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] mb-3">
          <img src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80" alt="Doc" class="parallax-img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
            <div>
              <div class="text-[var(--gold)] text-[10px] mb-1">Documentary</div>
              <div class="text-lg serif font-medium">Beyond The Lens</div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-shrink-0 w-[300px] md:w-[420px] group cursor-pointer reveal-up">
        <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] mb-3">
          <img src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80" alt="Brand" class="parallax-img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
            <div>
              <div class="text-[var(--gold)] text-[10px] mb-1">Brand Film</div>
              <div class="text-lg serif font-medium">Horizon Rebrand</div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-shrink-0 w-[300px] md:w-[420px] group cursor-pointer reveal-up">
        <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] mb-3">
          <img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80" alt="Fashion" class="parallax-img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
            <div>
              <div class="text-[var(--gold)] text-[10px] mb-1">Fashion</div>
              <div class="text-lg serif font-medium">Vogue Editorial</div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-shrink-0 w-[300px] md:w-[420px] group cursor-pointer reveal-up">
        <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] mb-3">
          <img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80" alt="Podcast" class="parallax-img w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
            <div>
              <div class="text-[var(--gold)] text-[10px] mb-1">Podcast</div>
              <div class="text-lg serif font-medium">The Business Hour</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CREATOR CARDS ===== -->
<section class="py-24 px-6 lg:px-16" id="creators">
  <div class="max-w-[1400px] mx-auto">
    <div class="text-center mb-12 reveal-up">
      <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Verified Talent</div>
      <h2 class="text-3xl md:text-5xl serif font-medium mb-3">Meet the <span class="gold-text">creators</span></h2>
      <p class="text-sm text-[var(--text-secondary)] max-w-md mx-auto">Browse portfolios from verified creators across every discipline.</p>
    </div>
    <div class="grid md:grid-cols-3 gap-5" id="creator-grid">
      <!-- Aria -->
      <div class="liquid-glass rounded-2xl p-5 reveal-up group">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="parallax-wrap w-12 h-12 rounded-xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" alt="Aria" class="parallax-img w-full h-full object-cover scale-110">
            </div>
            <div>
              <div class="font-semibold text-sm">Aria Visual Studio</div>
              <div class="text-[11px] text-[var(--text-dim)]">Aria Vasquez</div>
            </div>
          </div>
          <div class="flex gap-1"><span class="tag-gold">Verified</span><span class="tag-gold">Elite</span></div>
        </div>
        <div class="flex items-center gap-3 mb-3 text-[11px] text-[var(--text-dim)]">
          <span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>Miami, FL</span>
          <span>7+ yrs</span><span class="tag-green">Available</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">Commercial and portrait photographer with a bold, editorial aesthetic. Featured in Vogue Business, Harper's Bazaar.</p>
        <!-- Video intro thumbnail -->
        <div class="parallax-wrap rounded-lg overflow-hidden aspect-video mb-4 video-thumb">
          <img src="https://images.unsplash.com/photo-1554048612-387768052bf7?w=400&q=80" alt="Portfolio" class="parallax-img w-full h-full object-cover scale-110 transition-transform duration-500 group-hover:scale-100">
          <div class="play-btn">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-4">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Commercial</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Real Estate</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Fashion</span>
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div class="flex items-center gap-1">
            <svg class="w-4 h-4 text-[var(--gold)]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <span class="font-semibold text-sm">4.9</span><span class="text-[10px] text-[var(--text-dim)]">(64)</span>
          </div>
          <button class="btn-gold text-[10px] px-3 py-1.5">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            View
          </button>
        </div>
      </div>

      <!-- SoundWave -->
      <div class="liquid-glass rounded-2xl p-5 reveal-up group">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="parallax-wrap w-12 h-12 rounded-xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" alt="Jordan" class="parallax-img w-full h-full object-cover scale-110">
            </div>
            <div>
              <div class="font-semibold text-sm">SoundWave Podcast Co.</div>
              <div class="text-[11px] text-[var(--text-dim)]">Jordan Mitchell</div>
            </div>
          </div>
          <div class="flex gap-1"><span class="tag-gold">Verified</span><span class="tag-gold">Proven</span></div>
        </div>
        <div class="flex items-center gap-3 mb-3 text-[11px] text-[var(--text-dim)]">
          <span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>New York, NY</span>
          <span>7+ yrs</span><span class="tag-green">Available</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">Full-service podcast production studio. Launched over 200 shows from scratch to top-tier productions.</p>
        <div class="parallax-wrap rounded-lg overflow-hidden aspect-video mb-4 video-thumb">
          <img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80" alt="Studio" class="parallax-img w-full h-full object-cover scale-110 transition-transform duration-500 group-hover:scale-100">
          <div class="play-btn">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-4">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Podcast</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Audio Editing</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Studio</span>
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div class="flex items-center gap-1">
            <svg class="w-4 h-4 text-[var(--gold)]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <span class="font-semibold text-sm">4.8</span><span class="text-[10px] text-[var(--text-dim)]">(53)</span>
          </div>
          <button class="btn-gold text-[10px] px-3 py-1.5">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            View
          </button>
        </div>
      </div>

      <!-- LensCraft -->
      <div class="liquid-glass rounded-2xl p-5 reveal-up group">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="parallax-wrap w-12 h-12 rounded-xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" alt="David" class="parallax-img w-full h-full object-cover scale-110">
            </div>
            <div>
              <div class="font-semibold text-sm">LensCraft Studios</div>
              <div class="text-[11px] text-[var(--text-dim)]">David Park</div>
            </div>
          </div>
          <div class="flex gap-1"><span class="tag-gold">Verified</span><span class="tag-gold">Elite</span></div>
        </div>
        <div class="flex items-center gap-3 mb-3 text-[11px] text-[var(--text-dim)]">
          <span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>Los Angeles, CA</span>
          <span>5+ yrs</span><span class="tag-green">Available</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">Cinematic video production team. Red-certified cinematographers and full post-production pipeline.</p>
        <div class="parallax-wrap rounded-lg overflow-hidden aspect-video mb-4 video-thumb">
          <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&q=80" alt="Film set" class="parallax-img w-full h-full object-cover scale-110 transition-transform duration-500 group-hover:scale-100">
          <div class="play-btn">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-4">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Brand Film</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Commercial</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Color</span>
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div class="flex items-center gap-1">
            <svg class="w-4 h-4 text-[var(--gold)]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <span class="font-semibold text-sm">5.0</span><span class="text-[10px] text-[var(--text-dim)]">(31)</span>
          </div>
          <button class="btn-gold text-[10px] px-3 py-1.5">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            View
          </button>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== FOR CREATORS ===== -->
<section class="py-24 px-6 lg:px-16" id="creators-cta">
  <div class="max-w-[1400px] mx-auto">
    <div class="liquid-glass rounded-2xl p-8 md:p-12 reveal-up">
      <div class="grid lg:grid-cols-12 gap-10 items-center">
        <div class="lg:col-span-7">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">For Working Creators</div>
          <h2 class="text-3xl md:text-4xl serif font-medium leading-tight mb-4">Bring your best work into a marketplace with standards.</h2>
          <p class="text-sm text-[var(--text-secondary)] max-w-md mb-6">List focused services, show proof of experience, and meet clients who need professional media production.</p>
          <div class="grid sm:grid-cols-3 gap-4 mb-8">
            <div class="flex items-start gap-3 reveal-up">
              <div class="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div>
                <div class="font-semibold text-sm mb-0.5">Escrow Protection</div>
                <div class="text-[11px] text-[var(--text-dim)]">Get paid before you deliver</div>
              </div>
            </div>
            <div class="flex items-start gap-3 reveal-up">
              <div class="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <div class="font-semibold text-sm mb-0.5">AI Matching</div>
                <div class="text-[11px] text-[var(--text-dim)]">Matched to fitting projects</div>
              </div>
            </div>
            <div class="flex items-start gap-3 reveal-up">
              <div class="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </div>
              <div>
                <div class="font-semibold text-sm mb-0.5">Analytics</div>
                <div class="text-[11px] text-[var(--text-dim)]">Track portfolio performance</div>
              </div>
            </div>
          </div>
          <button class="btn-gold">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            Join as Creator
          </button>
        </div>
        <div class="lg:col-span-5">
          <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] reveal-up">
            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80" alt="Creator workspace" class="parallax-img w-full h-full object-cover scale-110">
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== WHY CREATORBRIDGE ===== -->
<section class="py-24 px-6 lg:px-16" id="why">
  <div class="max-w-[1400px] mx-auto">
    <div class="grid lg:grid-cols-12 gap-10 mb-12">
      <div class="lg:col-span-5 reveal-up">
        <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Why CreatorBridge</div>
        <h2 class="text-4xl md:text-5xl lg:text-6xl serif font-medium leading-[1.05]">A production bench you can activate when the work matters.</h2>
      </div>
      <div class="lg:col-span-7 flex items-end reveal-up">
        <p class="text-sm text-[var(--text-secondary)] max-w-lg">CreatorBridge gives clients a cleaner path to vetted media specialists while giving creators a platform built around professional standards and protected payment structure.</p>
      </div>
    </div>

    <div class="grid md:grid-cols-3 gap-5 mb-10" id="why-grid">
      <div class="liquid-glass rounded-2xl p-6 reveal-up">
        <div class="gold-line mb-4"></div>
        <h3 class="font-semibold text-base mb-2">Production talent on demand</h3>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">A flexible production bench without hiring a full internal media department.</p>
      </div>
      <div class="liquid-glass rounded-2xl p-6 reveal-up">
        <div class="gold-line mb-4"></div>
        <h3 class="font-semibold text-base mb-2">Cleaner client decisions</h3>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">Compare focused creator profiles, service fit, availability, packages, and proof.</p>
      </div>
      <div class="liquid-glass rounded-2xl p-6 reveal-up">
        <div class="gold-line mb-4"></div>
        <h3 class="font-semibold text-base mb-2">Standards before booking</h3>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">Profiles are gated by experience, portfolio, verification, and platform rules.</p>
      </div>
    </div>

    <!-- Fee Comparison -->
    <div class="liquid-glass rounded-2xl p-6 md:p-8 reveal-up mb-8">
      <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-2">Fee Comparison</div>
      <h3 class="text-2xl serif font-medium mb-6">Built to cost less and feel more focused.</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[var(--border)]">
              <th class="text-left py-3 pr-4 font-normal text-[var(--text-dim)]"></th>
              <th class="text-left py-3 px-4 font-medium text-[var(--gold)] uppercase tracking-wider text-[10px]">CreatorBridge</th>
              <th class="text-left py-3 pl-4 font-normal text-[var(--text-dim)] uppercase tracking-wider text-[10px]">General Marketplaces</th>
            </tr>
          </thead>
          <tbody>
            <tr class="compare-row border-b border-[var(--border)]">
              <td class="py-3.5 pr-4 font-medium text-sm">Creator fee</td>
              <td class="py-3.5 px-4 text-[var(--gold)] font-semibold">10% to 6%</td>
              <td class="py-3.5 pl-4 text-[var(--text-dim)]">Often up to 20%</td>
            </tr>
            <tr class="compare-row border-b border-[var(--border)]">
              <td class="py-3.5 pr-4 font-medium text-sm">Client booking fee</td>
              <td class="py-3.5 px-4 text-[var(--gold)] font-semibold">5%</td>
              <td class="py-3.5 pl-4 text-[var(--text-dim)]">Often higher or unclear</td>
            </tr>
            <tr class="compare-row border-b border-[var(--border)]">
              <td class="py-3.5 pr-4 font-medium text-sm">Media-only focus</td>
              <td class="py-3.5 px-4 text-[var(--gold)] font-semibold">Yes</td>
              <td class="py-3.5 pl-4 text-[var(--text-dim)]">Usually broad categories</td>
            </tr>
            <tr class="compare-row border-b border-[var(--border)]">
              <td class="py-3.5 pr-4 font-medium text-sm">Verified standards</td>
              <td class="py-3.5 px-4 text-[var(--gold)] font-semibold">Required</td>
              <td class="py-3.5 pl-4 text-[var(--text-dim)]">Mixed or self-managed</td>
            </tr>
            <tr class="compare-row">
              <td class="py-3.5 pr-4 font-medium text-sm">Protected payments</td>
              <td class="py-3.5 px-4 text-[var(--gold)] font-semibold">50 / 50</td>
              <td class="py-3.5 pl-4 text-[var(--text-dim)]">Varies by platform</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-5">
      <div class="parallax-wrap rounded-2xl overflow-hidden aspect-[4/3] reveal-up">
        <img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80" alt="Camera lens" class="parallax-img w-full h-full object-cover scale-110">
        <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-2">Risk Control</div>
          <h3 class="text-xl serif font-medium">Stop guessing who can deliver. Start with creators built for production work.</h3>
        </div>
      </div>
      <div class="liquid-glass rounded-2xl p-8 flex flex-col justify-center reveal-up">
        <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">The Difference</div>
        <h3 class="text-2xl serif font-medium mb-4">Built around production, not general freelancing.</h3>
        <p class="text-sm text-[var(--text-secondary)] mb-6">Every feature is designed for media production: scoped briefs, package-based pricing, crew coordination, and delivery milestones.</p>
        <div class="flex flex-wrap gap-2">
          <span class="tag-gold">Scoped Briefs</span>
          <span class="tag-gold">Package Pricing</span>
          <span class="tag-gold">Crew Coordination</span>
          <span class="tag-gold">Delivery Milestones</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== PROJECT BOARD ===== -->
<section class="py-24 px-6 lg:px-16" id="board">
  <div class="max-w-[1400px] mx-auto">
    <div class="liquid-glass rounded-2xl p-8 md:p-12 mb-8 reveal-up">
      <div class="grid lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-7">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Curated Production Work</div>
          <h2 class="text-3xl md:text-4xl serif font-medium mb-4">Project Board</h2>
          <p class="text-[var(--text-secondary)] text-sm max-w-md">Post a production brief, compare fit, and keep project context organized before money moves.</p>
        </div>
        <div class="lg:col-span-5">
          <div class="parallax-wrap rounded-xl overflow-hidden aspect-video">
            <img src="https://images.unsplash.com/photo-1542744173-8e7e53413aef?w=800&q=80" alt="Brief" class="parallax-img w-full h-full object-cover scale-110">
            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Production Brief</div>
              <div class="text-sm font-medium">Scope the work before creators apply.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-6 reveal-up">
      <button class="btn-gold text-xs">Browse (4)</button>
      <div class="liquid-glass px-4 py-2 flex items-center gap-2 text-xs text-[var(--text-dim)] flex-1 max-w-md">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        Search projects...
      </div>
      <button class="liquid-glass px-4 py-2 text-xs text-[var(--text-dim)]">All services <svg class="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>
      <button class="liquid-glass px-4 py-2 text-xs text-[var(--text-dim)]">Any budget <svg class="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>
    </div>

    <div class="grid md:grid-cols-2 gap-4" id="project-grid">
      <div class="liquid-glass rounded-xl p-6 reveal-up cursor-pointer">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
              <svg class="w-5 h-5 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
            </div>
            <div>
              <div class="font-semibold text-sm">Product Photography for E-Commerce Launch</div>
              <div class="text-[11px] text-[var(--text-dim)]">by BeautyBrand Co · May 6</div>
            </div>
          </div>
          <span class="tag-green text-[10px]">Open</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">We're launching a new skincare line and need a professional photographer to shoot 30+ products with clean white backgrounds and lifestyle shots.</p>
        <div class="flex items-center gap-3 text-[11px] text-[var(--text-dim)] mb-3">
          <span class="text-[var(--gold)] font-semibold">$800 – $1,500</span>
          <span>Apr 30</span>
          <span>New York, NY</span>
          <span>3 applied</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">product photography</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Adobe Lightroom</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">white background</span>
        </div>
      </div>

      <div class="liquid-glass rounded-xl p-6 reveal-up cursor-pointer">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
              <svg class="w-5 h-5 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </div>
            <div>
              <div class="font-semibold text-sm">YouTube Channel Intro Video (30 sec)</div>
              <div class="text-[11px] text-[var(--text-dim)]">by TechReviewPro · May 7</div>
            </div>
          </div>
          <span class="tag-green text-[10px]">Open</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">Looking for a motion graphics designer to create a punchy 30-second intro animation for a tech review YouTube channel.</p>
        <div class="flex items-center gap-3 text-[11px] text-[var(--text-dim)] mb-3">
          <span class="text-[var(--gold)] font-semibold">$300 – $600</span>
          <span>Apr 19</span>
          <span>Remote OK</span>
          <span>7 applied</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">After Effects</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">motion graphics</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">logo animation</span>
        </div>
      </div>

      <div class="liquid-glass rounded-xl p-6 reveal-up cursor-pointer">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
              <svg class="w-5 h-5 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>
            </div>
            <div>
              <div class="font-semibold text-sm">Brand Content Package - Real Estate</div>
              <div class="text-[11px] text-[var(--text-dim)]">by LuxRealty Group · May 3</div>
            </div>
          </div>
          <span class="tag-green text-[10px]">Open</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">Boutique real estate agency needs a monthly brand content package: 12 Instagram posts, 4 Reels, and 8 Stories per month.</p>
        <div class="flex items-center gap-3 text-[11px] text-[var(--text-dim)] mb-3">
          <span class="text-[var(--gold)] font-semibold">$1,200 – $2,500</span>
          <span>Los Angeles, CA</span>
          <span>Remote OK</span>
          <span>12 applied</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Instagram</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Canva</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">real estate</span>
        </div>
      </div>

      <div class="liquid-glass rounded-xl p-6 reveal-up cursor-pointer">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
              <svg class="w-5 h-5 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            </div>
            <div>
              <div class="font-semibold text-sm">Podcast Production & Editing (Weekly)</div>
              <div class="text-[11px] text-[var(--text-dim)]">by The Business Pod · May 5</div>
            </div>
          </div>
          <span class="tag-green text-[10px]">Open</span>
        </div>
        <p class="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">Established weekly business podcast (200+ episodes) seeking reliable audio editor. ~45 min raw audio per week. Long-term preferred.</p>
        <div class="flex items-center gap-3 text-[11px] text-[var(--text-dim)] mb-3">
          <span class="text-[var(--gold)] font-semibold">$150 – $300</span>
          <span>Remote OK</span>
          <span>5 applied</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Adobe Audition</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">podcast editing</span>
          <span class="px-2 py-0.5 rounded bg-white/[0.03] text-[10px] text-[var(--text-dim)]">Descript</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CREATOR NETWORK ===== -->
<section class="py-24 px-6 lg:px-16" id="network">
  <div class="max-w-[1400px] mx-auto">
    <div class="liquid-glass rounded-2xl p-8 md:p-12 mb-8 reveal-up">
      <div class="grid lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-7">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">State Creator Network</div>
          <h2 class="text-3xl md:text-4xl serif font-medium mb-4">Creator Network</h2>
          <p class="text-[var(--text-secondary)] text-sm max-w-md mb-6">Connect with verified media professionals in your area while keeping referrals, production questions, and peer conversations inside CreatorBridge.</p>
          <div class="grid sm:grid-cols-3 gap-3">
            <div class="liquid-glass rounded-xl p-4 reveal-up">
              <div class="font-semibold text-sm mb-1">Verified circles</div>
              <div class="text-[11px] text-[var(--text-dim)]">Creators and clients stay tied to real accounts.</div>
            </div>
            <div class="liquid-glass rounded-xl p-4 reveal-up">
              <div class="font-semibold text-sm mb-1">State context</div>
              <div class="text-[11px] text-[var(--text-dim)]">Local production needs stay easier to scan.</div>
            </div>
            <div class="liquid-glass rounded-xl p-4 reveal-up">
              <div class="font-semibold text-sm mb-1">No poaching</div>
              <div class="text-[11px] text-[var(--text-dim)]">Contact and job-board abuse are filtered.</div>
            </div>
          </div>
        </div>
        <div class="lg:col-span-5">
          <div class="parallax-wrap rounded-xl overflow-hidden aspect-video">
            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80" alt="Network" class="parallax-img w-full h-full object-cover scale-110">
            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Local Production Layer</div>
              <div class="text-sm font-medium">Build trusted media relationships before the next shoot needs a crew.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="liquid-glass rounded-2xl p-6 reveal-up">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Choose a State Network</div>
          <div class="text-sm text-[var(--text-secondary)]">Posts and live chat are organized by state.</div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-[var(--text-dim)]">Most active:</span>
          <span class="tag-gold text-[10px] cursor-pointer">AZ (2)</span>
          <span class="tag-gold text-[10px] cursor-pointer">CA (1)</span>
          <span class="tag-gold text-[10px] cursor-pointer">TX (1)</span>
          <span class="tag-gold text-[10px] cursor-pointer">NY (1)</span>
          <span class="tag-gold text-[10px] cursor-pointer">FL</span>
        </div>
      </div>
      <div class="liquid-glass rounded-xl p-12 text-center">
        <svg class="w-8 h-8 text-[var(--gold)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <h3 class="text-lg font-semibold mb-2">Select a state to get started</h3>
        <p class="text-sm text-[var(--text-secondary)]">Browse posts and join live chat from creators in your area.</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== RATE CALCULATOR ===== -->
<section class="py-24 px-6 lg:px-16" id="calculator">
  <div class="max-w-[1400px] mx-auto">
    <div class="liquid-glass rounded-2xl p-8 md:p-12 mb-8 reveal-up">
      <div class="grid lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-7">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Creator Pricing Tool</div>
          <h2 class="text-3xl md:text-4xl serif font-medium mb-4">Build rates with professional confidence.</h2>
          <p class="text-[var(--text-secondary)] text-sm max-w-md mb-6">Use this creator-side tool to calculate service pricing, quote structure, costs, margin, and package fit before sending work to a client.</p>
          <div class="liquid-glass rounded-xl p-4 border-l-2 border-[var(--gold)] reveal-up">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-[var(--gold)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <div class="text-sm text-[var(--text-secondary)]">This calculator is for creator pricing strategy, not the public client booking flow.</div>
            </div>
          </div>
        </div>
        <div class="lg:col-span-5">
          <div class="parallax-wrap rounded-xl overflow-hidden aspect-video">
            <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80" alt="Calculator" class="parallax-img w-full h-full object-cover scale-110">
            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Quote Discipline</div>
              <div class="text-sm font-medium">Build packages around the work, not guesses.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid lg:grid-cols-12 gap-6">
      <div class="lg:col-span-8 space-y-6">
        <div class="liquid-glass rounded-2xl p-6 reveal-up">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] mb-4">Your Market</div>
          <div class="flex items-center gap-4">
            <div class="flex-1 liquid-glass rounded-xl p-4 flex items-center gap-3 cursor-pointer">
              <svg class="w-5 h-5 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span class="text-[var(--text-dim)] text-sm">Select city...</span>
              <svg class="w-4 h-4 text-[var(--text-dim)] ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div class="flex gap-2">
              <button class="liquid-glass rounded-lg px-4 py-3 text-xs text-[var(--text-dim)]">2-3 yrs</button>
              <button class="liquid-glass rounded-lg px-4 py-3 text-xs bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20">4-6 yrs</button>
              <button class="liquid-glass rounded-lg px-4 py-3 text-xs text-[var(--text-dim)]">7+ yrs</button>
            </div>
          </div>
        </div>

        <div class="liquid-glass rounded-2xl p-6 reveal-up">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] mb-4">Service Type</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <div class="text-sm font-medium">Video Production</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
              <div class="text-sm font-medium">Photography</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              <div class="text-sm font-medium">Drone / Aerial</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>
              <div class="text-sm font-medium">Brand Content</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              <div class="text-sm font-medium">Editing & Post</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <div class="text-sm font-medium">Live Events</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <div class="text-sm font-medium">Corporate</div>
            </button>
            <button class="liquid-glass rounded-xl p-4 text-left hover:border-[var(--border-hover)] transition-all">
              <svg class="w-5 h-5 text-[var(--gold)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              <div class="text-sm font-medium">Podcast</div>
            </button>
          </div>
        </div>
      </div>

      <div class="lg:col-span-4 space-y-6">
        <div class="liquid-glass rounded-2xl p-6 reveal-up">
          <div class="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Pricing Guardrails</div>
          <h3 class="text-lg serif font-medium mb-4">Keep the quote tied to real production work.</h3>
          <div class="space-y-3">
            <div class="liquid-glass rounded-xl p-4">
              <div class="font-semibold text-sm mb-1">Scope first</div>
              <div class="text-xs text-[var(--text-secondary)]">Define shoot, edit, delivery, and revision needs before pricing.</div>
            </div>
            <div class="liquid-glass rounded-xl p-4">
              <div class="font-semibold text-sm mb-1">Cost visibility</div>
              <div class="text-xs text-[var(--text-secondary)]">Track crew, rental, travel, and post-production costs before margin.</div>
            </div>
            <div class="liquid-glass rounded-xl p-4">
              <div class="font-semibold text-sm mb-1">Package fit</div>
              <div class="text-xs text-[var(--text-secondary)]">Compare basic, standard, and premium lanes without guessing.</div>
            </div>
          </div>
        </div>

        <div class="liquid-glass rounded-2xl p-6 reveal-up text-center">
          <div class="w-12 h-12 rounded-full bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="text-sm text-[var(--text-secondary)]">Enable line items in the builder to see your quote come together with real numbers.</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== STATS ===== -->
<section class="py-24 px-6 lg:px-16">
  <div class="max-w-[1400px] mx-auto">
    <div class="grid md:grid-cols-3 gap-8" id="stats-grid">
      <div class="text-center reveal-up">
        <div class="text-5xl md:text-6xl lg:text-7xl serif font-medium gold-text stat-num mb-3" data-target="12400">0</div>
        <div class="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Verified Creators</div>
      </div>
      <div class="text-center reveal-up">
        <div class="text-5xl md:text-6xl lg:text-7xl serif font-medium gold-text stat-num mb-3" data-target="8500">0</div>
        <div class="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Projects Delivered</div>
      </div>
      <div class="text-center reveal-up">
        <div class="text-5xl md:text-6xl lg:text-7xl serif font-medium gold-text stat-num mb-3" data-target="98">0</div>
        <div class="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Satisfaction Rate %</div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CTA ===== -->
<section class="py-32 px-6 lg:px-16 relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/5 via-transparent to-[var(--gold)]/5"></div>
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-3xl"></div>
  <div class="max-w-3xl mx-auto text-center relative z-10 reveal-up">
    <h2 class="text-4xl md:text-6xl serif font-medium mb-6 leading-tight">Ready to produce<br><span class="gold-text">something extraordinary?</span></h2>
    <p class="text-[var(--text-secondary)] text-base mb-10 max-w-lg mx-auto">Join thousands of creators and brands already building the future of media production.</p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <button class="btn-gold text-base px-8 py-3">Get Started Free</button>
      <button class="btn-ghost text-base px-8 py-3">Talk to Sales</button>
    </div>
  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="py-16 px-6 lg:px-16 border-t border-[var(--border)]">
  <div class="max-w-[1400px] mx-auto">
    <div class="grid md:grid-cols-4 gap-12 mb-12">
      <div class="md:col-span-2">
        <a href="#" class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 relative">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="url(#footGold)"/>
              <path d="M8 28C8 28 12 20 20 20C28 20 32 28 32 28" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M8 28L8 32" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M32 28L32 32" stroke="#0d0d0f" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M12 20C12 20 14 14 20 14C26 14 28 20 28 20" stroke="#0d0d0f" stroke-width="2" stroke-linecap="round"/>
              <defs><linearGradient id="footGold" x1="0" y1="0" x2="40" y2="40"><stop stop-color="#c9a84c"/><stop offset="1" stop-color="#a08030"/></linearGradient></defs>
            </svg>
          </div>
          <div class="text-lg serif font-medium">CreatorBridge</div>
        </a>
        <p class="text-xs text-[var(--text-secondary)] max-w-sm mb-6 leading-relaxed">The premium marketplace connecting visionary brands with exceptional creative talent. From concept to final cut.</p>
        <div class="flex gap-2">
          <a href="#" class="w-9 h-9 rounded-lg liquid-glass flex items-center justify-center">
            <svg class="w-4 h-4 text-[var(--text-dim)]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
          </a>
          <a href="#" class="w-9 h-9 rounded-lg liquid-glass flex items-center justify-center">
            <svg class="w-4 h-4 text-[var(--text-dim)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-2.861c0-1.881-2.002-1.722-2.002 0v2.861h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z"/></svg>
          </a>
          <a href="#" class="w-9 h-9 rounded-lg liquid-glass flex items-center justify-center">
            <svg class="w-4 h-4 text-[var(--text-dim)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
        </div>
      </div>
      <div>
        <h4 class="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-4">Platform</h4>
        <ul class="space-y-2.5">
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">How it Works</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Find Creators</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Project Board</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Rate Calculator</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Creator Network</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-4">Company</h4>
        <ul class="space-y-2.5">
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">About</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Blog</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Careers</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Terms of Service</a></li>
          <li><a href="#" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Privacy</a></li>
        </ul>
      </div>
    </div>
    <div class="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="text-[10px] text-[var(--text-dim)]">CreatorBridge — connecting content creators with brands and clients seeking media production and digital content services</div>
      <div class="flex gap-6 text-[10px] text-[var(--text-dim)]">
        <a href="#" class="hover:text-[var(--text)] transition-colors">Terms of Service</a>
        <a href="#" class="hover:text-[var(--text)] transition-colors">Privacy</a>
        <a href="#" class="hover:text-[var(--text)] transition-colors">Support</a>
      </div>
    </div>
  </div>
</footer>

<script>
// ===== LOADER =====
window.addEventListener('load', () => {
  setTimeout(() => {
    gsap.to('#loader', {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => {
        document.getElementById('loader').style.display = 'none';
        initAnimations();
      }
    });
  }, 2200);
});

// ===== CURSOR (V1 Style - Never Hidden) =====
const cursorRing = document.getElementById('cursor-ring');
const cursorDot = document.getElementById('cursor-dot');
let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

if (window.innerWidth > 768) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';
  });

  function animateCursor() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    cursorRing.style.left = ringX + 'px';
    cursorRing.style.top = ringY + 'px';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Hover on interactive elements
  const interactives = document.querySelectorAll('a, button, .liquid-glass, .lane-card, .parallax-wrap');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
  });
}

// ===== SCROLL PROGRESS =====
const scrollProgress = document.getElementById('progress');
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress.style.transform = `scaleX(${scrollTop / docHeight})`;
});

// ===== NAV SCROLL =====
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.style.background = window.scrollY > 80 
    ? 'rgba(13,13,15,0.92)' 
    : 'rgba(13,13,15,0.75)';
});

// ===== GSAP ANIMATIONS =====
function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  // Hero line reveals
  gsap.from('.h-line', {
    y: '110%',
    opacity: 0,
    duration: 1.2,
    stagger: 0.08,
    ease: 'power4.out',
    delay: 0.2
  });

  // General reveals
  gsap.utils.toArray('.reveal-up').forEach((el, i) => {
    if (el.closest('#hero')) return;
    gsap.to(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none'
      },
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      delay: (i % 4) * 0.06
    });
  });

  // Stagger grids
  const grids = ['#lanes-grid', '#signals-list', '#creator-grid', '#why-grid', '#project-grid', '#stats-grid'];
  grids.forEach(id => {
    const g = document.querySelector(id);
    if (g) {
      gsap.to(g.children, {
        scrollTrigger: { trigger: g, start: 'top 82%' },
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out'
      });
    }
  });

  // Parallax images
  gsap.utils.toArray('.parallax-img').forEach(img => {
    const wrap = img.closest('.parallax-wrap');
    if (!wrap) return;
    gsap.to(img, {
      scrollTrigger: {
        trigger: wrap,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5
      },
      y: '-15%',
      ease: 'none'
    });
  });

  // Horizontal scroll
  const hSection = document.querySelector('.h-scroll-section');
  const hTrack = document.getElementById('h-track');
  if (hSection && hTrack) {
    const scrollWidth = hTrack.scrollWidth - window.innerWidth + 100;
    gsap.to(hTrack, {
      x: -scrollWidth,
      ease: 'none',
      scrollTrigger: {
        trigger: hSection,
        start: 'top top',
        end: () => `+=${scrollWidth}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1
      }
    });
  }

  // Stat counters
  gsap.utils.toArray('.stat-num').forEach(stat => {
    const target = parseInt(stat.dataset.target);
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 2.5,
      ease: 'power2.out',
      scrollTrigger: { trigger: stat, start: 'top 85%' },
      onUpdate: () => {
        const v = Math.round(obj.val);
        stat.innerText = target === 98 ? v + '%' : v.toLocaleString();
      }
    });
  });

  // Magnetic buttons
  document.querySelectorAll('.btn-gold, .btn-ghost').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0,0)';
    });
  });
}

// Smooth anchor scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  });
});
</script>
</body>
</html>
</pasted_text>

## User



## Assistant

Got the code — solid foundation. Quick read on what you've built:

**Aesthetic:** Dark luxury (`#0d0d0f` bg + `#c9a84c` gold), Playfair Display serif + Inter, liquid-glass cards with backdrop blur, custom cursor, GSAP scroll + parallax animations.

**Sections:** Hero → Marquee → Production Lanes → Project Signals/Discovery → Horizontal Showcase → Creator Cards → Creators CTA → Why CreatorBridge (+ fee comparison) → Project Board → State Creator Network → Rate Calculator → Stats → CTA → Footer.

**Positioning:** Verified, media-only marketplace with 50/50 escrow, 6–10% creator fee, state-based networks.

Before I start designing, what would you like to do next? A few common directions:

1. **Build out a new screen** the marketing page hints at but doesn't show — e.g. the actual creator profile, the rate calculator interactive flow, the project board detail/apply flow, the state network chat, the booking/escrow checkout, an onboarding flow.
2. **Iterate on the landing page** — refine sections, try alternate hero/visual treatments, swap out the liquid-glass aesthetic, etc.
3. **Build the authenticated dashboard** — what creators or clients see after sign-in (project pipeline, messages, deliverables, payouts).
4. **A specific feature flow as an interactive prototype** — e.g. "client posts a brief → reviews 3 verified creators → books with 50% retainer."
5. **Something else** — tell me what's on your mind.

If you have screenshots, Figma links, or other files from the original codebase (especially anything beyond this landing page — components, theme tokens, other screens), drop those in too and I'll match the visual language exactly.

What are we building?

## User

Can you start a design from the code that was provided? If so, let's start building it from there.

## Assistant

_[tool: write_file]_

Absolutely — let me save your code as the base file first, then I want to ask a few focused questions so we head in the right direction. Your landing page is already complete, so "starting from the code" most likely means building the *next* surface (a real screen behind the marketing) using its visual language. Let me confirm.

_[tool: write_file]_

Hold on — I overwrote the file with a placeholder instead of preserving your actual code. Fixing that now, then asking a few questions.

_[tool: write_file]_

Restoring your actual landing page first — I'll keep that as the canonical reference file.

_[tool: questions_v2]_

I keep tripping over the file write — let me stop iterating on the landing file (your full original is preserved in chat) and just ask what's next. The landing page is complete; "start designing from the code" tells me you want to extend it. I need to know what to extend it into.

## User

Questions timed out; go with defaults

## Assistant

_[tool: update_todos]_

Going with defaults: **Creator Profile page**, fully interactive, desktop primary, balanced novelty. This is the highest-leverage next screen — your landing page sells the marketplace, but the creator profile is where booking decisions actually happen. I'll feature Aria Vasquez (already named on the landing) so it ties back.

Plan:
- Hero (avatar + name + tier badges + featured reel)
- Stats strip (rating · completed · on-time · repeat clients)
- About + specialties
- Filterable portfolio grid (interactive)
- 3 packages with 50/50 escrow split (selectable, drives sticky booking panel)
- Reviews
- Inline booking sheet (opens when "Book" clicked)
- Tweaks: density · hero layout · package style · accent intensity

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

Now writing the main profile JSX and HTML.

_[tool: update_todos]_

_[tool: done]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Built `Creator Profile.html` carrying the landing page's full visual language (dark + gold, liquid glass, Playfair + Inter).

**What's in it:**
- Hero with avatar, tier chips, italic tagline, verification ledger, featured reel (click to expand)
- Stats strip (4.9 ★ · 142 projects · 96% on-time · 48% repeat)
- About + 4-step process card
- Filterable portfolio grid (5 categories, click-to-lightbox)
- 3 packages (Essential $850 / Signature $1,950 / Editorial $4,500) — selectable, drives the sticky book bar
- Reviews (Soho House, Aritzia, Equinox, The Standard)
- Sticky bottom book bar appears on scroll
- **Booking sheet** opens as a right-side slide-in: date · location · brief · live 50/50 escrow split with 5% client fee math · success state

**Tweaks:** Density (compact/regular/comfy), Hero (split/banner), Packages (cards/table), Accent (subtle/bold).

Next obvious surfaces if you want to keep going: the **booking confirmation/escrow checkout** as its own flow, the **creator-side inbox** (what Aria sees when a brief lands), or the **project workspace** (the active production after booking).

## User

I need you to look at the actual page here https://www.creatorbridge.studio  let's utilize your design with the current page design go through each page if you can, and redesign each page replace the images with your images. Keep the animations and keep every page unified with the same author

## Assistant

_[tool: update_todos]_

Let me look at the live site first to map out which pages exist.

_[tool: web_fetch]_

_[tool: web_fetch]_

I can't scrape the SPA pages directly, but I have enough from your pasted source to map the full IA — the landing's nav and footer reveal: **Find Creators · Project Board · Creator Network · Rate Calculator · How It Works** (plus the Creator Profile I just built). Let me build them all out as a unified multi-page experience, sharing the design language.

**Plan:**

1. **Shared `styles.css`** — design tokens + components so every page is unified
2. **Shared `core.js`** — cursor, scroll progress, nav, reveals, parallax
3. **5 pages, fully designed:**
   - `Landing.html` (restored full version)
   - `Find Creators.html` (search + filters + result grid)
   - `Project Board.html` (brief list + detail panel)
   - `Rate Calculator.html` (interactive working calculator)
   - `Creator Network.html` (state picker + feed/chat)
   - `Creator Profile.html` (already built — re-linked)
4. Unified nav links between all pages
5. My Unsplash image set used consistently across

Let me reset the todo list and start.

_[tool: snip]_

_[tool: write_file]_

## Assistant

_[tool: write_file]_

_[tool: write_file]_

_[tool: update_todos]_

_[tool: write_file]_

_[tool: delete_file]_

_[tool: write_file]_

_[tool: update_todos]_

_[tool: write_file]_

_[tool: update_todos]_

_[tool: write_file]_

_[tool: update_todos]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: update_todos]_

_[tool: show_html]_

_[tool: done]_

_[tool: grep]_

_[tool: run_script]_

_[tool: done]_

_[tool: done]_

_[tool: done]_

_[tool: done]_

_[tool: done]_

_[tool: done]_

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Built the unified multi-page site. Six pages, one design system, fully cross-linked.

**Pages (all in the project, navigate from the top nav):**
- **Landing.html** — restored hero, marquee, production lanes, signals, featured work, fee comparison, stats, CTA
- **Find Creators.html** — searchable grid with live filters (lane / tier / budget / availability), 10 verified creators, sortable
- **Project Board.html** — master-detail brief list with inline detail panel, "Post a brief" modal, 8 open briefs
- **Rate Calculator.html** — fully interactive: lane × market × experience × scope sliders → live quote with margin, 50/50 escrow split, recommended package fit
- **Creator Network.html** — 24-state grid (active networks pulse green), state-scoped feed (referrals / gear / collabs / leads) + live channel chat
- **Creator Profile.html** — Aria Visual Studio sample profile with packages, portfolio, reviews, booking sheet (carries Tweaks)

**Unified via:**
- `styles.css` — design tokens, components, liquid glass, buttons, tags, lane cards
- `core.js` — custom cursor, scroll progress, GSAP reveals + parallax, magnetic buttons, shared nav + footer mounted on every page

All animations preserved (cursor ring, scroll progress, marquee, parallax images, reveal-on-scroll, magnetic buttons, gold gradient text). Image set is consistent across pages.

Next obvious extensions: authenticated dashboards (creator inbox + client project pipeline), active project workspace (post-booking), creator onboarding flow.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed — swapped the reveal-on-scroll animation from GSAP/ScrollTrigger to IntersectionObserver, which fires reliably for elements already in the viewport at page load. The 4-element stagger is preserved. Parallax + magnetic buttons stay on GSAP. Verifier is double-checking.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Switched to a fail-open pattern: content is visible by default in CSS; JS adds a `.js-hidden` class on load, then the IntersectionObserver strips it as elements come into view. A 1.5-second safety net force-removes the class no matter what, so the page can never get stuck blank.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

Verifier confirmed reveals are working. All six pages are clean and unified — ready for review.

## User

lets use this logo. part of the txt is cutoff also part of the txt you can't really see much. the background is kinda boring we need to add animations in the background like the original site. make the animations stronger over the mouse also there was a unique way of scrolling

## Assistant

_[tool: snip]_

_[tool: copy_files]_

_[tool: image_metadata]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Logo + animations layered in. Here's what changed:

**Logo** — Your CB monogram (`logo.png`) now renders in the nav and footer on every page, replacing the placeholder SVG. The subtitle is already in the image so it's not duplicated.

**Background animations** (always-on, every page):
- Animated gold grid that slowly drifts diagonally, faded via radial mask
- Three large blurred gold orbs that float in slow ease-in-out loops
- Subtle gold haze gradient that *tracks the mouse position* — the area near your cursor brightens with a soft gold glow

**Mouse interactions** (stronger):
- Cursor ring grew to 72px on hover (was 56px) with a gold halo glow
- Cursor dot has its own soft drop-shadow
- Dedicated mouse-glow spotlight follows the cursor with eased motion (Screen blend, soft golden light)

**Smooth scrolling** — Lenis is now loaded and running globally. Easing curve gives you the smooth, weighted feel of the original site instead of the browser's default snap.

**Hero text** — Removed the forced one-word-per-line breaks. Now wraps naturally with `text-wrap: balance` so the H1 reads cleanly without any clipping.

Verifier is double-checking.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed — the cursor + mouse-glow init now runs from inside `mountChrome` after the elements exist, instead of trying to find them at script load (when they didn't exist yet). Verifier double-checking.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

All confirmed working — cursor + mouse-glow track properly, logo renders, hero is clean, smooth scrolling is active. Ready for review.

## User

on the home page this floating transparent Text is hard to see it's too transparent and it is blending in the background. I do like this floating effect as well. I think we should try the same effect with the protection line and services have them float the same but stay in that order or maybe do the same with recent production from the network, have them float the same. The number Text over here is normally animated and part of it is cut off when the page is loading that text quickly counts from zero to the max number so lets make these adjustments.

## Assistant

_[tool: snip]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Done — three fixes landed:

**Floating hero cards** — switched both "Marketplace Pulse" and "Production Standards" to a new `.float-card` style: 82% opaque dark background with stronger blur, gold-tinted border, and a layered shadow. Label text is now full `--text` (not dim) so it reads cleanly over any image behind. The bob animation is preserved.

**Bobbing applied to grids** — both **Production Lanes** (7 services) and **Recent Productions** (6 work tiles) now subtly float. They're staggered into 4 different bob rhythms (~6.5–8s loops, varied offsets) so the grid breathes instead of all moving in lockstep. Hover pauses the bob so the lift transform stays clean.

**Stat numbers** — restored the count-up animation. They start at 0 and animate up to 12,400 / 8,500 / 98% with an ease-out cubic when scrolled into view (~2.2s), triggered by IntersectionObserver. Added safe vertical padding + `line-height: 1.05` so the gold-gradient descenders never get clipped.

Verifier double-checking.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

All confirmed. Floating cards readable, bob applied to lanes + productions, stat counters animating cleanly. Ready for the next round of changes whenever you are.

## User

This scrolling area is cool, but it feels empty. We need to put something there instead of just production lineup. I don't know what category to move there to make things a little better. I don't like that scrolling. It is very cool but we need something more to make the site balance. any suggestions?

## Assistant

_[tool: snip]_

Yeah — that band is just decorative text right now. Same scroll motion can carry something with substance. Here's how I'd think about it:

**Option A — Trusted by (client logos row)**
Replace the service names with brands that have hired through CreatorBridge: *Soho House · Aritzia · Equinox · The Standard · Hypebeast · Vogue Business · Tribeca · Aesop*. Classic social proof, premium feel, lets the gold-on-black scrolling become the "as featured in" moment. Strongest signal.

**Option B — Live activity ticker**
Network-pulse content scrolling past, with small status dots: *"Aria booked a 2-day hotel campaign · Miami" · "Jordan delivered 4 podcast eps · NYC" · "New verified: Mateo R. · Austin" · "$1.2k retainer released · Soho House Miami"*. Makes the marketplace feel alive. Pair with a green pulse dot and an eyebrow that says **Live network**.

**Option C — Two stacked rows, opposite directions**
Keep service names on top (slow, leftward), add a second row underneath flowing the opposite way (faster, rightward) with **client logos** OR **a live ticker**. This is what most premium marketplace sites do — adds density without losing the effect you like.

**Option D — Service names + interspersed work thumbnails**
"Video Production · [📷 thumbnail of a real shoot] · Photography · [📷 portrait] · Drone · [📷 aerial]..." Mixes type and imagery in one row. Visually richer than text alone.

**My recommendation: C with rows A + B.** Top row = client/brand logos (anchors trust). Bottom row = live activity ticker (anchors energy). The two rows scrolling in opposite directions give the section the visual weight it's missing and reinforce the two strongest things about the platform — *who books here* and *what's happening right now*.

Want me to build C? Or one of the other options?

## User

I'm gonna leave that up to you. Let's see what we got so far I like the entire design. We just need to do something with that part that is scrolling. I mentioned let's see where you got make it work.

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Built option C — replaced the empty service-name scroller with **two stacked rows**:

**Top row · Trusted by** (scrolls left) — Premium serif brand names that have hired through CreatorBridge: *Soho House · Aritzia · Equinox · The Standard · Hypebeast · Vogue Business · Tribeca · Aesop · Harper's Bazaar · Verge · LuxRealty · Saigon Sky*. Each plate is hover-lit gold, separated by thin dividers.

**Bottom row · Live network** (scrolls right, opposite direction) — Real-time activity pills, each with a pulsing dot (green = creator activity, gold = money moves): *"Aria V. booked a 2-day hotel campaign · Miami"*, *"$3,400 released to LensCraft Studios"*, *"New verified creator: Mateo R."*, *"5★ review for SoundWave Podcast"*, etc.

Both rows fade out at the edges so they dissolve into the background, and the eyebrow labels above tell users what each row is. The opposite scroll directions give the section visual weight and rhythm — the band now reinforces the two strongest things about the platform: **who books here** and **what's happening right now**.

Verifier confirming.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

Confirmed clean. Ready for the next round.

## User

do you think we should put that in the bottom of the page then instead of right in the middle or maybe the top of the page.?

## Assistant

_[tool: snip]_

Short answer: **keep it where it is** (right after the hero) — but there's a case for splitting it.

Here's how I think about each placement:

**Right after hero (current)** — Best for the *brand logo row*. "Trusted by" landing immediately under the headline is the strongest trust pattern on the web. It converts hero claims into credibility before the user scrolls into services. Moving this lower buries it.

**Top of page** — No. Pushes the hero down, weakens the first impression. Landing pages should always lead with the brand promise, not social proof.

**Bottom of page** — Works well for the *live activity ticker*. A "Live network · pulse" band right above the footer feels like a heartbeat — last thing you see before you leave is "stuff is happening here right now."

**My recommendation:** split the two rows.
- **Brand logos** stay where they are (under hero) — pure social proof, where it earns the most.
- **Live ticker** moves to a slim band just above the footer — becomes the site's "vital signs" footer rhythm.

That way each row does one job in the place where it works hardest, instead of both rows competing in one band.

Want me to make that split?

## User

yes

## Assistant

_[tool: snip]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Split is in place:

- **Trusted by** (brand logos) — stays right under the hero. Pure social proof where it earns the most.
- **Live network** (activity ticker, reverse-scroll, pulsing green dot) — moved to a slim band just above the footer. Acts as the site's heartbeat — last thing you see before you leave.

Verifier double-checking.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

Confirmed working. Brand row sits under hero, live ticker now lives above the footer. Ready for the next change.

## User

No, I think we should try this. We put the the one that is in the middle at the bottom and we put the live network at the very top of the page. So trusted by we put that at the bottom  and live network goes at the top of the page. that way the page isn't split in half we do have a lot of empty space at the top of the page so lets adjust everything so there isn't much negative space at the middle since we are going to be removing the trusted by area at the bottom.

## User

Verifier agent check completed

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

Confirmed — Live Network at top, Trusted By at bottom, middle sections tightened. Ready for the next change.

## User

lets remove these dash – from anywhere on the website I see two of them on this line on demand Media Production hub and then there's a dash national Bridge fall in house team there's a dash trusted by – brands that have hired through the network remove all the dash. You can leave them in places that is needed if it is vocabulary, correct

## Assistant

_[tool: grep]_

