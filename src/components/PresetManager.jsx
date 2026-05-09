import { useState, useRef } from 'react';
import { Save, FolderOpen, Download, Upload, Trash2, ChevronDown } from 'lucide-react';

export function PresetManager({ currentState, onLoad, dark = true }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('creator-presets') || '[]'); } catch { return []; }
  });
  const fileRef = useRef(null);

  const persist = (list) => {
    setSaved(list);
    localStorage.setItem('creator-presets', JSON.stringify(list));
  };

  const savePreset = () => {
    if (!name.trim()) return;
    const preset = {
      id: Date.now().toString(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      state: {
        serviceId: currentState.serviceId,
        regionKey: currentState.regionKey,
        lineItems: currentState.lineItems,
        equipment: currentState.equipment,
        turnaround: currentState.turnaround,
        licensingId: currentState.licensingId,
        taxEnabled: currentState.taxEnabled,
        taxRate: currentState.taxRate,
        revisions: currentState.revisions,
        additionalRevisionRate: currentState.additionalRevisionRate,
        experienceLevel: currentState.experienceLevel,
        currency: currentState.currency,
      },
    };
    persist([preset, ...saved]);
    setName('');
  };

  const deletePreset = (id) => persist(saved.filter(p => p.id !== id));

  const exportPreset = (preset) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const preset = JSON.parse(ev.target.result);
        if (preset.name && preset.state) {
          preset.id = Date.now().toString();
          preset.createdAt = new Date().toISOString();
          persist([preset, ...saved]);
        }
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const bg = dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200';
  const dropBg = dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_24px_80px_rgba(0,0,0,0.36)]' : 'bg-white border-gray-200';
  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-400';
  const hoverRow = dark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-50';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${bg} ${textMain} text-sm transition-all hover:border-gold-500/40`}
      >
        <FolderOpen size={14} className="text-gold-400" />
        <span className="font-medium">Presets</span>
        {saved.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400">{saved.length}</span>
        )}
        <ChevronDown size={12} className={`${textSub} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 top-full mt-2 z-40 w-80 rounded-2xl border shadow-2xl ${dropBg} overflow-hidden animate-slide-up`}>
            {/* Save section */}
            <div className={`px-4 py-3 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Save Current Settings</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()}
                  placeholder="e.g., My Wedding Rates"
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={savePreset}
                  disabled={!name.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500 text-charcoal-900 text-xs font-bold disabled:opacity-40 hover:bg-gold-600 transition-colors"
                >
                  <Save size={12} /> Save
                </button>
              </div>
            </div>

            {/* Import */}
            <div className={`px-4 py-2 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`flex items-center gap-2 text-xs ${textSub} hover:${dark ? 'text-white' : 'text-gray-900'} transition-colors`}
              >
                <Upload size={12} /> Import preset from JSON
              </button>
              <input ref={fileRef} type="file" accept=".json" onChange={importPreset} className="hidden" />
            </div>

            {/* Saved presets */}
            <div className="max-h-64 overflow-y-auto">
              {saved.length === 0 ? (
                <div className={`px-4 py-6 text-center text-xs ${textSub}`}>No saved presets yet</div>
              ) : (
                saved.map(preset => (
                  <div key={preset.id}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b last:border-0 ${dark ? 'border-white/[0.07]' : 'border-gray-100'} ${hoverRow} transition-colors`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${textMain}`}>{preset.name}</p>
                      <p className={`text-[10px] ${textSub}`}>
                        {preset.state.serviceId} · {new Date(preset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => { onLoad(preset.state); setOpen(false); }}
                        className="p-1.5 rounded-lg text-gold-400 hover:bg-gold-500/10 transition-colors text-xs font-medium">
                        Load
                      </button>
                      <button type="button" onClick={() => exportPreset(preset)}
                        className={`p-1.5 rounded-lg ${textSub} hover:text-gold-400 transition-colors`}>
                        <Download size={12} />
                      </button>
                      <button type="button" onClick={() => deletePreset(preset.id)}
                        className={`p-1.5 rounded-lg ${textSub} hover:text-red-400 transition-colors`}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
