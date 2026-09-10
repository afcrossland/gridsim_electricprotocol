# Deployment Explorer

A third tool alongside the Solar Policy Explorer (this repository's own
`/policy/`) and `ep_solareconomics` (Solar Economics Explorer, a separate
project) - this one is a map of actual solar *uptake*, not policy or cost.
One country choropleth, one three-way metric selector, all three reading
real data (Ember for solar, World Bank for population) with no placeholder
fallback anywhere: **Installed Capacity** (MW), **Installed Capacity per
Capita** (W/cap), and **Share of Electricity** (solar's % of a country's
own annual generation).

Served at `/deployment/` from this project's own single Vite dev server -
`npm run dev` at the repo root covers this app plus the Playbook (`/`) and
Policy Explorer (`/policy/`) together. See the root README's "Site
structure" section for how the three HTML entries fit together.

**History**: this app started life as its own standalone project,
`ep_deploymentexplorer`, and was moved in here 2026-09-09 (copied, not
symlinked - `deployment/src/`, `deployment/scripts/`, `deployment/index.html`)
so everything serves from one dev server on one port rather than juggling
separate ports per app. The standalone project still exists on disk as of
this writing but is no longer what's running; treat this directory as the
only real one.

## Site structure

- **`deployment/index.html`** mounts `deployment/src/main.tsx` - its own
  entry point and its own `src/` tree, entirely separate from this
  project's root `src/` (which the Policy Explorer app uses). Two different
  apps, so they can't share one `main.tsx`.
- **`deployment/scripts/`** - the one-time data-import Python scripts (see
  Data below), plus their raw download caches (gitignored). Not wired into
  `package.json` - run by hand: `python3 deployment/scripts/build_ember_solar.py`
  etc.
- Dependencies (`react-map-gl`, `maplibre-gl`, MUI, etc.) are shared with
  the root `package.json` - versions already matched exactly when this app
  was merged in, so no separate `deployment/package.json` exists.
- `tsconfig.app.json`'s `include` covers both `./src` and
  `./deployment/src`, so `npx tsc -b` at the repo root typechecks this app
  too. `npm run build:dev` / `build:prod` build all three HTML entries in
  one pass (see the root `vite.config.ts`'s `build.rollupOptions.input`).

## Layout

Deliberately matched to the Policy Explorer's own chrome, not
approximately - same fonts (Eastman Grotesque, copied verbatim into
`deployment/src/assets/fonts/`), same MUI theme (`deployment/src/mui-theme.tsx`
exports the same `getTheme(mode)` shape), same header/sidebar/footer
sizing and positioning.

- **Header** (`TopNavbar.tsx`) - logo + "Solar Deployment Explorer" + GSC
  tagline on the left (logo and title share one flex container with
  `gap: 1`, matching the Policy Explorer's own spacing exactly - they used
  to sit in separate containers with a wider Toolbar-level gap, which read
  as a bigger gap than Policy's). Clicking the logo navigates back to the
  Playbook homepage (`window.location.href = BASE_URL`), same as Policy
  Explorer's own TopNavbar. On the right: "Data from [Ember logo]",
  then the light/dark toggle as the rightmost element - also matching where
  Policy Explorer's own toggle now sits (moved there 2026-09-09, see the
  root README's Dark mode section).
- **Map** (flex, left) - choropleth with the legend pinned top-left
  (desktop) / full-width banner (mobile), exactly Policy Explorer's
  `MapLegend.tsx` positioning.
- **Sidebar** (right, 460px - same as Policy Explorer's `PANEL_WIDTH`):
  - A heading + description matching Policy Explorer's own Scoreboard
    copy.
  - A **Filter** control matching `ScoreboardFilters.tsx` exactly (moved to
    this pattern 2026-09-09, replacing a plain always-open Continent
    select): collapsed by default behind a filter icon + badge dot (dot
    shows only once a continent is actually selected), "Filter" label,
    "Clear" button once active, and a sort-direction arrow on the same row,
    right-aligned. Expanding it reveals the Continent multi-select inside a
    bordered panel, same as Policy Explorer's own filter panel styling.
  - The ranked list itself, styled as the same light-grey bordered tiles as
    Policy Explorer's `Scoreboard.tsx` `Row` component (`#E5E7EB` border,
    8px radius, `action.hover` fill, `#F3F4F6` on hover) - replaced the
    plain border-left-highlight rows this used before 2026-09-09.
  - **Or**, once a country with real Ember history is clicked: a detail
    panel with a shared header (back button, flag, name, and - top right -
    the population figure the per-capita metric actually divides by, e.g.
    "Pop. 341.785M", with a tooltip citing World Bank + the data year) and
    up to two stacked timeseries sections underneath: `CountryDetail.tsx`
    (installed capacity, if Ember's capacity file covers this country) then
    `GenerationDetail.tsx` (generation mix, if the generation file covers
    it) - both shown together when both exist, regardless of which metric
    is active on the map.
- **Footer** (48px, same as Policy Explorer's bottom bar) - country search
  (far left), the metric selector (Installed Capacity / Installed Capacity
  per Capita / Share of Electricity) next to it, language switcher on the
  far right.

## Data - three imports, no placeholder fallback

All three are **one-time reads, not a live pipeline** - re-run the
relevant script by hand to refresh; nothing calls any of them
automatically, and Andrew is still confirming Ember's terms for
redistributing its data via the app before this goes further than a local
demo.

- **Installed Capacity** - Ember's monthly capacity CSV
  (files.ember-energy.org/public-downloads/capacity/outputs/monthly_capacity_wind_solar_public_release_file.csv)
  built into `src/data/ember_solar.json` by `scripts/build_ember_solar.py`,
  covering 25 countries.

  **Bug found and fixed, 2026-09-09**: Ember reports two permanently
  parallel rows per country-month - one `GWAC`-rated, one `GWDC`-rated -
  not a mid-series unit-convention switch as this script's docstring first
  (wrongly) assumed. An earlier version of the script kept both and sorted
  only by (year, month), so the two series interleaved and capacity looked
  like it went up and down month to month - each row on its own actually
  climbs steadily. Fixed by keeping only the `GWDC` (DC nameplate) row and
  dropping the `GWAC` one; re-run and verified monotonic (the handful of
  tiny remaining dips, e.g. US Jan→Feb 2019, are genuine small
  month-to-month figures, not an artefact).

- **Share of Electricity** - Ember's monthly generation CSV
  (files.ember-energy.org/public-downloads/generation/outputs/release_generation_monthly_global.csv,
  ~28MB) built into `src/data/ember_generation.json` by
  `scripts/build_ember_generation.py`, covering **77 countries** - wider
  reach than the capacity file, since generation is reported from grid
  operator data even where a country's own capacity register is thin.
  Annual, not monthly, per Andrew's instruction: each year sums 12 months
  of Solar and Total generation TWh and divides, rather than averaging
  monthly `Share of generation (%)` values (which would distort seasonal
  countries); a year is only included if both series have all 12 months,
  so the in-progress current year is dropped rather than shown as a
  misleadingly low partial year.

- **Population** (for the per-capita metric) - World Bank Open Data,
  indicator `SP.POP.TOTL`, most recent value per country, built into
  `src/data/population.json` by `scripts/build_population.py` - 213
  countries. Taiwan is the one hand-added exception (the World Bank does
  not publish a Taiwan figure under its own code); see that script's
  docstring for the source. Shown directly to the reader in the country
  detail header's top right, since a per-capita number is meaningless
  without knowing the population assumption behind it.

Clicking a country plots its latest figure on the map and opens its full
history as a chart in the sidebar (`CountryDetail.tsx` /
`GenerationDetail.tsx`, both hand-drawn SVG lines via the shared
`TimeseriesChart.tsx` - no charting library for one series on one screen).
`GenerationDetail.tsx`'s TWh figures use `formatTWh()` (2dp below 10 TWh,
whole numbers above it, added 2026-09-10) rather than a flat
`toLocaleString()` - the raw JSON keeps up to 4 decimal places, which read
as false precision once a country's generation reaches thousands of TWh
(e.g. "1,173.241 of 10,389.238 TWh").

**Resolved, 2026-09-09**: all placeholder data is gone.
`dummyDeployment.ts` (fabricated Rooftop/Utility-scale/Battery splits,
made-up capacity guesses, and made-up population figures) has been deleted
entirely - every metric now reads real data only, with no placeholder
fallback for a country either Ember dataset doesn't cover (it just shows
no data / gets excluded from that metric's ranking).

**Resolved, 2026-09-10**: all three importers now flag new countries on
re-run. Each gets a `report_new_countries(out_path, new_codes)` diffing
the freshly-built country-code set against whatever `src/data/*.json`
already contains on disk (its own previous build), printing "NEW
COUNTRIES since last build: [...]" or "No new countries since last build."
Only additions are flagged, not removals - a country dropping out of
Ember's or the World Bank's data is a much rarer, more alarming event than
one appearing, and would be more likely to warrant investigating the raw
CSV/API response directly than a one-line log message.

## Colour ramp

`lib/metrics.ts`'s `RAMP_STOPS` changed 2026-09-10 from a single-hue Aqua
sequential ramp to orange-to-teal/aqua (low value to high) - Burnt Orange
(#EF864C) to Aqua (#00ABBB), both drawn from the GSC brand palette (see
mui-theme.tsx's own brand-colour comment) rather than arbitrary hex values,
with three hand-tuned intermediate stops rather than a mechanical
interpolation. This was tried on Policy Explorer's own score ramp first,
then reverted there and applied here instead once it turned out that's
what Andrew actually wanted to try it on - see `ep_policymap/src/lib/scoring.ts`'s
own comment on `SCORE_RAMP` for that history, which is still red-to-green,
unchanged.

## Notable files

- `lib/jurisdictions.ts` - `isSubdivided`/`resolveTargets`/`canonicalCode`,
  ported from the Policy Explorer's own equivalent. Originally
  load-bearing: the shared geometry draws Australia, the US and Canada as
  their states/provinces only, with no country-level shape at all, so a
  plain "AU"/"US"/"CA" click or fill silently did nothing. **Superseded**
  by `scripts/dissolve_subdivided.py`, which dissolves each of the three
  into one real country-level polygon in this app's own copy of the
  geometry (the Policy Explorer keeps its own copy subdivided on purpose -
  policy genuinely varies state by state there; this app only ever has one
  national number per country, so drawing 54 identically-coloured US
  states was always wrong for what it's showing). The functions are left
  in place, now a no-op for AU/US/CA, in case a future real dataset
  reintroduces a genuinely subdivided country.
- `lib/metrics.ts` - the `Metric` type (`"capacity" | "capacityPerCapita" |
  "share"`) and its three lookups (`codesForMetric`, `valueForMetric`,
  `domainForMetric` - the one place that branches on which dataset a
  metric reads) plus the colour ramp (one hue, GSC Aqua, light to dark -
  same "sequential" reasoning as the Policy Explorer's own score ramp).
- `lib/emberSolar.ts` / `lib/emberGeneration.ts` / `lib/population.ts` -
  typed accessors over the three built JSON "databases" (`ember_solar.json`,
  `ember_generation.json`, `population.json`).
- `components/DeploymentMap.tsx` - the map itself, adapted from the Policy
  Explorer's own `PolicyMap.tsx` pattern (MapLibre via react-map-gl, a
  GeoJSON source with `promoteId="code"`, per-feature colour via
  `setFeatureState`, light/dark base style picked from
  `theme.palette.mode`). Values are normalised on a **log scale**, not
  linear, for every metric - installed capacity, per-capita capacity and
  solar's own share of generation all span several orders of magnitude,
  and linear normalisation would paint almost the entire map at the bottom
  of the ramp either way.
- `components/TimeseriesChart.tsx` - the shared hand-drawn SVG line chart
  behind both `CountryDetail.tsx` (capacity) and `GenerationDetail.tsx`
  (generation mix).
- `assets/jurisdictions.geojson`, `data/jurisdictions.json`,
  `assets/map_gsc.json`, `assets/map_gsc_dark.json`, `assets/fonts/` -
  copied directly from the Policy Explorer's own root `src/`, not
  regenerated or symlinked - if the geometry pipeline or fonts ever
  change, these copies go stale until manually re-copied.
- `public/ember-logo.svg` (at the repo root's `public/`, shared across all
  three HTML entries) - Ember's actual logo, downloaded from
  ember-energy.org for the header's attribution badge.
- `scripts/dissolve_subdivided.py` - see the note on `lib/jurisdictions.ts`
  above. Run once already; only needs re-running if the geometry gets
  re-copied fresh from the Policy Explorer's own root `src/`.

Not done:

- `npm audit` flags the pinned `maplibre-gl` version (shared with the
  Policy Explorer) for a critical XSS advisory with a fix available only
  via a breaking major-version bump - not applied here, flagged for a
  deliberate decision across the whole project rather than a silent
  one-off patch.
- **`LanguageSwitcher.tsx` is a stub, not real multi-language support**
  (flagged 2026-09-10). Copied verbatim from Policy Explorer's own
  component - same reasoning there too. Its language list has exactly one
  entry (English), selecting it does nothing beyond closing the menu, and
  nothing in either app is actually translated - it exists only so the
  footer has the same shape as the sibling apps, "ready to grow later." A
  real build means an i18n library, extracting every hardcoded string
  (headings, tooltips, chart labels, the whole Help page), and actual
  translations - not a small fix.

## What it shows

- **Installed Capacity** - total installed solar PV by country (MW), from
  `ember_solar.json` - 25 countries, no placeholder fallback.
- **Installed Capacity per Capita** - the same, divided by
  `population.json`'s real World Bank figure (W per capita) - also limited
  to `ember_solar.json`'s 25 countries, since that's the dataset the
  numerator comes from.
- **Share of Electricity** - solar's share of a country's own annual
  electricity generation (%), from `ember_generation.json` - 77 countries.
- Clicking a country opens its detail panel with whichever of the two
  timeseries sections it has real data for (capacity, generation mix, or
  both) - not just the one matching the currently active metric. A country
  with neither just gets highlighted in the ranking list instead.

## Cross-links to the other tools

The country detail panel's top, above the capacity/generation-mix
sections, has two small link tiles (`CrossLinkTile` in `Sidebar.tsx`,
added 2026-09-10) - this app only shows uptake, not the policy environment
behind it or the grid context around it, so these link straight out
rather than leaving that as a dead end:

- **Solar Policy Explorer** → `${BASE_URL}policy/?country=<code>` - a real
  deep link. `?country=` is a new URL param added to the Policy Explorer
  app itself the same day (see the root README's "Site structure"
  section) - it opens straight into that country's page and implicitly
  skips the onboarding tour, the same way `?skipIntro` already did.
- **Future Grid Simulator** → its homepage only
  (futuregridsimulator.globalsolarcouncil.org). It's an external site with
  no documented per-country URL to deep-link into - Andrew confirmed
  homepage-only is fine for now rather than guessing at a URL scheme.

Styled as small versions of the Playbook's own tile cards (`index.html`'s
`.tile`/`.cta` classes) - a bold title in that tool's own homepage accent
colour (`#008194` aqua-dark for Policy Explorer, `#C98600` citrus-dark for
Grid Simulator) over a rounded-pill "Open" button in the same colour,
rather than a plain bordered link row.

## Map controls

`DeploymentMap.tsx` got the same top-right zoom controls as Policy
Explorer's `PolicyMap.tsx`, 2026-09-10 (it had none before this) - hand-built
`IconButton`s (zoom in, zoom out, back to full map view), not MapLibre's own
`NavigationControl`, ported verbatim including the mobile top-offset trick
(`top: isMobile ? 64 : 16`) so the buttons clear `MapLegend.tsx`'s
full-width mobile banner rather than sitting underneath it. "Back to full
map view" calls `onCountryClick(null)` - clearing `selectedCountry` already
triggers the existing `fitBounds(WORLD_BOUNDS)` effect, so the button
needed no new camera logic, only `onCountryClick`'s prop type widened from
`(code: string) => void` to `(code: string | null) => void` (`App.tsx`
already passes its plain `setSelectedCountry`, which accepted null from the
start).

## Header

`TopNavbar.tsx`'s Ember badge reads "Data from [Ember logo]" (was "Powered
by", changed 2026-09-10 - more accurate, since this app doesn't run on any
Ember infrastructure, it just reads Ember's published data). The "DEMO"
label that used to sit next to it is gone too, 2026-09-10 - Andrew
considers the app live now, not a demo. It's a real link to
ember-energy.org (`target="_blank"`, `rel="noopener noreferrer"`), added
the same day as the wording change - previously the logo just sat there
with no click behaviour at all.

## Playbook tile

The Electric Futures Playbook (`index.html` at the repo root) links to
this app from its "Solar Deployment Explorer" tile - **as of 2026-09-10 it
is the site's first tile**, ahead of Policy Explorer, Future Grid
Simulator, then the still-greyed-out Solar Economics Explorer last (tile
order was swapped once already, 2026-09-09, putting Policy Explorer first
- reordered again the next day to lead with Deployment Explorer instead).
The tile's action button reads "Show me how" and uses the tile's own peach
accent (`--peach-dark`) - it briefly read "Demo" in grey (`--muted`,
`#6B7280`) between 2026-09-09 and 2026-09-10, back when it was a dead
`href="#"` link with nothing real to point at; reverted to "Show me how"
and the peach accent once it linked to something real (`?showTour=1`, see
Scroll story below), matching the other tiles' own wording/colour
convention.

## Scroll story (onboarding tour)

Built 2026-09-10 - `deployment/src/scrollstory/` (`ScrollStory.tsx`,
`Spotlight.tsx`, `scenes.ts`), a **4-scene** trimmed sibling of Policy
Explorer's own `src/scrollstory/` (13 scenes), per Andrew's "only needs
2/3 windows" instruction rather than a full port:

- `Spotlight.tsx` is copied verbatim - it's already generic (finds a live
  DOM element by a `data-tour` CSS selector, dims everything else, floats
  a caption card next to it), no Policy-specific dependency to strip out.
- `ScrollStory.tsx` keeps the same wheel/keyboard-driven scene navigation,
  progress dots and hero/spotlight layouts, and the same "a scene can
  select a real country" idea as Policy Explorer's fuller version (see
  `onSelectCountry`), but drops its separate CTA layout - the last scene
  is dismissed the same way as any other, via the same button, just
  relabelled "Start exploring" instead of "Skip intro".
- `scenes.ts` - scene 0 (hero) welcomes the visitor; scene 1 spotlights
  the footer's metric selector (`data-tour="metric-selector"`, added to
  `App.tsx`'s `ToggleButtonGroup`); scene 2 spotlights the sidebar ranking
  list (`data-tour="ranking-list"`, added to `Sidebar.tsx`); scene 3
  (added 2026-09-10, "add a card showing what happens if we click to see
  a country") actually selects a real country (`DEMO_COUNTRY = "DE"` -
  Germany, chosen because it has real data in all three of this app's
  datasets) and spotlights the resulting detail panel
  (`data-tour="country-detail"`, added to `Sidebar.tsx`'s detail-panel
  `Box`) - a real, live demonstration rather than a description over a
  static screenshot.

Opens automatically on a visitor's first-ever visit, tracked via a plain
`localStorage` flag (`deployment-tour-seen`) rather than a persisted store
field - this app has no Zustand store the way Policy Explorer does. It
also opens on `?showTour=1` (added 2026-09-10, same param-stripping
pattern as Policy Explorer's own App.tsx) - the Playbook homepage's "Show
me how" button (`index.html`) now links to `/deployment/?showTour=1` instead of
being a dead `href="#"` link with no real destination. A "Take the tour"
link in `TopNavbar.tsx` (same `navItemSx` style as the Help link next to
it) reopens it any time.

## Help page

Built 2026-09-10, matching Policy Explorer's own `HelpPage.tsx` structure
exactly (back-arrow + `h2` header, a centered max-width-720 column of
heading/body topic sections) and its nav's plain underlined-link style
(`navItemSx`, copied into this app's own `TopNavbar.tsx` since it didn't
have any nav links before this). Content is deliberately much simpler than
Policy Explorer's own Help page - this is a demo tool for a general
audience, not a research wiki, so there's no scoring formula or evidence-
basis reference to write. Written to roughly a 12-year-old reading level
per Andrew's instruction: short sentences, plain words, five short topics
(what the tool shows, how to use it, where the data comes from, why some
countries are missing, how often it updates).

Same "page" concept as Policy Explorer's own `App.tsx` (`"map" | "help"`),
but plain local `useState` here rather than a store field - this app has
nothing else that needs to read or restore it.

## Ember logo in dark mode

Fixed 2026-09-10: Ember's logo is dark navy text on a transparent
background, unreadable against a dark-mode header. Wrapped in a small
white chip (`bgcolor: "#fff"`, rounded corners) in `TopNavbar.tsx` rather
than swapping to a different asset - Ember doesn't publish a white variant
we can verify or link to. Harmless in light mode too, where the header
background is already white.

## Resolved decisions

1. **Regional vs country-level** - the brief originally said "country/
   regional map". Policy Explorer handles some countries as their
   states/provinces (Australia, the US) via `isSubdivided`, which raised
   the question of whether this tool wanted the same subnational treatment.
   **Resolved 2026-09-10 - no**: this app tracks whatever granularity the
   data it's given actually has, not a subnational split invented on top
   of it. AU/US/CA were dissolved to country-level shapes 2026-09-09 (see
   `lib/jurisdictions.ts` above) and stay that way; not an open question
   any more.
