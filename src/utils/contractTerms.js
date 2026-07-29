const CANCELLATION_COPY = 'Before the retainer is paid, either party may cancel at no cost. After the retainer is paid and before delivery, the retainer is split evenly. The creator keeps 25 percent of the project total and the client receives 25 percent of the project total. No platform fees apply to a cancelled project. After delivery, cancellations and refunds are unavailable.';
const USAGE_COPY = 'Creators retain ownership of their work unless the accepted brief or a signed agreement grants specific usage rights to the client. CreatorBridge does not claim ownership of work produced through the platform.';
const DISPUTE_COPY = 'A party may open a dispute through CreatorBridge for delivered work that does not match the agreed scope. The client review window is 72 hours after delivery. CreatorBridge reviews the agreement, project messages, and delivered work.';
const COMMUNICATION_COPY = 'Project communication, files, approvals, and payment activity remain on CreatorBridge.';

function requiredText(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function money(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a valid amount`);
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function documentNumber(contractId, generatedAt) {
  const year = new Date(generatedAt).getUTCFullYear();
  const suffix = requiredText(contractId, 'Contract ID').replaceAll('-', '').slice(0, 6).toUpperCase();
  return `CB-${year}-${suffix}`;
}

export function assembleContractTerms(source) {
  if (!source?.package) throw new Error('A verified package is required');
  const deliverables = Array.isArray(source.package.deliverables)
    ? source.package.deliverables.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  if (!deliverables.length) throw new Error('At least one package deliverable is required');

  const total = money(source?.pricing?.total, 'Project total');
  if (total <= 0) throw new Error('Project total must be greater than zero');
  const retainer = money(total * 0.5, 'Retainer');
  const final = money(total - retainer, 'Final payment');
  const creatorFeePct = money(source?.pricing?.creatorFeePct, 'Creator fee percentage');
  const clientFeePct = money(source?.pricing?.clientFeePct, 'Client fee percentage');
  const creatorFee = money(total * creatorFeePct / 100, 'Creator fee');
  const clientFee = money(total * clientFeePct / 100, 'Client fee');
  const generatedAt = new Date(requiredText(source.generatedAt, 'Generation timestamp')).toISOString();

  return {
    document: {
      number: documentNumber(source.contractId, generatedAt),
      template_version: 'v1',
    },
    parties: {
      client: {
        user_id: requiredText(source.client?.userId, 'Client user ID'),
        name: requiredText(source.client?.name, 'Client name'),
        company: String(source.client?.company || '').trim() || null,
      },
      creator: {
        user_id: requiredText(source.creator?.userId, 'Creator user ID'),
        listing_id: requiredText(source.creator?.listingId, 'Creator listing ID'),
        name: requiredText(source.creator?.name, 'Creator name'),
        business_name: requiredText(source.creator?.businessName || source.creator?.name, 'Creator business name'),
      },
    },
    project: {
      id: requiredText(source.project?.id, 'Project ID'),
      title: requiredText(source.project?.title, 'Project title'),
      description: requiredText(source.project?.description, 'Project description'),
      service_id: requiredText(source.project?.serviceId, 'Project service'),
      location: String(source.project?.location || '').trim() || null,
      timeline: String(source.project?.timeline || '').trim() || null,
      project_duration: String(source.project?.projectDuration || '').trim() || null,
      package_id: requiredText(source.package.id, 'Package ID'),
      package_name: requiredText(source.package.name, 'Package name'),
    },
    deliverables,
    timeline: {
      turnaround_days: Number.isFinite(Number(source.package.turnaroundDays)) ? Number(source.package.turnaroundDays) : null,
      project_timeline: String(source.project?.timeline || '').trim() || null,
      project_duration: String(source.project?.projectDuration || '').trim() || null,
    },
    shoot_dates: String(source.project?.timeline || '').trim() || null,
    location: String(source.project?.location || '').trim() || null,
    pricing: {
      currency: 'USD',
      total,
      retainer,
      final,
      creator_fee_pct: creatorFeePct,
      client_fee_pct: clientFeePct,
      creator_fee: creatorFee,
      client_fee: clientFee,
      creator_net: money(total - creatorFee, 'Creator net'),
    },
    revisions: Math.max(0, Math.round(Number(source.package.revisions || 0))),
    usage: USAGE_COPY,
    cancellation: CANCELLATION_COPY,
    disputes: DISPUTE_COPY,
    communication: COMMUNICATION_COPY,
    generated_at: generatedAt,
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function canonicalizeContractTerms(terms) {
  return JSON.stringify(stableValue(terms));
}

export async function hashContractTerms(terms) {
  const bytes = new TextEncoder().encode(canonicalizeContractTerms(terms));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const contractClauseCopy = Object.freeze({
  cancellation: CANCELLATION_COPY,
  usage: USAGE_COPY,
  disputes: DISPUTE_COPY,
  communication: COMMUNICATION_COPY,
});
