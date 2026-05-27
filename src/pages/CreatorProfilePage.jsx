import { useState, useEffect, useRef, useMemo } from 'react';
import { SEO } from '../components/SEO.jsx';

const useTweaks = (defaults) => [defaults, () => {}];
const TweaksPanel = () => null;
const TweakSection = () => null;
const TweakRadio = () => null;


// ---------- DATA ----------
const creator = {
  studio: "Aria Visual Studio",
  name: "Aria Vasquez",
  city: "Miami, FL",
  years: "7+ yrs",
  rating: 4.9,
  reviews: 64,
  responseTime: "~2 hrs",
  onTime: 96,
  repeat: 48,
  projects: 142,
  tagline: "Editorial commercial photography with a bold, narrative eye.",
  bio: "I shoot for brands that want their work to feel deliberate. Studio and on-location, with a small reliable crew. Based in Miami, working nationally across the US.",
  featuredIn: ["Vogue Business", "Harper's Bazaar", "Hypebeast", "Soho House Magazine"],
  // ONE primary pillar — never multiple. 1–3 specialties inside it.
  pillar: { key: "photo", label: "Photography" },
  specialties: ["Brand & Commercial Photography", "Editorial & Press", "Headshots & Portraits"],
  gear: ["Hasselblad H6D-100c", "Phase One IQ4", "Profoto B10s × 4", "DJI Ronin 4D"],
  languages: ["English", "Spanish"],
  crew: "2-person core team + on-call stylists & assistants",
  tiers: ["Verified", "Elite"],
  avatar: "/images/creatorbridge/handoff/photo-1494790108377-be9c29b29330.png",
  reel: "/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png"
};

const verification = [
  { label: "Profile Gate", value: "7 yrs verified" },
  { label: "Proof Layer", value: "12 published" },
  { label: "Intro Check", value: "Passed 03/24" },
  { label: "ID & Tax", value: "On file" }
];

const portfolio = [
  { id: 1, cat: "Editorial & Press",                ratio: "aspect-[4/5]",  src: "/images/creatorbridge/handoff/photo-1492691527719-9d1e07e534b4.png", title: "Spring drop · Aritzia" },
  { id: 2, cat: "Brand & Commercial Photography",   ratio: "aspect-[16/10]",src: "/images/creatorbridge/handoff/photo-1542038784456-1ea8e935640e.png", title: "Soho House · Miami" },
  { id: 3, cat: "Headshots & Portraits",            ratio: "aspect-[4/5]",  src: "/images/creatorbridge/handoff/photo-1554384645-13eab165c24b.png", title: "Equinox · Member series" },
  { id: 4, cat: "Brand & Commercial Photography",   ratio: "aspect-[16/10]",src: "/images/creatorbridge/handoff/photo-1502672260266-1c1ef2d93688.png", title: "The Standard · Property" },
  { id: 5, cat: "Editorial & Press",                ratio: "aspect-[4/5]",  src: "/images/creatorbridge/handoff/photo-1496217590455-aa63a8350eea.png", title: "Vogue Business · Resort" },
  { id: 6, cat: "Brand & Commercial Photography",   ratio: "aspect-[16/10]",src: "/images/creatorbridge/handoff/photo-1539109136881-3be0616acf4b.png", title: "Horizon Rebrand" },
  { id: 7, cat: "Headshots & Portraits",            ratio: "aspect-[4/5]",  src: "/images/creatorbridge/handoff/photo-1531123897727-8f129e1688ce.png", title: "Founder portraits" },
  { id: 8, cat: "Brand & Commercial Photography",   ratio: "aspect-[16/10]",src: "/images/creatorbridge/handoff/photo-1516035069371-29a1b244cc32.png", title: "Editorial campaign" },
  { id: 9, cat: "Editorial & Press",                ratio: "aspect-[4/5]",  src: "/images/creatorbridge/handoff/photo-1600585154340-be6161a56a0c.png", title: "Coral Gables · feature" }
];

const packages = [
  {
    id: "essential", name: "Essential", price: 850, popular: false,
    tagline: "For focused single-deliverable shoots.",
    items: ["Half-day shoot · up to 4 hrs", "25 edited high-res images", "1 location", "7-day delivery", "1 revision round", "Personal use license"]
  },
  {
    id: "signature", name: "Signature", price: 1950, popular: true,
    tagline: "The right fit for most brand campaigns.",
    items: ["Full-day shoot · up to 8 hrs", "60 edited high-res images", "Up to 2 locations", "5-day delivery", "3 revision rounds", "RAW files included", "Commercial license · 1 year"]
  },
  {
    id: "editorial", name: "Editorial", price: 4500, popular: false,
    tagline: "Multi-day, crew-supported productions.",
    items: ["2-day production · crew + stylist", "120 edited images + behind-the-scenes", "Up to 4 locations", "3-day priority delivery", "Unlimited revisions", "RAW + uncompressed deliverables", "Buyout-eligible usage rights"]
  }
];

const reviews = [
  { id: 1, client: "Soho House Miami", role: "Brand Lead", rating: 5, project: "Hotel campaign · Signature", date: "Mar 2026",
    body: "Aria's team showed up prepared, ran a tight schedule, and the deliverables read like they belong in a magazine. Booking again for Q3." },
  { id: 2, client: "Aritzia", role: "Creative Director", rating: 5, project: "Editorial · Spring drop", date: "Feb 2026",
    body: "Honestly the easiest editorial shoot we've done all year. Strong creative POV but knew when to defer to the brief." },
  { id: 3, client: "Equinox Coral Gables", role: "Marketing Manager", rating: 5, project: "Portrait series · Essential", date: "Jan 2026",
    body: "Made our members feel comfortable. Edits came back ahead of schedule with consistent grading across all 12 sitters." },
  { id: 4, client: "The Standard Hotels", role: "Property GM", rating: 4, project: "Property feature · Editorial", date: "Dec 2025",
    body: "Premium output. Loved the final cut. The only note was on revision pacing — small thing, communicated and resolved." }
];

// ---------- HELPERS ----------
const Star = ({ filled = true, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
);

const Eyebrow = ({ children }) => (
  <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">{children}</div>
);

const Pill = ({ children, tone = "gold" }) => (
  <span className={tone === "gold" ? "tag-gold" : "tag-green"}>{children}</span>
);

const fmt = (n) => "$" + n.toLocaleString();

// ---------- SUB-COMPONENTS ----------

function Breadcrumb() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] mb-6">
      <a href="/" className="hover:text-[var(--text)] transition-colors">Home</a>
      <span className="opacity-40">/</span>
      <a href="/find" className="hover:text-[var(--text)] transition-colors">Find Creators</a>
      <span className="opacity-40">/</span>
      <a href="/find?pillar=photo" className="hover:text-[var(--text)] transition-colors">{creator.pillar.label}</a>
      <span className="opacity-40">/</span>
      <span className="text-[var(--text)]">Aria Visual Studio</span>
    </div>
  );
}

function Hero({ onPlayReel, onJumpBook, layout, saved, setSaved }) {
  if (layout === "banner") {
    return (
      <section>
        <div className="relative rounded-2xl overflow-hidden mb-6 parallax-wrap">
          <div className="aspect-[21/9] relative">
            <img src={creator.reel} alt="Reel" className="absolute inset-0 w-full h-full object-cover scale-105"/>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/60 to-transparent"></div>
            <button onClick={onPlayReel} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[var(--gold)]/90 hover:bg-[var(--gold-light)] transition-all flex items-center justify-center hover:scale-110">
              <svg className="w-6 h-6 text-[var(--bg)] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">Featured Reel · 02:14</div>
              <div className="text-lg serif">2024–25 selected work</div>
            </div>
          </div>
        </div>
        <HeroInfo onJumpBook={onJumpBook} saved={saved} setSaved={setSaved}/>
      </section>
    );
  }
  return (
    <section className="grid lg:grid-cols-12 gap-8 lg:gap-10 mb-12">
      <div className="lg:col-span-7">
        <HeroInfo onJumpBook={onJumpBook} saved={saved} setSaved={setSaved}/>
      </div>
      <div className="lg:col-span-5">
        <div className="relative rounded-2xl overflow-hidden parallax-wrap group cursor-pointer" onClick={onPlayReel}>
          <div className="aspect-[4/5] relative">
            <img src={creator.reel} alt="Reel" className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20"></div>
            <button className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[var(--gold)]/90 group-hover:bg-[var(--gold-light)] transition-all flex items-center justify-center group-hover:scale-110">
              <svg className="w-6 h-6 text-[var(--bg)] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-2">Featured Reel · 02:14</div>
              <div className="text-base serif font-medium">2024–25 selected work</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroInfo({ onJumpBook, saved, setSaved }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="parallax-wrap w-16 h-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-[var(--border)]">
          <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="primary-pillar-badge">
              <span className="dot"></span>
              <span className="label">Primary pillar</span>
              <span className="value">{creator.pillar.label}</span>
            </span>
            {creator.tiers.map(t => <Pill key={t}>{t}</Pill>)}
            <Pill tone="green">Available now</Pill>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl serif font-medium leading-[1.05] mb-1">
            {creator.studio}
          </h1>
          <div className="text-sm text-[var(--text-dim)]">{creator.name} · {creator.city} · {creator.years}</div>
        </div>
      </div>

      <p className="text-base text-[var(--text)]/90 leading-relaxed max-w-xl serif italic">
        "{creator.tagline}"
      </p>

      <div className="flex flex-wrap gap-1.5">
        {creator.specialties.map(s => (
          <span key={s} className="specialty-chip-profile">{s}</span>
        ))}
      </div>

      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="flex text-[var(--gold)]">
            {[1,2,3,4,5].map(i => <Star key={i} filled={i <= Math.round(creator.rating)}/>)}
          </div>
          <span className="font-semibold text-sm">{creator.rating}</span>
          <span className="text-[var(--text-dim)]">({creator.reviews})</span>
        </div>
        <span className="text-[var(--text-dim)]">Replies in {creator.responseTime}</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={onJumpBook} className="btn-gold">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          Check availability
        </button>
        <button className="btn-ghost">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          Message
        </button>
        <button onClick={() => setSaved(!saved)} className="btn-ghost" style={saved ? { borderColor: 'var(--gold)', color: 'var(--gold)', background: 'var(--gold-dim)' } : {}}>
          <svg className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="liquid-glass rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-2 max-w-md">
        <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] col-span-2 mb-1">Verification Ledger</div>
        {verification.map(v => (
          <div key={v.label} className="flex items-center justify-between text-xs py-1">
            <span className="text-[var(--text-dim)]">{v.label}</span>
            <span className="text-[var(--text)] flex items-center gap-1.5">
              <svg className="w-3 h-3 text-[var(--gold)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              {v.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatStrip() {
  const stats = [
    { v: creator.rating.toFixed(1), l: "Star Rating", sub: `${creator.reviews} verified reviews` },
    { v: creator.projects, l: "Projects Delivered", sub: `across ${creator.specialties.length} ${creator.pillar.label.toLowerCase()} specialties` },
    { v: creator.onTime + "%", l: "On-time Delivery", sub: "last 12 months" },
    { v: creator.repeat + "%", l: "Repeat Clients", sub: "book again within 90 days" }
  ];
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 liquid-glass rounded-2xl divide-x divide-[var(--border)] mb-16 overflow-hidden">
      {stats.map((s, i) => (
        <div key={i} className="p-5 md:p-6">
          <div className="text-3xl md:text-4xl serif gold-text stat-num leading-none mb-2">{s.v}</div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text)] mb-0.5">{s.l}</div>
          <div className="text-[10px] text-[var(--text-dim)]">{s.sub}</div>
        </div>
      ))}
    </section>
  );
}

// ===== SERVICE OFFERS =====
// Shows the single primary pillar + 1–3 specialties as a clean section.
// Replaces any old "service lane" tabbed UI.
const SPECIALTY_BLURB = {
  "Brand & Commercial Photography": "Campaign stills + commercial work for brand-led shoots — studio or on-location, deliverables sized for digital, OOH, and print.",
  "Editorial & Press": "Editorial-eye photography for magazines, press features, and brand storytelling. Strong creative POV with on-brief restraint.",
  "Headshots & Portraits": "Founder, team, and member portraits. Consistent grading across sitters, quick turnarounds, premium retouching."
};

function ServiceOffers() {
  return (
    <section className="mb-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <Eyebrow>Service offers</Eyebrow>
          <h2 className="text-2xl md:text-3xl serif font-medium leading-tight">{creator.pillar.label} — {creator.specialties.length} specialties.</h2>
        </div>
        <div className="text-xs text-[var(--text-dim)] max-w-sm">One primary pillar per creator on CreatorBridge. Aria works exclusively within {creator.pillar.label}.</div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {creator.specialties.map((s, i) => (
          <div key={s} className="service-offer-card">
            <div className="flex items-center justify-between mb-3">
              <span className="serif text-[var(--gold)] text-sm">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)]">{creator.pillar.label}</span>
            </div>
            <h3 className="serif text-lg font-medium mb-2 leading-tight">{s}</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {SPECIALTY_BLURB[s] || `Specialty work within ${creator.pillar.label}.`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="grid lg:grid-cols-12 gap-8 mb-16">
      <div className="lg:col-span-7">
        <Eyebrow>About the studio</Eyebrow>
        <h2 className="text-2xl md:text-3xl serif font-medium mb-4 leading-tight">A small studio built to deliver editorial work at commercial pace.</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">{creator.bio}</p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Past clients include Aritzia, Soho House, The Standard Hotels, Equinox, and Hypebeast. I work nationally — based in Miami, comfortable on shoots in NYC, LA, and Mexico City.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-6">
          <Meta label="Specialties" items={creator.specialties}/>
          <Meta label="Featured in" items={creator.featuredIn}/>
          <Meta label="Gear" items={creator.gear}/>
          <Meta label="Languages" items={creator.languages}/>
        </div>
      </div>
      <div className="lg:col-span-5">
        <div className="liquid-glass rounded-2xl p-6">
          <Eyebrow>Crew & approach</Eyebrow>
          <div className="text-sm font-medium mb-2">{creator.crew}</div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-5">
            Pre-production call within 48 hrs of booking. Detailed shot list and call sheet shared 5 days before shoot. Edits delivered through CreatorBridge with watermarked previews and final downloads.
          </p>
          <div className="space-y-2.5 text-xs">
            <Step n="01" t="Brief & call" d="Scope, references, locations, deliverables."/>
            <Step n="02" t="50% retainer" d="Held in CreatorBridge escrow until shoot day."/>
            <Step n="03" t="Production" d="On-location or studio, with shot list."/>
            <Step n="04" t="Review & deliver" d="Watermarked previews, then final delivery + remaining 50%."/>
          </div>
        </div>
      </div>
    </section>
  );
}

function Meta({ label, items }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(x => <span key={x} className="px-2 py-1 rounded bg-white/[0.04] text-[11px] text-[var(--text)]/85 border border-[var(--border)]">{x}</span>)}
      </div>
    </div>
  );
}

function Step({ n, t, d }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="serif text-[var(--gold)] text-sm w-6 shrink-0">{n}</div>
      <div className="flex-1 border-t border-[var(--border)] pt-2">
        <div className="font-medium text-xs mb-0.5">{t}</div>
        <div className="text-[11px] text-[var(--text-dim)] leading-relaxed">{d}</div>
      </div>
    </div>
  );
}

function Portfolio({ onOpen }) {
  // Filter categories pulled from the creator's specialties — no old generic service lanes.
  const cats = ["All", ...creator.specialties];
  const [active, setActive] = useState("All");
  const items = active === "All" ? portfolio : portfolio.filter(p => p.cat === active);
  return (
    <section className="mb-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <Eyebrow>Portfolio</Eyebrow>
          <h2 className="text-2xl md:text-3xl serif font-medium leading-tight">Selected work — last 18 months.</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button key={c} onClick={() => setActive(c)}
              className={"px-3 py-1.5 rounded-lg text-[11px] transition-all border " +
                (active === c
                  ? "bg-[var(--gold)] text-[var(--bg)] border-[var(--gold)] font-semibold"
                  : "bg-transparent text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--gold)]")
              }>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {items.map(p => (
          <div key={p.id} onClick={() => onOpen(p)} className={"lane-card cursor-pointer " + p.ratio}>
            <img src={p.src} alt={p.title}/>
            <div className="lane-content">
              <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--gold)] mb-1">{p.cat}</div>
              <div className="text-sm font-medium">{p.title}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Packages({ selected, setSelected, style, onBook }) {
  if (style === "table") {
    return (
      <section className="mb-16" id="packages-section">
        <div className="mb-6">
          <Eyebrow>Packages</Eyebrow>
          <h2 className="text-2xl md:text-3xl serif font-medium leading-tight">Choose a package to start a booking.</h2>
        </div>
        <div className="liquid-glass rounded-2xl overflow-hidden">
          {packages.map((p, i) => {
            const isSel = selected === p.id;
            return (
              <div key={p.id} onClick={() => setSelected(p.id)}
                className={"grid lg:grid-cols-12 gap-4 p-5 md:p-6 cursor-pointer transition-colors " +
                  (i > 0 ? "border-t border-[var(--border)] " : "") +
                  (isSel ? "bg-[var(--gold-dim)]" : "hover:bg-white/[0.02]")}>
                <div className="lg:col-span-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="serif text-xl font-medium">{p.name}</div>
                    {p.popular && <Pill>Most booked</Pill>}
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">{p.tagline}</div>
                </div>
                <div className="lg:col-span-6 text-xs text-[var(--text-secondary)] leading-relaxed">
                  {p.items.slice(0, 4).join(" · ")}
                </div>
                <div className="lg:col-span-3 flex items-center lg:justify-end gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">from</div>
                    <div className="text-2xl serif gold-text leading-none">{fmt(p.price)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setSelected(p.id); onBook(); }}
                    className={isSel ? "btn-gold text-[11px]" : "btn-ghost text-[11px]"}>
                    {isSel ? "Continue" : "Select"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <section className="mb-16" id="packages-section">
      <div className="mb-6">
        <Eyebrow>Packages</Eyebrow>
        <h2 className="text-2xl md:text-3xl serif font-medium leading-tight">Choose a package to start a booking.</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mt-2">Every booking includes CreatorBridge's 50/50 escrow split. Custom scopes are negotiable after first call.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {packages.map(p => {
          const isSel = selected === p.id;
          return (
            <div key={p.id} onClick={() => setSelected(p.id)}
              className={"relative liquid-glass rounded-2xl p-6 cursor-pointer transition-all " +
                (isSel ? "ring-1 ring-[var(--gold)] -translate-y-1 shadow-[0_0_40px_rgba(201,168,76,0.12)]" : "")}>
              {p.popular && (
                <div className="absolute -top-2 left-6">
                  <Pill>Most booked</Pill>
                </div>
              )}
              <div className="text-xs tracking-[0.25em] uppercase text-[var(--text-dim)] mb-2">{p.name}</div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">from</span>
                <span className="text-4xl serif gold-text">{fmt(p.price)}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-5">{p.tagline}</p>
              <ul className="space-y-2 mb-6">
                {p.items.map(it => (
                  <li key={it} className="flex items-start gap-2 text-xs text-[var(--text)]/85 leading-relaxed">
                    <svg className="w-3 h-3 text-[var(--gold)] mt-1 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    {it}
                  </li>
                ))}
              </ul>
              <button onClick={(e) => { e.stopPropagation(); setSelected(p.id); onBook(); }}
                className={"w-full justify-center " + (isSel ? "btn-gold text-xs" : "btn-ghost text-xs")}>
                {isSel ? "Continue with " + p.name : "Select " + p.name}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Reviews() {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? reviews : reviews.slice(0, 2);
  return (
    <section className="mb-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <Eyebrow>Client reviews</Eyebrow>
          <h2 className="text-2xl md:text-3xl serif font-medium leading-tight">{creator.rating} · {creator.reviews} verified reviews</h2>
        </div>
        <button onClick={() => setShowAll(!showAll)} className="btn-ghost text-[11px]">
          {showAll ? "Show fewer" : "Show all"}
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(r => (
          <div key={r.id} className="liquid-glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-sm">{r.client}</div>
                <div className="text-[11px] text-[var(--text-dim)]">{r.role} · {r.date}</div>
              </div>
              <div className="flex text-[var(--gold)]">
                {[1,2,3,4,5].map(i => <Star key={i} filled={i <= r.rating} size={12}/>)}
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">"{r.body}"</p>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <div className="text-[10px] text-[var(--text-dim)]">{r.project}</div>
              <Pill tone="green">Verified booking</Pill>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReelModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="max-w-5xl w-full liquid-glass rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="aspect-video relative bg-black">
          <img src={creator.reel} alt="Reel" className="absolute inset-0 w-full h-full object-cover opacity-80"/>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-[var(--gold)]/90 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--bg)] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Featured Reel · 02:14</div>
            <div className="text-base serif">2024–25 selected work · {creator.studio}</div>
          </div>
          <button className="btn-ghost text-xs">Share</button>
        </div>
      </div>
    </div>
  );
}

function LightboxModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div className="max-w-6xl w-full liquid-glass rounded-2xl overflow-hidden grid md:grid-cols-3" onClick={e => e.stopPropagation()}>
        <div className="md:col-span-2 bg-black">
          <img src={item.src} alt={item.title} className="w-full h-full object-cover max-h-[80vh]"/>
        </div>
        <div className="p-6 flex flex-col">
          <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">{item.cat}</div>
          <h3 className="text-2xl serif font-medium mb-3 leading-tight">{item.title}</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
            Selected frame from a recent {item.cat.toLowerCase()} production. Full case studies available after booking.
          </p>
          <div className="mt-auto flex items-center justify-between pt-4 border-t border-[var(--border)]">
            <button onClick={onClose} className="btn-ghost text-xs">Close</button>
            <button className="btn-gold text-xs">Book similar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingSheet({ open, onClose, selectedPkg }) {
  const [brief, setBrief] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("Miami, FL");
  const [submitted, setSubmitted] = useState(false);
  const pkg = packages.find(p => p.id === selectedPkg) || packages[1];
  const subtotal = pkg.price;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;
  const retainer = Math.round(total / 2);
  const remainder = total - retainer;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl h-full overflow-y-auto bg-[var(--bg)] border-l border-[var(--border)]" onClick={e => e.stopPropagation()}>
        <div className="p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Book {creator.studio}</div>
              <h3 className="text-xl serif">Reserve your shoot</h3>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {submitted ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--gold)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div className="text-xl serif mb-2">Reservation request sent</div>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-6">
                Aria will reply within ~2 hrs to confirm shoot details. Your 50% retainer of <span className="text-[var(--gold)] font-semibold">{fmt(retainer)}</span> is on hold and will only be charged once both sides confirm.
              </p>
              <button onClick={onClose} className="btn-gold text-xs">Back to profile</button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="liquid-glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] mb-0.5">Package</div>
                  <div className="font-medium text-sm">{pkg.name} · {pkg.items[0]}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">from</div>
                  <div className="text-2xl serif gold-text leading-none">{fmt(pkg.price)}</div>
                </div>
              </div>

              <Field label="Preferred shoot date">
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)] transition-colors"/>
              </Field>

              <Field label="Location / scope">
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="City, neighborhood, or studio"
                  className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)] transition-colors"/>
              </Field>

              <Field label="Brief">
                <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4}
                  placeholder="What are we shooting? Mood, references, deliverables, deadlines…"
                  className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)] transition-colors resize-none"/>
              </Field>

              <div className="liquid-glass rounded-xl p-5 space-y-2.5">
                <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] mb-1">Escrow split · 50 / 50</div>
                <Row k={`${pkg.name} package`} v={fmt(subtotal)} />
                <Row k="Client booking fee · 5%" v={fmt(fee)} tone="dim"/>
                <div className="border-t border-[var(--border)] pt-2.5">
                  <Row k="Total" v={fmt(total)} bold/>
                </div>
                <div className="border-t border-[var(--border)] pt-2.5 space-y-2.5">
                  <Row k="Held now (50% retainer)" v={fmt(retainer)} tone="gold"/>
                  <Row k="Released on delivery" v={fmt(remainder)} tone="gold"/>
                </div>
                <p className="text-[10px] text-[var(--text-dim)] pt-1 leading-relaxed">
                  Funds sit in CreatorBridge escrow. Retainer releases to creator only when shoot is confirmed. Final balance releases on your approval of deliverables.
                </p>
              </div>

              <button onClick={() => setSubmitted(true)} disabled={!date || !brief}
                className="btn-gold w-full justify-center py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Reserve · hold {fmt(retainer)}
              </button>
              <p className="text-[10px] text-[var(--text-dim)] text-center">You won't be charged until Aria accepts the booking.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function Row({ k, v, tone, bold }) {
  return (
    <div className="flex justify-between items-baseline text-xs">
      <span className={tone === "dim" ? "text-[var(--text-dim)]" : "text-[var(--text)]/85"}>{k}</span>
      <span className={
        (tone === "gold" ? "text-[var(--gold)]" : "text-[var(--text)]") +
        (bold ? " font-semibold text-sm" : "") +
        " serif"
      }>{v}</span>
    </div>
  );
}

function StickyBook({ selectedPkg, onBook, show }) {
  const pkg = packages.find(p => p.id === selectedPkg) || packages[1];
  if (!show) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] liquid-glass rounded-2xl px-5 py-3 flex items-center gap-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg overflow-hidden">
          <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover"/>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-dim)] leading-none mb-0.5">{pkg.name} package</div>
          <div className="text-sm serif gold-text leading-none">{fmt(pkg.price)}</div>
        </div>
      </div>
      <div className="h-8 w-px bg-[var(--border)]"></div>
      <div className="text-[10px] text-[var(--text-dim)] hidden sm:block">
        <div>50% held in escrow</div>
        <div className="text-[var(--gold)]">{fmt(Math.round(pkg.price * 1.05 / 2))} due now</div>
      </div>
      <button onClick={onBook} className="btn-gold text-xs">Reserve</button>
    </div>
  );
}

// ---------- MAIN APP ----------

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "regular",
  "heroLayout": "split",
  "packageStyle": "cards",
  "accent": "subtle"
}/*EDITMODE-END*/;

function HandoffCreatorProfile() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [selectedPkg, setSelectedPkg] = useState("signature");
  const [reelOpen, setReelOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  // Sticky book bar appears after hero scroll
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 600 && !bookOpen);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bookOpen]);

  // Density → padding scale
  const padScale = t.density === "compact" ? "py-8 md:py-10" : t.density === "comfy" ? "py-16 md:py-24" : "py-12 md:py-16";

  // Accent → animated gold body wash
  useEffect(() => {
    document.body.classList.toggle("accent-bold", t.accent === "bold");
  }, [t.accent]);

  const jumpToBook = () => setBookOpen(true);

  return (
    <>
      <main className={"relative z-10 px-6 lg:px-16 pt-24 " + padScale}>
        <div className="max-w-[1400px] mx-auto">
          <Breadcrumb/>
          <Hero onPlayReel={() => setReelOpen(true)} onJumpBook={jumpToBook}
                layout={t.heroLayout} saved={saved} setSaved={setSaved}/>
          <StatStrip/>
          <About/>
          <ServiceOffers/>
          <Portfolio onOpen={setLightbox}/>
          <Packages selected={selectedPkg} setSelected={setSelectedPkg}
                    style={t.packageStyle} onBook={jumpToBook}/>
          <Reviews/>
        </div>
      </main>

      <StickyBook selectedPkg={selectedPkg} onBook={jumpToBook} show={showSticky}/>
      <ReelModal open={reelOpen} onClose={() => setReelOpen(false)}/>
      <LightboxModal item={lightbox} onClose={() => setLightbox(null)}/>
      <BookingSheet open={bookOpen} onClose={() => setBookOpen(false)} selectedPkg={selectedPkg}/>

      <TweaksPanel>
        <TweakSection label="Layout"/>
        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)}/>
        <TweakRadio label="Hero" value={t.heroLayout}
          options={["split", "banner"]}
          onChange={(v) => setTweak("heroLayout", v)}/>
        <TweakRadio label="Packages" value={t.packageStyle}
          options={["cards", "table"]}
          onChange={(v) => setTweak("packageStyle", v)}/>
        <TweakSection label="Treatment"/>
        <TweakRadio label="Accent" value={t.accent}
          options={["subtle", "bold"]}
          onChange={(v) => setTweak("accent", v)}/>
      </TweaksPanel>
    </>
  );
}

export function CreatorProfilePage() {
  return (
    <>
      <SEO title="Aria Visual Studio | CreatorBridge" description="Verified CreatorBridge photography profile with packages, portfolio, reviews, and booking details." />
      <HandoffCreatorProfile />
    </>
  );
}
