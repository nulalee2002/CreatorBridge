import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Plus, MapPin, DollarSign,
  Check, X, Search, Send, Users,
  Star, Calendar, CreditCard, ThumbsUp, RotateCcw, Zap,
  Upload, AlertCircle, Timer, Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { SERVICES, MARKETPLACE_CATEGORIES, getMarketplaceServiceIds, normalizeServiceId } from '../data/rates.js';
import { PROJECT_STATUSES, statusBadgeClass } from '../config/fees.js';
import { ProjectTimeline } from '../components/ProjectTimeline.jsx';
import { DisputeModal } from '../components/DisputeModal.jsx';
import { CancellationModal } from '../components/CancellationModal.jsx';
import { ClientReputationBadge, loadClientReputation, RateClientModal } from '../components/ClientReputationBadge.jsx';
import { ReferralSection } from '../components/ReferralSection.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { sanitizeLongText, sanitizePlainText, sanitizeTagList, clampNumber, sanitizeUrl } from '../utils/inputSecurity.js';
import { checkMessage, logFilterEvent } from '../utils/messageFilter.js';
import {
  fromSupabaseProject,
  loadLocalProjects,
  mergeProjects,
  sanitizeProjectDraft,
  saveLocalProjects,
  toSupabaseProject,
  upsertLocalProject,
} from '../utils/projectStorage.js';

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
    createdAt: row.created_at,
    source: 'supabase',
  };
}

function mergeApplications(...lists) {
  const byId = new Map();
  lists.flat().filter(Boolean).forEach(app => {
    if (!app?.id) return;
    const current = byId.get(app.id) || {};
    byId.set(app.id, { ...app, ...current });
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

// ── Delivery Submit Modal ────────────────────────────────────────
function DeliverySubmitModal({ project, dark, onClose, onDelivered }) {
  const [link, setLink]           = useState('');
  const [notes, setNotes]         = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError]         = useState('');
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
    const deliveredAt = new Date().toISOString();
    const patch = {
      status:      'delivered',
      deliveredAt,
      deliveryLink: cleanLink,
      deliveryNotes: cleanNotes,
    };
    const updated = updateProject(project.id, patch);
    if (supabaseConfigured && isUuid(project.id)) {
      try {
        await supabase
          .from('projects')
          .update({
            status: 'delivered',
            delivered_at: deliveredAt,
            delivery_link: cleanLink,
            delivery_notes: cleanNotes,
          })
          .eq('id', project.id);
      } catch {}
    }
    onDelivered?.(updated.find(p => p.id === project.id));
    onClose();
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
          <button type="button" onClick={handleSubmit}
            className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
            <Send size={14} /> Submit Delivery
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
  });
  const [errors, setErrors] = useState({});
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

  function validate() {
    const next = {};
    const minBudget = parseFloat(form.budgetMin);
    const maxBudget = parseFloat(form.budgetMax);
    const cleanTitle = sanitizePlainText(form.title, 120);
    const cleanDescription = sanitizeLongText(form.description, 4000);
    if (!cleanTitle) next.title = 'Add a clear project title.';
    if (!form.serviceId) next.serviceId = 'Choose the production service you need.';
    if (cleanDescription.length < 80) next.description = 'Add at least 80 characters so creators understand the scope.';
    if (!form.projectDuration) next.projectDuration = 'Select how long you need the creator or crew.';
    if (form.budgetMin && minBudget < 0) next.budgetMin = 'Budget cannot be negative.';
    if (form.budgetMax && maxBudget < 0) next.budgetMax = 'Budget cannot be negative.';
    if (form.budgetMin && form.budgetMax && minBudget > maxBudget) next.budgetMax = 'Max budget should be higher than min budget.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handlePost() {
    if (!validate()) return;
    setErrors({});
    const cleanProject = sanitizeProjectDraft({
      id:          Date.now().toString() + Math.random(),
      title:       sanitizePlainText(form.title, 120),
      description: sanitizeLongText(form.description, 4000),
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
        const { data, error } = await supabase
          .from('projects')
          .insert(toSupabaseProject(project, user.id))
          .select()
          .single();
        if (error) throw error;
        saved = { ...project, ...fromSupabaseProject(data), clientName: project.clientName };
      } catch {
        saved = project;
      }
    }
    upsertLocalProject(saved);
    onPost(saved);
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
            Client production brief
          </p>
          <h3 className={`font-display font-bold text-2xl mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Post a project</h3>
          <p className={`text-sm leading-6 mb-6 ${textSub}`}>
            Give creators enough context to judge fit, timeline, and budget before they apply. Strong briefs get better matches.
          </p>

          <div className="space-y-4">
            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Project Title *</p>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Brand photography for new product launch"
                className={inputCls('title')} />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
            </div>

            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Description *</p>
              <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Describe what needs to be created, the style or usage, must-have shots, deliverables, and anything the creator needs to know."
                className={`${inputCls('description')} resize-none`} />
              <div className="mt-1 flex items-center justify-between gap-3">
                {errors.description ? <p className="text-xs text-red-400">{errors.description}</p> : <span />}
                <p className={`text-[10px] ${form.description.length >= 80 ? 'text-gold-400' : textSub}`}>{form.description.length} / 80</p>
              </div>
            </div>

            <div>
              <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Service Type *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(SERVICES).map(([id, svc]) => (
                  <button key={id} type="button" onClick={() => set('serviceId', form.serviceId === id ? '' : id)}
                    className={`flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                      form.serviceId === id
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : errors.serviceId
                          ? 'border-red-500/45 ' + (dark ? 'text-charcoal-300' : 'text-gray-500')
                          : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35 hover:bg-white/[0.035]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <span className="text-xl leading-none">{svc.icon}</span>
                    <span>
                      <span className="block text-xs font-bold">{svc.name}</span>
                      <span className={`mt-1 block text-[10px] leading-4 ${form.serviceId === id ? 'text-gold-300' : textSub}`}>{svc.description}</span>
                    </span>
                  </button>
                ))}
              </div>
              {errors.serviceId && <p className="mt-1 text-xs text-red-400">{errors.serviceId}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Min Budget ($)</p>
                <input type="number" min={0} value={form.budgetMin} onChange={e => set('budgetMin', e.target.value)}
                  placeholder="500" className={inputCls('budgetMin')} />
                {errors.budgetMin && <p className="mt-1 text-xs text-red-400">{errors.budgetMin}</p>}
              </div>
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Max Budget ($)</p>
                <input type="number" min={0} value={form.budgetMax} onChange={e => set('budgetMax', e.target.value)}
                  placeholder="2000" className={inputCls('budgetMax')} />
                {errors.budgetMax && <p className="mt-1 text-xs text-red-400">{errors.budgetMax}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Project Duration *</p>
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
                <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Location</p>
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
                placeholder="e.g. Adobe Lightroom, drone photography, product shots"
                className={inputCls('skills')} />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button type="button" onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${dark ? 'border-white/[0.09] text-charcoal-300 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
              Cancel
            </button>
            <button type="button" onClick={handlePost}
              disabled={!form.title.trim() || !form.description.trim() || !form.serviceId || !form.projectDuration}
              className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
              <Briefcase size={14} /> Post Project
            </button>
          </div>
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
        const { data } = await supabase
          .from('project_applications')
          .insert({
            project_id: project.id,
            listing_id: creatorListing.id,
            message: cleanProposal,
            proposed_rate: cleanRate,
            status: 'pending',
          })
          .select()
          .single();
        if (data?.id) app.id = data.id;
      } catch {}
    }

    const all = loadApplications();
    saveApplications([...all, app]);
    // Increment application count
    const projs = loadProjects();
    const nextProjects = projs.map(p => p.id === project.id ? { ...p, applications: (p.applications || 0) + 1 } : p);
    saveProjects(nextProjects);
    if (supabaseConfigured && isUuid(project.id)) {
      try {
        await supabase
          .from('projects')
          .update({ applications: (project.applications || 0) + 1 })
          .eq('id', project.id);
      } catch {}
    }
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
                  <input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)}
                      placeholder={project.budgetMax || '1500'} className={`${inputCls} pl-8`} />
                  </div>
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

  function changeStatus(newStatus, patch = {}) {
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
              onClick={e => {
                e.stopPropagation();
                changeStatus('approved', { approvedAt: new Date().toISOString() });
                navigate(`/checkout/${project.id}?payment=final`);
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
  const serviceId = normalizeServiceId(project.serviceId || project.service_id || project.serviceType);
  const svc      = SERVICES[serviceId];
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
            {svc?.icon || '📋'}
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
      />
    </div>
  );
}

// ── Project Detail Modal ─────────────────────────────────────────
function ProjectDetailModal({ project, dark, onClose, onApply, myApplications, applications, isClient, canApply, onStatusChange }) {
  const navigate    = useNavigate();
  const serviceId   = normalizeServiceId(project.serviceId || project.service_id || project.serviceType);
  const svc         = SERVICES[serviceId];
  const textSub     = dark ? 'text-charcoal-300' : 'text-gray-500';
  const applied     = myApplications.some(a => a.projectId === project.id);
  const projectApps = applications.filter(a => a.projectId === project.id);
  const [showDispute, setShowDispute]       = useState(false);
  const [showCancel, setShowCancel]         = useState(false);
  const [showRateClient, setShowRateClient] = useState(false);
  const [showDelivery, setShowDelivery]     = useState(false);
  const [showRevision, setShowRevision]     = useState(false);
  const [localProject, setLocalProject]    = useState(project);

  const budgetStr = project.budgetMin && project.budgetMax
    ? `$${Number(project.budgetMin).toLocaleString()} – $${Number(project.budgetMax).toLocaleString()}`
    : project.budgetMax ? `Up to $${Number(project.budgetMax).toLocaleString()}`
    : project.budgetMin ? `From $${Number(project.budgetMin).toLocaleString()}`
    : 'Budget TBD';

  async function acceptApplication(app) {
    const now = new Date().toISOString();
    const patch = {
      acceptedCreatorId: app.creatorId,
      acceptedApplicationId: app.id,
      acceptedAt: now,
    };
    updateApplicationStatus(app.id, 'accepted');
    const updatedProjects = updateProject(localProject.id, { status: 'accepted', ...patch });
    const updatedProject = updatedProjects.find(p => p.id === localProject.id);
    setLocalProject(updatedProject || { ...localProject, status: 'accepted', ...patch });
    onStatusChange?.(localProject.id, 'accepted', patch);

    if (supabaseConfigured && isUuid(localProject.id)) {
      try {
        await supabase
          .from('projects')
          .update({
            status: 'accepted',
            accepted_creator_id: app.creatorId,
            accepted_application_id: app.id,
          })
          .eq('id', localProject.id);
        if (isUuid(app.id)) {
          await supabase.from('project_applications').update({ status: 'accepted' }).eq('id', app.id);
        }
      } catch {}
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-xl rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto ${dark ? 'bg-charcoal-950/70 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg z-10 ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${dark ? 'bg-white/[0.08]' : 'bg-gray-100'}`}>
              {svc?.icon || '📋'}
            </div>
            <div className="flex-1">
              <h2 className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h2>
              <p className={`text-xs ${textSub}`}>Posted by {project.clientName} · {timeAgo(project.createdAt)}</p>
            </div>
          </div>

          {/* Details grid */}
          <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl mb-4 ${dark ? 'bg-charcoal-900/72' : 'bg-gray-50'}`}>
            {[
              { icon: DollarSign, label: 'Budget', value: budgetStr, color: 'text-gold-400' },
              { icon: Users,      label: 'Applications', value: `${project.applications || 0} proposals`, color: textSub },
              ...(project.projectDuration ? [{ icon: Clock, label: 'Duration', value: project.projectDuration, color: textSub }] : []),
              ...(project.deadline ? [{ icon: Calendar, label: 'Deadline', value: new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: textSub }] : []),
              ...(locationStr(project.location) ? [{ icon: MapPin, label: 'Location', value: locationStr(project.location) + (project.remote ? ' (Remote OK)' : ''), color: textSub }] : []),
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label}>
                <p className={`text-[10px] font-medium mb-0.5 ${textSub}`}>{label}</p>
                <p className={`text-sm font-semibold flex items-center gap-1 ${color}`}><Icon size={12} /> {value}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="mb-4">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Project Status</p>
            <div className={`p-3 rounded-xl border overflow-x-auto ${dark ? 'border-white/[0.07] bg-charcoal-900/72' : 'border-gray-200 bg-gray-50'}`}>
              <ProjectTimeline status={project.status} dark={dark} />
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Project Description</p>
            <p className={`text-sm leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{project.description}</p>
          </div>

          {/* Skills */}
          {project.skills?.length > 0 && (
            <div className="mb-4">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Required Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {project.skills.map(skill => (
                  <span key={skill} className={`text-xs px-2.5 py-1 rounded-full ${dark ? 'bg-white/[0.08] text-charcoal-300' : 'bg-gray-100 text-gray-700'}`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Applications (client view) */}
          {isClient && projectApps.length > 0 && (
            <div className="mb-4">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Proposals Received ({projectApps.length})</p>
              <div className="space-y-2">
                {projectApps.map(app => (
                  <div key={app.id} className={`p-3 rounded-xl border ${dark ? 'border-white/[0.07] bg-charcoal-900/72' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{app.creatorAvatar}</span>
                        <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{app.creatorName}</p>
                        {app.rate && <span className="text-xs font-bold text-gold-400">${Number(app.rate).toLocaleString()}</span>}
                      </div>
                      {localProject.status === 'open' && app.status !== 'accepted' && (
                        <button type="button" onClick={() => acceptApplication(app)}
                          className="shrink-0 rounded-lg bg-gold-500 px-2.5 py-1 text-[10px] font-bold text-charcoal-900 hover:bg-gold-600">
                          Accept
                        </button>
                      )}
                      {app.status === 'accepted' && (
                        <span className="shrink-0 rounded-lg bg-gold-500/15 px-2.5 py-1 text-[10px] font-bold text-gold-400 ring-1 ring-gold-500/20">
                          Accepted
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'} line-clamp-2`}>{app.proposal}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archived project notice */}
          {isArchived(localProject) && (
            <div className="mb-4">
              <ArchivedProjectNotice project={localProject} dark={dark} onStatusChange={onStatusChange} />
            </div>
          )}

          {/* Delivery link display */}
          {localProject.deliveryLink && localProject.status !== 'in_progress' && !isArchived(localProject) && (
            <div className={`mb-4 p-4 rounded-xl border ${dark ? 'border-white/[0.07] bg-charcoal-900/72' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Delivery</p>
              <a href={localProject.deliveryLink} target="_blank" rel="noreferrer"
                className="text-sm text-gold-400 hover:text-gold-300 underline break-all">
                {localProject.deliveryLink}
              </a>
              {localProject.deliveryNotes && (
                <p className={`text-xs mt-2 ${textSub}`}>{localProject.deliveryNotes}</p>
              )}
              <p className={`text-[10px] mt-2 ${textSub}`}>{STORAGE_NOTICE}</p>
            </div>
          )}

          <div className="space-y-2">
            <ProjectActionButtons
              project={localProject}
              isClient={isClient}
              canApply={canApply}
              applied={applied}
              dark={dark}
              onApply={() => { onClose(); onApply(project); }}
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
                className={`w-full py-2 rounded-xl border text-xs font-medium transition-all text-red-400 border-red-500/30 hover:bg-red-500/10`}>
                Cancel Project
              </button>
            )}
            {/* Dispute button - shown for active projects */}
            {isClient && ['retainer_paid', 'in_progress', 'delivered', 'revision'].includes(project.status) && (
              <button type="button" onClick={() => setShowDispute(true)}
                className={`w-full py-2 rounded-xl border text-xs font-medium transition-all text-red-400 border-red-500/30 hover:bg-red-500/10`}>
                Open a Dispute
              </button>
            )}
          </div>
          {showDelivery && (
            <DeliverySubmitModal
              project={localProject}
              dark={dark}
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
              onSubmitted={() => { setShowDispute(false); setLocalProject(p => ({ ...p, status: 'disputed' })); onStatusChange?.(project.id, 'disputed'); onClose(); }}
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
                onClose();
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
      </div>
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
  const [viewTarget, setViewTarget]     = useState(null);

  function handleStatusChange(projectId, newStatus, patch = {}) {
    const cleanPatch = { ...(patch || {}) };
    delete cleanPatch.id;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus, ...cleanPatch } : p));
    setViewTarget(prev => prev?.id === projectId ? { ...prev, status: newStatus, ...cleanPatch } : prev);
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

    async function loadRemoteProjects() {
      if (!supabaseConfigured || !user) return;
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled || !data) return;
      setProjects(current => mergeProjects(current, data.map(fromSupabaseProject)));
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
          .select('id,business_name,name,avatar')
          .in('id', listingIds);
        listingsById = (listingRows || []).reduce((map, listing) => {
          map[listing.id] = listing;
          return map;
        }, {});
      }

      const remoteApps = data.map(row => fromSupabaseApplication(row, listingsById[row.listing_id]));
      setApplications(current => mergeApplications(current, remoteApps));
    }

    loadRemoteProjects();
    loadRemoteApplications();
    return () => { cancelled = true; };
  }, [user]);

  // Seed some demo projects if empty
  useEffect(() => {
    const existing = loadProjects();
    if (existing.length === 0) {
      const demos = [
        {
          id: 'demo-1', title: 'Product Photography for E-Commerce Launch',
          description: 'We\'re launching a new skincare line and need a professional photographer to shoot 30+ products with clean white backgrounds and lifestyle shots for our website and marketing materials.',
          serviceId: 'photography', budgetMin: 800, budgetMax: 1500, deadline: '2026-05-01',
          location: 'New York, NY', remote: false, skills: ['product photography', 'Adobe Lightroom', 'white background'],
          clientId: 'client-1', clientName: 'BeautyBrand Co', status: 'open', applications: 3,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'demo-2', title: 'YouTube Channel Intro Video (30 sec)',
          description: 'Looking for a motion graphics designer to create a punchy 30-second intro animation for a tech review YouTube channel. Should include logo animation, sound effects, and a modern aesthetic.',
          serviceId: 'video', budgetMin: 300, budgetMax: 600, deadline: '2026-04-20',
          location: '', remote: true, skills: ['After Effects', 'motion graphics', 'logo animation'],
          clientId: 'client-2', clientName: 'TechReviewPro', status: 'open', applications: 7,
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
        {
          id: 'demo-3', title: 'Brand Content Package - Real Estate',
          description: 'Boutique real estate agency needs a monthly brand content package: 12 Instagram posts, 4 Reels, and 8 Stories per month. Luxury properties, aspirational lifestyle aesthetic. Must have experience in real estate marketing.',
          serviceId: 'social', budgetMin: 1200, budgetMax: 2500, deadline: null,
          location: 'Los Angeles, CA', remote: true, skills: ['Instagram', 'Canva', 'real estate', 'copywriting'],
          clientId: 'client-3', clientName: 'LuxRealty Group', status: 'open', applications: 12,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'demo-4', title: 'Podcast Production & Editing (Weekly)',
          description: 'Established weekly business podcast (200+ episodes) seeking reliable audio editor. Tasks: noise reduction, leveling, intro/outro insertion, chapter markers. ~45 min raw audio per week. Long-term contract preferred.',
          serviceId: 'podcast', budgetMin: 150, budgetMax: 300, deadline: null,
          location: '', remote: true, skills: ['Adobe Audition', 'podcast editing', 'Descript'],
          clientId: 'client-4', clientName: 'The Business Pod', status: 'open', applications: 5,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
      ];
      saveProjects(demos);
      setProjects(demos);
    }
  }, []);

  function handleApplied(app) {
    setApplications(prev => [...prev, app]);
    setApplyTarget(null);
  }

  function handlePosted(project) {
    setProjects(prev => [project, ...prev]);
    setShowPost(false);
    // Redirect client to smart match results
    navigate(`/matches/${project.id}`);
  }

  const myApplications = applications.filter(a => a.creatorId === creatorListing?.id);
  const myProjects      = projects.filter(p => p.clientId === user?.id);

  const isCreator = !!creatorListing;
  const isClient  = !!user; // Anyone logged in can post

  // Filter browse list
  const browsed = projects.filter(p => {
    if (tab !== 'browse') return true;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterService) {
      const serviceId = normalizeServiceId(p.serviceId || p.service_id || p.serviceType);
      if (!getMarketplaceServiceIds(filterService).includes(serviceId)) return false;
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
  const projectBoardImage = '/images/creatorbridge/project-board-planning.jpg';

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className={`relative overflow-hidden rounded-[28px] border p-6 md:p-8 mb-6 ${
          dark ? 'bg-charcoal-900/70 border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'
        }`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-stretch">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                  Curated production work
                </p>
                <h1 className={`font-display font-bold text-4xl md:text-5xl ${dark ? 'text-white' : 'text-gray-900'}`}>
                  Project Board
                </h1>
                <p className={`text-sm md:text-base leading-7 mt-3 max-w-2xl ${textSub}`}>
                  {isCreator ? 'Browse production briefs and submit proposals.' : 'Post a production brief, compare fit, and keep project context organized before money moves.'}
                </p>
              </div>
              {user && (
                <button type="button" onClick={() => setShowPost(true)}
                  className="flex w-fit items-center gap-2 px-5 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
                  <Plus size={14} /> Post a Project
                </button>
              )}
            </div>
            <div className={`relative hidden min-h-[230px] overflow-hidden rounded-2xl border lg:block ${dark ? 'border-gold-500/18 bg-charcoal-950/70' : 'border-gray-200 bg-gray-50'}`}>
              <img src={projectBoardImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/92 via-charcoal-950/38 to-charcoal-950/12" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-gold-300 mb-2" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                  Production brief
                </p>
                <p className="max-w-sm text-sm font-bold leading-6 text-white">
                  Scope the work before creators apply.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-2xl border mb-5 w-fit max-w-full overflow-x-auto ${dark ? 'bg-charcoal-950/60 border-white/[0.07]' : 'bg-gray-100 border-gray-200'}`}>
          {tabs.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                tab === id ? 'bg-gold-500 text-charcoal-900' : dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Filters (browse only) */}
        {tab === 'browse' && (
          <div className={`flex flex-wrap gap-3 mb-6 rounded-2xl border p-3 ${dark ? 'bg-charcoal-950/45 border-white/[0.06]' : 'bg-white border-gray-200'}`}>
            <div className="relative flex-1 min-w-48">
              <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border outline-none transition-all ${
                  dark ? 'bg-charcoal-950/70 border-white/[0.08] text-white placeholder-charcoal-500 focus:border-gold-500'
                       : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                }`} />
            </div>
            <select value={filterService} onChange={e => setFilterService(e.target.value)}
              className={`px-3 py-2 text-sm rounded-xl border outline-none transition-all ${
                dark ? 'bg-charcoal-950/70 border-white/[0.08] text-white focus:border-gold-500'
                     : 'bg-white border-gray-200 text-gray-900 focus:border-gold-500'
              }`}>
              <option value="">All services</option>
              {MARKETPLACE_CATEGORIES.filter(category => category.id !== 'all').map(category => (
                <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
              ))}
            </select>
            <select value={filterBudget} onChange={e => setFilterBudget(e.target.value)}
              className={`px-3 py-2 text-sm rounded-xl border outline-none transition-all ${
                dark ? 'bg-charcoal-950/70 border-white/[0.08] text-white focus:border-gold-500'
                     : 'bg-white border-gray-200 text-gray-900 focus:border-gold-500'
              }`}>
              {BUDGET_RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        )}

        {/* Project grid */}
        {displayProjects.length === 0 ? (
          <div className={`rounded-2xl border px-5 py-14 text-center ${dark ? 'border-white/[0.08] bg-charcoal-900/64' : 'border-gray-200 bg-white shadow-sm'} ${textSub}`}>
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${dark ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20' : 'bg-gold-50 text-gold-600'}`}>
              <Briefcase size={20} />
            </div>
            <p className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              {tab === 'my_projects' ? "You haven't posted any projects yet"
               : tab === 'my_applications' ? "You haven't applied to any projects yet"
               : "No projects match your filters"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 opacity-80">
              {tab === 'browse' ? 'Try widening the service, location, or budget filters.' : 'When projects move through CreatorBridge, this page becomes your operating view.'}
            </p>
            {tab === 'my_projects' && user && (
              <button type="button" onClick={() => setShowPost(true)}
                className="mt-4 px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm">
                Post Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                dark={dark}
                onApply={setApplyTarget}
                myApplications={myApplications}
                isClient={p.clientId === user?.id}
                canApply={isCreator && p.clientId !== user?.id}
                onView={setViewTarget}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      {/* Client Referral Section - shown on My Projects tab */}
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
      {viewTarget && (
        <ProjectDetailModal
          project={viewTarget}
          dark={dark}
          onClose={() => setViewTarget(null)}
          onApply={setApplyTarget}
          myApplications={myApplications}
          applications={applications}
          isClient={viewTarget.clientId === user?.id}
          canApply={isCreator && viewTarget.clientId !== user?.id}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
