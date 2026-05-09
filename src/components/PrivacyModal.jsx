import { useEffect } from 'react';
import { X } from 'lucide-react';

export function PrivacyModal({ dark, onClose }) {
  const textBody = dark ? 'text-charcoal-300' : 'text-gray-600';
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls  = `rounded-xl border p-4 my-3 ${dark ? 'border-white/[0.08] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`;
  const linkCls  = 'text-gold-400 hover:text-gold-300 underline';

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
            <h2 className={`font-display font-bold text-xl ${dark ? 'text-white' : 'text-gray-900'}`}>Privacy Policy</h2>
          </div>
          <button type="button" onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className={`flex-1 overflow-y-auto px-6 py-5 ${dark ? 'bg-[radial-gradient(circle_at_25%_0%,rgba(212,169,65,0.06),transparent_34%)]' : ''}`}>
          <p className={`text-xs mb-6 ${textSub}`}>Effective April 17, 2026. Last updated April 17, 2026.</p>

          <div className={`space-y-3 text-sm leading-relaxed ${textBody}`}>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                1. What Data We Collect
              </h2>
              <p>
                CreatorBridge collects only the information necessary to operate the marketplace. We collect:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>Account registration information: your name, email address, and phone number</li>
                <li>Profile content you provide: bio, photos, portfolio items, service descriptions, and rates</li>
                <li>Identity verification data processed by Stripe (government ID for creators receiving payments)</li>
                <li>Project and payment records: booking details, transaction amounts, and project status history</li>
                <li>Messages sent through the CreatorBridge platform messaging system</li>
                <li>Usage data: pages visited, features used, and session timestamps for platform improvement</li>
                <li>Device and browser information for security monitoring and abuse prevention</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                2. How We Store Your Data
              </h2>
              <p>
                Your data is stored securely using Supabase, a cloud database provider with enterprise-grade security.
                All data is encrypted at rest and in transit using industry-standard TLS encryption.
              </p>
              <p className="mt-2">
                Payment information is never stored on CreatorBridge servers. All payment data is handled exclusively
                by Stripe, a PCI-DSS Level 1 certified payment processor.
              </p>
              <p className="mt-2">
                Uploaded files (portfolio images, delivery files) are stored in encrypted cloud storage.
                Delivery files uploaded to CreatorBridge are automatically deleted after 7 days.
                Portfolio images and profile photos are retained as long as your account is active.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                3. How We Use Your Data
              </h2>
              <p>We use your information to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>Operate the CreatorBridge marketplace and match clients with creators</li>
                <li>Process payments and manage project escrow through Stripe</li>
                <li>Verify creator identities to maintain platform safety and trust</li>
                <li>Send notifications about project updates, messages, and platform activity</li>
                <li>Improve matching algorithms and platform features based on usage patterns</li>
                <li>Detect and prevent fraud, abuse, and violations of our Terms of Service</li>
                <li>Comply with legal obligations including tax reporting requirements</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                4. Third-Party Sharing Policy
              </h2>
              <div className={cardCls}>
                <p className={`font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Your data is never sold to third parties. Ever.</p>
              </div>
              <p>
                We share data only as strictly necessary to operate the platform:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Stripe:</strong> Payment processing, escrow management, and creator identity verification (KYC).
                  Stripe's privacy policy applies to data they handle.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Supabase:</strong> Secure database and file storage hosting.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Cloudflare:</strong> Network security, DDoS protection, and bot mitigation.
                </li>
              </ul>
              <p className="mt-2">
                We do not share your data with advertisers, data brokers, marketing platforms, or any other
                third parties beyond those listed above.
              </p>
              <p className="mt-2">
                We may disclose data when required by law, such as in response to a valid court order or legal process.
                We will notify you of such requests when legally permitted to do so.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                5. Your Rights
              </h2>
              <p>You have the following rights regarding your data:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Access:</strong> You may request a copy of all personal data we hold about you.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Correction:</strong> You may update or correct inaccurate information through your account settings at any time.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Deletion:</strong> You may request complete deletion of your account and personal data at any time.
                  Note that transaction records may be retained for up to 7 years for legal and accounting obligations.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Portability:</strong> You may request an export of your data in a standard format.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Opt-out of communications:</strong> You may unsubscribe from marketing emails at any time.
                  Transactional emails (booking confirmations, payment receipts) cannot be disabled while your account is active.
                </li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a>.
                {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
                We will respond to all requests within 30 days.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                6. Cookie Policy
              </h2>
              <p>
                CreatorBridge uses cookies and similar local storage technologies to operate the platform.
                We do not use advertising cookies or third-party tracking cookies.
              </p>
              <p className="mt-2">We use the following types of storage:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Session cookies:</strong> Required for authentication and keeping you logged in.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Local storage:</strong> Used to save your calculator preferences, draft quotes,
                  and display settings (like dark mode) so your experience persists between visits.
                </li>
                <li>
                  <strong className={dark ? 'text-white' : 'text-gray-900'}>Cloudflare cookies:</strong> Used for security and bot protection. These are set by
                  Cloudflare when you visit the site and are necessary for platform protection.
                </li>
              </ul>
              <p className="mt-2">
                You can clear cookies and local storage through your browser settings at any time.
                Clearing session cookies will log you out of your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                7. Data Retention
              </h2>
              <p>We retain your data as follows:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>Account and profile data: retained while your account is active, deleted within 30 days of account deletion request</li>
                <li>Project and transaction records: retained for 7 years for legal and accounting compliance</li>
                <li>Delivery files uploaded to CreatorBridge: automatically deleted after 7 days</li>
                <li>Platform messages: retained for 2 years, then archived</li>
                <li>Usage and analytics data: retained in anonymized form for up to 2 years</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className={`font-display font-bold text-lg mb-3 pb-2 border-b ${dark ? 'text-white border-white/[0.07]' : 'text-gray-900 border-gray-200'}`}>
                8. Contact for Privacy Requests
              </h2>
              <p>
                For any privacy-related questions, data requests, or concerns, please contact us at:
              </p>
              <div className={cardCls}>
                <p className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>CreatorBridge Privacy</p>
                <p>Email: <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a></p>
                {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
              </div>
              <p className="mt-2">
                We take privacy requests seriously and will respond within 30 days.
                For urgent matters related to account security, please mark your email subject line as "URGENT: Privacy Request."
              </p>
            </section>

            <div className={`pt-4 border-t text-xs ${dark ? 'border-white/[0.07] text-charcoal-300' : 'border-gray-200 text-gray-400'}`}>
              <p>CreatorBridge. Questions? Contact <a href="mailto:drl33@creatorbridge.studio" className={linkCls}>drl33@creatorbridge.studio</a></p>
              {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
            </div>
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
