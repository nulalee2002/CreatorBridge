import { useState, useMemo } from 'react';
import { ChevronDown, MapPin, Search } from 'lucide-react';

// US states with their major cities and tier mapping
const US_STATES = [
  { code: 'AL', name: 'Alabama',        cities: [{ name: 'Birmingham', tier: 3 }, { name: 'Montgomery', tier: 3 }, { name: 'Huntsville', tier: 3 }] },
  { code: 'AK', name: 'Alaska',         cities: [{ name: 'Anchorage', tier: 3 }, { name: 'Fairbanks', tier: 3 }] },
  { code: 'AZ', name: 'Arizona',        cities: [{ name: 'Phoenix', tier: 2 }, { name: 'Scottsdale', tier: 2 }, { name: 'Tucson', tier: 3 }, { name: 'Mesa', tier: 2 }] },
  { code: 'AR', name: 'Arkansas',       cities: [{ name: 'Little Rock', tier: 3 }, { name: 'Fayetteville', tier: 3 }] },
  { code: 'CA', name: 'California',     cities: [{ name: 'Los Angeles', tier: 1 }, { name: 'San Francisco', tier: 1 }, { name: 'San Diego', tier: 1 }, { name: 'Sacramento', tier: 2 }, { name: 'Oakland', tier: 1 }, { name: 'San Jose', tier: 1 }, { name: 'Fresno', tier: 3 }, { name: 'Long Beach', tier: 1 }] },
  { code: 'CO', name: 'Colorado',       cities: [{ name: 'Denver', tier: 2 }, { name: 'Colorado Springs', tier: 3 }, { name: 'Boulder', tier: 2 }, { name: 'Aurora', tier: 2 }] },
  { code: 'CT', name: 'Connecticut',    cities: [{ name: 'Hartford', tier: 2 }, { name: 'New Haven', tier: 2 }, { name: 'Stamford', tier: 1 }] },
  { code: 'DE', name: 'Delaware',       cities: [{ name: 'Wilmington', tier: 3 }, { name: 'Dover', tier: 3 }] },
  { code: 'FL', name: 'Florida',        cities: [{ name: 'Miami', tier: 1 }, { name: 'Orlando', tier: 2 }, { name: 'Tampa', tier: 2 }, { name: 'Jacksonville', tier: 2 }, { name: 'Fort Lauderdale', tier: 1 }, { name: 'Sarasota', tier: 2 }] },
  { code: 'GA', name: 'Georgia',        cities: [{ name: 'Atlanta', tier: 2 }, { name: 'Savannah', tier: 2 }, { name: 'Augusta', tier: 3 }, { name: 'Columbus', tier: 3 }] },
  { code: 'HI', name: 'Hawaii',         cities: [{ name: 'Honolulu', tier: 1 }, { name: 'Maui', tier: 1 }, { name: 'Kauai', tier: 1 }] },
  { code: 'ID', name: 'Idaho',          cities: [{ name: 'Boise', tier: 3 }, { name: 'Nampa', tier: 3 }, { name: 'Idaho Falls', tier: 3 }] },
  { code: 'IL', name: 'Illinois',       cities: [{ name: 'Chicago', tier: 1 }, { name: 'Springfield', tier: 3 }, { name: 'Rockford', tier: 3 }, { name: 'Naperville', tier: 2 }] },
  { code: 'IN', name: 'Indiana',        cities: [{ name: 'Indianapolis', tier: 2 }, { name: 'Fort Wayne', tier: 3 }, { name: 'Evansville', tier: 3 }] },
  { code: 'IA', name: 'Iowa',           cities: [{ name: 'Des Moines', tier: 3 }, { name: 'Cedar Rapids', tier: 3 }, { name: 'Davenport', tier: 3 }] },
  { code: 'KS', name: 'Kansas',         cities: [{ name: 'Wichita', tier: 3 }, { name: 'Overland Park', tier: 3 }, { name: 'Kansas City', tier: 3 }] },
  { code: 'KY', name: 'Kentucky',       cities: [{ name: 'Louisville', tier: 2 }, { name: 'Lexington', tier: 3 }, { name: 'Bowling Green', tier: 3 }] },
  { code: 'LA', name: 'Louisiana',      cities: [{ name: 'New Orleans', tier: 2 }, { name: 'Baton Rouge', tier: 3 }, { name: 'Shreveport', tier: 3 }] },
  { code: 'ME', name: 'Maine',          cities: [{ name: 'Portland', tier: 3 }, { name: 'Bangor', tier: 3 }] },
  { code: 'MD', name: 'Maryland',       cities: [{ name: 'Baltimore', tier: 2 }, { name: 'Bethesda', tier: 1 }, { name: 'Annapolis', tier: 2 }] },
  { code: 'MA', name: 'Massachusetts',  cities: [{ name: 'Boston', tier: 1 }, { name: 'Cambridge', tier: 1 }, { name: 'Worcester', tier: 2 }, { name: 'Springfield', tier: 3 }] },
  { code: 'MI', name: 'Michigan',       cities: [{ name: 'Detroit', tier: 2 }, { name: 'Grand Rapids', tier: 3 }, { name: 'Ann Arbor', tier: 2 }, { name: 'Lansing', tier: 3 }] },
  { code: 'MN', name: 'Minnesota',      cities: [{ name: 'Minneapolis', tier: 2 }, { name: 'Saint Paul', tier: 2 }, { name: 'Rochester', tier: 3 }] },
  { code: 'MS', name: 'Mississippi',    cities: [{ name: 'Jackson', tier: 3 }, { name: 'Gulfport', tier: 3 }] },
  { code: 'MO', name: 'Missouri',       cities: [{ name: 'Kansas City', tier: 2 }, { name: 'St. Louis', tier: 2 }, { name: 'Springfield', tier: 3 }] },
  { code: 'MT', name: 'Montana',        cities: [{ name: 'Billings', tier: 3 }, { name: 'Missoula', tier: 3 }, { name: 'Bozeman', tier: 3 }] },
  { code: 'NE', name: 'Nebraska',       cities: [{ name: 'Omaha', tier: 3 }, { name: 'Lincoln', tier: 3 }] },
  { code: 'NV', name: 'Nevada',         cities: [{ name: 'Las Vegas', tier: 2 }, { name: 'Reno', tier: 3 }, { name: 'Henderson', tier: 2 }] },
  { code: 'NH', name: 'New Hampshire',  cities: [{ name: 'Manchester', tier: 3 }, { name: 'Nashua', tier: 2 }, { name: 'Concord', tier: 3 }] },
  { code: 'NJ', name: 'New Jersey',     cities: [{ name: 'Newark', tier: 1 }, { name: 'Jersey City', tier: 1 }, { name: 'Trenton', tier: 2 }, { name: 'Atlantic City', tier: 2 }] },
  { code: 'NM', name: 'New Mexico',     cities: [{ name: 'Albuquerque', tier: 3 }, { name: 'Santa Fe', tier: 3 }, { name: 'Las Cruces', tier: 3 }] },
  { code: 'NY', name: 'New York',       cities: [{ name: 'New York City', tier: 1 }, { name: 'Brooklyn', tier: 1 }, { name: 'Buffalo', tier: 3 }, { name: 'Albany', tier: 3 }, { name: 'Rochester', tier: 3 }] },
  { code: 'NC', name: 'North Carolina', cities: [{ name: 'Charlotte', tier: 2 }, { name: 'Raleigh', tier: 2 }, { name: 'Greensboro', tier: 3 }, { name: 'Durham', tier: 2 }, { name: 'Asheville', tier: 2 }] },
  { code: 'ND', name: 'North Dakota',   cities: [{ name: 'Fargo', tier: 3 }, { name: 'Bismarck', tier: 3 }] },
  { code: 'OH', name: 'Ohio',           cities: [{ name: 'Columbus', tier: 2 }, { name: 'Cleveland', tier: 2 }, { name: 'Cincinnati', tier: 2 }, { name: 'Toledo', tier: 3 }, { name: 'Akron', tier: 3 }] },
  { code: 'OK', name: 'Oklahoma',       cities: [{ name: 'Oklahoma City', tier: 3 }, { name: 'Tulsa', tier: 3 }] },
  { code: 'OR', name: 'Oregon',         cities: [{ name: 'Portland', tier: 2 }, { name: 'Eugene', tier: 3 }, { name: 'Salem', tier: 3 }, { name: 'Bend', tier: 3 }] },
  { code: 'PA', name: 'Pennsylvania',   cities: [{ name: 'Philadelphia', tier: 1 }, { name: 'Pittsburgh', tier: 2 }, { name: 'Allentown', tier: 3 }, { name: 'Harrisburg', tier: 3 }] },
  { code: 'RI', name: 'Rhode Island',   cities: [{ name: 'Providence', tier: 2 }, { name: 'Newport', tier: 2 }] },
  { code: 'SC', name: 'South Carolina', cities: [{ name: 'Charleston', tier: 2 }, { name: 'Columbia', tier: 3 }, { name: 'Greenville', tier: 3 }, { name: 'Myrtle Beach', tier: 2 }] },
  { code: 'SD', name: 'South Dakota',   cities: [{ name: 'Sioux Falls', tier: 3 }, { name: 'Rapid City', tier: 3 }] },
  { code: 'TN', name: 'Tennessee',      cities: [{ name: 'Nashville', tier: 2 }, { name: 'Memphis', tier: 2 }, { name: 'Knoxville', tier: 3 }, { name: 'Chattanooga', tier: 3 }] },
  { code: 'TX', name: 'Texas',          cities: [{ name: 'Houston', tier: 2 }, { name: 'Dallas', tier: 2 }, { name: 'Austin', tier: 2 }, { name: 'San Antonio', tier: 2 }, { name: 'Fort Worth', tier: 2 }, { name: 'El Paso', tier: 3 }, { name: 'Plano', tier: 2 }] },
  { code: 'UT', name: 'Utah',           cities: [{ name: 'Salt Lake City', tier: 2 }, { name: 'Provo', tier: 3 }, { name: 'Ogden', tier: 3 }, { name: 'Park City', tier: 2 }] },
  { code: 'VT', name: 'Vermont',        cities: [{ name: 'Burlington', tier: 3 }, { name: 'Montpelier', tier: 3 }] },
  { code: 'VA', name: 'Virginia',       cities: [{ name: 'Virginia Beach', tier: 2 }, { name: 'Richmond', tier: 2 }, { name: 'Norfolk', tier: 2 }, { name: 'Arlington', tier: 1 }, { name: 'Alexandria', tier: 1 }] },
  { code: 'WA', name: 'Washington',     cities: [{ name: 'Seattle', tier: 1 }, { name: 'Spokane', tier: 3 }, { name: 'Tacoma', tier: 2 }, { name: 'Bellevue', tier: 1 }] },
  { code: 'WV', name: 'West Virginia',  cities: [{ name: 'Charleston', tier: 3 }, { name: 'Huntington', tier: 3 }] },
  { code: 'WI', name: 'Wisconsin',      cities: [{ name: 'Milwaukee', tier: 2 }, { name: 'Madison', tier: 2 }, { name: 'Green Bay', tier: 3 }] },
  { code: 'WY', name: 'Wyoming',        cities: [{ name: 'Cheyenne', tier: 3 }, { name: 'Casper', tier: 3 }, { name: 'Jackson', tier: 2 }] },
  { code: 'DC', name: 'Washington DC',  cities: [{ name: 'Washington DC', tier: 1 }] },
];

const TIER_LABELS = {
  1: { label: 'Major Market', color: 'text-gold-400', bg: 'bg-gold-500/10', regionKey: 'us-tier1' },
  2: { label: 'Mid-Market',   color: 'text-gold-300',  bg: 'bg-gold-500/10',  regionKey: 'us-tier2' },
  3: { label: 'Smaller Market', color: 'text-charcoal-300', bg: 'bg-white/[0.08]', regionKey: 'us-tier3' },
};

/**
 * Returns { state, city, regionKey } from a stored value object.
 * value: { state: 'CA', city: 'Los Angeles', regionKey: 'us-tier1' } | null
 */
export function StateCitySelector({ value, onChange, dark = true }) {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const [selState, setSelState] = useState(value?.state || '');

  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';
  const dropBg   = dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_24px_80px_rgba(0,0,0,0.36)]' : 'bg-white border-gray-200';
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const hoverRow = dark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-50';

  const filteredStates = useMemo(() => {
    if (!search) return US_STATES;
    const q = search.toLowerCase();
    return US_STATES.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.cities.some(c => c.name.toLowerCase().includes(q))
    );
  }, [search]);

  const currentState = US_STATES.find(s => s.code === (selState || value?.state));

  function selectCity(stateCode, city) {
    const tier = TIER_LABELS[city.tier];
    onChange({ state: stateCode, city: city.name, regionKey: tier.regionKey });
    setOpen(false);
    setSearch('');
  }

  const displayText = value?.city
    ? `${value.city}, ${value.state}`
    : 'Select city…';
  const tierInfo = value?.regionKey ? TIER_LABELS[
    Object.entries(TIER_LABELS).find(([, t]) => t.regionKey === value.regionKey)?.[0]
  ] : null;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border ${
          dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200'
        } ${textMain} transition-all hover:border-gold-500/50 focus:outline-none focus:border-gold-500`}
      >
        <MapPin size={16} className="text-gold-400 shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-semibold truncate">{displayText}</div>
          {tierInfo && (
            <div className={`text-[11px] truncate ${tierInfo.color}`}>{tierInfo.label}</div>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${textSub}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setSelState(''); setSearch(''); }} />
          <div className={`absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border shadow-2xl ${dropBg} overflow-hidden`}>
            {/* Search */}
            <div className={`p-3 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              <div className="relative">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelState(''); }}
                  placeholder="Search state or city…"
                  autoFocus
                  className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {!selState && !search && (
                /* State list */
                filteredStates.map(s => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setSelState(s.code)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${hoverRow}`}
                  >
                    <span className={`text-sm font-medium ${textMain}`}>{s.name}</span>
                    <ChevronDown size={13} className={`-rotate-90 ${textSub}`} />
                  </button>
                ))
              )}

              {(selState || search) && (
                /* City list for selected state or filtered by search */
                <>
                  {selState && !search && (
                    <button
                      type="button"
                      onClick={() => setSelState('')}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b transition-colors ${
                        dark ? 'border-white/[0.07] text-charcoal-300 hover:text-white' : 'border-gray-100 text-gray-400 hover:text-gray-900'
                      }`}
                    >
                      ← {currentState?.name}
                    </button>
                  )}
                  {(selState
                    ? (currentState?.cities || [])
                    : filteredStates.flatMap(s => s.cities.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => ({ ...c, stateCode: s.code, stateName: s.name })))
                  ).map((city, i) => {
                    const tier = TIER_LABELS[city.tier];
                    const stateCode = selState || city.stateCode;
                    return (
                      <button
                        key={`${stateCode}-${city.name}-${i}`}
                        type="button"
                        onClick={() => selectCity(stateCode, city)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${hoverRow} ${
                          value?.city === city.name && value?.state === stateCode
                            ? (dark ? 'bg-gold-500/10' : 'bg-gold-50')
                            : ''
                        }`}
                      >
                        <div>
                          <span className={`text-sm font-medium ${textMain}`}>{city.name}</span>
                          {search && !selState && (
                            <span className={`text-xs ml-1.5 ${textSub}`}>{city.stateName}</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tier.color} ${tier.bg}`}>
                          {tier.label}
                        </span>
                      </button>
                    );
                  })}
                  {search && filteredStates.flatMap(s => s.cities.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))).length === 0 && (
                    <p className={`px-4 py-4 text-sm text-center ${textSub}`}>No cities found for "{search}"</p>
                  )}
                </>
              )}
            </div>

            {/* Tier legend */}
            <div className={`px-4 py-2.5 border-t flex items-center gap-4 ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              {Object.entries(TIER_LABELS).map(([, t]) => (
                <div key={t.regionKey} className="flex items-center gap-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${t.color} ${t.bg}`}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
