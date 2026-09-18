# Solar Homes Calculator

A tool in the Electric Futures Playbook family, living at `/calculator/`
alongside `/policy/` and `/deployment/` in this same `ep_policymap` build
(moved in from a standalone `ep_solarCalculator` project 2026-09-16, so
everything serves from one dev server): pick any country or city in the
world, and see what a solar + battery system could mean for a home there -
how much of its own electricity it covers, what it exports, and a payback
estimate.

The calculation model started as a port of Andrew's own `mygridgb` repo's
solar calculator (not its "expert" quote comparer, which is out of scope
here) - see "How the calculation works" below for its current, generalised
shape.

## Status

v1 - working end to end. English-only UI.

## Layout

Same map + sidebar shell as Deployment Explorer: `TopNavbar` up top, the map
as a flex sibling of the sidebar (not an overlay), a footer bar with a
location search box, the map's own metric selector, and the language
switcher.

**Default (no location selected)**: the sidebar shows an intro line and a
**league table** - every country ranked by the map's current metric (flag,
name, value), sortable ascending/descending, and clicking a row selects
that country exactly like clicking it on the map (`CountryLeagueTable.tsx`).

**Map metric selector** (`ToggleButtonGroup` in the footer, same pattern as
Policy/Deployment Explorer's own): two views, coloured with the same
amber-to-aqua ramp as the sibling apps (`lib/mapColor.ts`).
- **Self-sufficiency (%)** - the default. Coloured from a *precomputed*
  per-country dataset (`data/country-self-sufficiency.json`), normalised
  against a fixed 60-100% domain (not 0-100% or the dataset's own min/max -
  almost every country clears 50% with this system size, so a wider domain
  would waste most of the ramp on a range nothing falls into).
- **Generation** - annual kWh/kWp, coloured from the same
  `country-irradiance.json` dataset the calculation itself reads, log-scale
  normalised (unbounded, right-skewed figures).

See `lib/mapMetrics.ts` for both metrics' value loaders/domains/formatters,
and `components/WorldMap.tsx` for how the selected metric drives the
choropleth (a fixed MapLibre `fill-color` expression interpolating on
`feature-state.norm`; only the per-country `norm` value written into that
feature-state changes when the metric changes - same pattern as
Deployment Explorer's own map).

**Picking a location** (map click, search, or a league-table row) opens the
sidebar's detail view: a back arrow + flag + name header, three headline
tiles (Total generation, Self sufficiency, Payback range - the last one
reads "Coming soon", a deliberate placeholder, not a bug), then four tabs:

| Tab | Content |
|---|---|
| **Economics** | Panel/battery spec, a from-solar/from-grid breakdown, three tariff sliders (import price day, import price night, export sale value - all $/kWh), then the payback table those sliders drive. |
| **Design** | Four sliders - panel count (0-50, default 10), panel size (400-750Wp, default 500), battery (0-40kWh, default 10), annual demand (500-20,000kWh, default 4,000) - each its own icon-labelled card. No EV charging controls (still exists in the model at a fixed default, just not user-editable); no submit button - changing a slider on either this tab or Economics auto-recalculates (debounced 300ms) via `App.tsx`'s own effect. |
| **Generation & demand** | The 8760-hour generation profile (`generationProfile`) plotted together with the real demand profile the dispatch simulation itself ran against (`demandProfile`, both in `SavingsResults`) - not an illustrative shape, the same system's own demand - as a monthly-total grouped bar chart (`DualMonthlyBarChart.tsx`) above a year-long daily line chart (`MultiLineChart.tsx`, GSC yellow for generation, GSC teal for demand). Click a day, or drag across several, to zoom into their hourly values - and keep dragging within that zoomed view to narrow further, recursively, down to a single day. Originally two separate tabs (Generation, Demand), merged 2026-09-17 so the two are directly comparable on shared axes rather than viewed apart. |
| **Dispatch** | How solar, the battery and the grid cover demand, hour by hour - a signed stacked-bar chart (solar-to-demand/battery-discharge/grid/solar-to-battery stacked upward, solar-export stacked downward, from one shared zero axis) at monthly, yearly-daily, and hourly-drill-down resolution, plus a separate battery state-of-charge (%) chart below it. |

`GenerationTimeseries.tsx` (now only the Dispatch tab's own state-of-charge
chart), `MultiLineChart.tsx` (the Generation & demand tab's own multi-series
line chart) and `StackedBarChart.tsx` (Dispatch's own flow chart) all
implement the same click-or-drag-and-keep-zooming interaction independently,
since they're different mark types (single line vs. multi-line vs. signed
stacked bars).

## How the calculation works

Every location uses the same generic 8760-hour (one year, hourly)
generation profile per array, summed across arrays, load-matched
hour-by-hour against an 8760-hour demand profile via a battery dispatch
model. See `src/lib/calculateGeneric.ts`, `genericSource.ts`,
`demandProfile.ts`, `batteryDispatch.ts`.

A Great Britain-specific path using the real MCS MGD003 lookup-table method
(ported from `mygridgb`'s own `runCalc`) shipped briefly and was removed
2026-09-16 - it's coming back later. `src/lib/calculate.ts` stays a small
dispatcher function specifically so reintroducing a location-specific
branch is a contained change there, not a rewrite of every call site.

**Generation** (`genericSource.ts`) reads `src/data/country-irradiance.json`
- one real 8760-hour W/Wp profile per country, built by
`scripts/build_country_irradiance.py` from PVGIS's own `seriescalc` API
(free, no key, near-global coverage - PVGIS-SARAH2/SARAH3, PVGIS-NSRDB, or
PVGIS-ERA5 depending on region) at each country's own biggest city (Natural
Earth's own `ne_10m_populated_places`, falling back to a polygon
`representative_point()` on `assets/jurisdictions.geojson` for the ~20
countries missing from that dataset, or if the city's own exact coordinates
fail PVGIS outright), with `mountingplace=building` (this is rooftop
residential solar, not a ground-mounted array) and `usehorizon=0` (real
local terrain shading at one exact point is appropriate for one address,
not a national estimate), oriented due south (northern hemisphere) / due
north (southern hemisphere) at a tilt matching latitude (clamped 5-35°) -
this script's own fixed-angle heuristic, not PVGIS's own `optimalangles=1`
(tried first, but confirmed broken for near-equatorial locations - see the
script's own doc comment for the full story). Two known limitations remain,
documented in that same comment: even a country's biggest city is still
one single point, so a country whose population spans genuinely different
climates isn't fully captured; and one specific historical year (2015)
isn't the same as a statistically "typical" year. `WorldMap.tsx`'s own
"Generation" metric view reads this exact same dataset via
`lib/countryIrradiance.ts`, so the
map and a calculation never disagree.

**Demand** (`demandProfile.ts`) reads `src/data/pc1-demand-profile.json` -
a real (not synthetic) shape built by `scripts/build_pc1_demand_profile.py`
from Elexon's own published Profile Class 1 (Domestic Unrestricted)
half-hourly load profile coefficients, normalised so its 8760 values sum to
1. It's the **one** demand shape this app has - no Profile Class 2/Economy 7
option, no occupancy/house-size variation - reused for every country and
scaled to whatever annual total applies. A `southernHemisphere` flag
rotates the shape six months (so a southern visitor's own Jun/Jul winter
gets the peak, not the source data's own Dec/Jan) - a crude fix, not a real
southern-hemisphere dataset.

**Battery dispatch** (`batteryDispatch.ts`): solar meets demand directly
first; any surplus charges the battery, capped by its own 1C max charge
power (its kWh capacity, per one-hour step) and by the room left in it,
with √0.85 one-way charging efficiency (so a full charge-then-discharge
cycle compounds to exactly 85% round-trip); anything left over exports,
up to an `exportLimitKW` that's currently always left at `Infinity` (the
curtailment math exists but is unreachable - no market's real export limit
is modelled yet); if solar doesn't cover demand the battery discharges (no
power cap, only the efficiency loss) down to flat; whatever's still unmet
imports from the grid. The same function also tracks state of charge (%)
hour-by-hour, for the Dispatch tab's own chart.

**Self-sufficiency map metric**: `data/country-self-sufficiency.json` is a
precomputed % per country for one fixed default system (10 panels at
500Wp, a 10kWh battery, 3,500 kWh/yr demand), built by running this exact
model - not a reimplementation of it - via
`scripts/build_self_sufficiency.ts` (`npx tsx
scripts/build_self_sufficiency.ts` from `calculator/`). **It goes stale**
the moment the irradiance database, the demand shape, or the dispatch
model's own assumptions change, and regenerating it is a manual step - see
ROADMAP.md.

**Known placeholders, tracked as TODOs** (see the repo root's own
`ROADMAP.md` for the consolidated, up-to-date list): the country-irradiance
database's own single-representative-point and single-historical-year
limitations above; an array's own `tilt`/`azimuth` only affects its kWp
for this source today, not its orientation; the PC1-only demand shape (no
Economy 7, no occupancy variation, one fixed annual total on the map's own
self-sufficiency dataset); the flat, non-time-shaped
EV-charging addition (still in the model, just not user-editable any
more); the always-infinite grid export limit; and the self-sufficiency map
dataset's own staleness risk above.

## Verification

From the repo root (`ep_policymap`):

```sh
npx tsc -b && npx vitest run && npm run build:dev
```

## Regenerating the precomputed datasets

Three one-off generator scripts under `scripts/`, each with its own doc
comment covering method and caveats - re-run only when their own upstream
assumptions change, not at build/dev time:

```sh
# Per-country 8760 irradiance profile (Python, needs shapely)
python3 scripts/build_country_irradiance.py

# The PC1 demand shape (Python)
python3 scripts/build_pc1_demand_profile.py

# The self-sufficiency map dataset (TypeScript, via tsx - reuses the real
# generation/demand/dispatch model directly, run from calculator/)
npx tsx scripts/build_self_sufficiency.ts
```
