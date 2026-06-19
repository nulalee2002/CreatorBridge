import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';

const SECTIONS = [
  { id: 'introduction', title: '1. Introduction & Scope' },
  { id: 'fees',         title: '2. Platform Fee Structure & Tiers' },
  { id: 'payments',     title: '3. Payment Structure & Stripe Connect' },
  { id: 'disintermediation', title: '4. Non-Circumvention & Off-Platform Policy' },
  { id: 'profile-lock', title: '5. Profile Information & 90-Day Lock' },
  { id: 'strikes',      title: '6. Violations & The Three-Strike Rule' },
  { id: 'termination',  title: '7. Term and Termination' },
];

function Section({ id, title, dark, children }) {
  const textBody = dark ? 'text-charcoal-300' : 'text-gray-600';

  return (
    <section id={id} className="scroll-mt-20 mb-10">
      <h2 className={`font-display font-bold text-xl mb-4 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
        {title}
      </h2>
      <div className={`space-y-3 text-sm leading-relaxed ${textBody}`}>
        {children}
      </div>
    </section>
  );
}

export function CreatorAgreement({ dark }) {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [location.hash]);

  const cardCls  = `rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const linkCls  = 'text-gold-400 hover:text-gold-300 underline';

  return (
    <div className={`min-h-screen ${dark ? 'bg-charcoal-950 bg-[radial-gradient(circle_at_50%_0%,rgba(212,169,65,0.08),transparent_34%)]' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${textSub}`}>Legal</p>
          <h1 className={`font-display font-bold text-3xl mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Creator Agreement
          </h1>
          <p className={`text-sm ${textSub}`}>Effective May 20, 2026. Last updated May 20, 2026.</p>
          <button
            onClick={() => window.print()}
            className="cb-no-print mt-4 inline-flex items-center gap-2 rounded-xl border border-gold-500/30 px-4 py-2 text-xs font-bold text-gold-400 hover:bg-gold-500/10 transition-colors"
            aria-label="Download Creator Agreement as PDF"
          >
            <Download size={13} /> Download as PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">

          {/* Table of contents */}
          <aside className="lg:sticky lg:top-20 self-start">
            <div className={`${cardCls} p-4`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${textSub}`}>Contents</p>
              <nav className="space-y-1">
                {SECTIONS.map(s => (
                  <a key={s.id} href={`#${s.id}`}
                    className={`flex min-h-[34px] items-center text-xs py-1 transition-colors hover:text-gold-400 ${textSub}`}>
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div className={`${cardCls} p-8`}>

            <Section id="introduction" title="1. Introduction & Scope" dark={dark}>
              <p>
                This Creator Agreement governs your status as a registered service provider on the CreatorBridge platform.
                By submitting your application, creating a creator profile, or listing services, you enter into a legally
                binding contract with CreatorBridge Inc.
              </p>
              <p>
                This Agreement details your rights and duties regarding payments, fees, client bookings, profile locks, and general
                operational standards on the Platform. This Agreement incorporates and supplements our general Terms of Service.
              </p>
            </Section>

            <Section id="fees" title="2. Platform Fee Structure & Tiers" dark={dark}>
              <p>
                CreatorBridge aligns its incentives with your success. We earn revenue by taking a platform fee percentage from the projects you
                book through the Platform. This fee covers our operating cost, payment security, marketing, and matching technology.
              </p>
              <p>
                Our fee structure decreases based on your experience and project volume on the Platform, defined by the following creator tiers:
              </p>
              <div className={`rounded-xl border p-4 my-3 ${dark ? 'border-white/[0.08] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-gray-800 pb-2">
                    <div>
                      <p className="font-bold text-white">Launch Tier</p>
                      <p className={`text-[10px] ${textSub}`}>Initial registration tier (0–9 projects completed)</p>
                    </div>
                    <span className="font-mono font-bold text-gold-400">10% Platform Fee</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-800 pb-2">
                    <div>
                      <p className="font-bold text-white">Proven Tier</p>
                      <p className={`text-[10px] ${textSub}`}>After 10 completed projects</p>
                    </div>
                    <span className="font-mono font-bold text-gold-400">8% Platform Fee</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-800 pb-2">
                    <div>
                      <p className="font-bold text-white">Elite Tier</p>
                      <p className={`text-[10px] ${textSub}`}>After 25 completed projects</p>
                    </div>
                    <span className="font-mono font-bold text-gold-400">6% Platform Fee</span>
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <p className="font-bold text-white">Signature Tier</p>
                      <p className={`text-[10px] ${textSub}`}>After 50 completed projects / custom invite</p>
                    </div>
                    <span className="font-mono font-bold text-gold-400">5% Platform Fee</span>
                  </div>
                </div>
              </div>
              <p>
                Fees are automatically computed and deducted at the time payouts are transferred to your Connect account.
              </p>
            </Section>

            <Section id="payments" title="3. Payment Structure & Stripe Connect" dark={dark}>
              <p>
                To list services on CreatorBridge, you must onboard with Stripe Connect. You agree to create and maintain an active
                Stripe Express Account linked to your bank account or debit card. Payouts cannot be made unless your Express account
                is fully verified and enabled for payouts.
              </p>
              <p>
                All project payments follow a secure escrow-like structure:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>50% Retainer:</strong> Paid by the client upon booking and before work begins. Retainers are held securely by our processor. You are notified to begin work once retainer funds clear.</li>
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>50% Final Payout:</strong> Paid by the client upon content delivery. Funds are released to your Connect account once the client approves the final work.</li>
              </ul>
              <p>
                If a client fails to take action (approve or request a revision) within 72 hours of delivery, the final payment is released
                automatically to protect you from payment delays.
              </p>
            </Section>

            <Section id="disintermediation" title="4. Non-Circumvention & Off-Platform Policy" dark={dark}>
              <p>
                CreatorBridge connects you with high-value clients. You agree that all bookings, communication, and financial transactions
                with any client who discovered your services or profile on CreatorBridge must be completed entirely on the Platform.
              </p>
              <p>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>This booking exclusivity requirement lasts for a period of 24 months</strong> from the date you are introduced to the client.
              </p>
              <p>
                Prohibited actions include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Sharing email addresses, phone numbers, websites, or social media handles in messages before a paid booking is finalized.</li>
                <li>Requesting direct invoicing, checks, cash, bank wires, or any payment method other than checkout links provided by the Platform.</li>
                <li>Completing subsequent projects off-platform with any client met through CreatorBridge.</li>
              </ul>
              <p>
                We use automated pattern filtering to block contact details in conversations. Violation of this non-circumvention clause
                is grounds for immediate account termination.
              </p>
            </Section>

            <Section id="profile-lock" title="5. Profile Information & 90-Day Lock" dark={dark}>
              <p>
                To maintain a safe and reliable directory, all registered profiles must pass standard verification.
                Your business name, location, primary pillar, specialty selections, and full name are verified at signup.
              </p>
              <p>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>90-Day Profile Lock:</strong> Once approved and published, critical identity details (including business name, full name, and location) are locked for a period of 90 days. Minor modifications like bio, portfolio links, packages, and calendar availability are unlocked and editable at any time.
              </p>
              <p>
                This lock prevents creators from changing identity details rapidly to bypass reviews or feedback. If a critical profile change is required (e.g., due to rebranding or moving location), you must submit a ticket to admin support.
              </p>
            </Section>

            <Section id="strikes" title="6. Violations & The Three-Strike Rule" dark={dark}>
              <p>
                To ensure a trustworthy platform, we operate a three-strike rule for infractions:
              </p>
              <div className="space-y-3 mt-2">
                <div className="p-3.5 rounded-xl border border-gold-500/20 bg-gold-500/5">
                  <p className="font-bold text-xs text-gold-400">Strike 1 — Warning</p>
                  <p className={`text-xs mt-1 ${textSub}`}>An administrative warning is logged. Your dashboard notifies you of the warning. This serves as an education step.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                  <p className="font-bold text-xs text-white">Strike 2 — Restriction</p>
                  <p className={`text-xs mt-1 ${textSub}`}>Your search visibility is reduced. Your profile is marked "Under Review". You are restricted from bidding on high-budget briefs for 30 days.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-red-500/25 bg-red-500/5">
                  <p className="font-bold text-xs text-red-400">Strike 3 — Suspension</p>
                  <p className={`text-xs mt-1 ${textSub}`}>Immediate profile suspension. You are removed from the public directory. Payouts may be held pending contract review. You cannot communicate with new clients.</p>
                </div>
              </div>
              <p className="mt-2">
                Strikes are issued for: attempting off-platform booking, using fake credentials or plagiarized portfolio items,
                harassment, or failing to deliver contracted work.
              </p>
            </Section>

            <Section id="termination" title="7. Term and Termination" dark={dark}>
              <p>
                This Agreement remains in effect until your account is closed. Either party may terminate this Agreement by deleting
                the creator account or sending a termination request to <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a>.
              </p>
              <p>
                Termination does not release you from completing any in-progress bookings, nor does it waive the 24-month non-circumvention
                requirement for clients introduced prior to termination.
              </p>
            </Section>

            <div className={`mt-8 pt-6 border-t text-xs ${dark ? 'border-white/[0.07] text-charcoal-300' : 'border-gray-200 text-gray-400'}`}>
              <p>CreatorBridge Inc. Questions? Contact <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a></p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
