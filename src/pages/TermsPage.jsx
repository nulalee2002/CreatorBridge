import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SECTIONS = [
  { id: 'welcome',      title: '1. Welcome to CreatorBridge' },
  { id: 'how-it-works', title: '2. How CreatorBridge Works' },
  { id: 'accounts',     title: '3. Account Requirements' },
  { id: 'booking',      title: '4. Platform Booking Requirement' },
  { id: 'fees',         title: '5. Fees and Payments' },
  { id: 'cancellation', title: '6. Cancellation and Refunds' },
  { id: 'communication',title: '7. Communication Policy' },
  { id: 'violations',   title: '8. Violation Policy' },
  { id: 'disputes',     title: '9. Dispute Resolution' },
  { id: 'ip',           title: '10. Content and Intellectual Property' },
  { id: 'privacy',      title: '11. Privacy' },
  { id: 'changes',      title: '12. Changes to Terms' },
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

export function TermsPage({ dark }) {
  const location = useLocation();

  useEffect(() => {
    const targetHash = location.hash || (location.pathname === '/privacy' ? '#privacy' : '');
    if (targetHash) {
      const el = document.querySelector(targetHash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [location.hash, location.pathname]);

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
            Terms of Service
          </h1>
          <p className={`text-sm ${textSub}`}>Effective April 9, 2026. Last updated April 9, 2026.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">

          {/* Table of contents */}
          <aside className="lg:sticky lg:top-20 self-start">
            <div className={`${cardCls} p-4`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${textSub}`}>Contents</p>
              <nav className="space-y-1">
                {SECTIONS.map(s => (
                  <a key={s.id} href={`#${s.id}`}
                    className={`block text-xs py-1 transition-colors hover:text-gold-400 ${textSub}`}>
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div className={`${cardCls} p-8`}>

            <Section id="welcome" title="1. Welcome to CreatorBridge" dark={dark}>
              <p>
                CreatorBridge is an online platform connecting content creators with brands and clients seeking
                media production and digital content services. Our community includes video production, photography,
                and post-production specialists across US markets and specialty needs.
                We provide the tools, infrastructure, and payment system to help creative work get done safely and professionally.
              </p>
              <p>
                By creating an account or using our platform in any capacity, you agree to these Terms of Service.
                If you do not agree, please do not use CreatorBridge.
              </p>
              <p>
                These terms apply to all users of the platform: creators offering services, clients seeking services,
                and any visitors browsing the marketplace.
              </p>
            </Section>

            <Section id="how-it-works" title="2. How CreatorBridge Works" dark={dark}>
              <p>
                CreatorBridge operates as a two-sided marketplace. Creators list their services, packages, and rates.
                Clients browse the directory, request quotes, and book projects through the platform.
              </p>
              <p>
                All financial transactions are processed through CreatorBridge using Stripe, a licensed payment processor.
                CreatorBridge never holds funds indefinitely: payment is split into a 50% retainer at booking and 50% upon
                project completion and approval. Funds are released to the creator after client approval or after 72 hours
                with no response.
              </p>
              <p>
                CreatorBridge earns revenue through a platform fee charged to both parties. This fee structure is described
                in Section 5. Fees and Payments.
              </p>
            </Section>

            <Section id="accounts" title="3. Account Requirements" dark={dark}>
              <p>
                To use CreatorBridge, you must:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Be at least 18 years of age</li>
                <li>Provide accurate, truthful registration information</li>
                <li>Verify your email address</li>
                <li>Agree to these Terms of Service</li>
                <li>Maintain a valid email address on your account at all times</li>
              </ul>
              <p>
                Creators must additionally connect a Stripe payment account to receive payments. Identity verification
                is handled automatically through Stripe's Know Your Customer (KYC) process.
              </p>
              <p>
                You are responsible for maintaining the security of your account credentials. CreatorBridge is not
                liable for losses resulting from unauthorized account access due to your failure to secure your credentials.
              </p>
            </Section>

            <Section id="booking" title="4. Platform Booking Requirement" dark={dark}>
              <p>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Any client who discovers a creator through CreatorBridge must book all projects with that creator
                through the CreatorBridge platform for a period of 24 months from the date of initial introduction.</strong>
              </p>
              <p>
                This requirement applies equally to both parties:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Clients may not contact, hire, or pay creators discovered on CreatorBridge outside of the platform during this 24-month period.</li>
                <li>Creators may not solicit, accept, or fulfill work from clients introduced through CreatorBridge outside of the platform during this 24-month period.</li>
              </ul>
              <p>
                Circumventing this requirement is a serious violation and may result in account suspension and recovery
                of any platform fees that would have been due. We implement monitoring systems including message filtering
                and usage analysis to detect off-platform arrangements.
              </p>
              <p>
                This policy exists to protect the sustainability of the platform and ensure that the creators and
                clients we connect can continue to use our services at reasonable cost.
              </p>
            </Section>

            <Section id="fees" title="5. Fees and Payments" dark={dark}>
              <p>
                CreatorBridge charges the following platform fees:
              </p>
              <div className={`rounded-xl border p-4 my-3 ${dark ? 'border-white/[0.08] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between"><span>Client booking fee</span><span className="font-bold">5% of project total</span></div>
                  <div className="flex justify-between"><span>Creator platform fee (Standard tier)</span><span className="font-bold">10% of earnings</span></div>
                  <div className="flex justify-between"><span>Creator platform fee (Silver tier, 10+ projects)</span><span className="font-bold">8% of earnings</span></div>
                  <div className="flex justify-between"><span>Creator platform fee (Gold tier, 25+ projects)</span><span className="font-bold">6% of earnings</span></div>
                </div>
              </div>
              <p>
                The Loyalty Fee Reduction Program rewards creators for long-term platform use. Fees automatically
                decrease as you complete more projects through CreatorBridge.
              </p>
              <p>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Payment structure:</strong> Projects are split into two payments.
                50% is due as a retainer when the project is accepted and before work begins.
                The remaining 50% is due upon project completion and client approval.
              </p>
              <p>
                All payments are processed through Stripe and are subject to Stripe's standard processing fees,
                which are included in the amounts displayed at checkout. CreatorBridge does not charge additional
                payment processing fees beyond those shown.
              </p>
            </Section>

            <Section id="cancellation" title="6. Cancellation and Refunds" dark={dark}>
              <p>
                Cancellation policies depend on the project stage:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>Before retainer is paid:</strong> Either party may cancel at no cost. No fees are charged.</li>
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>After retainer paid, before work begins:</strong> Client may cancel. Creator retains 10% of the retainer as a cancellation fee. The remaining 90% of the retainer is refunded to the client minus the 5% client booking fee, which is non-refundable.</li>
                <li><strong className={dark ? 'text-white' : 'text-gray-900'}>After work has begun:</strong> Cancellations are handled through the dispute process. Outcomes depend on how much work was completed.</li>
              </ul>
              <p>
                Refunds, when applicable, are processed within 5 to 10 business days depending on your bank or payment provider.
              </p>
            </Section>

            <Section id="communication" title="7. Communication Policy" dark={dark}>
              <p>
                All initial communication between clients and creators must occur through the CreatorBridge messaging system.
                This protects both parties and ensures a record of project discussions.
              </p>
              <p>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Sharing contact information through the platform's messaging system before a paid booking is completed is a violation of these Terms.</strong>{' '}
                This includes email addresses, phone numbers, website URLs, and social media handles.
              </p>
              <p>
                CreatorBridge uses automated message filtering to detect and block contact information in messages.
                Repeated attempts to share contact information through messages will trigger the violation system
                described in Section 8.
              </p>
              <p>
                After a paid retainer is processed, direct contact information (email and phone) becomes visible
                to the specific client who booked, so project communication may continue through any channel.
              </p>
            </Section>

            <Section id="violations" title="8. Violation Policy" dark={dark}>
              <p>
                CreatorBridge operates a three-strike violation system to protect the community:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Strike 1:</strong> A warning is issued and displayed on your account dashboard.
                  "Your account has received a warning for [reason]. Repeated violations may result in suspension."
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Strike 2:</strong> A 30-day feature restriction is applied.
                  Your profile is deprioritized in search results and marked "Under Review."
                  Clients have reduced access to posting new projects.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Strike 3:</strong> Your account is suspended.
                  Your profile is removed from the directory. You cannot send messages or accept projects.
                  You must contact <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a> to appeal.
                </li>
              </ul>
              <p>
                Violations may be issued for: repeated attempts to share contact information in messages,
                off-platform booking arrangements, fraudulent reviews, abusive behavior toward other users,
                or any other breach of these Terms.
              </p>
              <p>
                Users may also report violations using the Report button available on creator profiles and in messages.
                Reports are reviewed by our team within 2 business days.
              </p>
            </Section>

            <Section id="disputes" title="9. Dispute Resolution" dark={dark}>
              <p>
                If a client and creator cannot agree on whether deliverables meet the project requirements,
                either party may open a formal dispute through the platform.
              </p>
              <p>
                The dispute process:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>The disputing party submits a description and selects a reason category</li>
                <li>CreatorBridge reviews the dispute within 2 business days</li>
                <li>Both parties may be asked to provide additional documentation or context</li>
                <li>CreatorBridge issues a determination: full release to creator, partial release, full refund to client, or mediated split</li>
                <li>All dispute determinations are final</li>
              </ul>
              <p>
                During an active dispute, payment is held by the platform and not released to either party
                until resolution. Disputes must be filed within 14 days of project delivery.
              </p>
            </Section>

            <Section id="ip" title="10. Content and Intellectual Property" dark={dark}>
              <p>
                Creators retain full ownership of all work they produce unless otherwise agreed in a signed contract
                with the client. CreatorBridge makes no claim to ownership of any creative work produced through projects
                booked on the platform.
              </p>
              <p>
                Usage rights for project deliverables are defined by the agreement between client and creator.
                When no explicit usage rights agreement exists, the following defaults apply:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Client receives non-exclusive personal use rights</li>
                <li>Commercial use requires explicit creator agreement</li>
                <li>Creator may display the work in their portfolio unless otherwise agreed</li>
              </ul>
              <p>
                By listing on CreatorBridge, creators grant us a non-exclusive license to display portfolio items
                and profile content for the purpose of operating the marketplace. This license ends when you remove
                the content or delete your account.
              </p>
            </Section>

            <Section id="privacy" title="11. Privacy" dark={dark}>
              <p>
                CreatorBridge collects only the information necessary to operate the marketplace. This includes:
                account registration data, profile content you provide, project and payment records,
                and usage data for platform improvement.
              </p>
              <p>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Your data is never sold to third parties.</strong>{' '}
                We share data only as required to process payments (Stripe), verify identity (Stripe KYC),
                and fulfill legal obligations.
              </p>
              <p>
                We use message content filtering to detect contact information violations. Flagged message patterns are
                logged by pattern type only. The actual message text is not stored in violation logs.
              </p>
              <p>
                You may request deletion of your account and associated data at any time by contacting
                {' '}<a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a>.
                Note that transaction records may be retained for legal and accounting purposes.
              </p>
            </Section>

            <Section id="changes" title="12. Changes to Terms" dark={dark}>
              <p>
                CreatorBridge reserves the right to update these Terms of Service at any time.
                When changes are made, we will notify active users by email with at least 30 days notice
                before the new terms take effect.
              </p>
              <p>
                Continued use of the platform after the effective date of updated terms constitutes acceptance
                of those terms. If you do not agree to updated terms, you must stop using CreatorBridge before
                the effective date and may request account deletion.
              </p>
              <p>
                Minor clarifications or corrections that do not materially change your rights or obligations
                may be made without the 30-day notice period.
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
