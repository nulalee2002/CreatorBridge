import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Briefcase, CheckCircle2, Clock, CreditCard, FileText,
  Globe, Image, MessageSquare, Phone, Search, ShieldCheck, Star, User, Users, Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { ClientVerification } from '../components/ClientVerification.jsx';
import { ClientReputationBadge, loadClientReputation } from '../components/ClientReputationBadge.jsx';
import { SERVICES, normalizeServiceId } from '../data/rates.js';
import { fromSupabaseProject, mergeProjects } from '../utils/projectStorage.js';

function loadLocalClientProfile(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-client-profiles') || '[]');
    return all.find(p => p.userId === userId || p.user_id === userId) || null;
  } catch { return null; }
}

function saveLocalClientProfile(profile) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-client-profiles') || '[]');
    const idx = all.findIndex(p => p.userId === profile.userId || p.user_id === profile.user_id);
    if (idx >= 0) all[idx] = { ...all[idx], ...profile };
    else all.push(profile);
    localStorage.setItem('cm-client-profiles', JSON.stringify(all));
  } catch {}
}

function loadLocalProjects(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
    return all.filter(p => p.clientId === userId || p.client_id === userId);
  } catch { return []; }
}

function loadLocalTransactions(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-transactions') || '[]');
    return all.filter(t => t.clientId === userId || t.client_id === userId);
  } catch { return []; }
}

function loadLocalFavoriteIds() {
  try {
    return JSON.parse(localStorage.getItem('creator-favorites') || '[]');
  } catch {
    return [];
  }
}

function normalizeTransaction(txn) {
  return {
    ...txn,
    id: txn.id,
    clientId: txn.clientId || txn.client_id,
    retainerAmount: Number(txn.retainerAmount ?? txn.retainer_amount ?? 0),
    finalAmount: Number(txn.finalAmount ?? txn.final_amount ?? 0),
    clientFeeAmount: Number(txn.clientFeeAmount ?? txn.client_fee_amount ?? 0),
    retainerStatus: txn.retainerStatus || txn.retainer_status || 'pending',
    finalStatus: txn.finalStatus || txn.final_status || 'pending',
    retainerPaidAt: txn.retainerPaidAt || txn.retainer_paid_at,
    finalPaidAt: txn.finalPaidAt || txn.final_paid_at,
    createdAt: txn.createdAt || txn.created_at,
  };
}

function clientPaidCents(txn) {
  const t = normalizeTransaction(txn);
  const fallback = Number(t.client_paid ?? t.amount ?? t.totalClientPays ?? 0);
  if (fallback > 0) return fallback > 10000 ? fallback : Math.round(fallback * 100);

  let paid = 0;
  if (['paid', 'released'].includes(t.retainerStatus)) {
    paid += t.retainerAmount + t.clientFeeAmount;
  }
  if (['paid', 'released'].includes(t.finalStatus)) {
    paid += t.finalAmount + t.clientFeeAmount;
  }
  return paid;
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function projectDate(project) {
  const raw = project.projectDate || project.deadline || project.timeline || project.createdAt || project.created_at;
  if (!raw) return 'Date pending';
  return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function serviceName(project) {
  const id = normalizeServiceId(project.serviceId || project.service_id || project.service || project.serviceType);
  return SERVICES[id]?.name || project.serviceType || 'Production';
}

function normalizeUrl(url = '') {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function clientInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || 'C';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : 'B';
  return `${first}${second}`.toUpperCase();
}

export function ClientProfilePage({ dark }) {
  const { user, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [clientProfile, setClientProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [savedCreatorCount, setSavedCreatorCount] = useState(0);
  const [form, setForm] = useState({ displayName: '', companyName: '', phone: '', avatarUrl: '', website: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const panelCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.07] shadow-[0_28px_90px_rgba(0,0,0,0.22)]' : 'bg-white border-gray-200 shadow-sm'}`;
  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadClientData();
  }, [user]);

  async function loadClientData() {
    setLoading(true);
    let profile = null;
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = data;

      const { data: quoteRows } = await supabase
        .from('quote_requests')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      const { data: projectRows } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      const localProjects = loadLocalProjects(user.id);
      const dbProjects = (projectRows || []).map(fromSupabaseProject);
      const quoteProjects = (quoteRows || []).map(q => ({
        id: q.id,
        title: q.project_title || q.description || 'Quote request',
        serviceId: q.service_id,
        projectDate: q.timeline,
        budgetRange: q.budget_range || (q.budget ? `$${Number(q.budget).toLocaleString()}` : ''),
        status: q.status || 'quote_requested',
        createdAt: q.created_at,
        clientId: q.client_id,
        source: 'quote_request',
      }));
      setProjects(mergeProjects(localProjects, dbProjects, quoteProjects));

      const { data: txnRows } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });
      setTransactions([...(txnRows || []), ...loadLocalTransactions(user.id)].map(normalizeTransaction));

      const { data: favoriteRows } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.id);
      const favoriteIds = new Set([
        ...(favoriteRows || []).map(row => row.listing_id),
        ...loadLocalFavoriteIds(),
      ].filter(Boolean));
      setSavedCreatorCount(favoriteIds.size);
    } else {
      profile = loadLocalClientProfile(user.id);
      setProjects(loadLocalProjects(user.id));
      setTransactions(loadLocalTransactions(user.id).map(normalizeTransaction));
      setSavedCreatorCount(loadLocalFavoriteIds().length);
    }

    setClientProfile(profile);
    setForm({
      displayName: profile?.display_name || profile?.displayName || authProfile?.full_name || user.email?.split('@')[0] || '',
      companyName: profile?.company_name || profile?.companyName || '',
      phone: profile?.phone || '',
      avatarUrl: profile?.avatar_url || profile?.avatarUrl || '',
      website: profile?.website || '',
      bio: profile?.bio || '',
    });
    setReputation(await loadClientReputation(user.id));
    setLoading(false);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      userId: user.id,
      user_id: user.id,
      displayName: form.displayName,
      display_name: form.displayName,
      companyName: form.companyName,
      company_name: form.companyName,
      phone: form.phone,
      avatarUrl: form.avatarUrl,
      avatar_url: form.avatarUrl,
      website: form.website,
      bio: form.bio,
      emailVerified: !!user.email,
      email_verified: !!user.email,
      updatedAt: now,
      updated_at: now,
    };

    if (supabaseConfigured) {
      await supabase.from('client_profiles').upsert({
        user_id: user.id,
        display_name: form.displayName,
        company_name: form.companyName || null,
        phone: form.phone || null,
        avatar_url: form.avatarUrl || null,
        website: form.website || null,
        bio: form.bio.trim() || null,
        email_verified: !!user.email,
        updated_at: now,
      }, { onConflict: 'user_id' });
    } else {
      saveLocalClientProfile(payload);
    }

    setClientProfile(prev => ({ ...(prev || {}), ...payload }));
    setSaving(false);
  }

  const stats = useMemo(() => {
    const completedStatuses = ['completed', 'final_paid'];
    const inactiveStatuses = ['cancelled', ...completedStatuses];
    const active = projects.filter(p => !inactiveStatuses.includes(p.status)).length;
    const completed = projects.filter(p => completedStatuses.includes(p.status)).length;
    const totalSpent = transactions.reduce((sum, txn) => sum + clientPaidCents(txn), 0) / 100;
    return { active, completed, totalSpent, all: projects.length };
  }, [projects, transactions]);

  const recentProjects = projects
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
    .slice(0, 4);
  const clientName = form.companyName || form.displayName || 'Client Account';
  const clientAvatar = normalizeUrl(form.avatarUrl);
  const clientWebsite = normalizeUrl(form.website);
  const clientHeroImage = '/images/creatorbridge/event-crew-stage.png';
  const clientSupportImage = '/images/creatorbridge/post-production-suite.png';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 px-5 text-center ${dark ? 'text-white' : 'text-gray-900'}`}>
        <Users size={42} className="text-gold-400" />
        <h1 className="font-display text-2xl font-bold">Sign in to manage your client profile</h1>
        <p className={`max-w-md text-sm ${textSub}`}>Your client page tracks quote requests, project status, account verification, and booking readiness.</p>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login', role: 'client' } }))}
          className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-charcoal-900">
          Sign In
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1520px] px-5 py-8 sm:px-8 lg:px-12">
      <section className={`relative overflow-hidden rounded-[28px] border p-6 md:p-8 mb-6 ${dark ? 'bg-charcoal-900/72 border-gold-500/18 shadow-[0_32px_110px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-stretch">
          <div>
            <p className="mb-3 text-gold-400" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Client Command Center
            </p>
            <h1 className={`font-display text-4xl font-bold leading-tight md:text-5xl ${dark ? 'text-white' : 'text-gray-900'}`}>
              Run production without building a full in-house team.
            </h1>
            <p className={`mt-4 max-w-2xl text-sm leading-7 md:text-base ${textSub}`}>
              Keep creator discovery, quote requests, active projects, booking identity, and trust signals in one production hub before you hire.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['Source', 'Verified talent'],
                ['Brief', 'Clear project needs'],
                ['Book', 'Protected payment path'],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl border px-4 py-3 ${dark ? 'border-white/[0.07] bg-charcoal-950/44' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-400">{label}</p>
                  <p className={`mt-1 text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-gold-500/18 bg-charcoal-950/75">
            <img src={clientHeroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-76" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/28 to-black/12" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                Production Desk
              </p>
              <h2 className="font-display text-2xl font-bold text-white">Your outside production department.</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-charcoal-200">Find the right crew, compare proof, and keep the booking path accountable.</p>
            </div>
          </div>
          <div className={`xl:col-start-2 rounded-2xl border p-4 ${dark ? 'bg-gold-500/10 border-gold-500/20' : 'bg-gold-50 border-gold-200'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-sm font-black ${dark ? 'border-gold-500/25 bg-charcoal-950/65 text-gold-300' : 'border-gold-200 bg-white text-gold-700'}`}>
                  {clientAvatar ? (
                    <img src={clientAvatar} alt="" className="h-full w-full object-cover" />
                  ) : clientInitials(clientName)}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{clientName}</p>
                  <p className={`mt-1 truncate text-[11px] ${textSub}`}>{user.email}</p>
                  {clientWebsite && (
                    <a href={clientWebsite} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold text-gold-400 hover:text-gold-300">
                      <Globe size={11} /> Website
                    </a>
                  )}
                </div>
              </div>
              <ClientReputationBadge metrics={reputation || { totalProjects: stats.completed }} dark={dark} size="md" />
            </div>
            {form.bio && (
              <p className={`mt-3 line-clamp-2 text-[11px] leading-5 ${textSub}`}>{form.bio}</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Active projects', value: stats.active, icon: Briefcase },
              { label: 'Completed', value: stats.completed, icon: CheckCircle2 },
              { label: 'Total spent', value: money(stats.totalSpent), icon: CreditCard },
              { label: 'Saved creators', value: savedCreatorCount, icon: Star },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className={`${panelCls} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <Icon size={17} className="text-gold-400" />
                  <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${textSub}`}>{label}</span>
                </div>
                <p className={`font-display text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className={`${panelCls} p-5`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                  Booking Activity
                </p>
                <h2 className={`font-display text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Project Pipeline</h2>
              </div>
              <button type="button" onClick={() => navigate('/projects')}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-bold text-charcoal-900 hover:bg-gold-600">
                Open Projects <ArrowRight size={14} />
              </button>
            </div>

            {recentProjects.length ? (
              <div className="space-y-3">
                {recentProjects.map(project => (
                  <button key={project.id} type="button" onClick={() => navigate('/projects')}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${dark ? 'bg-charcoal-950/55 border-white/[0.07] hover:border-gold-500/30' : 'bg-gray-50 border-gray-200 hover:border-gold-300'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className={`font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{project.title || 'Untitled project'}</p>
                        <p className={`mt-1 text-xs ${textSub}`}>{serviceName(project)} · {projectDate(project)}</p>
                      </div>
                      <span className="rounded-full bg-gold-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-400 ring-1 ring-gold-500/20">
                        {String(project.status || 'open').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={`rounded-2xl border p-8 text-center ${dark ? 'bg-charcoal-950/45 border-white/[0.07]' : 'bg-gray-50 border-gray-200'}`}>
                <Search size={30} className="mx-auto mb-3 text-gold-400" />
                <p className={`font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>No projects in motion yet</p>
                <p className={`mx-auto mt-2 max-w-md text-sm ${textSub}`}>Post a project brief or browse verified creators to start building your first booking path.</p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <button type="button" onClick={() => navigate('/projects')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-bold text-charcoal-900 hover:bg-gold-600">
                    Post a project <ArrowRight size={14} />
                  </button>
                  <button type="button" onClick={() => navigate('/')}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${dark ? 'border-white/[0.09] text-charcoal-200 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-700 hover:border-gold-300'}`}>
                    Browse creators
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'Find creators', copy: 'Browse verified media specialists by category, location, and fit.', icon: Search, action: () => navigate('/') },
              { title: 'Review messages', copy: 'Keep project questions and booking context inside CreatorBridge.', icon: MessageSquare, action: () => navigate('/messages') },
              { title: 'Post a project', copy: 'Create a brief and review Smart Match recommendations.', icon: Zap, action: () => navigate('/projects') },
            ].map(({ title, copy, icon: Icon, action }) => (
              <button key={title} type="button" onClick={action}
                className={`${panelCls} group p-5 text-left transition-all hover:border-gold-500/35`}>
                <Icon size={20} className="mb-4 text-gold-400" />
                <p className={`font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
                <p className={`mt-2 text-xs leading-5 ${textSub}`}>{copy}</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-gold-500/18 bg-charcoal-950/70">
            <img src={clientSupportImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/22 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                Review Before Booking
              </p>
              <h2 className="font-display text-xl font-bold text-white">Creator proof stays visible before money moves.</h2>
            </div>
          </div>

          <ClientVerification user={user} dark={dark} requireLevel="basic" onComplete={loadClientData} />

          <form onSubmit={saveProfile} className={`${panelCls} p-5`}>
            <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
              Client Profile
            </p>
            <h2 className={`mb-4 font-display text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Booking identity</h2>
            <div className="space-y-3">
              <label className="block">
                <span className={`mb-1.5 block text-xs font-medium ${textSub}`}>Display name</span>
                <div className="relative">
                  <User size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                  <input className={`${inputCls} pl-9`} value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Your name" />
                </div>
              </label>
              <label className="block">
                <span className={`mb-1.5 block text-xs font-medium ${textSub}`}>Company or brand</span>
                <div className="relative">
                  <Briefcase size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                  <input className={`${inputCls} pl-9`} value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Company name" />
                </div>
              </label>
              <label className="block">
                <span className={`mb-1.5 block text-xs font-medium ${textSub}`}>Phone</span>
                <div className="relative">
                  <Phone size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                  <input className={`${inputCls} pl-9`} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                </div>
              </label>
              <label className="block">
                <span className={`mb-1.5 block text-xs font-medium ${textSub}`}>Logo or headshot URL</span>
                <div className="relative">
                  <Image size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                  <input className={`${inputCls} pl-9`} value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))} placeholder="https://..." />
                </div>
              </label>
              <label className="block">
                <span className={`mb-1.5 block text-xs font-medium ${textSub}`}>Website or brand link</span>
                <div className="relative">
                  <Globe size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                  <input className={`${inputCls} pl-9`} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="yourbrand.com" />
                </div>
              </label>
              <label className="block">
                <span className={`mb-1.5 block text-xs font-medium ${textSub}`}>About this client</span>
                <textarea
                  className={`${inputCls} min-h-[96px] resize-none`}
                  maxLength={300}
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Short context creators should know before accepting work."
                />
                <span className={`mt-1 block text-right text-[11px] ${textSub}`}>{form.bio.length}/300</span>
              </label>
            </div>
            <button type="submit" disabled={saving || !form.displayName}
              className="mt-4 w-full rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-bold text-charcoal-900 transition-colors hover:bg-gold-600 disabled:opacity-45">
              {saving ? 'Saving...' : 'Save Client Profile'}
            </button>
          </form>

          <div className={`${panelCls} p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                  Client Trust Profile
                </p>
                <h2 className={`font-display text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Booking signals</h2>
              </div>
              <ClientReputationBadge metrics={reputation || { totalProjects: stats.completed }} dark={dark} size="md" />
            </div>
            <div className="space-y-2">
              {[
                { label: 'Projects posted', value: stats.all },
                { label: 'Completed bookings', value: stats.completed },
                { label: 'Creator reviews', value: reputation?.totalReviews || 0 },
                { label: 'Average rating', value: reputation?.avgRating ? reputation.avgRating.toFixed(1) : 'Pending' },
              ].map(({ label, value }) => (
                <div key={label} className={`flex items-center justify-between rounded-xl px-3 py-2 ${dark ? 'bg-white/[0.025]' : 'bg-gray-50'}`}>
                  <span className={`text-xs ${textSub}`}>{label}</span>
                  <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
                </div>
              ))}
            </div>
            <p className={`mt-3 text-[11px] leading-5 ${textSub}`}>
              These signals help creators understand booking reliability before accepting work.
            </p>
          </div>

          <div className={`${panelCls} p-5`}>
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck size={20} className="text-gold-400" />
              <div>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Booking readiness</p>
                <p className={`text-xs ${textSub}`}>What creators see before accepting work.</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Email connected', done: !!user.email, icon: FileText },
                { label: 'Profile name saved', done: !!(clientProfile?.display_name || clientProfile?.displayName || form.displayName), icon: User },
                { label: 'Phone added', done: !!(clientProfile?.phone || form.phone), icon: Phone },
                { label: 'Project history started', done: stats.all > 0, icon: Clock },
              ].map(({ label, done, icon: Icon }) => (
                <div key={label} className={`flex items-center justify-between rounded-xl px-3 py-2 ${dark ? 'bg-white/[0.025]' : 'bg-gray-50'}`}>
                  <span className={`flex items-center gap-2 text-xs ${textSub}`}><Icon size={13} /> {label}</span>
                  <span className={done ? 'text-gold-400' : textSub}>{done ? 'Ready' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
