import { useMemo, useState } from 'react';
import { Search, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { CreatorDirectory } from '../components/CreatorDirectory.jsx';

const ROLE_GROUPS = [
  {
    id: 'all',
    label: 'Any teammate',
    pillar: 'all',
    search: '',
    helper: 'Search across the full verified creator network.',
  },
  {
    id: 'video_crew',
    label: 'Video Production',
    pillar: 'video_production',
    search: 'director cinematographer camera operator drone producer gaffer lighting second shooter video production',
    helper: 'DPs, camera operators, producers, drone, lighting, and production crew.',
  },
  {
    id: 'photo_crew',
    label: 'Photography',
    pillar: 'photography',
    search: 'photographer second shooter assistant retoucher product portrait event photography',
    helper: 'Photographers, second shooters, assistants, product, portrait, and event specialists.',
  },
  {
    id: 'post_team',
    label: 'Post Production',
    pillar: 'post_production',
    search: 'editor colorist motion graphics vfx sound design podcast audio retouching post production',
    helper: 'Editors, colorists, motion, VFX, audio, podcast, and finishing specialists.',
  },
  {
    id: 'production_support',
    label: 'Production Support',
    pillar: 'all',
    search: 'producer coordinator art director stylist assistant production support',
    helper: 'Producers, coordinators, stylists, assistants, and project support roles.',
  },
];

const FILTERS_BY_ROLE = {
  video_crew: [
    { label: 'Shoot type', options: ['Brand film', 'Interview', 'Event', 'Drone', 'Documentary'] },
    { label: 'Gear', options: ['Cinema camera', 'Lighting', 'Audio kit', 'Drone'] },
    { label: 'Location requirements', options: ['Local only', 'Can travel', 'Studio access'] },
  ],
  photo_crew: [
    { label: 'Shoot type', options: ['Commercial', 'Portrait', 'Product', 'Event', 'Real estate'] },
    { label: 'Gear', options: ['Studio lights', 'Medium format', 'Drone', 'Tethered capture'] },
    { label: 'Location requirements', options: ['Local only', 'Can travel', 'Studio access'] },
  ],
  post_team: [
    { label: 'Software', options: ['Adobe Premiere Pro', 'DaVinci Resolve', 'Final Cut Pro', 'After Effects', 'Pro Tools'] },
    { label: 'Specialty', options: ['Editing', 'Color grade', 'Motion graphics', 'Sound design', 'Podcast audio'] },
    { label: 'Turnaround', options: ['Rush', '3-5 days', '1-2 weeks'] },
  ],
  production_support: [
    { label: 'Role type', options: ['Producer', 'Coordinator', 'Assistant', 'Stylist', 'Art direction'] },
    { label: 'Location requirements', options: ['Local only', 'Can travel', 'Remote support'] },
    { label: 'Turnaround', options: ['Same week', 'Next week', 'Flexible'] },
  ],
  all: [
    { label: 'Role search', options: ['Second shooter', 'Editor', 'Colorist', 'Producer', 'Assistant'] },
    { label: 'Location requirements', options: ['Local only', 'Can travel', 'Remote support'] },
    { label: 'Available for collaboration', options: ['Open now', 'This week', 'This month'] },
  ],
};

export function CreatorHiringDashboard({ dark = true }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState(ROLE_GROUPS[0]);
  const [filterValues, setFilterValues] = useState({});

  const adaptiveFilters = FILTERS_BY_ROLE[selectedRole.id] || FILTERS_BY_ROLE.all;
  const directorySearchQuery = useMemo(() => (
    [searchTerm.trim(), selectedRole.search, ...Object.values(filterValues)].filter(Boolean).join(' ')
  ), [searchTerm, selectedRole, filterValues]);

  const selectRole = (role) => {
    setSelectedRole(role);
    setFilterValues({});
  };

  return (
    <div className="mx-auto max-w-[1520px] px-5 py-8 sm:px-8">
      <section className={`mb-6 overflow-hidden rounded-2xl border p-7 ${dark ? 'border-gold-500/20 bg-charcoal-950/80 text-white' : 'border-gray-200 bg-white text-gray-900'}`}>
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold-400">Build Your Team</p>
            <h1 className="mt-2 font-display text-4xl font-bold">Build Your Production Team</h1>
            <p className={`mt-3 max-w-3xl text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              Search verified creators by name, studio, role, specialty, city, or software. Hire across Video Production, Photography, Post Production, and production support with fixed collaborator payouts funded before work begins.
            </p>
            <p className={`mt-2 max-w-3xl text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
              This platform view only shows creators marked Open to Creator Collaborations.
            </p>

            <div className={`mt-6 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${dark ? 'border-white/[0.08] bg-charcoal-900/70' : 'border-gray-200 bg-gray-50'}`}>
              <Search size={17} className={dark ? 'text-charcoal-400' : 'text-gray-400'} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search creator, studio, specialty, city"
                className={`min-h-[40px] min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none ${dark ? 'border-white/[0.08] bg-charcoal-950/75 text-white placeholder:text-charcoal-500 focus:border-gold-500' : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-gold-500'}`}
              />
            </div>

            <div className="mt-5">
              <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>What role do you need?</p>
              <div className="flex flex-wrap gap-2">
                {ROLE_GROUPS.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role)}
                    className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition ${
                      selectedRole.id === role.id
                        ? 'border-gold-500 bg-gold-500 text-charcoal-950'
                        : dark ? 'border-white/[0.08] bg-charcoal-900/70 text-charcoal-200 hover:border-gold-500/40 hover:text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gold-400'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              <p className={`mt-2 text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{selectedRole.helper}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {adaptiveFilters.map(filter => (
                <select
                  key={filter.label}
                  aria-label={filter.label}
                  value={filterValues[filter.label] || ''}
                  onChange={(event) => setFilterValues(prev => ({ ...prev, [filter.label]: event.target.value }))}
                  className={`min-h-[40px] rounded-xl border px-3 text-sm outline-none ${dark ? 'border-white/[0.08] bg-charcoal-900 text-white focus:border-gold-500' : 'border-gray-200 bg-white text-gray-900 focus:border-gold-500'}`}
                >
                  <option value="">{filter.label}</option>
                  {filter.options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ))}
            </div>
          </div>

          <aside className={`rounded-2xl border p-5 ${dark ? 'border-gold-500/20 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
            <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400">Protected team payouts</p>
            <h2 className={`mt-2 font-display text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Fixed collaborator payout</h2>
            <p className={`mt-3 text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              The lead creator sets the scope, deadline, and fixed amount. The teammate accepts before work starts, and the collaboration is funded upfront so nobody is left chasing payment.
            </p>
            <div className="mt-4 grid gap-2">
              {[
                ['Scope first', 'Role, deliverables, revisions, and deadline are written before invite.'],
                ['Funded upfront', 'The hiring creator funds the collaborator payout before work begins.'],
                ['Fair release', 'Funds are released after approval or the auto-release window.'],
              ].map(([label, copy]) => (
                <div key={label} className={`flex gap-3 rounded-xl border p-3 ${dark ? 'border-white/[0.07] bg-charcoal-950/50' : 'border-gold-200 bg-white'}`}>
                  {label === 'Funded upfront' ? <WalletCards size={16} className="mt-0.5 shrink-0 text-gold-400" /> : label === 'Fair release' ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold-400" /> : <Users size={16} className="mt-0.5 shrink-0 text-gold-400" />}
                  <div>
                    <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                    <p className={`mt-1 text-[11px] leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <CreatorDirectory
        key={`${selectedRole.id}-${JSON.stringify(filterValues)}-${searchTerm}`}
        dark={dark}
        mode="search"
        initialSearchQuery={directorySearchQuery}
        initialPillarFilter={selectedRole.pillar}
        collaborationOnly
      />
    </div>
  );
}
