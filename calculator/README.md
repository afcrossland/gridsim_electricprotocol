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
switcher. Headings follow the same GSC theme typography Deployment Explorer
already used (`mui-theme.tsx`, shared verbatim between the two apps) -
top-level tab headings use the theme's own `h5` (no inline weight
override), and every sub-section label ("Monthly total", "Tariffs",
"Payback", etc.) uses `overline` (small, uppercase, letter-spaced grey),
matching Deployment Explorer's own `CountryDetail.tsx`/`GenerationDetail.tsx`
convention rather than the plain `subtitle2` this app used until
2026-09-18.

**Mobile** (below MUI's `md` breakpoint), ported from Deployment Explorer's
own mobile layout 2026-09-18: the map and sidebar can't sit side by side
(the sidebar's own desktop width alone is wider than most phones), so they
become a List/Map `ToggleButtonGroup` instead - the search box moves up
next to that toggle (off the footer, which is desktop-only there). Picking
a location takes over the *entire* screen on mobile (no toggle/search
above it) rather than opening a side panel, with its own back arrow to
return to the List/Map toggle.

**Default (no location selected)**: the sidebar shows an intro line and a
**league table** - every country ranked by the map's current metric (flag,
name, value), sortable ascending/descending, and clicking a row selects
that country exactly like clicking it on the map (`CountryLeagueTable.tsx`).
Each row's own displayed value differs by metric, per Andrew's own
instruction 2026-09-18: **Generation** shows kWh/panel/yr for a 500Wp panel
(the header reads "Ranked by generation (based on 500Wp panel)") rather
than the panel-size-agnostic kWh/kWp/yr the map's own legend/tooltip still
use; **Self-sufficiency** shows a low-high range across the three
precomputed system tiers (see below) rather than the single medium figure
the list is actually ranked by.

**Map metric selector** (`ToggleButtonGroup` in the footer, same pattern as
Policy/Deployment Explorer's own; hidden once a location is selected,
2026-09-18, since it colours a map that's no longer the focus of the view
at that point - see App.tsx): two views, coloured with the same
amber-to-aqua ramp as the sibling apps (`lib/mapColor.ts`).
- **Self-sufficiency (%)** - the default. Coloured from a *precomputed*
  per-country dataset (`data/country-self-sufficiency.json`), reading only
  its "medium" tier (see below), normalised against a fixed 50-100% domain
  (not 0-100% or the dataset's own min/max - almost every country clears
  50% with this system size, so a wider domain would waste most of the ramp
  on a range nothing falls into; the domain's own midpoint is deliberately
  75%, not the naive 80%, per Andrew's own instruction 2026-09-18).
- **Generation** - annual kWh/kWp, coloured from the same
  `country-irradiance.json` dataset the calculation itself reads, log-scale
  normalised (unbounded, right-skewed figures). The map's own legend/hover
  tooltip show this in kWh/kWp/yr (panel-size-agnostic); only the league
  table's own row values (above) convert this to kWh/panel/yr.

See `lib/mapMetrics.ts` for both metrics' value loaders/domains/formatters,
and `components/WorldMap.tsx` for how the selected metric drives the
choropleth (a fixed MapLibre `fill-color` expression interpolating on
`feature-state.norm`; only the per-country `norm` value written into that
feature-state changes when the metric changes - same pattern as
Deployment Explorer's own map). The floating legend's own title
(`MapLegend.tsx`) is NOT rendered in CSS uppercase, unlike the sibling
apps' own copy of that component - a mixed-case unit like "kWh/kWp" reads
as "KWH/KWP" under `text-transform: uppercase`, so this app's own copy
dropped that rule 2026-09-18.

**Picking a location** (map click, search, or a league-table row) opens the
sidebar's detail view: a back arrow + flag + name header, three headline
tiles (Total generation, Self sufficiency, Payback range - the last one
reads "Coming soon", a deliberate placeholder, not a bug), then four tabs
(Design first, per Andrew's own instruction 2026-09-18 - "when click on
country, default to design tab"):

| Tab | Content |
|---|---|
| **Design** | Four sliders - panel count (0-50, default 10, step 1), panel size (400-750Wp, default 500, step 10Wp), battery (0-40kWh, default 10, step 2.5kWh), annual demand (500-20,000kWh, default 4,000, step 250kWh) - each its own icon-labelled card. No EV charging controls (still exists in the model at a fixed default, just not user-editable); no submit button - changing a slider on either this tab or Economics auto-recalculates (debounced 300ms) via `App.tsx`'s own effect. |
| **Generation & demand** | The 8760-hour generation profile (`generationProfile`) plotted together with the real demand profile the dispatch simulation itself ran against (`demandProfile`, both in `SavingsResults`) - not an illustrative shape, the same system's own demand - as a monthly-total grouped bar chart (`DualMonthlyBarChart.tsx`) above a year-long daily line chart (`MultiLineChart.tsx`, GSC yellow for generation, GSC teal for demand). Click a day, or drag across several, to zoom into their hourly values - and keep dragging within that zoomed view to narrow further, recursively, down to a single day. Originally two separate tabs (Generation, Demand), merged 2026-09-17 so the two are directly comparable on shared axes rather than viewed apart. |
| **Dispatch** | A "From solar"/"From grid" tile pair and an annual-energy-flow Sankey diagram (`SankeyDiagram.tsx`, hand-built SVG - Solar+Grid import on the left, Battery in the middle, Demand+Grid export+Losses on the right) up top, then how solar, the battery and the grid cover demand hour by hour: a repeated colour-key legend above each chart (not just once at the top, per Andrew's own instruction 2026-09-18 - "do we need more legends?"), "Monthly total" as a signed stacked-bar chart (`StackedBarChart.tsx`), then "Daily dispatch across the year" (and its hourly drill-down) as a smoothed stacked-area chart instead (`StackedAreaChart.tsx`, per Andrew's own instruction 2026-09-18 - "can we do as a stacked area... keep bars elsewhere"). Solar-to-demand/battery-discharge/solar-to-battery/grid stack upward from one shared zero axis; solar export stacks *above* the axis too on "Monthly total" and the daily view (not below, at reduced opacity - `DispatchPanel.tsx`'s own `withExportAboveAxis`), but stays below the axis at full opacity on the hourly drill-down. A separate battery state-of-charge (%) chart sits below all of that. |
| **Economics** | Panel/battery spec, three tariff sliders (import price day, import price night, export sale value) shown in the visitor's own local currency symbol (`lib/currency.ts` - USD/CAD/AUD/NZD/EUR/GBP by country, USD elsewhere; a display-symbol swap only, not real conversion), then a cost/IRR/payback table (`PaybackTable.tsx` - low/typical/high install-cost estimates: $2,000 fixed + $0.40/Wp of panel + $400/kWh of battery, each with its own pre-tax unlevered IRR and payback year count) and a separate year-by-year saving table (`YearlySavingsTable.tsx` - import saving, which grows with inflation, vs. export revenue, which doesn't, for 25 years, each figure prefixed with the currency symbol). |

`GenerationTimeseries.tsx` (now only the Dispatch tab's own state-of-charge
chart), `MultiLineChart.tsx` (the Generation & demand tab's own multi-series
line chart), `StackedBarChart.tsx` ("Monthly total") and `StackedAreaChart.tsx`
("Daily dispatch across the year" and its hourly drill-down) all implement
the same click-or-drag-and-keep-zooming interaction independently, since
they're different mark types (single line vs. multi-line vs. signed stacked
bars vs. smoothed stacked areas). Every chart's own y-axis uses
`lib/chartFormat.ts`'s `niceTicks()` (round tick steps, a ceiling *at or
above* the real data max so nothing clips) and `formatAxisValue()` (plain
numbers with thousands separators - never abbreviated as "1.2k", per
Andrew's own instruction 2026-09-18).

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
precomputed `{ low, medium, high }` % per country, one per system tier -
low (8 panels at 500Wp, a 5kWh battery, 5,000 kWh/yr demand), medium (10
panels, 10kWh, 4,000 kWh/yr - the same "normal house" default the Design
tab itself starts from, and the only tier the map's own colour view
actually reads today), high (14 panels, 15kWh, 3,500 kWh/yr) - added
2026-09-18 per Andrew's own instruction. Built by running this exact
model - not a reimplementation of it - via
`scripts/build_self_sufficiency.ts` (`npx tsx
scripts/build_self_sufficiency.ts` from `calculator/`, or `npm run
calculator:build-datasets` from the repo root to chain it after the
irradiance/demand-profile scripts). **It goes stale** the moment the
irradiance database, the demand shape, or the dispatch model's own
assumptions change - the chained npm script means one command now
regenerates all three in the right order instead of someone having to
remember to run this one too, but running that command is still a manual
step, not wired into any build/CI check - see ROADMAP.md. The league
table's own low-high range display (see "Layout" above) reads "low" and
"high" straight from this file via `lib/mapMetrics.ts`'s own
`loadSelfSufficiencyTiers()`.

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
assumptions change, not at build/dev time. Since the self-sufficiency
dataset (the third one) is built *from* the other two's own output, it
goes stale whenever either of them changes - per Andrew's own instruction
2026-09-18 ("update the code so this repeats every time we update the
demand profile/irradiance"), all three are now chained under one root
`package.json` script instead of relying on someone remembering to run
the third one too:

```sh
# From the repo root - runs all three, in order
npm run calculator:build-datasets
```

Or individually, from `calculator/`:

```sh
# Per-country 8760 irradiance profile (Python, needs shapely)
python3 scripts/build_country_irradiance.py

# The PC1 demand shape (Python)
python3 scripts/build_pc1_demand_profile.py

# The self-sufficiency map dataset, all three system tiers (TypeScript,
# via tsx - reuses the real generation/demand/dispatch model directly)
npx tsx scripts/build_self_sufficiency.ts
```
