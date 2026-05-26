import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Star, Video, Camera, Mic, Radio, Award, Sliders, Play, Compass, CheckCircle2, Zap } from 'lucide-react';
import { SEO } from '../components/SEO.jsx';
import { EmailCapture } from '../components/EmailCapture.jsx';

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CreatorBridge',
  url: 'https://www.creatorbridge.studio',
  logo: 'https://www.creatorbridge.studio/icons/icon-512.png',
  description: 'On-demand media production hub connecting brands with verified freelance creators.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Phoenix',
    addressRegion: 'AZ',
    addressCountry: 'US',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'drl33@creatorbridge.studio',
    contactType: 'customer support',
  },
};

export function LandingPage({ dark }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for tracking elements
  const ringRef = useRef(null);
  const dotRef = useRef(null);
  const glowRef = useRef(null);
  const progRef = useRef(null);

  // States for interactive count-up stats
  const [stats, setStats] = useState({ creators: 0, projects: 0, satisfaction: 0 });

  // Custom mouse-spotlight + cursor ring with optimized fast lerps and reduced flare
  useEffect(() => {
    const ring = ringRef.current;
    const dot = dotRef.current;
    const glow = glowRef.current;
    const prog = progRef.current;
    if (!ring || !dot) return;

    if (window.innerWidth <= 768) return;

    ring.style.display = 'block';
    dot.style.display = 'block';

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let gx = mx;
    let gy = my;
    let active = false;

    const onMouseMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.left = `${mx}px`;
      dot.style.top = `${my}px`;
      if (!active) {
        active = true;
        document.body.classList.add('mouse-active');
      }
      document.body.style.setProperty('--mx', `${(mx / window.innerWidth) * 100}%`);
      document.body.style.setProperty('--my', `${(my / window.innerHeight) * 100}%`);
    };

    const onMouseLeave = () => {
      document.body.classList.remove('mouse-active');
      active = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);

    // Fast lerp speeds
    let frameId;
    const tick = () => {
      rx += (mx - rx) * 0.30; // Responsive cursor tracking
      ry += (my - ry) * 0.30;
      gx += (mx - gx) * 0.20; // Spotlight tracking, faster follow
      gy += (my - gy) * 0.20;

      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      if (glow) {
        glow.style.left = `${gx}px`;
        glow.style.top = `${gy}px`;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    // Hover effect expansions
    const hovers = document.querySelectorAll('a, button, .liquid-glass, .lane-card, .parallax-wrap, input, textarea, select');
    const addHover = () => ring.classList.add('hover');
    const removeHover = () => ring.classList.remove('hover');
    hovers.forEach(el => {
      el.addEventListener('mouseenter', addHover);
      el.addEventListener('mouseleave', removeHover);
    });

    // Scroll progress bar
    const handleScroll = () => {
      const top = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (prog) {
        prog.style.transform = `scaleX(${h > 0 ? top / h : 0})`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(frameId);
      document.body.classList.remove('mouse-active');
      hovers.forEach(el => {
        el.removeEventListener('mouseenter', addHover);
        el.removeEventListener('mouseleave', removeHover);
      });
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // IntersectionObserver for elements reveals (.reveal-up)
  useEffect(() => {
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

    const fallback = setTimeout(() => {
      document.querySelectorAll('.reveal-up.js-hidden').forEach(el => el.classList.remove('js-hidden'));
    }, 1500);

    return () => {
      clearTimeout(fallback);
      els.forEach(el => io.unobserve(el));
    };
  }, []);

  // IntersectionObserver for Count-up Stats
  useEffect(() => {
    const elements = document.querySelectorAll('.stat-num[data-target]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'), 10);
          const isSatisfaction = el.getAttribute('data-target') === '98';
          const isCreators = el.getAttribute('data-target') === '12400';

          const duration = 2200;
          const start = performance.now();
          const easeOut = (t) => 1 - Math.pow(1 - t, 3);

          const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const v = Math.round(target * easeOut(p));

            setStats(prev => {
              const next = { ...prev };
              if (isSatisfaction) next.satisfaction = v;
              else if (isCreators) next.creators = v;
              else next.projects = v;
              return next;
            });

            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });

    elements.forEach(el => io.observe(el));
    return () => {
      elements.forEach(el => io.unobserve(el));
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/find?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/find');
    }
  };

  // 3-pillar production lanes. Each card links to Find Creators with the pillar pre-filtered.
  const productionLanes = [
    {
      title:    'Video Production',
      desc:     'Brand films · weddings · events · drone · podcast video',
      url:      '/find?pillar=video_production',
      count:    'Brand films, commercials, social, drone, podcasts',
      img:      '/images/creatorbridge/camera-lens-event-reflection.png',
    },
    {
      title:    'Photography',
      desc:     'Commercial · weddings · headshots · product · editorial',
      url:      '/find?pillar=photography',
      count:    'Brand, lifestyle, real estate, food, drone',
      img:      '/images/creatorbridge/commercial-photographer.png',
    },
    {
      title:    'Post Production',
      desc:     'Editing · color · motion · sound · podcast audio',
      url:      '/find?pillar=post_production',
      count:    'Long-form, short-form, color, VFX, retouching',
      img:      '/images/creatorbridge/post-production-suite.png',
    },
  ];

  return (
    <>
      <SEO
        title="Hire Verified Media Creators"
        description="CreatorBridge is an on-demand media production hub for brands that need video, podcast, event coverage, brand content, or photography — without building an internal department."
        url="https://www.creatorbridge.studio"
        jsonLd={ORG_JSON_LD}
      />

      {/* Scroll Progress Indicator */}
      <div className="scroll-progress" ref={progRef} />

      {/* Custom Cursor Elements */}
      <div className="cursor-ring" ref={ringRef} style={{ display: 'none' }} />
      <div className="cursor-dot" ref={dotRef} style={{ display: 'none' }} />

      {/* Mouse Tracked Spotlight Glow */}
      <div className="mouse-glow" ref={glowRef} />

      <main className="relative z-10 text-[#f0f0f0]">

        {/* ===== LIVE NETWORK (heartbeat band) ===== */}
        <section className="pt-20 pb-5 border-b border-white/[0.06] overflow-hidden relative" id="live-network">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-16 flex items-center gap-3 mb-4 reveal-up">
            <span className="flex items-center gap-2 eyebrow">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4ade80]" style={{ boxShadow: '0 0 8px rgba(74,222,128,0.6)', animation: 'pulseDot 2s infinite' }}></span>
              Live network
            </span>
            <span className="w-8 h-px bg-white/[0.06]"></span>
            <span className="text-[11px] text-[#6a6a72]">Recent activity across CreatorBridge</span>
          </div>

          <div className="marquee-fade overflow-hidden">
            <div className="marquee-track reverse">
              <div className="flex items-center">
                <span className="ticker-pill"><span className="ticker-dot"></span> <strong>Aria V.</strong> booked a 2-day hotel campaign · <em>Miami</em></span>
                <span className="ticker-pill"><span class="ticker-dot gold"></span> <strong>$3,400</strong> released to <em>LensCraft Studios</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> New verified creator: <strong>Mateo R.</strong> · <em>Austin</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> <strong>Jordan M.</strong> delivered 4 podcast eps · <em>NYC</em></span>
                <span className="ticker-pill"><span class="ticker-dot gold"></span> <strong>$1,200</strong> retainer held · <em>Aritzia × Sofia P.</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> <strong>Naomi G.</strong> awarded a brand film · <em>LA</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> 3 new briefs posted to <strong>Project Board</strong> · <em>last hr</em></span>
                <span className="ticker-pill"><span class="ticker-dot gold"></span> <strong>5★ review</strong> for <em>SoundWave Podcast Co.</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> <strong>Dre W.</strong> shortlisted for conference recap · <em>Atlanta</em></span>

                {/* Seamless loop duplicates */}
                <span className="ticker-pill"><span className="ticker-dot"></span> <strong>Aria V.</strong> booked a 2-day campaign · <em>Miami</em></span>
                <span className="ticker-pill"><span class="ticker-dot gold"></span> <strong>$3,400</strong> released to <em>LensCraft Studios</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> New creator: <strong>Mateo R.</strong> · <em>Austin</em></span>
                <span className="ticker-pill"><span class="ticker-dot"></span> <strong>Jordan M.</strong> delivered podcast eps · <em>NYC</em></span>
                <span className="ticker-pill"><span class="ticker-dot gold"></span> <strong>$1,200</strong> retainer held · <em>Aritzia × Sofia P.</em></span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== HERO ===== */}
        <section className="min-h-[85vh] flex items-center pt-8 pb-12 px-6 lg:px-16">
          <div className="max-w-[1400px] mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-[#6a6a72] reveal-up">
                  <span>On-Demand Media Production Hub</span>
                  <span className="w-6 h-px bg-white/[0.06]"></span>
                  <span className="text-[#c9a84c]">National Reach</span>
                </div>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5rem] serif font-medium leading-[1.02] tracking-tight text-white" style={{ textWrap: 'balance' }}>
                  Verified creative talent for brands that <span className="gold-text">need the work done right.</span>
                </h1>
                <p className="text-[#a0a0a8] text-sm max-w-md leading-relaxed reveal-up">
                  CreatorBridge helps companies source vetted video production, photography, and post-production specialists without building an internal production department.
                </p>

                {/* Direct Search Bar */}
                <form onSubmit={handleSearchSubmit} className="flex max-w-md rounded-xl border border-white/[0.08] bg-white/[0.02] p-1.5 focus-within:border-[#c9a84c] focus-within:bg-white/[0.04] transition-all reveal-up">
                  <div className="flex items-center px-3 text-[#6a6a72]">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, studio, or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-[#6a6a72] focus:outline-none"
                  />
                  <button type="submit" className="btn-gold flex items-center justify-center font-bold text-xs rounded-lg px-4">
                    Search
                  </button>
                </form>

                <div className="flex flex-wrap gap-3 reveal-up pt-2">
                  <button onClick={() => navigate('/find')} className="btn-gold">
                    <Search className="w-4 h-4" />
                    Browse All Creators
                  </button>
                  <button onClick={() => navigate('/projects')} className="btn-ghost">Post a brief</button>
                </div>

                {/* Waitlist email capture */}
                <div className="reveal-up pt-1">
                  <EmailCapture source="homepage_hero" />
                </div>
              </div>

              {/* Hero Image Collage */}
              <div className="relative">
                <div className="grid grid-cols-2 gap-3 reveal-up">
                  <div className="parallax-wrap rounded-2xl overflow-hidden aspect-[3/4] border border-white/[0.06]">
                    <img src="/images/creatorbridge/camera-lens-event-reflection.png" alt="Camera" className="parallax-img w-full h-full object-cover scale-110" />
                  </div>
                  <div className="space-y-3">
                    <div className="parallax-wrap rounded-xl overflow-hidden aspect-video border border-white/[0.06]">
                      <img src="/images/creatorbridge/commercial-photographer.png" alt="Photographer" className="parallax-img w-full h-full object-cover scale-110" />
                    </div>
                    <div className="parallax-wrap rounded-xl overflow-hidden aspect-video border border-white/[0.06]">
                      <img src="/images/creatorbridge/post-production-suite.png" alt="Studio" className="parallax-img w-full h-full object-cover scale-110" />
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 float-card p-4 bob-1 reveal-up" style={{ minWidth: '220px' }}>
                  <div className="eyebrow mb-2">Marketplace Pulse</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-6"><span className="text-[#f0f0f0]">Profile Gate</span><span className="serif text-[#c9a84c]">2+ yrs</span></div>
                    <div className="divider"></div>
                    <div className="flex justify-between gap-6"><span className="text-[#f0f0f0]">Proof Layer</span><span className="serif text-[#c9a84c]">3+ works</span></div>
                    <div className="divider"></div>
                    <div className="flex justify-between gap-6"><span className="text-[#f0f0f0]">Intro Check</span><span className="serif text-[#c9a84c]">60–90s</span></div>
                  </div>
                </div>
                <div className="absolute -top-3 -right-3 float-card p-4 bob-2 reveal-up" style={{ minWidth: '220px' }}>
                  <div className="eyebrow mb-2">Production Standards</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-6"><span className="text-[#f0f0f0]">Review</span><span className="text-[#c9a84c]">Manual</span></div>
                    <div className="flex justify-between gap-6"><span className="text-[#f0f0f0]">Payment</span><span className="text-[#c9a84c]">50 / 50</span></div>
                    <div className="flex justify-between gap-6"><span className="text-[#f0f0f0]">Fee</span><span className="text-[#c9a84c]">10% → 6%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PRODUCTION LANES ===== */}
        <section className="py-16 px-6 lg:px-16 border-t border-white/[0.04] bg-white/[0.01]">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid lg:grid-cols-12 gap-8 mb-10 items-end">
              <div className="lg:col-span-7 reveal-up">
                <div className="eyebrow mb-3">Production Lanes</div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl serif font-medium leading-tight text-white">Production coverage without building a full in-house team.</h2>
              </div>
              <div className="lg:col-span-5 reveal-up">
                <p className="text-sm text-[#a0a0a8] mb-3">Choose the type of production work first, then compare creators by proof, package, availability, and fit.</p>
                <button onClick={() => navigate('/find')} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                  Browse all services
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bob-grid">
              {productionLanes.map((lane, idx) => (
                <div key={idx} onClick={() => navigate(lane.url)} className="lane-card aspect-[4/5] reveal-up block">
                  <img src={lane.img} alt={lane.title} className="w-full h-full object-cover" />
                  <div className="lane-content">
                    <div className="text-[10px] uppercase tracking-wider text-white/60 mb-2">{lane.desc}</div>
                    <div className="font-semibold text-base uppercase tracking-wide text-white">{lane.title}</div>
                    <div className="text-[10px] text-[#c9a84c] mt-2 leading-snug">{lane.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== PROJECT SIGNALS & GUIDED DISCOVERY ===== */}
        <section className="py-16 px-6 lg:px-16">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 space-y-5">
                <div className="reveal-up">
                  <div className="eyebrow mb-3">Project Signals</div>
                  <h2 className="text-3xl md:text-4xl serif font-medium leading-tight mb-3 text-white">Guide clients toward the right production path.</h2>
                  <p className="text-sm text-[#a0a0a8]">Clear pricing signals help brands understand what level of production they need.</p>
                </div>
                <div className="space-y-3">
                  <div onClick={() => navigate('/find?lane=video')} className="liquid-glass hover-lift rounded-xl p-5 flex items-center justify-between reveal-up cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="parallax-wrap w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <img src="/images/creatorbridge/camera-lens-event-reflection.png" alt="Brand film" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white">Brand film</div>
                        <div className="text-xs text-[#6a6a72]">Corporate story, campaign narrative</div>
                      </div>
                    </div>
                    <div className="text-[#c9a84c] font-semibold serif text-xl">$1,500+</div>
                  </div>
                  <div onClick={() => navigate('/find?pillar=video_production')} className="liquid-glass hover-lift rounded-xl p-5 flex items-center justify-between reveal-up cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="parallax-wrap w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <img src="/images/creatorbridge/podcast-producer-studio.png" alt="Podcast" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white">Video podcast</div>
                        <div className="text-xs text-[#6a6a72]">Show launch, capture, edits</div>
                      </div>
                    </div>
                    <div className="text-[#c9a84c] font-semibold serif text-xl">$350+</div>
                  </div>
                  <div onClick={() => navigate('/find?lane=photo')} className="liquid-glass hover-lift rounded-xl p-5 flex items-center justify-between reveal-up cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="parallax-wrap w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <img src="/images/creatorbridge/commercial-photographer.png" alt="Photo" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white">Commercial photo</div>
                        <div className="text-xs text-[#6a6a72]">Product setups, portraits, events</div>
                      </div>
                    </div>
                    <div className="text-[#c9a84c] font-semibold serif text-xl">$500+</div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="liquid-glass rounded-2xl p-8 h-full reveal-up flex flex-col justify-between">
                  <div>
                    <div className="eyebrow mb-6">Guided Discovery</div>
                    <div className="grid sm:grid-cols-3 gap-6 mb-8">
                      <div>
                        <div className="serif text-4xl text-[#c9a84c] mb-3">01</div>
                        <h3 class="font-semibold text-sm mb-2 text-white">Define the need</h3>
                        <p class="text-xs text-[#a0a0a8] leading-relaxed">Choose service type, market, budget range, and delivery expectations.</p>
                      </div>
                      <div>
                        <div className="serif text-4xl text-[#c9a84c] mb-3">02</div>
                        <h3 class="font-semibold text-sm mb-2 text-white">Review curated fit</h3>
                        <p class="text-xs text-[#a0a0a8] leading-relaxed">Browse verified media specialists instead of sorting through general gig profiles.</p>
                      </div>
                      <div>
                        <div className="serif text-4xl text-[#c9a84c] mb-3">03</div>
                        <h3 class="font-semibold text-sm mb-2 text-white">Book protected</h3>
                        <p class="text-xs text-[#a0a0a8] leading-relaxed">50% retainer and 50% delivery structure keeps both sides accountable.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="divider mb-6"></div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-[#c9a84c] text-sm font-medium mb-1">Daily curated preview</div>
                        <div className="text-xs text-[#a0a0a8]">Guests see 3 verified creators each day. Create a free account to browse full profiles.</div>
                      </div>
                      <button onClick={() => navigate('/find')} className="btn-gold text-xs shrink-0">Create free account</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FEATURED WORK ===== */}
        <section className="py-16 px-6 lg:px-16 border-t border-white/[0.04] bg-white/[0.01]">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid lg:grid-cols-12 gap-8 mb-10 items-end">
              <div className="lg:col-span-7 reveal-up">
                <div className="eyebrow mb-3">Featured Work</div>
                <h2 className="text-3xl md:text-4xl serif font-medium leading-tight text-white">Recent <span className="gold-text">productions</span> from the network.</h2>
              </div>
              <div className="lg:col-span-5 reveal-up flex lg:justify-end">
                <button onClick={() => navigate('/find')} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                  Browse creator directory
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 bob-grid">
              <div onClick={() => navigate('/find')} className="lane-card aspect-[3/4] reveal-up block cursor-pointer">
                <img src="/images/creatorbridge/camera-lens-event-reflection.png" alt="Luxe" />
                <div className="lane-content">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c] mb-1">Commercial</div>
                  <div className="text-sm font-medium text-white">Luxe Campaign 2025</div>
                </div>
              </div>
              <div onClick={() => navigate('/find')} className="lane-card aspect-[3/4] reveal-up block cursor-pointer">
                <img src="/images/creatorbridge/commercial-photographer.png" alt="Music" />
                <div className="lane-content">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c] mb-1">Music Video</div>
                  <div className="text-sm font-medium text-white">Neon Dreams EP</div>
                </div>
              </div>
              <div onClick={() => navigate('/find')} className="lane-card aspect-[3/4] reveal-up block cursor-pointer">
                <img src="/images/creatorbridge/drone-operator-golden-hour.png" alt="Doc" />
                <div className="lane-content">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c] mb-1">Documentary</div>
                  <div className="text-sm font-medium text-white">Beyond The Lens</div>
                </div>
              </div>
              <div onClick={() => navigate('/find')} className="lane-card aspect-[3/4] reveal-up block cursor-pointer">
                <img src="/images/creatorbridge/event-crew-stage.png" alt="Horizon" />
                <div className="lane-content">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c] mb-1">Brand Film</div>
                  <div className="text-sm font-medium text-white">Horizon Rebrand</div>
                </div>
              </div>
              <div onClick={() => navigate('/find')} className="lane-card aspect-[3/4] reveal-up block cursor-pointer">
                <img src="/images/creatorbridge/post-production-suite.png" alt="Vogue" />
                <div className="lane-content">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c] mb-1">Editorial</div>
                  <div className="text-sm font-medium text-white">Vogue · Resort</div>
                </div>
              </div>
              <div onClick={() => navigate('/find')} className="lane-card aspect-[3/4] reveal-up block cursor-pointer">
                <img src="/images/creatorbridge/podcast-producer-studio.png" alt="Podcast" />
                <div className="lane-content">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c] mb-1">Podcast</div>
                  <div className="text-sm font-medium text-white">The Business Hour</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== WHY CREATORBRIDGE + FEE COMPARISON ===== */}
        <section className="py-16 px-6 lg:px-16">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid lg:grid-cols-12 gap-10 mb-12">
              <div className="lg:col-span-5 reveal-up">
                <div className="eyebrow mb-3">Why CreatorBridge</div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl serif font-medium leading-[1.05] text-white">A production bench you can activate when the work matters.</h2>
              </div>
              <div className="lg:col-span-7 flex items-end reveal-up">
                <p className="text-sm text-[#a0a0a8] max-w-lg">CreatorBridge gives clients a cleaner path to vetted media specialists while giving creators a platform built around professional standards and protected payment.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-10">
              <div className="liquid-glass hover-lift rounded-2xl p-6 reveal-up">
                <div className="gold-line mb-4"></div>
                <h3 className="font-semibold text-base mb-2 text-white">Production talent on demand</h3>
                <p class="text-xs text-[#a0a0a8] leading-relaxed">A flexible production bench without hiring a full internal media department.</p>
              </div>
              <div className="liquid-glass hover-lift rounded-2xl p-6 reveal-up">
                <div className="gold-line mb-4"></div>
                <h3 class="font-semibold text-base mb-2 text-white">Cleaner client decisions</h3>
                <p class="text-xs text-[#a0a0a8] leading-relaxed">Compare focused creator profiles, service fit, availability, packages, and proof.</p>
              </div>
              <div className="liquid-glass hover-lift rounded-2xl p-6 reveal-up">
                <div className="gold-line mb-4"></div>
                <h3 class="font-semibold text-base mb-2 text-white">Standards before booking</h3>
                <p class="text-xs text-[#a0a0a8] leading-relaxed">Profiles are gated by experience, portfolio, verification, and platform rules.</p>
              </div>
            </div>

            <div className="liquid-glass rounded-2xl p-6 md:p-8 reveal-up">
              <div className="eyebrow mb-2">Fee Comparison</div>
              <h3 className="text-2xl serif font-medium mb-6 text-white">Built to cost less and feel more focused.</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-3 pr-4 font-normal text-[#6a6a72]"></th>
                      <th className="text-left py-3 px-4 font-medium text-[#c9a84c] uppercase tracking-wider text-[10px]">CreatorBridge</th>
                      <th className="text-left py-3 pl-4 font-normal text-[#6a6a72] uppercase tracking-wider text-[10px]">General Marketplaces</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3.5 pr-4 font-medium text-sm text-white">Creator fee</td>
                      <td className="py-3.5 px-4 text-[#c9a84c] font-semibold">10% → 6%</td>
                      <td className="py-3.5 pl-4 text-[#6a6a72]">Often up to 20%</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3.5 pr-4 font-medium text-sm text-white">Client booking fee</td>
                      <td className="py-3.5 px-4 text-[#c9a84c] font-semibold">5%</td>
                      <td className="py-3.5 pl-4 text-[#6a6a72]">Often higher or unclear</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3.5 pr-4 font-medium text-sm text-white">Media-only focus</td>
                      <td className="py-3.5 px-4 text-[#c9a84c] font-semibold">Yes</td>
                      <td className="py-3.5 pl-4 text-[#6a6a72]">Usually broad categories</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3.5 pr-4 font-medium text-sm text-white">Verified standards</td>
                      <td className="py-3.5 px-4 text-[#c9a84c] font-semibold">Required</td>
                      <td className="py-3.5 pl-4 text-[#6a6a72]">Mixed or self-managed</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-sm text-white">Protected payments</td>
                      <td className="py-3.5 px-4 text-[#c9a84c] font-semibold">50 / 50 escrow</td>
                      <td className="py-3.5 pl-4 text-[#6a6a72]">Varies by platform</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ===== STATS ===== */}
        <section className="py-16 px-6 lg:px-16 border-t border-white/[0.04] bg-white/[0.01]">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center reveal-up">
                <div className="text-5xl md:text-6xl lg:text-7xl serif font-medium gold-text stat-num mb-3" data-target="12400">
                  {stats.creators.toLocaleString()}
                </div>
                <div className="text-xs text-[#a0a0a8] uppercase tracking-wider">Verified Creators</div>
              </div>
              <div className="text-center reveal-up">
                <div className="text-5xl md:text-6xl lg:text-7xl serif font-medium gold-text stat-num mb-3" data-target="8500">
                  {stats.projects.toLocaleString()}
                </div>
                <div className="text-xs text-[#a0a0a8] uppercase tracking-wider">Projects Delivered</div>
              </div>
              <div className="text-center reveal-up">
                <div className="text-5xl md:text-6xl lg:text-7xl serif font-medium gold-text stat-num mb-3" data-target="98">
                  {stats.satisfaction}%
                </div>
                <div className="text-xs text-[#a0a0a8] uppercase tracking-wider">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="py-24 px-6 lg:px-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#c9a84c]/5 via-transparent to-[#c9a84c]/5"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#c9a84c]/5 rounded-full blur-3xl"></div>
          <div className="max-w-3xl mx-auto text-center relative z-10 reveal-up">
            <h2 className="text-4xl md:text-6xl serif font-medium mb-6 leading-tight text-white">Ready to produce<br /><span className="gold-text">something extraordinary?</span></h2>
            <p className="text-[#a0a0a8] text-base mb-10 max-w-lg mx-auto">Join thousands of creators and brands already building the future of media production.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate('/find')} className="btn-gold" style={{ fontSize: '0.9rem', padding: '0.9rem 2rem' }}>Get started free</button>
              <button onClick={() => navigate('/projects')} className="btn-ghost" style={{ fontSize: '0.9rem', padding: '0.9rem 2rem' }}>Talk to sales</button>
            </div>
          </div>
        </section>

        {/* ===== TRUSTED BY ===== */}
        <section className="py-12 border-y border-white/[0.06] overflow-hidden relative" id="trusted-by">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-16 flex items-center gap-3 mb-6 reveal-up">
            <span className="eyebrow">Trusted by</span>
            <span className="w-8 h-px bg-white/[0.06]"></span>
            <span className="text-[11px] text-[#6a6a72]">Brands that have hired through the network</span>
          </div>

          <div className="marquee-fade overflow-hidden">
            <div className="marquee-track">
              <div className="flex items-center">
                <span className="brand-plate">Soho House</span>
                <span className="brand-plate">Aritzia</span>
                <span className="brand-plate">Equinox</span>
                <span className="brand-plate">The Standard</span>
                <span className="brand-plate">Hypebeast</span>
                <span className="brand-plate">Vogue Business</span>
                <span className="brand-plate">Tribeca</span>
                <span className="brand-plate">Aesop</span>
                <span className="brand-plate">Harper's Bazaar</span>
                <span className="brand-plate">Verge Conference</span>
                <span className="brand-plate">LuxRealty</span>
                <span className="brand-plate">Saigon Sky</span>

                {/* Seamless loop duplicates */}
                <span className="brand-plate">Soho House</span>
                <span className="brand-plate">Aritzia</span>
                <span className="brand-plate">Equinox</span>
                <span className="brand-plate">The Standard</span>
                <span className="brand-plate">Hypebeast</span>
                <span className="brand-plate">Vogue Business</span>
                <span className="brand-plate">Tribeca</span>
                <span className="brand-plate">Aesop</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== RENDER LOCAL PREMIUM FOOTER ===== */}
        <footer className="site border-t border-white/[0.06] mt-0 bg-black/40">
          <div className="inner">
            <div className="grid">
              <div>
                <div className="logo-mark mb-5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <span className="serif text-xl font-bold gold-text">CreatorBridge</span>
                </div>
                <p className="text-xs text-[#a0a0a8] max-w-sm leading-relaxed">
                  The verified marketplace connecting brands with professional media specialists across video production, photography, and post-production — without building an internal department.
                </p>
                <div className="mt-5">
                  <EmailCapture source="homepage_footer" compact />
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-bold tracking-wider text-[#6a6a72] mb-3 uppercase">Platform</h4>
                <button onClick={() => navigate('/find')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Find Creators</button>
                <button onClick={() => navigate('/projects')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Project Board</button>
                <button onClick={() => navigate('/network')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Creator Network</button>
                <button onClick={() => navigate('/calculator')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Rate Calculator</button>
              </div>
              <div>
                <h4 className="text-[10px] font-bold tracking-wider text-[#6a6a72] mb-3 uppercase">For Creators</h4>
                <button onClick={() => navigate('/register')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Apply to join</button>
                <button onClick={() => navigate('/terms-of-service')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Creator Agreement</button>
                <button onClick={() => navigate('/dispute-policy')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Dispute Policy</button>
              </div>
              <div>
                <h4 className="text-[10px] font-bold tracking-wider text-[#6a6a72] mb-3 uppercase">Company</h4>
                <a href="mailto:drl33@creatorbridge.studio" className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors">Contact Support</a>
                <button onClick={() => navigate('/terms-of-service')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Terms of Service</button>
                <button onClick={() => navigate('/privacy')} className="block text-xs text-[#a0a0a8] py-1.5 hover:text-[#c9a84c] transition-colors text-left w-full">Privacy Policy</button>
              </div>
            </div>
            <div className="bottom flex flex-col sm:flex-row justify-between gap-4 mt-12 pt-6 border-t border-white/[0.06] text-[10px] text-[#6a6a72]">
              <div>&copy; {new Date().getFullYear()} CreatorBridge. All rights reserved.</div>
              <div className="flex gap-4">
                <button onClick={() => navigate('/terms-of-service')} className="hover:text-[#c9a84c] transition-colors">Terms</button>
                <button onClick={() => navigate('/privacy')} className="hover:text-[#c9a84c] transition-colors">Privacy</button>
                <a href="mailto:drl33@creatorbridge.studio" className="hover:text-[#c9a84c] transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
