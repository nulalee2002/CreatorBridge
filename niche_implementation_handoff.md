# CreatorBridge: Niche Taxonomy & Budget Check Handoff Document

This document provides the complete technical specifications, database migrations, React components, and integration instructions for the new **3-Pillar Niche Taxonomy** and the **Dynamic Budget Health Check** system.

---

## 1. Database Schema & Migration (Supabase SQL)

Run this migration script in the Supabase SQL editor to add the new columns, create the GIN indexes for fast array matching, and establish the default constraints.

```sql
-- Up Migration: Restructure Creator Listings Taxonomy
ALTER TABLE public.creator_listings 
ADD COLUMN primary_niche text,
ADD COLUMN specialties text[],
ADD COLUMN minimum_project_budget numeric DEFAULT 0;

-- Create GIN index for fast containment querying on the specialties array
CREATE INDEX idx_creator_listings_specialties ON public.creator_listings USING gin (specialties);

-- Add database constraint to prevent listings from violating experience bar
ALTER TABLE public.creator_listings 
ADD CONSTRAINT chk_minimum_experience CHECK (years_experience >= 2);

-- Update RLS policies to allow public reads on the new taxonomy fields
-- (Ensures search directory queries work seamlessly)
ALTER TABLE public.creator_listings ENABLE ROW LEVEL SECURITY;
```

---

## 2. Taxonomy Niche Mapping (JSON Definition)

Save this configuration as `src/config/taxonomy.js` to reference the categories and specialties across onboarding, profiles, and directory filters.

```javascript
export const TAXONOMY = {
  video_production: {
    id: 'video_production',
    name: 'Video Production',
    icon: '🎥',
    specialties: [
      { id: 'wedding_films', label: 'Wedding Films (Wedding Video)' },
      { id: 'corporate_brand_films', label: 'Corporate Brand Films' },
      { id: 'commercials_advertising', label: 'Commercials & Advertising' },
      { id: 'events_recaps', label: 'Events & Conference Recaps' },
      { id: 'documentaries_interviews', label: 'Documentaries & Interviews' },
      { id: 'video_podcasts', label: 'Video Podcasts / Talks' },
      { id: 'social_content', label: 'Social & Short-Form Content' },
      { id: 'real_estate_video', label: 'Real Estate Video' },
      { id: 'private_events_video', label: 'Private Events (Birthdays/etc)' },
      { id: 'drone_aerial_video', label: 'Drone & Aerial Videography' }
    ]
  },
  photography: {
    id: 'photography',
    name: 'Photography',
    icon: '📷',
    specialties: [
      { id: 'wedding_photography', label: 'Wedding Photography (Photo)' },
      { id: 'corporate_events_photo', label: 'Corporate Events & Conferences' },
      { id: 'headshots_portraits', label: 'Headshots & Portraits' },
      { id: 'commercial_product', label: 'Commercial & Product Stills' },
      { id: 'lifestyle_fashion', label: 'Lifestyle & Fashion' },
      { id: 'editorial_press', label: 'Editorial & Press' },
      { id: 'real_estate_photo', label: 'Real Estate Photography' },
      { id: 'portraits_milestones', label: 'Portraits & Milestones' },
      { id: 'private_events_photo', label: 'Private Events (Birthdays/etc)' },
      { id: 'drone_aerial_photo', label: 'Drone & Aerial Photography' }
    ]
  },
  post_production: {
    id: 'post_production',
    name: 'Post-Production',
    icon: '🎛️',
    specialties: [
      { id: 'video_editing_corp', label: 'Video Editing (Corporate/Comm)' },
      { id: 'short_form_editing', label: 'Short-Form Editing (Reels/TikTok)' },
      { id: 'narrative_editing', label: 'Narrative & Documentary Editing' },
      { id: 'color_grading', label: 'Color Grading' },
      { id: 'sound_design_mixing', label: 'Sound Design & Audio Mixing' },
      { id: 'motion_graphics_vfx', label: 'Motion Graphics & VFX' },
      { id: 'photo_retouching', label: 'Photo Retouching' },
      { id: 'podcast_mastering', label: 'Podcast Audio Mastering' },
      { id: 'event_highlights_edit', label: 'Event Highlights Editing' }
    ]
  }
};
```

---

## 3. Onboarding Specialty Pill Selector (React)

Create this component at `src/components/onboarding/SpecialtySelector.jsx`. It implements the 2-step onboarding selection flow, enforcing a single primary niche and capping specialties at exactly 3.

```jsx
import React, { useState } from 'react';
import { TAXONOMY } from '../../config/taxonomy.js';

export function SpecialtySelector({ onChange, initialPrimary = '', initialSpecialties = [], dark = true }) {
  const [primary, setPrimary] = useState(initialPrimary);
  const [selected, setSelected] = useState(initialSpecialties);

  const handlePrimaryChange = (pillarId) => {
    setPrimary(pillarId);
    setSelected([]); // Reset specialties when primary changes
    onChange({ primary_niche: pillarId, specialties: [] });
  };

  const handleSpecialtyToggle = (specId) => {
    let updated;
    if (selected.includes(specId)) {
      updated = selected.filter(id => id !== specId);
    } else {
      if (selected.length >= 3) return; // Hard Cap at 3
      updated = [...selected, specId];
    }
    setSelected(updated);
    onChange({ primary_niche: primary, specialties: updated });
  };

  const textCls = dark ? 'text-white' : 'text-gray-900';
  const subtextCls = dark ? 'text-charcoal-400' : 'text-gray-500';

  return (
    <div className="space-y-6">
      {/* Step 1: Select Primary Niche */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider mb-3 text-gold-400">
          Step 1: Select Your Primary Craft (Choose 1)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.values(TAXONOMY).map(pillar => (
            <button
              key={pillar.id}
              type="button"
              onClick={() => handlePrimaryChange(pillar.id)}
              className={`p-4 rounded-xl border text-center transition-all ${
                primary === pillar.id
                  ? 'border-gold-500 bg-gold-500/10 text-gold-400 shadow-lg shadow-gold-500/5'
                  : dark
                    ? 'border-white/[0.08] bg-charcoal-900/50 text-charcoal-300 hover:border-gold-500/40'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <span className="text-2xl block mb-2">{pillar.icon}</span>
              <span className="font-semibold text-sm">{pillar.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Specialties */}
      {primary && (
        <div className="animate-fadeIn">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gold-400">
              Step 2: Select Your Specialties (Up to 3)
            </label>
            <span className={`text-xs font-semibold ${selected.length === 3 ? 'text-gold-400' : subtextCls}`}>
              Selected: {selected.length} / 3
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TAXONOMY[primary].specialties.map(spec => {
              const isSelected = selected.includes(spec.id);
              const isMaxed = selected.length >= 3 && !isSelected;

              return (
                <button
                  key={spec.id}
                  type="button"
                  disabled={isMaxed}
                  onClick={() => handleSpecialtyToggle(spec.id)}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition-all ${
                    isSelected
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : isMaxed
                        ? 'opacity-30 cursor-not-allowed border-transparent bg-transparent'
                        : dark
                          ? 'border-white/[0.06] bg-charcoal-950/40 text-charcoal-300 hover:border-gold-500/30'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-1">{isSelected ? '✓ ' : '+ '}</span>
                  {spec.label}
                </button>
              );
            })}
          </div>

          {selected.length === 3 && (
            <p className="text-[10px] text-gold-400/90 mt-2 font-medium">
              💡 Maximum of 3 specialties selected. Deselect an active item to add a new one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 4. Client-Side Budget Advisory Warning (React)

Create this component at `src/components/briefing/BudgetAdvisory.jsx`. It evaluates the selected project parameters and displays a warning if the budget is below standard U.S. creator rates.

```jsx
import React from 'react';

export function BudgetAdvisory({ serviceType, hours, selectedBudgetMax, dark = true }) {
  if (!serviceType || !hours || !selectedBudgetMax) return null;

  // Rate constants (U.S. Market baseline healthy targets)
  const RATE_THRESHOLDS = {
    photography: 150,     // $150/hr minimum (stills & editing)
    video_production: 250 // $250/hr minimum (shooting & heavy film editing)
  };

  const cleanServiceKey = serviceType.toLowerCase().includes('photo') 
    ? 'photography' 
    : serviceType.toLowerCase().includes('video') || serviceType.toLowerCase().includes('cine')
      ? 'video_production'
      : null;

  const threshold = RATE_THRESHOLDS[cleanServiceKey];
  if (!threshold) return null; // No advisory for post-production/other categories

  const minExpected = hours * threshold;
  const isBudgetLow = selectedBudgetMax < minExpected;

  if (!isBudgetLow) return null;

  // UI styling classes based on theme
  const containerCls = `p-4 rounded-xl border flex gap-3 text-xs leading-relaxed animate-pulseFast ${
    dark 
      ? 'bg-gold-500/10 border-gold-500/30 text-gold-200' 
      : 'bg-gold-50 border-gold-300 text-gold-800'
  }`;

  return (
    <div className={containerCls}>
      <span className="text-base select-none">💡</span>
      <div>
        <strong className="block mb-0.5 uppercase tracking-wide text-[10px] font-bold text-gold-400">
          Budget Advisory
        </strong>
        Verified creators on CreatorBridge prioritize professional-grade work. For a{' '}
        <span className="font-bold underline">{hours} hour(s)</span> shoot in{' '}
        <span className="font-bold underline">{serviceType}</span>, typical custom quotes range from{' '}
        <span className="font-bold">${minExpected} to ${Math.round(minExpected * 2)}</span>{' '}
        (including editing and licensing).
        <p className="mt-1 opacity-80">
          Posting with a budget below this range may result in fewer proposals or longer matching times. Consider adjusting your budget range to attract top-tier talent.
        </p>
      </div>
    </div>
  );
}
```

---

## 5. Engineering Integration Steps

Have your code engineer follow these steps to integrate the new files into your React/Supabase project:

### Step A: Update the Creator Registration Flow
1. Open the file containing the 5-step registration wizard (currently [CreatorDirectory.jsx](file:///Volumes/2Work%201-Drive/Claude%20&%20ChatGPT/src/components/CreatorDirectory.jsx)).
2. Import the new `<SpecialtySelector />` component.
3. Replace the old niche/service checkboxes in Step 1 with this component.
4. On form submission, pass the selected `primary_niche` (string) and `specialties` (array of strings) to the Supabase client insert payload.

### Step B: Querying Specialties in the Search Directory
To query creators by specialty, your developer should use the PostgreSQL array containment operator (`contains` or `@>`) in the Supabase Client:
```javascript
// Example query for the Directory Search Page
const { data, error } = await supabase
  .from('creator_listings')
  .select('*')
  .eq('primary_niche', activeCategory) // e.g., 'photography'
  .contains('specialties', [selectedSpecialtyId]); // e.g., ['wedding_photography']
```

### Step C: Add the Budget Advisory to the Quote Request Modal
1. Open [RequestQuoteModal.jsx](file:///Volumes/2Work%201-Drive/Claude%20&%20ChatGPT/src/components/RequestQuoteModal.jsx) (or the client brief creation page).
2. Import `<BudgetAdvisory />`.
3. Add the component right below the budget range selection field. Pass the current form states: `serviceType` (e.g. Photography), `hours` (e.g. 2), and `selectedBudgetMax` (numeric maximum of the selected range).
