import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SECTIONS = [
  { id: 'overview',     title: '1. Dispute Policy Overview' },
  { id: 'payment-split',title: '2. The 50/50 Payment Structure' },
  { id: 'revisions',    title: '3. Built-In Revisions' },
  { id: 'opening',      title: '4. How to Open a Dispute' },
  { id: 'resolution',   title: '5. Investigation & Admin Resolution' },
  { id: 'cancellation', title: '6. Payout Release & Cancellation Guidelines' },
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

export function DisputePolicy({ dark }) {
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
            Dispute Policy
          </h1>
          <p className={`text-sm ${textSub}`}>Effective May 20, 2026. Last updated May 20, 2026.</p>
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

            <Section id="overview" title="1. Dispute Policy Overview" dark={dark}>
              <p>
                CreatorBridge provides a structured environment for clients and creative professionals to collaborate.
                While most projects are completed successfully, disputes occasionally arise concerning deliverables,
                timelines, or communication.
              </p>
              <p>
                This Dispute Policy explains the rules and procedures governing payment disputes. Our goal is to ensure a fair
                resolution for both parties based on original project briefs and deliverables.
              </p>
            </Section>

            <Section id="payment-split" title="2. The 50/50 Payment Structure" dark={dark}>
              <p>
                To protect both clients and creators, all projects utilize a 50/50 split milestone payment model:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>50% Retainer payment</strong> is paid at booking. This secures the creator's schedule and covers pre-production costs. Work does not begin until the retainer is paid.</li>
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>50% Final payment</strong> is paid once deliverables are completed and approved by the client.</li>
              </ul>
              <p>
                Milestone payments are held securely by our processor and are only released upon approval, or automatically after
                72 hours with no client response.
              </p>
            </Section>

            <Section id="revisions" title="3. Built-In Revisions" dark={dark}>
              <p>
                Disagreements are often simply stylistic preferences that can be resolved using revisions. Unless custom packages specify
                otherwise, every project brief includes **2 rounds of standard revisions**.
              </p>
              <p>
                A revision request must:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Be filed within 72 hours of work delivery.</li>
                <li>Contain specific, actionable feedback aligned with the original project brief.</li>
                <li>Not request new services or features outside the original project scope (scope creep).</li>
              </ul>
              <p>
                Clients should always utilize the revision requests flow in the Project Board before initiating a formal dispute.
              </p>
            </Section>

            <Section id="opening" title="4. How to Open a Dispute" dark={dark}>
              <p>
                If work has been delivered, revisions have been exhausted, and both parties cannot reach an agreement,
                a formal dispute can be opened.
              </p>
              <p>
                To open a dispute:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Open the booking in your Project Board.</li>
                <li>Click the "Open Dispute" button.</li>
                <li>Provide a detailed description of why the work does not meet the brief, and attach any relevant communications or evidence.</li>
              </ul>
              <p>
                Formal disputes must be submitted within **14 days** of the last delivery upload. Opening a dispute freezes all pending
                milestone payments for that transaction.
              </p>
            </Section>

            <Section id="resolution" title="5. Investigation & Admin Resolution" dark={dark}>
              <p>
                Once a dispute is submitted, the CreatorBridge platform administration team takes over to investigate:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Evidence Review:</strong> We review the original project brief, the delivered assets,
                  all conversation histories on the platform, and the submitted revision feedback.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Response Gathering:</strong> The other party has 3 business days to submit their counter-evidence
                  or statement.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Determination:</strong> Admin will issue a final decision within 5 business days of receiving all evidence.
                </li>
              </ul>
              <p>
                Admin determinations can include: releasing 100% of the funds to the creator, returning 100% of the funds to the client,
                or a percentage split (e.g. 50% refund, 50% payout) based on the volume of work completed. All determinations are final.
              </p>
            </Section>

            <Section id="cancellation" title="6. Payout Release & Cancellation Guidelines" dark={dark}>
              <p>
                If a project is cancelled by the client before work begins:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>If cancelled before the retainer is paid: No charges apply.</li>
                <li>If cancelled after the retainer is paid: The creator receives 10% of the retainer as a scheduling fee, and the remainder is refunded to the client. The 5% client booking fee is non-refundable.</li>
              </ul>
              <p>
                If a creator fails to communicate for 7 consecutive days or abandons a project after the retainer has been paid, the client
                is entitled to a 100% refund of the retainer, and a warning is issued to the creator under the Strike Policy.
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
