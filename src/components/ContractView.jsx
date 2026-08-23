import { Download, FileCheck2, ShieldCheck } from 'lucide-react';

const LOGO = '/images/brand/creatorbridge-platform-logo-transparent.png';

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function displayService(value) {
  return String(value || 'Creative production')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function Clause({ number, title, children }) {
  return (
    <section className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-6">
      <div className="pt-0.5 text-center font-display text-4xl text-[#c46540]">{number}</div>
      <div className="min-w-0">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c9a15e] sm:text-xs">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function SignatureBlock({ role, signature, name, imageUrl }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="flex h-16 items-end justify-center overflow-hidden px-3">
        {imageUrl ? (
          <img src={imageUrl} alt={`${role} signature`} className="h-14 max-w-full object-contain [filter:invert(94%)_sepia(12%)_saturate(362%)]" />
        ) : signature ? (
          <span className="text-4xl text-[#f3eadb]" style={{ fontFamily: '"Pinyon Script", cursive' }}>{signature.signer_name}</span>
        ) : (
          <span className="font-display text-sm italic text-[#8a806e]">awaiting signature</span>
        )}
      </div>
      <div className="mx-2 h-px bg-[#c9a15e]/45" />
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c9a15e]">The {role}</p>
      <p className="mt-2 text-[10px] text-[#8a806e]">
        {signature ? `Signed electronically, ${dateLabel(signature.signed_at)}` : `Prepared for ${name}`}
      </p>
    </div>
  );
}

export function ContractView({ contract, signatures = [], signatureUrls = {}, onDownload, downloading = false, compact = false }) {
  const terms = contract?.terms;
  if (!terms) return null;
  const pricing = terms.pricing || {};
  const client = terms.parties?.client || {};
  const creator = terms.parties?.creator || {};
  const clientSignature = signatures.find(item => item.signer_role === 'client');
  const creatorSignature = signatures.find(item => item.signer_role === 'creator');
  const contractStatus = String(contract.status || 'draft').replaceAll('_', ' ');

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <span className="tag-forest inline-flex items-center gap-2 capitalize"><ShieldCheck size={13} /> {contractStatus}</span>
        {onDownload && (
          <button type="button" onClick={onDownload} disabled={downloading || !contract.pdf_ref} className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40">
            <Download size={14} /> {downloading ? 'Preparing PDF' : 'Download PDF'}
          </button>
        )}
      </div>

      <article className="relative overflow-hidden rounded-lg border border-[#c9a15e]/30 bg-[linear-gradient(180deg,#1a130c,#151009_42%,#120d07)] text-[#f3eadb] shadow-[0_42px_120px_rgba(0,0,0,0.58)]">
        <div className="pointer-events-none absolute inset-3 rounded border border-[#c9a15e]/35 before:absolute before:inset-1 before:rounded-sm before:border before:border-[#c9a15e]/15" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <img src={LOGO} alt="" className="w-[68%] max-w-[560px] opacity-[0.035]" />
        </div>

        <div className={`relative ${compact ? 'px-7 py-8 sm:px-10' : 'px-7 py-10 sm:px-14 sm:py-12'}`}>
          <header className="flex items-start justify-between gap-5 border-b border-[#c9a15e]/35 pb-5">
            <img src={LOGO} alt="CreatorBridge verified media platform" className="h-auto w-[190px] max-w-[52%] object-contain sm:w-[245px]" />
            <div className="shrink-0 text-right text-[9px] uppercase tracking-[0.26em] text-[#8a806e] sm:text-[10px]">
              <p className="font-semibold text-[#c9a15e]">No. {terms.document?.number}</p>
              <p className="mt-2">Issued {dateLabel(terms.generated_at)}</p>
            </div>
          </header>

          <div className="mx-auto mb-10 mt-9 max-w-[720px] text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#c9a15e] sm:text-[10px]">Auto-generated from the accepted brief</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-none text-[#f7efe1] sm:text-6xl">Production Agreement</h1>
            <div className="my-5 flex items-center justify-center gap-3 text-[#c9a15e]">
              <span className="h-px w-20 bg-gradient-to-r from-transparent to-[#c9a15e]/70" />
              <span className="h-2 w-2 rotate-45 border border-[#c9a15e]" />
              <span className="h-px w-20 bg-gradient-to-l from-transparent to-[#c9a15e]/70" />
            </div>
            <p className="text-sm leading-6 text-[#b3a892]">
              Between <strong className="text-[#f3eadb]">{client.name}</strong>{client.company ? ` for ${client.company}` : ''}, the Client, and <strong className="text-[#f3eadb]">{creator.business_name || creator.name}</strong>, the Creator, facilitated and protected by CreatorBridge.
            </p>
          </div>

          <div className="space-y-9">
            <Clause number="I" title="Project scope">
              <p className="text-sm leading-7 text-[#b3a892]"><strong className="text-[#e7dcc9]">{displayService(terms.project?.service_id)}</strong> · {terms.project?.title}. {terms.project?.description}</p>
            </Clause>

            <Clause number="II" title="Deliverables and timeline">
              <ul className="space-y-1">
                {(terms.deliverables || []).map(deliverable => (
                  <li key={deliverable} className="relative border-b border-[#c9a15e]/10 py-2 pl-5 text-sm leading-6 text-[#b3a892] before:absolute before:left-0 before:top-[17px] before:h-1.5 before:w-1.5 before:rotate-45 before:bg-[#c46540]">{deliverable}</li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-7 text-[#b3a892]"><strong className="text-[#e7dcc9]">Location</strong> {terms.location || 'As agreed'} · <strong className="text-[#e7dcc9]">Project timing</strong> {terms.timeline?.project_timeline || 'As agreed'} · <strong className="text-[#e7dcc9]">Delivery</strong> {terms.timeline?.turnaround_days ? `within ${terms.timeline.turnaround_days} days` : 'as stated in the brief'} · <strong className="text-[#e7dcc9]">Revisions</strong> {terms.revisions} rounds included.</p>
            </Clause>

            <Clause number="III" title="Fees and protected payment">
              <div className="border-y border-[#c9a15e]/35">
                {[
                  ['Project total', money(pricing.total)],
                  ['Retainer to book, 50 percent', money(pricing.retainer)],
                  ['Final on approved delivery, 50 percent', money(pricing.final)],
                  [`Client booking fee, ${pricing.client_fee_pct} percent`, money(pricing.client_fee)],
                  [`Creator platform fee, ${pricing.creator_fee_pct} percent`, `-${money(pricing.creator_fee)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-5 border-b border-[#c9a15e]/10 px-1 py-3 last:border-0">
                    <span className="text-xs text-[#b3a892] sm:text-sm">{label}</span>
                    <span className="shrink-0 font-display text-xl tabular-nums text-[#f3eadb]">{value}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-baseline justify-between gap-5 border-l-[3px] border-[#65b685] bg-gradient-to-r from-[#1f3a2e]/45 to-transparent px-4 py-4">
                  <span className="text-sm font-semibold text-[#f3eadb]">Estimated creator net</span>
                  <span className="shrink-0 font-display text-2xl font-semibold tabular-nums text-[#eaf3ec]">{money(pricing.creator_net)}</span>
                </div>
              </div>
              <p className="mt-4 text-xs italic leading-6 text-[#8a806e]">CreatorBridge uses protected payment through Stripe. The final payment is attempted after client approval, or automatically five calendar days after delivery if the client does not respond.</p>
            </Clause>

            <Clause number="IV" title="Cancellation, usage, and disputes">
              <p className="text-sm leading-7 text-[#b3a892]">{terms.cancellation}</p>
              <p className="mt-3 text-sm leading-7 text-[#b3a892]">{terms.usage}</p>
              <p className="mt-3 text-sm leading-7 text-[#b3a892]">{terms.disputes}</p>
            </Clause>

            <Clause number="V" title="Platform communication">
              <p className="text-sm leading-7 text-[#b3a892]">{terms.communication}</p>
            </Clause>
          </div>

          <div className="relative mt-10 border-t border-[#c9a15e]/35 pt-7">
            <p className="text-center font-display text-lg italic text-[#b3a892]">In witness whereof, the parties execute this agreement.</p>
            <div className="mt-6 flex flex-col gap-8 sm:flex-row sm:gap-10">
              <SignatureBlock role="Creator" signature={creatorSignature} name={creator.name} imageUrl={signatureUrls[creatorSignature?.id]} />
              <SignatureBlock role="Client" signature={clientSignature} name={client.name} imageUrl={signatureUrls[clientSignature?.id]} />
            </div>
            <div className="pointer-events-none absolute right-[12%] top-3 hidden h-24 w-24 rotate-[-11deg] items-center justify-center rounded-full border border-[#c9a15e]/55 sm:flex">
              <span className="absolute inset-1.5 rounded-full border border-dashed border-[#c9a15e]/45" />
              <div className="text-center">
                <img src={LOGO} alt="" className="mx-auto w-14 opacity-80" />
                <span className="mt-1 block text-[7px] uppercase tracking-[0.22em] text-[#c9a15e]">Verified</span>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-[#c9a15e]/15 pt-5 text-center text-[10px] italic leading-5 text-[#8a806e]">
            Both parties review and sign the same document. CreatorBridge records each signature against the exact document hash and never signs on behalf of either party.
          </div>
        </div>
      </article>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-[#8a806e]">
        <FileCheck2 size={12} /> Document hash: <span className="max-w-[220px] truncate font-mono sm:max-w-none">{contract.content_hash}</span>
      </div>
    </div>
  );
}
