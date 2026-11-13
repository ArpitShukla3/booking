import { Filter, Sparkles, UsersRound, X } from 'lucide-react';
import { Select } from '@/components/ui/input';
import type { MatchFacets, MatchFilters } from '@/types/search';
import { activeFilterCount, COMPOSITION_LABELS, NO_FILTERS, toggleInterest } from './matchFilters';

/**
 * G1: refine the matches by gender mix and shared interests. Every option shows how many of the
 * current matches it keeps; the backend applies the filters (they can only narrow the 6-rule results).
 */
export function MatchFiltersPanel({ filters, facets, total, totalUnfiltered, onChange }: {
  filters: MatchFilters; facets: MatchFacets; total: number; totalUnfiltered: number;
  onChange: (next: MatchFilters) => void;
}) {
  const active = activeFilterCount(filters);
  const sharedOptions = Array.from({ length: Math.max(0, Math.min(facets.max_shared, 6) - 2) }, (_, i) => i + 3);
  const mixOptions = [
    { value: null, label: 'Any mix', count: totalUnfiltered },
    ...(['WOMEN_ONLY', 'MEN_ONLY', 'MIXED'] as const).map((k) => ({ value: k, label: COMPOSITION_LABELS[k], count: facets.composition[k] })),
  ];

  return (
    <section className="gm-filters" aria-labelledby="refine-h">
      <div className="gm-filters-head">
        <h3 id="refine-h"><Filter size={16} aria-hidden="true" />Refine results{active ? <span className="gm-filter-count">{active}</span> : null}</h3>
        <p aria-live="polite">{active ? `${total} of ${totalUnfiltered} groups` : `${totalUnfiltered} groups`}</p>
        {active ? (
          <button type="button" className="text-link gm-clear" onClick={() => onChange(NO_FILTERS)}><X size={14} aria-hidden="true" />Clear filters</button>
        ) : null}
      </div>

      <fieldset className="gm-filter-group">
        <legend><UsersRound size={14} aria-hidden="true" />Group gender mix (current members)</legend>
        <div className="gm-chips">
          {mixOptions.map((o) => (
            <button key={o.label} type="button" className="gm-chip" aria-pressed={filters.composition === o.value}
              disabled={o.value !== null && o.count === 0 && filters.composition !== o.value}
              onClick={() => onChange({ ...filters, composition: o.value })}>
              {o.label} <span className="gm-chip-n">{o.count}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="gm-filter-row">
        <label className="gm-filter-group" htmlFor="min-shared">
          <span className="gm-legend"><Sparkles size={14} aria-hidden="true" />Shared interests with the organiser</span>
          <Select id="min-shared" value={filters.min_shared ?? ''} onChange={(e) => onChange({ ...filters, min_shared: e.target.value ? Number(e.target.value) : null })}>
            <option value="">At least 2 (every match)</option>
            {sharedOptions.map((n) => <option key={n} value={n}>At least {n}</option>)}
          </Select>
        </label>
      </div>

      {facets.interests.length ? (
        <fieldset className="gm-filter-group">
          <legend>Must share</legend>
          <div className="gm-chips">
            {facets.interests.map((i) => (
              <button key={i.interest} type="button" className="gm-chip" aria-pressed={filters.must.includes(i.interest)}
                onClick={() => onChange(toggleInterest(filters, i.interest))}>
                {i.label} <span className="gm-chip-n">{i.count}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </section>
  );
}
