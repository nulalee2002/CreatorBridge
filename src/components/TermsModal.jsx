import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

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
    <section id={`terms-${id}`} className="scroll-mt-4 mb-8">
      <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
        {title}
      </h2>
      <div className={`space-y-3 text-sm leading-relaxed ${textBody}`}>
        {children}
      </div>
    </section>
  );
}

export function TermsModal({ dark, onClose }) {
  const scrollRef = useRef(null);
  const linkCls = 'text-gold-400 hover:text-gold-300 underline';
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${
        dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_28px_90px_rgba(0,0,0,0.46)]' : 'bg-white border-gray-200'
      }`}>
        <div className="h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent shrink-0" />
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? 'border-white/[0.07] bg-charcoal-950/80' : 'border-gray-200 bg-gray-50'} shrink-0`}>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textSub}`}>Legal</p>
            <h2 className={`font-display font-bold text-xl ${dark ? 'text-white' : 'text-gray-900'}`}>Terms of Service</h2>
          </div>
          <button type="button" onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className={`flex-1 overflow-y-auto px-6 py-5 space-y-1 ${dark ? 'bg-[radial-gradient(circle_at_25%_0%,rgba(212,169,65,0.06),transparent_34%)]' : ''}`}>
          <p className={`text-xs mb-6 ${textSub}`}>Effective April 9, 2026. Last updated April 9, 2026.</p>

          {/* Table of contents */}
          <div className={`rounded-xl border p-4 mb-6 ${dark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Contents</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {SECTIONS.map(s => (
                <button key={s.id} type="button"
                  onClick={() => {
                    const el = scrollRef.current?.querySelector(`#terms-${s.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`text-xs text-left py-0.5 transition-colors hover:text-gold-400 ${textSub}`}>
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <Section id="welcome" title="1. Welcome to CreatorBridge" dark={dark}>
            <p>
              CreatorBridge is an online platform connecting content creators with brands and clients seeking
              media production and digital content services. Our community includes videographers, photographers,
              podcast producers, drone operators, and other creative professionals across every market and specialty.
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
              <li>Verify your phone number via SMS during signup</li>
              <li>Agree to these Terms of Service</li>
            </ul>
            <p>
              Creators must additionally:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Complete identity verification through Stripe Connect (required for all creators before receiving payments)</li>
              <li>Carry their own business insurance and professional liability coverage</li>
            </ul>
            <p>
              Identity verification for creators is handled automatically through Stripe's Know Your Customer (KYC) process.
            </p>
            <p>
              Each creator may only maintain one active profile on CreatorBridge. Creating multiple profiles
              is a violation of these Terms and may result in suspension of all associated accounts.
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
              of any platform fees that would have been due.
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
              <strong className={dark ? 'text-white' : 'text-gray-900'}>Payment structure:</strong> Projects are split into two payments.
              50% is due as a retainer when the project is accepted and before work begins.
              The remaining 50% is due upon project completion and client approval.
            </p>
          </Section>

          <Section id="cancellation" title="6. Cancellation and Refunds" dark={dark}>
            <p>
              CreatorBridge uses a simple three-rule cancellation policy to protect both clients and creators.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Rule 1 - Before work begins:</strong> Creator keeps 25% as a cancellation fee. Client receives a 75% refund.
                This applies when the project has been accepted but the creator has not yet started production.
              </li>
              <li>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Rule 2 - After work begins:</strong> Creator keeps 50% of the total project value.
                Client receives a 50% refund. This applies once the creator has actively started production.
              </li>
              <li>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Rule 3 - After delivery:</strong> No refund. Creator retains 100% of the project payment once work has been delivered.
              </li>
            </ul>
            <p>
              Refunds, when applicable, are processed within 5 to 10 business days depending on your bank or payment provider.
              All cancellations are final and cannot be undone.
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
              </li>
              <li>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Strike 2:</strong> A 30-day feature restriction is applied.
                Your profile is deprioritized in search results and marked "Under Review."
              </li>
              <li>
                <strong className={dark ? 'text-white' : 'text-gray-900'}>Strike 3:</strong> Your account is suspended.
                {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
                You must contact <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a> to appeal.
              </li>
            </ul>
          </Section>

          <Section id="disputes" title="9. Dispute Resolution" dark={dark}>
            <p>
              If a client and creator cannot agree on whether deliverables meet the project requirements,
              either party may open a formal dispute through the platform. CreatorBridge reviews the dispute
              within 2 business days and issues a final determination.
            </p>
            <p>
              Disputes must be filed within 14 days of project delivery.
            </p>
          </Section>

          <Section id="ip" title="10. Content and Intellectual Property" dark={dark}>
            <p>
              Creators retain full ownership of all work they produce unless otherwise agreed in a signed contract
              with the client. CreatorBridge makes no claim to ownership of any creative work produced through projects
              booked on the platform.
            </p>
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
              {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
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
              of those terms.
            </p>
          </Section>

          <div className={`pt-4 border-t text-xs ${dark ? 'border-white/[0.07] text-charcoal-300' : 'border-gray-200 text-gray-400'}`}>
            {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
            <p>CreatorBridge Inc. Questions? Contact <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a></p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${dark ? 'border-white/[0.07] bg-charcoal-950/80' : 'border-gray-200'} shrink-0`}>
          <button type="button" onClick={onClose}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
              dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'
            }`}>
            Close
          </button>
          <button type="button" onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
