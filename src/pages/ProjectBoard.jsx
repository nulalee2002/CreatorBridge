import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Plus, MapPin, DollarSign,
  Check, X, Search, Send, Users,
  Star, Calendar, CreditCard, ThumbsUp, RotateCcw, Zap,
  Upload, AlertCircle, Timer, Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { normalizeServiceId } from '../data/rates.js';
import { PILLARS, LEGACY_SERVICE_TO_PILLAR } from '../data/taxonomy.js';
import { PROJECT_STATUSES, statusBadgeClass } from '../config/fees.js';
import { ProjectTimeline } from '../components/ProjectTimeline.jsx';
import { DisputeModal } from '../components/DisputeModal.jsx';
import { CancellationModal } from '../components/CancellationModal.jsx';
import { ClientReputationBadge, loadClientReputation, RateClientModal } from '../components/ClientReputationBadge.jsx';
import { ReferralSection } from '../components/ReferralSection.jsx';
import { ClientVerification } from '../components/ClientVerification.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { appendReferenceLinksToText, parseReferenceLinks, sanitizeLongText, sanitizePlainText, sanitizeTagList, clampNumber, sanitizeUrl } from '../utils/inputSecurity.js';
import { checkMessage, logFilterEvent } from '../utils/messageFilter.js';
import { sendNotificationEmail } from '../lib/notifications.js';
import {
  fromSupabaseProject,
  loadLocalProjects,
  mergeProjects,
  sanitizeProjectDraft,
  saveLocalProjects,
  upsertLocalProject,
} from '../utils/projectStorage.js';
import { HandoffPage } from '../components/HandoffPage.jsx';
import { handoffPages } from '../data/handoffPages.js';
import { ProjectWorkspaces } from '../components/collaboration/ProjectWorkspaces.jsx';
import { DeliveryAnchorForm } from '../components/collaboration/DeliveryAnchorForm.jsx';
import { CollaborationReviewActions } from '../components/collaboration/CollaborationReviewActions.jsx';
import {
  CLIENT_MINIMUM_PROJECT_ERROR,
  CLIENT_MINIMUM_PROJECT_NOTE,
  CREATOR_MINIMUM_PROJECT_ERROR,
  CREATOR_MINIMUM_PROJECT_NOTE,
  MINIMUM_PROJECT_BUDGET_DOLLARS,
} from '../config/margins.js';

// ── localStorage helpers ────────────────────────────────────────
function loadProjects() {
  return loadLocalProjects();
}
function saveProjects(projects) {
  saveLocalProjects(projects);
}
function loadApplications() {
  try { return JSON.parse(localStorage.getItem('cm-applications') || '[]'); } catch { return []; }
}
function saveApplications(apps) {
  localStorage.setItem('cm-applications', JSON.stringify(apps));
}

function fromSupabaseApplication(row, listing = null) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    creatorId: row.listing_id,
    creatorName: listing?.business_name || listing?.name || 'Creator',
    creatorAvatar: listing?.avatar || '🎬',
    proposal: row.message || '',
    rate: row.proposed_rate,
    status: row.status || 'pending',
    payoutReady: listing?.stripe_account_id ? true : listing?.stripe_account_id === null ? false : undefined,
    createdAt: row.created_at,
    source: 'supabase',
  };
}

function mergeApplications(...lists) {
  const byId = new Map();
  lists.flat().filter(Boolean).forEach(app => {
    if (!app?.id) return;
    const current = byId.get(app.id) || {};
    byId.set(app.id, { ...current, ...app });
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || a.created_at || 0).getTime();
    const bTime = new Date(b.createdAt || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

function loadMyListing(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
    return all.find(c => c.user_id === userId) || null;
  } catch { return null; }
}

function fromCreatorListingRow(row) {
  if (!row) return null;
  return {
    ...row,
    businessName: row.business_name || row.businessName || row.name || '',
    name: row.name || row.business_name || row.businessName || 'Creator',
    avatar: row.avatar || '🎬',
    user_id: row.user_id,
  };
}

function locationStr(loc) {
  if (!loc) return '';
  if (typeof loc === 'object') {
    return [loc.city, loc.state].filter(Boolean).join(', ') || loc.address || '';
  }
  return String(loc);
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const BUDGET_RANGES = [
  { id: 'any',        label: 'Any budget' },
  { id: 'under500',   label: 'Under $500',     min: 0,    max: 500   },
  { id: '500-1500',   label: '$500–$1,500',    min: 500,  max: 1500  },
  { id: '1500-5000',  label: '$1,500–$5,000',  min: 1500, max: 5000  },
  { id: 'over5000',   label: '$5,000+',         min: 5000, max: Infinity },
];

// ── Delivery helpers ─────────────────────────────────────────────
const STORAGE_NOTICE = 'Note: Files uploaded directly to CreatorBridge are stored for 7 days and then permanently deleted. Creators are required to retain their own copies for 6 months. Clients should download all files within 7 days of delivery.';

function getRemainingHours(deliveredAt) {
  if (!deliveredAt) return null;
  const diff = 72 * 3600000 - (Date.now() - new Date(deliveredAt).getTime());
  if (diff <= 0) return 0;
  return Math.ceil(diff / 3600000);
}

function isArchived(project) {
  if (project.status !== 'delivered' && project.status !== 'completed') return false;
  if (!project.deliveredAt) return false;
  return Date.now() - new Date(project.deliveredAt).getTime() > 7 * 24 * 3600000;
}

function updateProject(id, patch) {
  const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
  const updated = all.map(p => p.id === id ? { ...p, ...patch } : p);
  localStorage.setItem('cm-projects', JSON.stringify(updated));
  return updated;
}

function updateApplicationStatus(applicationId, status) {
  const all = loadApplications();
  const updated = all.map(app => app.id === applicationId ? { ...app, status } : app);
  saveApplications(updated);
  return updated;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function getProjectPillarId(project) {
  const rawServiceId = project?.primary_pillar || project?.serviceId || project?.service_id || project?.serviceType;
  if (PILLARS[rawServiceId]) return rawServiceId;
  return LEGACY_SERVICE_TO_PILLAR[normalizeServiceId(rawServiceId)]?.pillar || 'video_production';
}

function getProjectPillar(project) {
  return PILLARS[getProjectPillarId(project)] || PILLARS.video_production;
}

// ── Delivery Submit Modal ────────────────────────────────────────
function DeliverySubmitModal({ project, dark, onClose, onDelivered, creatorName }) {
  const [link, setLink]           = useState('');
  const [notes, setNotes]         = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  async function handleSubmit() {
    const cleanLink = sanitizeUrl(link, 500);
    const cleanNotes = sanitizeLongText(notes, 2000);
    if (!cleanLink) { setError('Please add a valid delivery link.'); return; }
    if (!confirmed)   { setError('Please confirm that you have kept your own copy of the delivered files.'); return; }
    setSaving(true);
    setError('');
    const deliveredAt = new Date().toISOString();
    const patch = {
      status:      'delivered',
      deliveredAt,
      deliveryLink: cleanLink,
      deliveryNotes: cleanNotes,
    };
    
    let clientEmail = project.clientEmail || project.client_email || '';
    try {
      if (supabaseConfigured && isUuid(project.id)) {
        const { data, error: deliveryError } = await supabase
          .from('projects')
          .update({
            status: 'delivered',
            delivered_at: deliveredAt,
            delivery_link: cleanLink,
            delivery_notes: cleanNotes,
          })
          .eq('id', project.id)
          .select('id')
          .maybeSingle();

        if (deliveryError) throw deliveryError;
        if (!data?.id) throw new Error('Delivery could not be saved. Please refresh and try again.');
      }

      const updated = updateProject(project.id, patch);
      onDelivered?.(updated.find(p => p.id === project.id));

      // Send delivery_submitted email
      sendNotificationEmail(clientEmail, 'delivery_submitted', {
        client_name: project.clientName || 'Client',
        project_title: project.title,
        creator_name: creatorName || 'Creator'
      });

      onClose();
    } catch (err) {
      setError(err?.message || 'Delivery could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${dark ? 'bg-charcoal-950/70 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>
        <div className="p-6 space-y-4">
          <h3 className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>Submit Delivery</h3>
          <div>
            <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Delivery Link *</p>
            <input type="url" value={link} onChange={e => setLink(e.target.value)}
              placeholder="Google Drive, Dropbox, WeTransfer, Vimeo, Frame.io, or any URL"
              className={inputCls} />
            <p className={`text-[10px] mt-1 ${textSub}`}>Share a link to your completed deliverables. Make sure it is set to view-only or shared properly with the client.</p>
          </div>
          <div>
            <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Or upload a small file directly (PDFs, images, audio only. Max 200MB)</p>
            <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <Upload size={13} />
              <span className="text-sm">Choose file...</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.mp3,.wav,.aac" className="hidden" />
            </label>
          </div>
          <div>
            <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Delivery Notes (optional)</p>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any notes for the client about this delivery, file format, password if needed, etc."
              className={`${inputCls} resize-none`} />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-gold-500 shrink-0" />
            <span className={`text-xs leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              I confirm that I have kept my own copy of all delivered files and will retain them for a minimum of 6 months in case the client requests re-delivery.
            </span>
          </label>
          <div className={`rounded-xl border p-3 text-[10px] leading-relaxed ${dark ? 'border-white/[0.07] bg-charcoal-900/72 text-charcoal-300' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
            {STORAGE_NOTICE}
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
            <Send size={14} /> {saving ? 'Saving...' : 'Submit Delivery'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Revision Request Modal ───────────────────────────────────────
function RevisionRequestModal({ project, dark, onClose, onRevisionSubmitted }) {
  const [details, setDetails] = useState('');
  const [error, setError]     = useState('');
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  const revisionCount = project.revision_count || 0;
  const isPaidRevision = revisionCount >= 2;

  async function handleSubmit() {
    const cleanDetails = sanitizeLongText(details, 2000);
    if (cleanDetails.length < 50) { setError('Please describe what needs to change (at least 50 characters).'); return; }
    if (!isPaidRevision) {
      const newCount = revisionCount + 1;
      const patch = {
        status:         'in_progress',
        revision_count: newCount,
        deliveredAt:    null,
      };
      const updated = updateProject(project.id, patch);
      if (supabaseConfigured && isUuid(project.id)) {
        try {
          await supabase
            .from('projects')
            .update({
              status: 'in_progress',
              revision_count: newCount,
              delivered_at: null,
            })
            .eq('id', project.id);
        } catch {}
      }
      onRevisionSubmitted?.(updated.find(p => p.id === project.id));
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${dark ? 'bg-charcoal-950/70 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>
        <div className="p-6 space-y-4">
          <h3 className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>Request a Revision</h3>
          {isPaidRevision ? (
            <div className={`rounded-xl border p-4 ${dark ? 'border-gold-500/30 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
              <p className={`text-sm font-semibold ${dark ? 'text-gold-400' : 'text-gold-700'}`}>Free revisions used ({revisionCount} of 2)</p>
              <p className={`text-xs mt-1 ${dark ? 'text-gold-300/80' : 'text-gold-600'}`}>
                You have used your 2 included free revisions. A third revision requires an additional payment. The creator will provide a quote for the additional revision work.
              </p>
            </div>
          ) : (
            <div className={`rounded-xl border p-3 text-xs ${dark ? 'border-white/[0.07] bg-charcoal-900/72 text-charcoal-300' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
              Revision {revisionCount + 1} of 2 free revisions
            </div>
          )}
          <div>
            <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Describe what needs to be changed or improved. *</p>
            <textarea rows={4} value={details} onChange={e => setDetails(e.target.value)}
              placeholder="Be specific about what needs to change. The more detail you provide, the better the result."
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          {isPaidRevision ? (
            <button type="button" onClick={onClose}
              className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
              Request Paid Revision (Contact Creator)
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
              <RotateCcw size={14} /> Submit Revision Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Re-Delivery Request (Archived) ───────────────────────────────
function ArchivedProjectNotice({ project, dark, onStatusChange }) {
  const [requested, setRequested] = useState(false);
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  function requestRedelivery() {
    // $30 charge would go through Stripe - for now record the request
    const all = JSON.parse(localStorage.getItem('cm-redelivery-requests') || '[]');
    all.push({ projectId: project.id, requestedAt: new Date().toISOString() });
    localStorage.setItem('cm-redelivery-requests', JSON.stringify(all));
    setRequested(true);
  }

  return (
    <div className={`rounded-xl border p-4 ${dark ? 'border-white/[0.07] bg-charcoal-900/72' : 'border-gray-200 bg-gray-50'}`}>
      <p className={`text-sm font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Files Removed</p>
      <p className={`text-xs mb-3 ${textSub}`}>
        The files for this project were removed from CreatorBridge storage after 7 days as per our storage policy. You can request re-delivery from the creator for a $30 retrieval fee.
      </p>
      {requested ? (
        <p className="text-xs text-gold-400 font-medium">Re-delivery requested. The creator has been notified.</p>
      ) : (
        <button type="button" onClick={requestRedelivery}
          className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all">
          Request Re-Delivery ($30)
        </button>
      )}
    </div>
  );
}

// ── Post Job Modal ───────────────────────────────────────────────
function PostProjectModal({ dark, onClose, onPost, user }) {
  const [form, setForm] = useState({
    title: '', description: '', serviceId: '', budgetMin: '', budgetMax: '',
    projectDuration: '', deadline: '', location: '', remote: true, skills: '',
    referenceLinks: '',
  });
  const [errors, setErrors] = useState({});
  const [isPosting, setIsPosting] = useState(false);
  const [clientProfile, setClientProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = (field) => `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    errors[field]
      ? 'border-red-500 bg-red-500/5'
      : dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
             : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;
  const clientPhoneVerified = !!clientProfile?.phone_verified && !!clientProfile?.phone_verified_at;
  const clientProfileComplete = !!clientProfile?.display_name && !!clientProfile?.tos_accepted_at;
  const canPostBrief = !supabaseConfigured || (!!user && clientProfileComplete && clientPhoneVerified);

  useEffect(() => {
    let active = true;
    async function loadClientProfile() {
      if (!supabaseConfigured || !user) {
        if (active) setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      const { data } = await supabase
        .from('client_profiles')
        .select('display_name, phone, phone_verified, phone_verified_at, tos_accepted_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) {
        setClientProfile(data || null);
        setProfileLoading(false);
      }
    }
    loadClientProfile();
    return () => { active = false; };
  }, [user]);

  async function reloadClientProfile() {
    if (!supabaseConfigured || !user) return;
    const { data } = await supabase
      .from('client_profiles')
      .select('display_name, phone, phone_verified, phone_verified_at, tos_accepted_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setClientProfile(data || null);
  }

  function validate() {
    const next = {};
    const minBudget = parseFloat(form.budgetMin);
    const maxBudget = parseFloat(form.budgetMax);
    const cleanTitle = sanitizePlainText(form.title, 120);
    const cleanDescription = sanitizeLongText(form.description, 4000);
    const cleanLocation = sanitizePlainText(form.location, 160);
    const cleanSkills = sanitizePlainText(form.skills, 500);
    const referenceCheck = parseReferenceLinks(form.referenceLinks);
    if (!cleanTitle) next.title = 'Add a clear project title.';
    if (!form.serviceId) next.serviceId = 'Choose one primary pillar for this brief.';
    if (cleanDescription.length < 80) next.description = 'Add at least 80 characters so creators understand the scope.';
    if (referenceCheck.invalid.length) next.referenceLinks = 'Use full links that start with https:// or http://.';
    if (!form.projectDuration) next.projectDuration = 'Select how long you need the creator or crew.';
    if (!form.budgetMin || !Number.isFinite(minBudget) || minBudget < MINIMUM_PROJECT_BUDGET_DOLLARS) next.budgetMin = CLIENT_MINIMUM_PROJECT_ERROR;
    if (!form.budgetMax || !Number.isFinite(maxBudget) || maxBudget < MINIMUM_PROJECT_BUDGET_DOLLARS) next.budgetMax = CLIENT_MINIMUM_PROJECT_ERROR;
    if (form.budgetMin && form.budgetMax && minBudget > maxBudget) next.budgetMax = 'Max budget should be higher than min budget.';
    const contactFieldChecks = [
      ['title', cleanTitle],
      ['description', cleanDescription],
      ['location', cleanLocation],
      ['skills', cleanSkills],
    ];
    contactFieldChecks.forEach(([field, value]) => {
      if (!value || next[field]) return;
      if (checkMessage(value).blocked) {
        next[field] = 'Keep direct contact details inside CreatorBridge. Add style/reference URLs only in the reference links field.';
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handlePost() {
    if (!canPostBrief) {
      setErrors({ submit: 'Please verify your phone to post a brief.' });
      return;
    }
    if (!validate()) return;
    setErrors({});
    setIsPosting(true);
    const cleanProject = sanitizeProjectDraft({
      referenceLinks: parseReferenceLinks(form.referenceLinks).links,
      id:          Date.now().toString() + Math.random(),
      title:       sanitizePlainText(form.title, 120),
      description: appendReferenceLinksToText(form.description, parseReferenceLinks(form.referenceLinks).links),
      serviceId:   form.serviceId,
      budgetMin:   clampNumber(form.budgetMin, { min: 0, max: 1000000, fallback: null }),
      budgetMax:   clampNumber(form.budgetMax, { min: 0, max: 1000000, fallback: null }),
      projectDuration: form.projectDuration,
      deadline:    form.deadline || null,
      location:    sanitizePlainText(form.location, 160),
      remote:      form.remote,
      skills:      sanitizeTagList(form.skills, 12, 36),
      clientId:    user?.id || 'anon',
      clientName:  user?.email?.split('@')[0] || 'Anonymous',
      status:      'open',
      applications: 0,
      createdAt:   new Date().toISOString(),
    });
    const project = cleanProject;
    let saved = project;
    if (supabaseConfigured && user) {
      try {
        const { data, error } = await supabase.rpc('create_project_brief', {
          p_title:            project.title,
          p_service_id:       project.serviceId,
          p_description:      project.description,
          p_budget_min:       project.budgetMin,
          p_budget_max:       project.budgetMax,
          p_project_duration: project.projectDuration,
          p_timeline:         project.deadline,
          p_location:         project.location,
        });
        if (error) throw error;
        saved = { ...project, ...fromSupabaseProject(data), clientName: project.clientName };
      } catch (err) {
        setErrors({
          submit: err?.message || 'Project could not be posted. Please try again.',
        });
        setIsPosting(false);
        return;
      }
    }
    upsertLocalProject(saved);
    onPost(saved);
    setIsPosting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto ${dark ? 'bg-charcoal-950/92 border-gold-500/20' : 'bg-white border-gray-200'}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg z-10 ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>
        <div className="p-6">
          <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
            Post a production brief · US only
          </p>
          <h3 className={`font-display font-bold text-2xl mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Tell us what you're producing</h3>
          <p className={`text-sm leading-6 mb-6 ${textSub}`}>
            Share one clear primary pillar, budget, timeline, and production context so verified creators can judge fit before they apply.
          </p>

          {profileLoading ? (
            <div className={`rounded-2xl border p-5 ${dark ? 'border-white/[0.08] bg-charcoal-900/70 text-charcoal-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
              Checking your client verification...
            </div>
          ) : !canPostBrief ? (
            <div className="space-y-4">
              <div className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/25 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
                <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                  Please verify your phone to post a brief.
                </p>
                <p className={`mt-2 text-xs leading-5 ${textSub}`}>
                  This keeps fake briefs off the public board and protects creators from wasting time on spam.
                </p>
              </div>
              {user ? (
                <ClientVerification user={user} dark={dark} requireLevel="contact" onComplete={reloadClientProfile} />
              ) : (
                <p className={`text-sm ${textSub}`}>Sign in before posting a production brief.</p>
              )}
              {errors.submit && <p className="text-xs text-red-400">{errors.submit}</p>}
            </div>
          ) : (
          <>
          <div className="space-y-4">
            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Project title *</p>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Brand photography for new product launch"
                className={inputCls('title')} />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
            </div>

            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Brief *</p>
              <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Describe what needs to be created, where it will be used, must-have shots or edits, final deliverables, deadline pressure, and what would count as done."
                className={`${inputCls('description')} resize-none`} />
              <div className="mt-1 flex items-center justify-between gap-3">
                {errors.description ? <p className="text-xs text-red-400">{errors.description}</p> : <span />}
                <p className={`text-[10px] ${form.description.length >= 80 ? 'text-gold-400' : textSub}`}>{form.description.length} / 80</p>
              </div>
            </div>

            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Reference examples</p>
              <textarea rows={3} value={form.referenceLinks} onChange={e => set('referenceLinks', e.target.value)}
                placeholder="Paste 2-3 links that show the style, pacing, edit, framing, or finished result you want. One link per line."
                className={`${inputCls('referenceLinks')} resize-none`} />
              <p className={`mt-1 text-[10px] leading-4 ${textSub}`}>
                References help creators price the real scope instead of guessing from a vague brief.
              </p>
              {errors.referenceLinks && <p className="mt-1 text-xs text-red-400">{errors.referenceLinks}</p>}
            </div>

            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Primary pillar *</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Object.values(PILLARS).map(pillar => (
                  <button key={pillar.id} type="button" onClick={() => set('serviceId', form.serviceId === pillar.id ? '' : pillar.id)}
                    className={`flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                      form.serviceId === pillar.id
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : errors.serviceId
                          ? 'border-red-500/45 ' + (dark ? 'text-charcoal-300' : 'text-gray-500')
                          : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35 hover:bg-white/[0.035]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <span className="text-xl leading-none">{pillar.icon}</span>
                    <span>
                      <span className="block text-xs font-bold">{pillar.name}</span>
                      <span className={`mt-1 block text-[10px] leading-4 ${form.serviceId === pillar.id ? 'text-gold-300' : textSub}`}>{pillar.description}</span>
                    </span>
                  </button>
                ))}
              </div>
              {errors.serviceId && <p className="mt-1 text-xs text-red-400">{errors.serviceId}</p>}
            </div>

            <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${dark ? 'border-gold-500/25 bg-gold-500/10 text-gold-100' : 'border-gold-200 bg-gold-50 text-gold-800'}`}>
              {CLIENT_MINIMUM_PROJECT_NOTE}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Budget min · USD *</p>
                <input type="number" min={MINIMUM_PROJECT_BUDGET_DOLLARS} value={form.budgetMin} onChange={e => set('budgetMin', e.target.value)}
                  placeholder="Enter minimum" className={inputCls('budgetMin')} />
                {errors.budgetMin && <p className="mt-1 text-xs text-red-400">{errors.budgetMin}</p>}
              </div>
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Budget max · USD *</p>
                <input type="number" min={MINIMUM_PROJECT_BUDGET_DOLLARS} value={form.budgetMax} onChange={e => set('budgetMax', e.target.value)}
                  placeholder="Enter maximum" className={inputCls('budgetMax')} />
                {errors.budgetMax && <p className="mt-1 text-xs text-red-400">{errors.budgetMax}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Project duration *</p>
                <select value={form.projectDuration} onChange={e => set('projectDuration', e.target.value)}
                  className={inputCls('projectDuration')}>
                  <option value="">Select duration...</option>
                  <option value="1-2 hours">1-2 hours</option>
                  <option value="3-4 hours">3-4 hours</option>
                  <option value="Half day (4-5 hours)">Half day (4-5 hours)</option>
                  <option value="Full day (6-8 hours)">Full day (6-8 hours)</option>
                  <option value="Multi-day">Multi-day</option>
                  <option value="Ongoing / retainer">Ongoing / retainer</option>
                  <option value="Not sure yet">Not sure yet</option>
                </select>
                {errors.projectDuration && <p className="mt-1 text-xs text-red-400">{errors.projectDuration}</p>}
              </div>
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Deadline</p>
                <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
                  className={inputCls('deadline')} />
              </div>
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>US location</p>
                <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                  placeholder="New York, NY" className={inputCls('location')} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => set('remote', !form.remote)}
                className={`w-10 h-5 rounded-full transition-all relative ${form.remote ? 'bg-gold-500' : dark ? 'bg-charcoal-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.remote ? 'left-5' : 'left-0.5'}`} />
              </button>
              <span className={`text-sm ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>Remote work accepted</span>
            </div>

            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Required Skills (comma-separated)</p>
              <input type="text" value={form.skills} onChange={e => set('skills', e.target.value)}
                placeholder="e.g. product launch, color grade, conference coverage"
                className={inputCls('skills')} />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button type="button" onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${dark ? 'border-white/[0.09] text-charcoal-300 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
              Cancel
            </button>
            <button type="button" onClick={handlePost}
              disabled={isPosting || !form.title.trim() || !form.description.trim() || !form.serviceId || !form.projectDuration || !form.budgetMin || !form.budgetMax}
              className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
              <Briefcase size={14} /> {isPosting ? 'Posting...' : 'Post Project'}
            </button>
          </div>
          {errors.submit && (
            <p className="mt-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
              {errors.submit}
            </p>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Apply Modal ──────────────────────────────────────────────────
function ApplyModal({ project, dark, onClose, onApply, creatorListing }) {
  const [proposal, setProposal] = useState('');
  const [rate, setRate]         = useState('');
  const [creatorName, setCreatorName] = useState(
    creatorListing?.businessName || creatorListing?.name || ''
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  async function handleApply() {
    const cleanProposal = sanitizeLongText(proposal, 3000);
    const cleanCreatorName = sanitizePlainText(creatorName, 100);
    const cleanRate = clampNumber(rate, { min: 0, max: 1000000, fallback: null });
    if (!cleanProposal) return;
    if (cleanRate === null || cleanRate < MINIMUM_PROJECT_BUDGET_DOLLARS) {
      setError(CREATOR_MINIMUM_PROJECT_ERROR);
      return;
    }

    const { blocked, patternType } = checkMessage(cleanProposal);
    if (blocked) {
      setError('Keep contact details inside CreatorBridge. The client can review your fit without email, phone, social, or website links.');
      logFilterEvent(creatorListing?.user_id || creatorListing?.id || 'unknown', patternType, supabase, supabaseConfigured);
      return;
    }
    setError('');

    const app = {
      id:          Date.now().toString() + Math.random(),
      projectId:   project.id,
      creatorId:   creatorListing?.id || 'unknown',
      creatorName: cleanCreatorName || creatorListing?.businessName || creatorListing?.name || 'Creator',
      creatorAvatar: creatorListing?.avatar || '🎬',
      proposal:    cleanProposal,
      rate:        cleanRate,
      status:      'pending',
      createdAt:   new Date().toISOString(),
    };

    if (supabaseConfigured && creatorListing?.id && isUuid(project.id) && isUuid(creatorListing.id)) {
      try {
        const { data, error: applyError } = await supabase.rpc('apply_to_project', {
          p_project_id: project.id,
          p_listing_id: creatorListing.id,
          p_message: cleanProposal,
          p_proposed_rate: cleanRate,
        });
        if (applyError) throw applyError;
        if (data?.id) app.id = data.id;
      } catch (err) {
        setError(err?.message || 'Unable to submit this proposal right now. Please try again.');
        return;
      }
    }

    const all = loadApplications();
    saveApplications([...all, app]);
    // Increment application count
    const projs = loadProjects();
    const nextProjects = projs.map(p => p.id === project.id ? { ...p, applications: (p.applications || 0) + 1 } : p);
    saveProjects(nextProjects);

    // Send application_received email
    sendNotificationEmail(creatorListing?.email, 'application_received', {
      creator_name: app.creatorName,
      project_title: project.title
    });

    setSubmitted(true);
    setTimeout(() => { onApply(app); }, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${dark ? 'bg-charcoal-950/70 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-gold-500/15 flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-gold-400" />
              </div>
              <h3 className={`font-display font-bold text-lg mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Proposal Submitted!</h3>
              <p className={`text-sm ${textSub}`}>Your proposal for "{project.title}" has been saved. The client will review and reach out if interested.</p>
            </div>
          ) : (
            <>
              <h3 className={`font-display font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Apply to Project</h3>
              <p className={`text-xs mb-5 ${textSub}`}>{project.title}</p>

              <div className="space-y-4">
                <div>
                  <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Your Name / Studio</p>
                  <input type="text" value={creatorName} onChange={e => setCreatorName(e.target.value)}
                    placeholder="Your name or studio name" className={inputCls} />
                </div>
                <div>
                  <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Your Proposed Rate ($)</p>
                  <div className="relative">
                    <DollarSign size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
                  <input type="number" min={MINIMUM_PROJECT_BUDGET_DOLLARS} value={rate} onChange={e => setRate(e.target.value)}
                      placeholder={project.budgetMax || '1500'} className={`${inputCls} pl-8`} />
                  </div>
                  <p className={`mt-1 text-[10px] leading-4 ${textSub}`}>{CREATOR_MINIMUM_PROJECT_NOTE}</p>
                </div>
                <div>
                  <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Proposal / Cover Letter *</p>
                  <textarea rows={5} value={proposal} onChange={e => { setProposal(e.target.value); setError(''); }}
                    placeholder="Introduce yourself, explain why you're a great fit, and outline your approach to this project..."
                    className={`${inputCls} resize-none`} />
                </div>
              </div>
              {error && (
                <p className="mt-4 rounded-xl border border-gold-500/25 bg-gold-500/10 px-3 py-2 text-xs leading-relaxed text-gold-300">
                  {error}
                </p>
              )}

              <div className="flex gap-2 mt-5">
                <button type="button" onClick={onClose}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${dark ? 'border-white/[0.09] text-charcoal-300 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
                  Cancel
                </button>
                <button type="button" onClick={handleApply} disabled={!proposal.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
                  <Send size={13} /> Submit Proposal
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Action buttons (context-aware by role + status) ──────────────
function ProjectActionButtons({ project, isClient, canApply, applied, dark, onApply, onStatusChange, navigate, onOpenDelivery, onOpenRevision }) {
  const { status } = project;

  async function changeStatus(newStatus, patch = {}) {
    if (supabaseConfigured && isUuid(project.id)) {
      const remotePatch = {
        status: newStatus,
        ...(patch.approvedAt ? { approved_at: patch.approvedAt } : {}),
      };
      const { data, error } = await supabase
        .from('projects')
        .update(remotePatch)
        .eq('id', project.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error('Project status could not be saved. Please refresh and try again.');
    }

    const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
    const updated = all.map(p => p.id === project.id ? { ...p, status: newStatus, ...patch } : p);
    localStorage.setItem('cm-projects', JSON.stringify(updated));
    onStatusChange?.(project.id, newStatus, patch);
  }

  // Client buttons
  if (isClient) {
    if (status === 'open') {
      return (
        <button type="button"
          onClick={e => { e.stopPropagation(); navigate(`/matches/${project.id}`); }}
          className="w-full py-2 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-gold-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-gold-500/30">
          <Zap size={11} /> View Your Matches
        </button>
      );
    }
    if (status === 'accepted') {
      return (
        <button type="button"
          onClick={e => { e.stopPropagation(); navigate(`/checkout/${project.id}`); }}
          className="w-full py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
          <CreditCard size={11} /> Pay Retainer
        </button>
      );
    }
    if (status === 'delivered') {
      const remainHours = getRemainingHours(project.deliveredAt);
      return (
        <div className="space-y-2">
          {remainHours !== null && remainHours > 0 && (
            <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-lg ${dark ? 'bg-gold-500/10 text-gold-400' : 'bg-gold-50 text-gold-600'}`}>
              <Timer size={10} /> Auto-approves in {remainHours}h if no action taken
            </div>
          )}
          <div className="flex gap-2">
            <button type="button"
              onClick={async e => {
                e.stopPropagation();
                try {
                  await changeStatus('approved', { approvedAt: new Date().toISOString() });
                  navigate(`/checkout/${project.id}?payment=final`);
                } catch {
                  window.alert('Could not approve delivery. Please try again before paying the final balance.');
                }
              }}
              className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1">
              <ThumbsUp size={11} /> Approve &amp; Pay Final Balance
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button"
              onClick={e => { e.stopPropagation(); onOpenRevision?.(); }}
              className="flex-1 py-2 rounded-xl bg-gold-500/12 border border-gold-500/25 text-gold-400 text-xs font-bold transition-all flex items-center justify-center gap-1">
              <RotateCcw size={11} /> Request Revision
            </button>
            <button type="button"
              onClick={e => { e.stopPropagation(); onOpenRevision?.('dispute'); }}
              className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold transition-all flex items-center justify-center gap-1">
              <AlertCircle size={11} /> Open Dispute
            </button>
          </div>
        </div>
      );
    }
    if (status === 'approved' || status === 'completed') {
      return (
        <button type="button"
          onClick={e => { e.stopPropagation(); navigate(`/checkout/${project.id}?payment=final`); }}
          className="w-full py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5">
          <CreditCard size={11} /> Pay Remaining Balance
        </button>
      );
    }
    return null;
  }

  // Creator buttons
  if (!canApply) return null;

  if (status === 'open') {
    return (
      <button type="button"
        onClick={onApply}
        disabled={applied}
        className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
          applied
            ? 'bg-gold-500/15 text-gold-400 cursor-default'
            : 'bg-gold-500 hover:bg-gold-600 text-charcoal-900'
        }`}>
        {applied ? <span className="flex items-center justify-center gap-1"><Check size={11} /> Applied</span> : 'Apply Now'}
      </button>
    );
  }
  if (status === 'retainer_paid' || status === 'in_progress' || status === 'revision') {
    return (
      <button type="button"
        onClick={e => { e.stopPropagation(); onOpenDelivery?.(); }}
        className="w-full py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5">
        <Upload size={11} /> Submit Delivery
      </button>
    );
  }
  return null;
}

// ── Inline client rep loader ──────────────────────────────────────
function InlineClientRep({ clientId, dark }) {
  const [metrics, setMetrics] = useState(null);
  useEffect(() => {
    loadClientReputation(clientId).then(setMetrics);
  }, [clientId]);
  if (!metrics) return null;
  return <ClientReputationBadge metrics={metrics} dark={dark} size="sm" />;
}

// ── Project Card ─────────────────────────────────────────────────
function ProjectCard({ project, dark, onApply, myApplications, isClient, canApply, onView, onStatusChange }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showDelivery, setShowDelivery] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const pillar   = getProjectPillar(project);
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const applied  = myApplications.some(a => a.projectId === project.id);

  const budgetStr = project.budgetMin && project.budgetMax
    ? `$${Number(project.budgetMin).toLocaleString()} – $${Number(project.budgetMax).toLocaleString()}`
    : project.budgetMax ? `Up to $${Number(project.budgetMax).toLocaleString()}`
    : project.budgetMin ? `From $${Number(project.budgetMin).toLocaleString()}`
    : 'Budget TBD';

  const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.open;

  return (
    <div className={`group rounded-2xl border p-5 transition-all cursor-pointer ${
      dark ? 'bg-charcoal-900/72 border-white/[0.07] hover:border-gold-500/35 hover:bg-charcoal-900/90 shadow-[0_22px_70px_rgba(0,0,0,0.18)]' : 'bg-white border-gray-200 hover:border-gray-300'
    }`} onClick={() => onView(project)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${dark ? 'bg-white/[0.04] ring-1 ring-white/[0.07] group-hover:ring-gold-500/20' : 'bg-gray-100'}`}>
            {pillar.icon}
          </div>
          <div>
            <h3 className={`font-display font-bold text-base leading-snug ${dark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h3>
            <div className={`flex items-center gap-1.5 text-[11px] ${textSub}`}>
              by {project.clientName}
              {project.clientId && <InlineClientRep clientId={project.clientId} dark={dark} />}
              · {timeAgo(project.createdAt)}
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${statusBadgeClass(project.status, dark)}`}>
          {statusInfo.label}
        </span>
      </div>

      <p className={`text-sm leading-6 mb-5 line-clamp-3 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
        {project.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="flex items-center gap-1 text-xs font-bold text-gold-400">
          <DollarSign size={11} /> {budgetStr}
        </span>
        <span className={`flex items-center gap-1 text-xs ${textSub}`}>
          <Briefcase size={10} /> {pillar.name}
        </span>
        {project.deadline && (
          <span className={`flex items-center gap-1 text-xs ${textSub}`}>
            <Calendar size={10} /> {new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {project.projectDuration && (
          <span className={`flex items-center gap-1 text-xs ${textSub}`}>
            <Clock size={10} /> {project.projectDuration}
          </span>
        )}
        {locationStr(project.location) && (
          <span className={`flex items-center gap-1 text-xs ${textSub}`}>
            <MapPin size={10} /> {locationStr(project.location)}
          </span>
        )}
        {project.remote && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
            Remote OK
          </span>
        )}
        <span className={`flex items-center gap-1 text-xs ${textSub}`}>
          <Users size={10} /> {project.applications || 0} applied
        </span>
      </div>

      {project.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.skills.map(skill => (
            <span key={skill} className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
              {skill}
            </span>
          ))}
        </div>
      )}

      <ProjectActionButtons
        project={project}
        isClient={isClient}
        canApply={canApply}
        applied={applied}
        dark={dark}
        onApply={e => { e.stopPropagation(); onApply(project); }}
        onStatusChange={onStatusChange}
        navigate={navigate}
        onOpenDelivery={() => setShowDelivery(true)}
        onOpenRevision={(mode) => mode === 'dispute' ? setShowDispute(true) : setShowRevision(true)}
      />
      {showDelivery && (
        <DeliverySubmitModal
          project={project}
          dark={dark}
          creatorName={user?.user_metadata?.full_name || 'Creator'}
          onClose={() => setShowDelivery(false)}
          onDelivered={(updatedProject) => {
            setShowDelivery(false);
            onStatusChange?.(project.id, 'delivered', updatedProject);
          }}
        />
      )}
      {showRevision && (
        <RevisionRequestModal
          project={project}
          dark={dark}
          onClose={() => setShowRevision(false)}
          onRevisionSubmitted={(updatedProject) => {
            setShowRevision(false);
            onStatusChange?.(project.id, 'in_progress', updatedProject);
          }}
        />
      )}
      {showDispute && (
        <DisputeModal
          project={project}
          dark={dark}
          onClose={() => setShowDispute(false)}
          onSubmitted={() => {
            setShowDispute(false);
            onStatusChange?.(project.id, 'disputed');
          }}
        />
      )}
    </div>
  );
}

// ── Project Cover Helper ───────────────────────────────────────
function getProjectCoverImage(project) {
  switch(getProjectPillarId(project)) {
    case 'video_production':
      return '/images/creatorbridge/backgrounds/04-hero-parallax/parallax-camera-lens-macro.jpg';
    case 'photography':
      return '/images/creatorbridge/backgrounds/04-hero-parallax/parallax-photo-studio.jpg';
    case 'post_production':
      return '/images/creatorbridge/backgrounds/02-pillars/pillar-post-editing-monitor.jpg';
    default:
      return '/images/creatorbridge/backgrounds/02-pillars/pillar-photo-studio-subjects.jpg';
  }
}

function CollaborationWorkspacePanel({ project, dark, user }) {
  const navigate = useNavigate();
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(false);
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  async function loadCollaborations() {
    if (!supabaseConfigured || !user?.id || !isUuid(project?.id)) return;
    setLoading(true);
    const { data } = await supabase
      .from('creator_collaborations')
      .select('id,status,service_category,scope,amount_cents,deadline,prime_user_id,collaborator_user_id,project_context,created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    setCollaborations(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCollaborations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, user?.id]);

  if (!user?.id || !isUuid(project?.id)) return null;

  return (
    <section className={`rounded-xl border p-4 ${dark ? 'border-white/[0.07] bg-charcoal-900/40' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Creator collaboration</p>
          <h3 className={`mt-1 font-display text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Build the team for this project</h3>
          <p className={`mt-1 max-w-xl text-xs leading-5 ${textSub}`}>Add verified collaborators privately. The outside client does not see subcontractors or production-team links.</p>
        </div>
        <button type="button" onClick={() => navigate(`/find?project=${project.id}&collaboration=true`)} className="btn-gold text-xs">
          Add to This Project
        </button>
      </div>

      {loading && <p className={`mt-4 text-xs ${textSub}`}>Loading collaborations…</p>}
      {!loading && collaborations.length === 0 && (
        <p className={`mt-4 rounded-xl border p-3 text-xs ${dark ? 'border-white/[0.06] bg-black/20 text-charcoal-300' : 'border-gray-200 bg-white text-gray-600'}`}>
          No collaborators have been attached to this project yet.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {collaborations.map((collaboration) => {
          const isPrime = collaboration.prime_user_id === user.id;
          const isCollaborator = collaboration.collaborator_user_id === user.id;
          return (
            <article key={collaboration.id} className={`rounded-2xl border p-4 ${dark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{collaboration.service_category || 'Creator collaboration'}</p>
                  <p className={`mt-1 text-[11px] ${textSub}`}>${Number((collaboration.amount_cents || 0) / 100).toLocaleString()} · {collaboration.status.replaceAll('_', ' ')}</p>
                </div>
                {isPrime && collaboration.status === 'accepted' && (
                  <button type="button" onClick={() => navigate(`/collaboration/${collaboration.id}/payment`)} className="btn-gold text-xs">
                    Fund collaboration
                  </button>
                )}
              </div>
              {collaboration.scope && <p className={`mt-3 text-xs leading-5 ${textSub}`}>{collaboration.scope}</p>}
              {(isPrime || isCollaborator) && (
                <div className="mt-4 space-y-4">
                  <ProjectWorkspaces collaboration={collaboration} userId={user.id} onChanged={loadCollaborations} />
                  {isCollaborator && <DeliveryAnchorForm collaboration={collaboration} onSubmitted={loadCollaborations} />}
                  <CollaborationReviewActions collaboration={collaboration} userId={user.id} onChanged={loadCollaborations} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ── Project Detail Pane ─────────────────────────────────────────
function ProjectDetailPane({ project, dark, onApply, myApplications, applications, isClient, canApply, onStatusChange }) {
  const navigate    = useNavigate();
  const { user } = useAuth();
  const pillar      = getProjectPillar(project);
  const textSub     = dark ? 'text-charcoal-300' : 'text-gray-500';
  const applied     = myApplications.some(a => a.projectId === project.id);
  const projectApps = applications.filter(a => a.projectId === project.id);
  const [showDispute, setShowDispute]       = useState(false);
  const [showCancel, setShowCancel]         = useState(false);
  const [showRateClient, setShowRateClient] = useState(false);
  const [showDelivery, setShowDelivery]     = useState(false);
  const [showRevision, setShowRevision]     = useState(false);
  const [localProject, setLocalProject]    = useState(project);
  const [acceptError, setAcceptError]      = useState('');

  useEffect(() => {
    setLocalProject(project);
    setAcceptError('');
  }, [project]);

  const budgetStr = project.budgetMin && project.budgetMax
    ? `$${Number(project.budgetMin).toLocaleString()} – $${Number(project.budgetMax).toLocaleString()}`
    : project.budgetMax ? `Up to $${Number(project.budgetMax).toLocaleString()}`
    : project.budgetMin ? `From $${Number(project.budgetMin).toLocaleString()}`
    : 'Budget TBD';

  async function acceptApplication(app) {
    if (app.payoutReady === false) {
      setAcceptError('This creator has not finished Stripe payout setup yet. Ask them to connect payments before accepting the proposal.');
      return;
    }
    setAcceptError('');
    const now = new Date().toISOString();
    const patch = {
      acceptedCreatorId: app.creatorId,
      acceptedApplicationId: app.id,
      acceptedAt: now,
    };

    let creatorEmail = app.creatorEmail || app.creator_email || '';
    if (supabaseConfigured && isUuid(localProject.id) && isUuid(app.id)) {
      try {
        const { data: creatorData } = await supabase
          .from('creator_listings')
          .select('email')
          .eq('id', app.creatorId)
          .maybeSingle();
        if (creatorData?.email) {
          creatorEmail = creatorData.email;
        }

        const { error: acceptError } = await supabase.rpc('accept_project_application', {
          p_project_id: localProject.id,
          p_application_id: app.id,
        });
        if (acceptError) throw acceptError;
      } catch (err) {
        console.error('Unable to accept application:', err);
        setAcceptError(err.message || 'Unable to accept this proposal. Please try again.');
        return;
      }
    }

    updateApplicationStatus(app.id, 'accepted');
    const updatedProjects = updateProject(localProject.id, { status: 'accepted', ...patch });
    const updatedProject = updatedProjects.find(p => p.id === localProject.id);
    setLocalProject(updatedProject || { ...localProject, status: 'accepted', ...patch });

    const proposedRate = app.rate || localProject.budgetMax || localProject.budgetMin || 0;
    const retainer = Math.round(proposedRate * 0.5);
    sendNotificationEmail(creatorEmail, 'application_accepted', {
      creator_name: app.creatorName,
      project_title: localProject.title,
      retainer_amount: retainer
    });

    onStatusChange?.(localProject.id, 'accepted', patch);
  }

  const coverImage = getProjectCoverImage(project);

  return (
    <div className="w-full space-y-5 text-sans">
      {/* Cover Banner */}
      <div className="relative h-32 rounded-xl overflow-hidden">
        <img src={coverImage} alt="" className="w-full h-full object-cover" onError={(e)=>{ if(!e.currentTarget.dataset.fb){ e.currentTarget.dataset.fb='1'; e.currentTarget.src='/images/creatorbridge/backgrounds/09-fallback/fallback-default-cover.jpg'; } }} />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/40 to-transparent" />
        <span className={`absolute bottom-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full ${statusBadgeClass(localProject.status, dark)}`}>
          {PROJECT_STATUSES[localProject.status]?.label || 'Open'}
        </span>
        <span className="pillar-label">
          <span className="dot" />
          {pillar.name}
        </span>
      </div>

      <div>
        <h2 className="font-display font-bold text-xl text-white leading-snug">{localProject.title}</h2>
        <p className={`text-xs ${textSub} mt-1`}>Posted by {localProject.clientName} · {timeAgo(localProject.createdAt)}</p>
      </div>

      {/* Details list */}
      <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl ${dark ? 'bg-charcoal-900/60 border border-white/[0.04]' : 'bg-gray-50'}`}>
        {[
          { icon: DollarSign, label: 'Budget Range', value: budgetStr, color: 'text-gold-400' },
          { icon: Briefcase,  label: 'Primary Pillar', value: pillar.name, color: textSub },
          { icon: Users,      label: 'Applications', value: `${localProject.applications || 0} proposals`, color: textSub },
          ...(localProject.projectDuration ? [{ icon: Clock, label: 'Duration', value: localProject.projectDuration, color: textSub }] : []),
          ...(localProject.deadline ? [{ icon: Calendar, label: 'Deadline', value: new Date(localProject.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: textSub }] : []),
          ...(locationStr(localProject.location) ? [{ icon: MapPin, label: 'Location', value: locationStr(localProject.location) + (localProject.remote ? ' (Remote)' : ''), color: textSub }] : []),
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label}>
            <p className={`text-[10px] font-medium mb-0.5 ${textSub}`}>{label}</p>
            <p className={`text-xs font-semibold flex items-center gap-1 ${color}`}><Icon size={11} /> {value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Timeline status</p>
        <div className={`p-3 rounded-xl border ${dark ? 'border-white/[0.07] bg-charcoal-900/40' : 'border-gray-200 bg-gray-50'}`}>
          <ProjectTimeline status={localProject.status} dark={dark} />
        </div>
      </div>

      {!isClient && (
        <CollaborationWorkspacePanel project={localProject} dark={dark} user={user} />
      )}

      {/* Description */}
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Description</p>
        <p className={`text-xs leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{localProject.description}</p>
      </div>

      {/* Skills */}
      {localProject.skills?.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Skills required</p>
          <div className="flex flex-wrap gap-1">
            {localProject.skills.map(skill => (
              <span key={skill} className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-white/[0.06] text-charcoal-300' : 'bg-gray-100 text-gray-700'}`}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Proposals list */}
      {isClient && projectApps.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Proposals Received ({projectApps.length})</p>
          {acceptError && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-300">{acceptError}</p>
            </div>
          )}
          <div className="space-y-2">
            {projectApps.map(app => (
              <div key={app.id} className={`p-3 rounded-xl border ${dark ? 'border-white/[0.07] bg-charcoal-900/40' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{app.creatorAvatar}</span>
                    <p className={`text-xs font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{app.creatorName}</p>
                    {app.rate && <span className="text-xs font-bold text-gold-400">${Number(app.rate).toLocaleString()}</span>}
                  </div>
                  {localProject.status === 'open' && app.status !== 'accepted' && (
                    <button type="button" onClick={() => acceptApplication(app)} disabled={app.payoutReady === false}
                      className="shrink-0 rounded-lg bg-gold-500 px-2.5 py-1 text-[9px] font-bold text-charcoal-900 hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-45">
                      {app.payoutReady === false ? 'No Stripe' : 'Accept'}
                    </button>
                  )}
                  {app.status === 'accepted' && (
                    <span className="shrink-0 rounded-lg bg-gold-500/15 px-2.5 py-1 text-[9px] font-bold text-gold-400 ring-1 ring-gold-500/20">
                      Accepted
                    </span>
                  )}
                </div>
                <p className={`text-[11px] leading-relaxed ${dark ? 'text-charcoal-400' : 'text-gray-500'} line-clamp-2`}>{app.proposal}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Project Notice */}
      {isArchived(localProject) && (
        <div>
          <ArchivedProjectNotice project={localProject} dark={dark} onStatusChange={onStatusChange} />
        </div>
      )}

      {/* Delivery link */}
      {localProject.deliveryLink && localProject.status !== 'in_progress' && !isArchived(localProject) && (
        <div className={`p-4 rounded-xl border ${dark ? 'border-white/[0.07] bg-charcoal-900/40' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Delivery</p>
          <a href={localProject.deliveryLink} target="_blank" rel="noreferrer"
            className="text-xs text-gold-400 hover:text-gold-300 underline break-all">
            {localProject.deliveryLink}
          </a>
          {localProject.deliveryNotes && (
            <p className={`text-xs mt-2 ${textSub}`}>{localProject.deliveryNotes}</p>
          )}
          <p className={`text-[9px] mt-2 ${textSub}`}>{STORAGE_NOTICE}</p>
        </div>
      )}

      {/* Actions Stack */}
      <div className="space-y-2 pt-2">
        <ProjectActionButtons
          project={localProject}
          isClient={isClient}
          canApply={canApply}
          applied={applied}
          dark={dark}
          onApply={() => onApply(project)}
          onStatusChange={(id, st, patch = {}) => {
            setLocalProject(p => ({ ...p, status: st, ...patch }));
            onStatusChange?.(id, st, patch);
          }}
          navigate={navigate}
          onOpenDelivery={() => setShowDelivery(true)}
          onOpenRevision={(mode) => mode === 'dispute' ? setShowDispute(true) : setShowRevision(true)}
        />
        {/* Rate Client - shown for creators on completed projects */}
        {canApply && project.status === 'completed' && (
          <button type="button" onClick={() => setShowRateClient(true)}
            className="w-full py-2 rounded-xl bg-gold-500/15 border border-gold-500/30 text-gold-400 text-xs font-bold transition-all hover:bg-gold-500/25">
            ⭐ Rate This Client
          </button>
        )}
        {/* Cancel button - shown for client on open/active projects */}
        {isClient && ['open', 'accepted', 'retainer_paid', 'in_progress', 'revision'].includes(project.status) && (
          <button type="button" onClick={() => setShowCancel(true)}
            className="w-full py-2 rounded-xl border text-xs font-medium transition-all text-red-400 border-red-500/30 hover:bg-red-500/10">
            Cancel Project
          </button>
        )}
        {/* Dispute button - shown for active projects */}
        {isClient && ['retainer_paid', 'in_progress', 'delivered', 'revision'].includes(project.status) && (
          <button type="button" onClick={() => setShowDispute(true)}
            className="w-full py-2 rounded-xl border text-xs font-medium transition-all text-red-400 border-red-500/30 hover:bg-red-500/10">
            Open a Dispute
          </button>
        )}
      </div>

      {showDelivery && (
        <DeliverySubmitModal
          project={localProject}
          dark={dark}
          creatorName={user?.user_metadata?.full_name || 'Creator'}
          onClose={() => setShowDelivery(false)}
          onDelivered={(updatedProject) => {
            setLocalProject(updatedProject);
            onStatusChange?.(project.id, 'delivered', updatedProject);
          }}
        />
      )}
      {showRevision && (
        <RevisionRequestModal
          project={localProject}
          dark={dark}
          onClose={() => setShowRevision(false)}
          onRevisionSubmitted={(updatedProject) => {
            setLocalProject(updatedProject);
            onStatusChange?.(project.id, 'in_progress', updatedProject);
            setShowRevision(false);
          }}
        />
      )}
      {showDispute && (
        <DisputeModal
          project={localProject}
          dark={dark}
          onClose={() => setShowDispute(false)}
          onSubmitted={() => { setShowDispute(false); setLocalProject(p => ({ ...p, status: 'disputed' })); onStatusChange?.(project.id, 'disputed'); }}
        />
      )}
      {showCancel && (
        <CancellationModal
          project={project}
          dark={dark}
          onClose={() => setShowCancel(false)}
          onConfirm={(proj, reason) => {
            setShowCancel(false);
            onStatusChange?.(proj.id, 'cancelled');
          }}
        />
      )}
      {showRateClient && (
        <RateClientModal
          clientId={project.clientId}
          clientName={project.clientName}
          projectId={project.id}
          dark={dark}
          onClose={() => setShowRateClient(false)}
          onSubmitted={() => setShowRateClient(false)}
        />
      )}
    </div>
  );
}

// ── Main Project Board ───────────────────────────────────────────
export function ProjectBoard({ dark }) {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [projects, setProjects]         = useState([]);
  const [applications, setApplications] = useState([]);
  const [creatorListing, setCreatorListing] = useState(null);
  const [showPost, setShowPost]         = useState(false);
  const [applyTarget, setApplyTarget]   = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const detailPaneRef = useRef(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // On mobile (under the lg breakpoint, 1024px), use a master/detail
  // navigation pattern. Tapping a brief replaces the list with the detail
  // view (proper iOS/Android UX). The "Back to briefs" button returns to
  // the list. On desktop, both stay visible side by side.
  function selectBrief(id) {
    setActiveProjectId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileShowDetail(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function backToBriefList() {
    setMobileShowDetail(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handleStatusChange(projectId, newStatus, patch = {}) {
    const cleanPatch = { ...(patch || {}) };
    delete cleanPatch.id;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus, ...cleanPatch } : p));
  }
  const [search, setSearch]             = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterBudget, setFilterBudget] = useState('any');
  const [tab, setTab]                   = useState('browse'); // 'browse' | 'my_projects' | 'my_applications'

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  useEffect(() => {
    let cancelled = false;
    // Auto-approval: projects delivered 72+ hours ago become approved and ready for final payment.
    const raw = loadProjects();
    const now = Date.now();
    const autoApproved = raw.map(p => {
      if (p.status === 'delivered' && p.deliveredAt) {
        const elapsed = now - new Date(p.deliveredAt).getTime();
        if (elapsed >= 72 * 3600000) {
          return { ...p, status: 'approved', approvedAt: p.approvedAt || new Date().toISOString(), autoApproved: true };
        }
      }
      return p;
    });
    const anyChanged = autoApproved.some((p, i) => p.status !== raw[i].status);
    if (anyChanged) saveProjects(autoApproved);
    const local = anyChanged ? autoApproved : raw;
    setProjects(local);
    setApplications(loadApplications());
    if (user) {
      setCreatorListing(loadMyListing(user.id));
    }

    async function loadRemoteCreatorListing() {
      if (!supabaseConfigured || !user) return;
      const localListing = loadMyListing(user.id);
      if (localListing) return;
      const { data } = await supabase
        .from('creator_listings')
        .select('*')
        .eq('user_id', user.id)
        .order('review_status', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setCreatorListing(fromCreatorListingRow(data));
    }

    async function loadRemoteProjects() {
      if (!supabaseConfigured || !user) return;
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled || !data) return;
      setProjects(current => {
        const merged = mergeProjects(current, data.map(fromSupabaseProject));
        saveProjects(merged);
        return merged;
      });
    }

    async function loadRemoteApplications() {
      if (!supabaseConfigured || !user) return;
      const { data } = await supabase
        .from('project_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled || !data) return;

      const listingIds = [...new Set(data.map(app => app.listing_id).filter(Boolean))];
      let listingsById = {};
      if (listingIds.length) {
        const { data: listingRows } = await supabase
          .from('creator_listings')
          .select('id,business_name,name,avatar,stripe_account_id')
          .in('id', listingIds);
        listingsById = (listingRows || []).reduce((map, listing) => {
          map[listing.id] = listing;
          return map;
        }, {});
      }

      const remoteApps = data.map(row => fromSupabaseApplication(row, listingsById[row.listing_id]));
      setApplications(current => {
        const merged = mergeApplications(current, remoteApps);
        saveApplications(merged);
        return merged;
      });
    }

    loadRemoteCreatorListing();
    loadRemoteProjects();
    loadRemoteApplications();
    return () => { cancelled = true; };
  }, [user]);

  // Seed demo projects if empty. The 10 below mirror the original prototype
  // briefs so the live board feels populated from the first visit. Each uses
  // the canonical 3-pillar taxonomy (primary_pillar) plus a specialty.
  useEffect(() => {
    const existing = loadProjects();
    if (existing.length === 0) {
      const demos = [
        {
          id: 'demo-1', title: 'Product Photography for E-Commerce Launch',
          description: 'We\'re launching a new skincare line and need a US-based product photographer to shoot 30+ items on clean white backgrounds plus 12 lifestyle composition frames.',
          primary_pillar: 'photography', serviceId: 'photography', specialty: 'Product & Still Life',
          budgetMin: 800, budgetMax: 1500, deadline: '2026-05-30',
          location: 'New York, NY', remote: false,
          skills: ['product photography', 'Adobe Lightroom', 'white background', 'skincare'],
          clientId: 'client-1', clientName: 'BeautyBrand Co', status: 'open', applications: 3,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'demo-2', title: 'YouTube Channel Intro Animation (30 sec)',
          description: 'Need a motion designer for a punchy 30-second intro animation for a tech review channel. Bold typography, kinetic energy, tech-forward.',
          primary_pillar: 'post_production', serviceId: 'post_production', specialty: 'Motion Graphics & VFX',
          budgetMin: 300, budgetMax: 600, deadline: '2026-06-12',
          location: '', remote: true,
          skills: ['After Effects', 'motion graphics', 'logo animation', 'kinetic type'],
          clientId: 'client-2', clientName: 'TechReviewPro', status: 'open', applications: 7,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'demo-3', title: 'Monthly Social Video Package — Real Estate',
          description: 'Boutique real estate agency needs a monthly social-first video package: 4 Reels, 8 Stories, captions and strategy. Looking for a long-term partner in LA.',
          primary_pillar: 'video_production', serviceId: 'video_production', specialty: 'Short-Form & Social (Reels/TikTok/UGC)',
          budgetMin: 1200, budgetMax: 2500, deadline: '2026-07-15',
          location: 'Los Angeles, CA', remote: false,
          skills: ['Instagram', 'Reels', 'real estate', 'monthly retainer'],
          clientId: 'client-3', clientName: 'LuxRealty Group', status: 'open', applications: 12,
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
        {
          id: 'demo-4', title: 'Weekly Podcast Audio Editing — Long-Term',
          description: 'Established weekly business podcast (200+ episodes) seeking a reliable audio editor. ~45 min raw audio per week. Long-term preferred.',
          primary_pillar: 'post_production', serviceId: 'post_production', specialty: 'Podcast Audio Editing',
          budgetMin: 150, budgetMax: 300, deadline: '',
          location: '', remote: true,
          skills: ['Adobe Audition', 'podcast editing', 'Descript', 'long-term'],
          clientId: 'client-4', clientName: 'The Business Pod', status: 'open', applications: 5,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: 'demo-5', title: 'Aerial Video for Luxury Property Listings',
          description: 'Need a Part 107 licensed drone operator for aerial footage of 4 waterfront properties. 4K footage + edited 30-second listing reels.',
          primary_pillar: 'video_production', serviceId: 'video_production', specialty: 'Drone & Aerial Video',
          budgetMin: 400, budgetMax: 800, deadline: '2026-06-05',
          location: 'Miami, FL', remote: false,
          skills: ['Part 107', 'DJI Mavic', 'real estate', '4K'],
          clientId: 'client-5', clientName: 'Sunset Realty Miami', status: 'open', applications: 2,
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
        {
          id: 'demo-6', title: 'Conference Recap Video · Annual Summit',
          description: 'Two-day tech conference (~2000 attendees) needs a recap video team: keynote captures, hallway b-roll, attendee interviews, 3-minute hype edit.',
          primary_pillar: 'video_production', serviceId: 'video_production', specialty: 'Event & Conference Video',
          budgetMin: 3000, budgetMax: 5000, deadline: '2026-07-01',
          location: 'San Francisco, CA', remote: false,
          skills: ['multi-cam', 'live event', 'interviews', 'social'],
          clientId: 'client-6', clientName: 'Verge Conference', status: 'open', applications: 9,
          createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
        },
        {
          id: 'demo-7', title: 'Restaurant Menu Photography',
          description: 'Modern Vietnamese restaurant launching new spring menu, need 24 hero dishes shot. Natural light preferred, moody-but-clean aesthetic.',
          primary_pillar: 'photography', serviceId: 'photography', specialty: 'Food & Hospitality',
          budgetMin: 600, budgetMax: 1200, deadline: '2026-06-20',
          location: 'Chicago, IL', remote: false,
          skills: ['food photography', 'natural light', 'restaurant', 'editorial'],
          clientId: 'client-7', clientName: 'Saigon Sky', status: 'open', applications: 4,
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        },
        {
          id: 'demo-8', title: 'Documentary Short for Nonprofit',
          description: '12-minute documentary short profiling 3 program beneficiaries across NYC, Detroit, and Atlanta. Interviews + verite + supporting footage.',
          primary_pillar: 'video_production', serviceId: 'video_production', specialty: 'Documentary & Interviews',
          budgetMin: 4000, budgetMax: 8000, deadline: '2026-08-15',
          location: 'Multi-city · NYC, Detroit, ATL', remote: false,
          skills: ['documentary', 'interviews', 'verite', 'travel'],
          clientId: 'client-8', clientName: 'Hope Foundation', status: 'shortlisting', applications: 11,
          createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
        },
        {
          id: 'demo-9', title: 'Editorial Headshots — Founder Series',
          description: 'Magazine feature on 8 founders, editorial portraits, studio + on-location. Need a photographer with strong editorial sensibility.',
          primary_pillar: 'photography', serviceId: 'photography', specialty: 'Editorial & Press',
          budgetMin: 1500, budgetMax: 2500, deadline: '2026-06-28',
          location: 'Brooklyn, NY', remote: false,
          skills: ['editorial', 'portrait', 'magazine', 'founders'],
          clientId: 'client-9', clientName: 'Stride Magazine', status: 'open', applications: 6,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'demo-10', title: 'Brand Color Pass · Spring Campaign',
          description: 'Color grading pass on a 90-second spring campaign film. Moody warm palette, two-pass workflow with editorial team.',
          primary_pillar: 'post_production', serviceId: 'post_production', specialty: 'Color Grading',
          budgetMin: 800, budgetMax: 1600, deadline: '2026-06-08',
          location: '', remote: true,
          skills: ['DaVinci Resolve', 'editorial', 'warm grade', 'campaign'],
          clientId: 'client-10', clientName: 'Northgrade · Aesop', status: 'open', applications: 4,
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        }
      ];
      saveProjects(demos);
      setProjects(demos);
    }
  }, []);
  function handlePosted(newProject) {
    setProjects(prev => [newProject, ...prev]);
    setShowPost(false);
    navigate(`/matches/${newProject.id}`);
  }

  function handleApplied(newApp) {
    setApplications(prev => [newApp, ...prev]);
    setApplyTarget(null);
    setProjects(prev => prev.map(p => p.id === newApp.projectId ? { ...p, applications: (p.applications || 0) + 1 } : p));
  }

  const myApplications = applications.filter(a => a.creatorId === creatorListing?.id);
  const myProjects      = projects.filter(p => p.clientId === user?.id);

  const isCreator = !!creatorListing;

  const browsed = projects.filter(p => {
    if (tab !== 'browse') return true;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterService) {
      // filterService now holds a pillar id (video_production / photography / post_production)
      const projectPillar = p.primary_pillar
        || LEGACY_SERVICE_TO_PILLAR[normalizeServiceId(p.serviceId || p.service_id || p.serviceType)]?.pillar;
      if (projectPillar !== filterService) return false;
    }
    if (filterBudget !== 'any') {
      const range = BUDGET_RANGES.find(r => r.id === filterBudget);
      const mid = ((p.budgetMin || 0) + (p.budgetMax || p.budgetMin || 0)) / 2 || p.budgetMax || p.budgetMin || 0;
      if (range && (mid < range.min || mid > range.max)) return false;
    }
    return true;
  });

  const displayProjects = tab === 'my_projects' ? myProjects
    : tab === 'my_applications' ? projects.filter(p => myApplications.some(a => a.projectId === p.id))
    : browsed;

  const tabs = [
    { id: 'browse',           label: `Browse (${projects.filter(p => p.status === 'open').length})` },
    ...(user ? [
      { id: 'my_projects',      label: `My Posts (${myProjects.length})` },
      ...(isCreator ? [{ id: 'my_applications', label: `Applied (${myApplications.length})` }] : []),
    ] : []),
  ];
  const projectBoardImage = '/images/creatorbridge/backgrounds/09-fallback/fallback-default-cover.jpg';

  useEffect(() => {
    if (displayProjects.length > 0) {
      if (!activeProjectId || !displayProjects.some(p => p.id === activeProjectId)) {
        setActiveProjectId(displayProjects[0].id);
      }
    } else {
      setActiveProjectId(null);
    }
  }, [displayProjects, activeProjectId]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || displayProjects[0] || null;
  }, [projects, activeProjectId, displayProjects]);

  return (
    <div className={`relative min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-55'} text-sans`}>
      <div className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className={`relative overflow-hidden rounded-[28px] border p-6 md:p-8 mb-6 liquid-glass ${
          dark ? 'border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'
        }`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-stretch">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className={`mb-5 text-xs ${textSub}`}>
                  <button type="button" onClick={() => navigate('/')} className="inline-flex min-h-[34px] items-center hover:text-gold-300 transition-colors">Home</button>
                  <span className="mx-2 text-gold-500/70">/</span>
                  <span className={dark ? 'text-white' : 'text-gray-900'}>Project Board</span>
                </p>
                <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                  Open production briefs · US only
                </p>
                <h1 className={`font-display text-4xl md:text-6xl font-bold leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                  Curated work. <span className="gold-text">Scoped</span> before money moves.
                </h1>
                <p className={`text-sm md:text-base leading-7 mt-3 max-w-2xl ${textSub}`}>
                  Every brief is reviewed by the CreatorBridge team and tagged by pillar, budget, location, and timeline before verified creators apply.
                </p>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                {user && (
                  <button type="button" onClick={() => setShowPost(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all shadow-md">
                    <Plus size={14} /> Post a brief
                  </button>
                )}
                <button type="button" onClick={() => navigate('/find')}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.1] hover:border-white/[0.2] text-white text-sm font-bold transition-all bg-white/[0.02]">
                  Browse creators
                </button>
              </div>
            </div>
            
            <div className={`relative hidden min-h-[230px] overflow-hidden rounded-2xl border lg:block ${dark ? 'border-gold-500/18 bg-charcoal-950/70' : 'border-gray-200 bg-gray-50'}`}>
              <img src={projectBoardImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={(e)=>{ if(!e.currentTarget.dataset.fb){ e.currentTarget.dataset.fb='1'; e.currentTarget.src='/images/creatorbridge/backgrounds/01-hero/hero-landing-camera-dolly-alt.jpg'; } }} />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/78 via-charcoal-950/25 to-charcoal-950/8" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-gold-300 mb-2" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                  Production brief
                </p>
                <p className="max-w-sm text-sm font-bold leading-6 text-white">
                  One pillar, clear budget, verified creators.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className={`flex gap-1 p-1 rounded-2xl border w-fit max-w-full overflow-x-auto ${dark ? 'bg-charcoal-950/60 border-white/[0.07]' : 'bg-gray-100 border-gray-200'}`}>
            {tabs.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`min-h-[34px] px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  tab === id ? 'bg-gold-500 text-charcoal-900' : dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'browse' && (
            <div className="relative w-full md:w-64">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search briefs..."
                className="min-h-[34px] w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none bg-charcoal-900 text-white placeholder-charcoal-500 border-white/[0.08] focus:border-gold-500" />
            </div>
          )}
        </div>

        {tab === 'browse' && (
          <div className="flex flex-wrap gap-4 items-center bg-charcoal-950/30 border border-white/[0.06] rounded-2xl p-4 mb-6 liquid-glass">
            <div className="flex flex-wrap gap-2 items-center w-full">
              <span className={`text-[10px] uppercase tracking-wider font-bold ${textSub} mr-2`}>Pillar</span>
              <button 
                type="button"
                onClick={() => setFilterService('')}
                className={`filter-pill ${filterService === '' ? 'active' : ''}`}
              >
                All briefs
              </button>
              {Object.values(PILLARS).map((pillar, index) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setFilterService(pillar.id)}
                  className={`filter-pill ${filterService === pillar.id ? 'active' : ''}`}
                >
                  <span className="font-mono text-[9px] opacity-70">{String(index + 1).padStart(2, '0')}</span>
                  <span>{pillar.name}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center w-full border-t border-white/[0.04] pt-3 mt-1">
              <span className={`text-[10px] uppercase tracking-wider font-bold ${textSub} mr-2`}>Budget · USD</span>
              {BUDGET_RANGES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setFilterBudget(r.id)}
                  className={`filter-pill ${filterBudget === r.id ? 'active' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {displayProjects.length === 0 ? (
          <div className={`rounded-2xl border px-5 py-14 text-center ${dark ? 'border-white/[0.08] bg-charcoal-900/64' : 'border-gray-200 bg-white shadow-sm'} ${textSub}`}>
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${dark ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20' : 'bg-gold-50 text-gold-600'}`}>
              <Briefcase size={20} />
            </div>
            <p className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              {tab === 'my_projects' ? "You haven't posted any briefs yet"
               : tab === 'my_applications' ? "You haven't applied to any briefs yet"
               : "No briefs match your filters"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 opacity-80">
              {tab === 'browse' ? 'Try widening the pillar or budget range filters.' : 'Your active production briefs and applications will appear here.'}
            </p>
            {tab === 'my_projects' && user && (
              <button type="button" onClick={() => setShowPost(true)}
                className="mt-4 px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm shadow-md">
                Post Your First Brief
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
            {/* Brief list. Hidden on mobile when a brief is open in detail
                view, always visible on lg+. */}
            <div className={`space-y-4 ${mobileShowDetail ? 'hidden lg:block' : ''}`}>
              {displayProjects.map(p => {
                const pillar = getProjectPillar(p);
                const budgetStr = p.budgetMin && p.budgetMax
                  ? `$${Number(p.budgetMin).toLocaleString()} - $${Number(p.budgetMax).toLocaleString()}`
                  : p.budgetMax ? `Up to $${Number(p.budgetMax).toLocaleString()}`
                  : p.budgetMin ? `From $${Number(p.budgetMin).toLocaleString()}`
                  : 'Budget TBD';
                
                return (
                  <div
                    key={p.id}
                    className={`brief-card ${activeProject?.id === p.id ? 'active' : ''}`}
                    onClick={() => selectBrief(p.id)}
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${dark ? 'bg-white/[0.05] text-gold-400' : 'bg-gray-100 text-gold-600'} mr-2`}>
                          {pillar.name}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusBadgeClass(p.status, dark)}`}>
                          {PROJECT_STATUSES[p.status]?.label || 'Open'}
                        </span>
                      </div>
                      <span className="text-[10px] text-charcoal-400">{timeAgo(p.createdAt)}</span>
                    </div>
                    
                    <h3 className="font-display font-bold text-base text-white mb-2 leading-snug">
                      {p.title}
                    </h3>
                    
                    <p className="text-xs text-charcoal-300 line-clamp-2 mb-3 leading-relaxed">
                      {p.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-charcoal-400 border-t border-white/[0.04] pt-2.5">
                      <span className="flex items-center gap-1 font-bold text-gold-400">
                        <DollarSign size={10} /> {budgetStr}
                      </span>
                      {locationStr(p.location) && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {locationStr(p.location)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users size={10} /> {p.applications || 0} applied
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail pane. Hidden on mobile by default; tapping a brief
                shows it as the only visible content. Always visible on lg+. */}
            <aside
              ref={detailPaneRef}
              className={`detail-pane liquid-glass border border-white/[0.08] p-6 rounded-2xl shadow-xl scroll-mt-20 ${mobileShowDetail ? '' : 'hidden lg:block'}`}
            >
              {activeProject && mobileShowDetail && (
                <button
                  type="button"
                  onClick={backToBriefList}
                  className="lg:hidden flex items-center gap-1.5 mb-4 text-xs font-bold text-gold-400 hover:text-gold-300 transition-colors"
                >
                  <span aria-hidden="true">←</span> Back to briefs
                </button>
              )}
              {activeProject ? (
                <ProjectDetailPane
                  project={activeProject}
                  dark={dark}
                  onApply={setApplyTarget}
                  myApplications={myApplications}
                  applications={applications}
                  isClient={activeProject.clientId === user?.id}
                  canApply={isCreator && activeProject.clientId !== user?.id}
                  onStatusChange={handleStatusChange}
                />
              ) : (
                <div className="text-center py-12 text-charcoal-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-xs font-semibold text-white">No active project selected</p>
                  <p className="text-[10px] mt-1">Select a brief from the list to view full specifications.</p>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === 'my_projects' && user && (
          <div className="mt-8">
            <ReferralSection dark={dark} userType="client" />
          </div>
        )}
      </div>

      {/* Modals */}
      {showPost && (
        <PostProjectModal dark={dark} onClose={() => setShowPost(false)} onPost={handlePosted} user={user} />
      )}
      {applyTarget && (
        <ApplyModal
          project={applyTarget}
          dark={dark}
          onClose={() => setApplyTarget(null)}
          onApply={handleApplied}
          creatorListing={creatorListing}
        />
      )}
    </div>
  );
}
