import { useEffect, useState } from 'react';
import { Check, Package, Save } from 'lucide-react';
import { SERVICES } from '../data/rates.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import {
  CREATOR_MINIMUM_PROJECT_ERROR,
  CREATOR_MINIMUM_PROJECT_NOTE,
  MINIMUM_PROJECT_BUDGET_DOLLARS,
} from '../config/margins.js';

const PACKAGE_TEMPLATES = {
  Basic:    { color: 'text-charcoal-300', bg: 'bg-white/[0.035]',    border: 'border-white/[0.08]', label: 'Basic' },
  Standard: { color: 'text-gold-400',     bg: 'bg-gold-500/10',      border: 'border-gold-500/35',  label: 'Standard' },
  Premium:  { color: 'text-gold-300',     bg: 'bg-gold-500/[0.16]',  border: 'border-gold-400/50',  label: 'Premium' },
};

const TIER_NAMES = ['Basic', 'Standard', 'Premium'];

function canUseSupabasePackages(creatorId) {
  return Boolean(
    supabaseConfigured &&
    supabase &&
    creatorId &&
    !String(creatorId).startsWith('seed-')
  );
}

function loadPackages(creatorId) {
  try { return JSON.parse(localStorage.getItem(`creator-packages-${creatorId}`) || 'null'); } catch { return null; }
}
function savePackages(creatorId, pkgs) {
  localStorage.setItem(`creator-packages-${creatorId}`, JSON.stringify(pkgs));
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePackageRow(row) {
  return {
    id: row.id,
    name: row.name || 'Package',
    serviceId: row.service_id || 'photography',
    price: row.price === null || row.price === undefined ? '' : String(row.price),
    description: row.description || '',
    turnaroundDays: row.turnaround_days || '',
    revisions: row.revisions ?? 1,
    deliverables: row.deliverables?.length ? row.deliverables : [''],
  };
}

function buildDeliverables(pkg) {
  const written = (pkg.deliverables || []).map(item => item.trim()).filter(Boolean);
  if (written.length > 0) return written;

  const generated = [];
  if (pkg.hoursCoverage) generated.push(`${pkg.hoursCoverage} hour${Number(pkg.hoursCoverage) === 1 ? '' : 's'} of coverage`);
  if (pkg.numVideos) generated.push(`${pkg.numVideos} video deliverable${Number(pkg.numVideos) === 1 ? '' : 's'}`);
  if (pkg.videoLength) generated.push(`${pkg.videoLength} final runtime`);
  if (pkg.editedImages) generated.push(`${pkg.editedImages} edited image${Number(pkg.editedImages) === 1 ? '' : 's'}`);
  if (pkg.colorGrading) generated.push('Color grading included');
  if (pkg.droneFootage) generated.push('Drone footage included');
  if (pkg.rawFootage) generated.push('Raw footage included');
  if (pkg.onlineGallery) generated.push('Online gallery included');
  if (pkg.printRights) generated.push('Print rights included');
  if (pkg.secondShooter) generated.push('Second shooter included');
  if (pkg.travelIncluded) generated.push(`Travel included${pkg.travelRadius ? ` within ${pkg.travelRadius} miles` : ''}`);

  return generated;
}

function packageToRow(pkg, creatorId, index) {
  return {
    listing_id: creatorId,
    service_id: pkg.serviceId || 'photography',
    name: pkg.name || `Package ${index + 1}`,
    price: toNumberOrNull(pkg.price) || 0,
    description: pkg.description || '',
    deliverables: buildDeliverables(pkg),
    turnaround_days: toNumberOrNull(pkg.turnaroundDays),
    revisions: toNumberOrNull(pkg.revisions) ?? 1,
    display_order: index,
  };
}

async function fetchPackages(creatorId, primaryServiceId) {
  const fallback = loadPackages(creatorId);
  if (!canUseSupabasePackages(creatorId)) {
    return fallback?.length ? fallback : TIER_NAMES.map(name => defaultPackage(name, primaryServiceId));
  }

  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('listing_id', creatorId)
    .order('display_order', { ascending: true });

  if (error) {
    console.warn('Package load failed, using local fallback:', error.message);
    return fallback?.length ? fallback : TIER_NAMES.map(name => defaultPackage(name, primaryServiceId));
  }

  if (data?.length) {
    const normalized = data.map(normalizePackageRow);
    savePackages(creatorId, normalized);
    return normalized;
  }

  return fallback?.length ? fallback : TIER_NAMES.map(name => defaultPackage(name, primaryServiceId));
}

async function persistPackages(creatorId, pkgs) {
  savePackages(creatorId, pkgs);
  if (!canUseSupabasePackages(creatorId)) return pkgs;

  const rows = pkgs.map((pkg, index) => packageToRow(pkg, creatorId, index));
  const { error: deleteError } = await supabase
    .from('packages')
    .delete()
    .eq('listing_id', creatorId);

  if (deleteError) throw deleteError;
  if (rows.length === 0) return [];

  const { data, error: insertError } = await supabase
    .from('packages')
    .insert(rows)
    .select('*');

  if (insertError) throw insertError;

  const normalized = data
    ?.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(normalizePackageRow) || pkgs;
  savePackages(creatorId, normalized);
  return normalized;
}

function defaultPackage(name, serviceId) {
  const base = {
    id: Date.now().toString() + Math.random(),
    name,
    serviceId: serviceId || 'photography',
    price: '',
    description: '',
    turnaroundDays: '',
    revisions: 1,
    deliverables: [''],
  };
  if (serviceId === 'video') {
    return { ...base, hoursCoverage: '', numVideos: '', videoLength: '', droneFootage: false, colorGrading: true, rawFootage: false, travelIncluded: false, travelRadius: '' };
  }
  if (serviceId === 'photography') {
    return { ...base, hoursCoverage: 4, editedImages: '', engagementSession: false, onlineGallery: true, printRights: false, secondShooter: false };
  }
  return base;
}

function Toggle({ value, onChange, dark }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-gold-500' : dark ? 'bg-white/[0.09]' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function VideoFields({ pkg, onUpdate, dark, inputCls, textSub, labelCls }) {
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={labelCls}>Hours of Coverage</p>
          <input type="number" min={1} value={pkg.hoursCoverage || ''} placeholder="8"
            onChange={e => onUpdate('hoursCoverage', e.target.value)}
            className={inputCls} />
        </div>
        <div>
          <p className={labelCls}>Video Deliverables</p>
          <input type="number" min={1} value={pkg.numVideos || ''} placeholder="1"
            onChange={e => onUpdate('numVideos', e.target.value)}
            className={inputCls} />
        </div>
      </div>
      <div>
        <p className={labelCls}>Length per Deliverable</p>
        <input type="text" value={pkg.videoLength || ''} placeholder="3 to 5 min"
          onChange={e => onUpdate('videoLength', e.target.value)}
          className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={labelCls}>Revision Rounds</p>
          <input type="number" min={0} value={pkg.revisions || ''} placeholder="2"
            onChange={e => onUpdate('revisions', e.target.value)}
            className={inputCls} />
        </div>
        <div>
          <p className={labelCls}>Turnaround (days)</p>
          <input type="number" min={1} value={pkg.turnaroundDays || ''} placeholder="14"
            onChange={e => onUpdate('turnaroundDays', e.target.value)}
            className={inputCls} />
        </div>
      </div>
      <div className="space-y-2">
        {[
          { field: 'droneFootage', label: 'Drone footage included' },
          { field: 'colorGrading', label: 'Color grading included' },
          { field: 'rawFootage',   label: 'Raw footage included' },
          { field: 'travelIncluded', label: 'Travel included' },
        ].map(({ field, label }) => (
          <div key={field} className="flex items-center justify-between">
            <span className={`text-xs ${textSub}`}>{label}</span>
            <Toggle value={!!pkg[field]} onChange={v => onUpdate(field, v)} dark={dark} />
          </div>
        ))}
        {pkg.travelIncluded && (
          <div>
            <p className={labelCls}>Travel radius (miles)</p>
            <input type="number" min={0} value={pkg.travelRadius || ''} placeholder="50"
              onChange={e => onUpdate('travelRadius', e.target.value)}
              className={inputCls} />
          </div>
        )}
      </div>
    </div>
  );
}

function PhotographyFields({ pkg, onUpdate, dark, inputCls, textSub, labelCls }) {
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={labelCls}>Hours of Coverage</p>
          <select value={pkg.hoursCoverage || 4} onChange={e => onUpdate('hoursCoverage', Number(e.target.value))}
            className={inputCls}>
            {[2, 4, 6, 8, 10, 12].map(h => <option key={h} value={h}>{h} hours</option>)}
          </select>
        </div>
        <div>
          <p className={labelCls}>Edited Images</p>
          <input type="number" min={1} value={pkg.editedImages || ''} placeholder="100"
            onChange={e => onUpdate('editedImages', e.target.value)}
            className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={labelCls}>Revision Rounds</p>
          <input type="number" min={0} value={pkg.revisions || ''} placeholder="2"
            onChange={e => onUpdate('revisions', e.target.value)}
            className={inputCls} />
        </div>
        <div>
          <p className={labelCls}>Turnaround (days)</p>
          <input type="number" min={1} value={pkg.turnaroundDays || ''} placeholder="10"
            onChange={e => onUpdate('turnaroundDays', e.target.value)}
            className={inputCls} />
        </div>
      </div>
      <div className="space-y-2">
        {[
          { field: 'engagementSession', label: 'Engagement session included' },
          { field: 'onlineGallery',     label: 'Online gallery included' },
          { field: 'printRights',       label: 'Print rights included' },
          { field: 'secondShooter',     label: 'Second shooter included' },
        ].map(({ field, label }) => (
          <div key={field} className="flex items-center justify-between">
            <span className={`text-xs ${textSub}`}>{label}</span>
            <Toggle value={!!pkg[field]} onChange={v => onUpdate(field, v)} dark={dark} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BasicFields({ pkg, onUpdate, dark, inputCls, textSub, labelCls }) {
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={labelCls}>Revision Rounds</p>
          <input type="number" min={0} value={pkg.revisions || ''} placeholder="2"
            onChange={e => onUpdate('revisions', e.target.value)}
            className={inputCls} />
        </div>
        <div>
          <p className={labelCls}>Turnaround (days)</p>
          <input type="number" min={1} value={pkg.turnaroundDays || ''} placeholder="7"
            onChange={e => onUpdate('turnaroundDays', e.target.value)}
            className={inputCls} />
        </div>
      </div>
      <div>
        <p className={labelCls}>What's Included (one per line)</p>
        <div className="space-y-1.5">
          {(pkg.deliverables || ['']).map((d, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Check size={10} className="text-gold-400 shrink-0" />
              <input type="text" value={d}
                onChange={e => {
                  const arr = [...(pkg.deliverables || [''])];
                  arr[i] = e.target.value;
                  onUpdate('deliverables', arr);
                }}
                placeholder="e.g. 10 edited images"
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border outline-none transition-all ${
                  dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                       : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                }`} />
              {(pkg.deliverables || []).length > 1 && (
                <button type="button"
                  onClick={() => { const arr = [...(pkg.deliverables || [])].filter((_, j) => j !== i); onUpdate('deliverables', arr); }}
                  className="text-red-400/60 hover:text-red-400 text-xs shrink-0">x</button>
              )}
            </div>
          ))}
          <button type="button"
            onClick={() => onUpdate('deliverables', [...(pkg.deliverables || ['']), ''])}
            className={`text-[10px] flex items-center gap-1 mt-1 transition-colors ${dark ? 'text-charcoal-400 hover:text-gold-400' : 'text-gray-400 hover:text-gold-500'}`}>
            + Add item
          </button>
        </div>
      </div>
    </div>
  );
}

export function PackageBuilder({ creatorId, dark, serviceIds = [] }) {
  const primaryServiceId = serviceIds[0] || 'photography';

  const [packages, setPackages] = useState(() => {
    const saved = loadPackages(creatorId);
    if (saved && saved.length > 0) return saved;
    return TIER_NAMES.map(name => defaultPackage(name, primaryServiceId));
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    fetchPackages(creatorId, primaryServiceId)
      .then(nextPackages => {
        if (active) setPackages(nextPackages);
      })
      .catch(error => {
        console.warn('Package load failed:', error?.message || error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [creatorId, primaryServiceId]);

  const inputCls = `w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ${
    dark
      ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const labelCls = `text-[10px] font-medium mb-1 ${textSub}`;

  function updatePkg(id, field, val) {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
    setSaved(false);
  }

  async function handleSave() {
    setSaveError('');
    const hasBelowFloorPackage = packages.some(pkg => {
      const price = toNumberOrNull(pkg.price);
      return price === null || price < MINIMUM_PROJECT_BUDGET_DOLLARS;
    });
    if (hasBelowFloorPackage) {
      setSaveError(CREATOR_MINIMUM_PROJECT_ERROR);
      return;
    }
    setLoading(true);
    try {
      const persisted = await persistPackages(creatorId, packages);
      setPackages(persisted);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Package save failed:', error);
      setSaveError('Packages could not be saved. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className={`font-display font-bold text-base flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            <Package size={15} className="text-gold-400" /> Package Builder
          </h3>
          <p className={`text-[11px] mt-0.5 ${textSub}`}>
            {loading ? 'Syncing package data...' : 'Create tiered packages clients can choose from'}
          </p>
          {saveError && <p className="text-[11px] mt-1 text-red-400">{saveError}</p>}
          <p className={`text-[10px] mt-1 max-w-xl leading-4 ${textSub}`}>
            {CREATOR_MINIMUM_PROJECT_NOTE}
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={loading}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            saved ? 'bg-gold-500 text-charcoal-900' : 'bg-gold-500 hover:bg-gold-600 text-charcoal-900'
          } ${loading ? 'opacity-70 cursor-wait' : ''}`}>
          {saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> {loading ? 'Saving...' : 'Save Packages'}</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const template = PACKAGE_TEMPLATES[pkg.name] || PACKAGE_TEMPLATES.Basic;
          const onUpdate = (field, val) => updatePkg(pkg.id, field, val);
          const packageServiceId = pkg.serviceId || primaryServiceId;
          const isVideo = packageServiceId === 'video';
          const isPhotography = packageServiceId === 'photography';

          return (
            <div key={pkg.id} className={`rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${template.border} ${template.bg}`}>
              {/* Package header */}
              <input
                type="text"
                value={pkg.name}
                onChange={e => onUpdate('name', e.target.value)}
                className={`font-display font-bold text-sm bg-transparent border-none outline-none w-full mb-3 ${template.color}`}
                placeholder="Package name"
              />

              {/* Service type (if multiple services) */}
              {serviceIds.length > 1 && (
                <div className="mb-3">
                  <p className={labelCls}>Service</p>
                  <select value={pkg.serviceId} onChange={e => onUpdate('serviceId', e.target.value)}
                    className={inputCls}>
                    {serviceIds.map(sid => (
                      <option key={sid} value={sid}>{SERVICES[sid]?.icon} {SERVICES[sid]?.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Price */}
              <div className="mb-3">
                <p className={labelCls}>Price *</p>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${textSub}`}>$</span>
                  <input type="number" min={MINIMUM_PROJECT_BUDGET_DOLLARS} value={pkg.price}
                    onChange={e => onUpdate('price', e.target.value)}
                    placeholder={String(MINIMUM_PROJECT_BUDGET_DOLLARS)}
                    className={`${inputCls} pl-6`} />
                </div>
              </div>

              {/* Description */}
              <div className="mb-2">
                <p className={labelCls}>Description (max 150 chars)</p>
                <textarea value={pkg.description} rows={2} maxLength={150}
                  onChange={e => onUpdate('description', e.target.value)}
                  placeholder="What's included in this package..."
                  className={`${inputCls} resize-none`} />
                <p className={`text-[9px] text-right mt-0.5 ${textSub}`}>{(pkg.description || '').length}/150</p>
              </div>

              {/* Service-specific fields */}
              {isVideo && (
                <VideoFields pkg={pkg} onUpdate={onUpdate} dark={dark} inputCls={inputCls} textSub={textSub} labelCls={labelCls} />
              )}
              {isPhotography && (
                <PhotographyFields pkg={pkg} onUpdate={onUpdate} dark={dark} inputCls={inputCls} textSub={textSub} labelCls={labelCls} />
              )}
              {!isVideo && !isPhotography && (
                <BasicFields pkg={pkg} onUpdate={onUpdate} dark={dark} inputCls={inputCls} textSub={textSub} labelCls={labelCls} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
