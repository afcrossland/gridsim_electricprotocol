# Roadmap - from prototype to product

Where this app stands today, the plan to make it a real multi-user product,
and the five scoping decisions already made. Written for whoever picks this
up next - see individual file comments for the reasoning behind any specific
piece of current behaviour; this doc is about what changes and why.

## Where things stand today

Everything below is a deliberate, already-documented shortcut, not an
accident - see `src/stores/protocolStore.ts`'s own comments on the
persistence contract for the fullest version of this.

- **Protocol data** (sections, questions, rubrics) ships as a static JSON
  file (`src/data/protocol.seed.json`) baked into the build. Changing a
  question means editing a file and redeploying.
- **Territories** (country/state shapes) come from a one-off Natural Earth
  import (`scripts/build_geometry.py`, `npm run build:geometry`), run
  offline. There is no way to add, remove or hide a territory from the
  running app.
- **Answers and edits** (everything a visitor or admin does) live only in
  that one visitor's own browser storage (`localStorage`, via Zustand's
  `persist` middleware). Two people editing the same country never see each
  other's changes. Clear your browser data and it is gone.
- **Admin console** (`src/components/layout/AdminConsole.tsx`) is open to
  anyone who finds the URL - no password, no login, no way to tell who
  changed what. Grep the repo for `stands in for auth` to find the three
  places this is called out in comments.
- **Suggestions** (`src/lib/suggestions.ts`, `SuggestionsReview.tsx`) exist
  as a local review workflow but only ever show suggestions submitted in
  that same browser - see the `TODO` at the top of `lib/suggestions.ts`.

## Known gaps flagged in code

Every `TODO` comment in the codebase, consolidated here so they're all in one
place rather than only discoverable by grepping. Each inline comment now just
points back to this section instead of repeating the full explanation - if
you're reading this after fixing one, delete its entry here and its pointer
comment(s) together.

- **Evidence citations have no translate-to-English mechanism.**
  `EvidenceItem.title`/`.note` (`src/lib/types.ts`) are free text a
  jurisdiction's researcher writes, often in their own language - distinct
  from this app's own i18next-translated UI strings (`src/i18n/`) and
  deliberately never run through them (see `src/components/layout/
  QuestionCard.tsx`'s evidence form). A translation-API call at submission
  time, or an on-demand "translate" action in the review UI, are both
  plausible later options; neither is built. Flagged 2026-09-11, not an
  oversight.
- **Suggestions only ever show up in the browser that submitted them.**
  `diffResponses` (`src/lib/suggestions.ts`) and `SuggestionsReview.tsx` are
  written so the local `suggestions` array can be swapped for real API calls
  without changing shape, but there is no backend yet to carry a submitted
  suggestion to an admin on a different device. Closed by **Phase 6** below.
- **Admin console has no real authentication.** Open to anyone who finds the
  URL - no password, no login, no record of who changed what (`grep -rn
  "Stands in for auth" src/` to find the UI's own callout in
  `TopNavbar.tsx`; the same gap is why `SuggestionsReview.tsx` is equally
  open). Closed by **Phase 2** below.
- **Solar Homes Calculator has no Great Britain-specific calculation any
  more.** A real MCS MGD003 lookup-table path (`calculateGB.ts`, ported
  from Andrew's own `mygridgb` repo, plus its `irradiance.json`/
  `lookup.json` data and the occupancy-`Archetype` concept it drove) shipped
  briefly, then was deliberately deleted 2026-09-16 per Andrew's own
  instruction ("remove the GB specific calc... we will introduce it
  later") - every location now uses the same generic 8760-profile model
  (`calculateGeneric.ts`). `calculate.ts` is still a dispatcher function on
  purpose, not inlined, so reintroducing a location-specific branch later
  is a contained change there rather than a rewrite of every call site.
  Also still provisional: the flat, non-time-shaped EV-charging addition
  (see `EV_ANNUAL_KWH_DUMMY` in `calculator/src/lib/types.ts`).
- **Solar Homes Calculator's per-country generation is real PVGIS data, but
  with two remaining approximations.** `calculator/src/lib/genericSource.ts`
  used to ignore location entirely (one shared synthetic shape everywhere),
  then (2026-09-16) switched to a synthetic-but-per-country day-length
  model; as of 2026-09-17 `calculator/src/data/country-irradiance.json`
  (~10.7MB, code-split via dynamic `import()` so it's not in the initial
  bundle - see that file's own load comment) is built by
  `scripts/build_country_irradiance.py` from **PVGIS's own `seriescalc`
  API** - real satellite/reanalysis-derived hourly weather (PVGIS-SARAH2/3,
  PVGIS-NSRDB, or PVGIS-ERA5 depending on region), `mountingplace=building`
  (rooftop, not ground-mount, per Andrew's own instruction 2026-09-17), at
  a fixed orientation (due south/north by hemisphere, tilt clamped to
  latitude 5-35°) - this script's own heuristic, **not** PVGIS's own
  `optimalangles=1`, which Andrew caught returning physically-broken
  results (Sri Lanka's own "optimal" angle came back an invalid -1° tilt
  at 512 kWh/kWp/yr, when a sane fixed angle gives ~1,572 - a genuine
  PVGIS-side bug affecting 14+ near-equatorial countries, confirmed via
  direct testing 2026-09-17, not something a retry fixes).

  Two data-quality issues were found and fixed 2026-09-18 (Andrew: "there's
  still some odd generation numbers. why china so high, greece so low"):
  (1) Greece's own point (then still `representative_point()` - inland,
  651m, hilly terrain) was coming back at 1,043 kWh/kWp/yr, below
  Germany's own 1,209 despite being much further south, because PVGIS's
  default `usehorizon=1` shades the calculation against the REAL terrain
  surrounding that exact point, not just tilt/azimuth self-shading -
  confirmed via a direct PVGIS call that `usehorizon=0` for the same point
  gives 1,531. Fixed by adding `usehorizon=0`. (2) China's point landed in
  a remote high-irradiance Qinghai-Tibet-plateau desert (~2,200 kWh/kWp/yr)
  - not PVGIS's fault, but this script's own single-`representative_point()`-
  per-country strategy picking a genuinely unrepresentative spot. Fixed the
  same day, per Andrew's own follow-up ("we should calculate the
  irradiance at the location of the most populous city?"): the script now
  queries each country's own biggest city (Natural Earth's own
  `ne_10m_populated_places`, same source/host as `jurisdictions.geojson`'s
  own admin boundaries) instead of a polygon-geometric point -
  `biggest_city_points()`/`country_points()` in the script. China now
  reads Shanghai (~1,345 kWh/kWp/yr) instead of the desert figure. This
  introduced its own smaller issue, also fixed the same day: a handful of
  coastal capitals' exact coordinates (Conakry, Guinea; several small
  island nations - 14 countries total) landed just outside PVGIS's own
  land/sea classification ("Location over the sea"), even though the
  country obviously has land and people - fixed by falling back to the old
  `representative_point()` (interior-guaranteed) when the city point fails
  PVGIS outright, recovering all but the same 7 countries that were
  already failing before any of this (open ocean / outside PVGIS's spatial
  coverage - IO, KI, MH, MV, NF, SH, TV). Two approximations remain,
  documented in the script's own doc comment: (1) a single point - even
  the country's biggest city - still can't capture a large, climate-diverse
  country's full variation, just picks a less arbitrary single point than
  a geometric centroid did; (2) one specific historical year (2015, chosen
  as the one year valid across every PVGIS database this script hits)
  isn't the same as a statistically "typical" year - PVGIS's own `tmy`
  endpoint builds one of those, but doesn't do `pvcalculation`, so using it
  would mean implementing a tilt/azimuth transposition model in this
  script too. `WorldMap.tsx`'s
  own choropleth (and its hover tooltip's kWh/kWp/yr figure) reads the
  same dataset via `lib/countryIrradiance.ts`, shared with
  `genericSource.ts` so the map and a real calculation are never showing
  two different numbers for the same country. Also not yet applied: an
  array's own `tilt`/`azimuth` inputs only affect its kWp for this source
  today, not its orientation - every array uses its country's one fixed
  angle regardless of what's set in Design (see `genericSource.ts`'s own
  TODO) - recomputing per arbitrary tilt/azimuth would mean a live PVGIS
  call per calculation, not a precomputable static dataset.
- **Solar Homes Calculator's demand shape is one GB profile class, reused
  everywhere.** `calculator/src/lib/demandProfile.ts` used to synthesise a
  generic two-peak shape from scratch; as of 2026-09-16 it reads
  `calculator/src/data/pc1-demand-profile.json`, built by
  `scripts/build_pc1_demand_profile.py` from Elexon's own published Profile
  Class 1 (Domestic Unrestricted) half-hourly load profile coefficients -
  real GB settlement data, not synthetic, but still explicitly a
  placeholder per Andrew's own instruction ("just PC1... the database will
  be replaced by another dataset in the future"): no Profile Class 2
  (Economy 7) option, no occupancy/house-size variation, and every country
  gets the exact same shape (normalised so the 8760 sums to 1 kWh, then
  scaled to whatever annual total applies). The one adjustment made for
  non-GB locations is a six-month rotation for the southern hemisphere
  (`southernHemisphere` param, `location.lat < 0`) so the GB source data's
  own Dec/Jan heating peak lands on a southern visitor's own Jun/Jul winter
  instead - a crude fix (a rotation of one hemisphere's shape, not a real
  southern-hemisphere dataset), not a real fix. The sidebar's own Demand tab
  (`DemandPanel.tsx`) shows this shape directly, fixed at an illustrative
  4,000 kWh/yr, independent of whatever the Design tab's own demand slider
  is currently set to.
- **Solar Homes Calculator's battery dispatch has no grid export limit yet.**
  `calculator/src/lib/batteryDispatch.ts`'s `simulateDispatch` takes an
  `exportLimitKW` parameter (used to curtail solar once export hits that
  cap) but every call site leaves it at the default `Infinity`, per
  Andrew's own instruction 2026-09-16 ("we assume the grid export limit is
  infinite at this stage"). The curtailment math is already there
  (`Math.min(surplus, exportLimitKW)`), so giving this a real per-market
  value later doesn't need a rewrite - just a value to pass in, and
  somewhere to surface curtailed kWh in `DispatchResult` and the Dispatch
  tab's own chart (currently not tracked as its own series since it's
  always zero).
- **Solar Homes Calculator's self-sufficiency map view is a precomputed
  snapshot, not a live calculation.** As of 2026-09-16 the map's own metric
  selector (`WorldMap.tsx`, `lib/mapMetrics.ts`) defaults to self-sufficiency
  (%), coloured from `calculator/src/data/country-self-sufficiency.json` -
  one % per country for a single fixed default system (10 panels at 500Wp,
  10kWh battery, 3,500 kWh/yr demand), built by running the app's own real
  generation/demand/dispatch model (`genericSource.ts`, `demandProfile.ts`,
  `batteryDispatch.ts`) offline via `scripts/build_self_sufficiency.ts`
  (`npx tsx scripts/build_self_sufficiency.ts` from `calculator/`) rather
  than reimplementing the maths. **This file goes stale the moment any of
  those three inputs change** - a `country-irradiance.json` rebuild (this
  already happened once, 2026-09-17, when the irradiance script switched
  from a synthetic model to real PVGIS data, then again the same day when
  the `optimalangles=1` bug was found and fixed - both times this file had
  to be manually regenerated afterward, which it was), a new demand
  shape/database (see the entry above and the "global household demand"
  item below), or a changed dispatch model (round-trip efficiency, charge
  power cap, export limit) - and nothing currently catches that drift
  automatically; re-running the script is a manual step someone has to
  remember every time. A real fix would wire regeneration into whatever
  pipeline updates those upstream datasets.
- **TODO: the Dispatch tab's charts need explainer text.** As of
  2026-09-18, "Monthly total" and "Daily dispatch across the year"
  (`DispatchPanel.tsx`'s own `withExportAboveAxis`) show solar export
  stacked *above* the zero axis at reduced opacity, while the hourly
  drill-down still shows it *below* the axis at full opacity, per Andrew's
  own instruction ("show export above as +ve and with a transparency on
  it", "same on monthly total") - a deliberate per-view exception, not
  inconsistency, but a visitor moving between these views with no
  explanation would reasonably find the flip confusing (why does the same
  series switch sides and fade, and what does the transparency mean?).
  Flagged by Andrew the same day ("add explainer text to make it easy to
  understand") - not yet written; needs a short caption near each chart
  (or a shared one covering both) saying solar export is shown lighter and
  on top here because it's energy that left the site unused, not something
  the home actually drew on.

## Planned next (not yet built)

Requests Andrew has flagged for later, recorded here so they don't get
lost - not yet started.

- **TODO: compare the Solar Homes Calculator's generic-model results to
  the MCS standard.** Flagged 2026-09-18. The generic 8760-profile model
  (`calculateGeneric.ts` - real PVGIS generation, the PC1 demand shape,
  `batteryDispatch.ts`'s own dispatch loop) has never been checked against
  a known-correct reference; the real MCS MGD003 lookup-table method
  (`calculateGB.ts`, deleted 2026-09-16 - see the "Known gaps" entry above)
  is exactly that reference for GB. Needs: pick a handful of GB
  postcodes/system specs, run both paths (would mean temporarily
  resurrecting `calculateGB.ts`, or re-deriving its numbers by hand from
  the MCS tables directly) and compare annual generation, self-consumption
  %, and payback - flagging anywhere the generic model diverges enough to
  matter. Not started.
- **Download a location's own timeseries as an .xlsx.** Generation, demand,
  battery charge, battery discharge and battery state of charge (the same
  five/six series the Generation/Demand/Dispatch tabs already compute) as
  one spreadsheet a visitor can take away and open in Excel.
- ~~Two new map views on the main choropleth: self-consumption (%) and
  energy independence (%) of homes, per country/region.~~ **Done
  2026-09-16** - a self-sufficiency (%) view shipped as the map's new
  default metric (see the "Known gaps" entry above for its own caveats). A
  separate self-consumption (%) view (fraction of *generation* used
  on-site, as distinct from self-sufficiency - fraction of *demand* met by
  on-site generation) hasn't been built.
- **A global source for average household annual electricity demand, per
  region/country.** Flagged 2026-09-16 - the calculator currently has no
  location-specific demand total at all (every country defaults to the
  same 4,000 kWh/yr on the Design tab, and the self-sufficiency map's own
  precomputed dataset above uses one fixed 3,500 kWh/yr for every
  country). Researched 2026-09-17 - findings, not yet scoped into a build:
  - **No single ready-made "kWh per home" table covers every country.**
    IEA's own "Average residential electricity consumption per connection
    by region, 2000-2024" is the right *metric* (kWh per household, not
    per capita) but is region-level, not per-country, and isn't
    downloadable from that chart - the country-level detail sits behind
    IEA's data browser, which needs a free account.
  - A free, no-signup, per-country compiled table exists at
    [shrinkthatfootprint.com](https://shrinkthatfootprint.com/average-household-electricity-consumption/)
    (citing IEA/World Energy Council) - real kWh/yr-per-household figures,
    but only ~20 major economies (Canada 11,305 · US 11,156 · Sweden 8,914
    · Australia 5,919 · France 5,344 · Japan 4,749 · Spain 4,169 · UK
    3,658 · Germany 3,127 · China 2,180 · India 1,005, etc.) - most of
    Africa, Latin America and Southeast Asia isn't covered.
  - The only dataset with genuinely global, freely-downloadable coverage
    (World Bank's "Electric power consumption (kWh per capita)") is
    per-capita, not per-household - would need multiplying by a
    household-size-by-country dataset (UN Population Division or World
    Bank both publish one) to approximate a per-home figure, which is a
    derived estimate, not a directly-measured one.
  - **Path (a) above is ruled out, not just lower-precision.** Andrew's
    own catch, 2026-09-17: World Bank's "kWh per capita" indicator is
    *total* consumption (industry, commercial, streetlights, everything)
    divided by population, not residential - multiplying by household
    size doesn't recover a home's own demand, it wildly overstates it in
    industrial/mining-heavy economies especially. Confirmed by pulling
    the indicator directly (`api.worldbank.org`, `EG.USE.ELEC.KH.PC`) for
    a 9-country test case (UAE, Canada, US, Mexico, UK, France, Australia,
    Kenya, South Africa) and finding it unusable for this purpose.
  - **Separately: "average household consumption" figures are usually a
    mean per connection, not the median Andrew actually wants** ("we want
    average consumption of an average house (median)", 2026-09-17) - a
    mean is pulled upward by a right-skewed tail of high-consuming homes.
    Tested directly against the same 9-country case:
    - **Mexico is the one genuine median found**: INEGI's own household
      survey (ENIGH) publishes a national median of 158 kWh/month (urban,
      summer) - ~1,896 kWh/yr.
    - Kenya: no rigorous median, but a typical/modal grid-connected
      household (EPRA's own domestic tariff bands cluster 80-120
      kWh/month) - ~1,200 kWh/yr, closer in spirit to a median than a
      skewed mean would be.
    - UK ~3,658 · South Africa ~2,614 · France ~5,344 · Australia ~5,919 ·
      Canada ~11,305 · US ~11,156 (all from
      [shrinkthatfootprint.com](https://shrinkthatfootprint.com/average-household-electricity-consumption/),
      citing IEA/World Energy Council) - these are **means per
      connection**, not medians; the true median for each is presumably
      somewhat lower, by an unknown amount without the underlying
      distribution.
    - UAE: no usable figure - only a 2-bed-apartment tariff-band estimate
      (~14,000-18,000 kWh/yr), excludes villas entirely, low confidence.
  - **Where this leaves it, not started**: path (b) - hand-curate real
    figures for the ~20-30 countries where *something* exists
    (IEA/EIA/Eurostat/national statistics/household surveys) and fall back
    to a regional or income-band average elsewhere, same shape as the
    self-sufficiency dataset's own "everyone gets one fixed number"
    placeholder it would be replacing - is the only viable path left, and
    even that mostly yields means, not medians. A genuinely global,
    genuinely-median dataset doesn't exist ready-made; assembling true
    medians even for a handful of countries means digging into each
    country's own household survey microdata (US EIA's RECS, UK's English
    Housing Survey, Australia's ABS household energy survey, etc.) one at
    a time, each with its own methodology and update cycle - a real
    per-country curation effort, not a quick dataset swap.
- **Align the battery dispatch model to Andrew's own paper.** Flagged
  2026-09-16, no detail given yet on which paper or where it diverges from
  `calculator/src/lib/batteryDispatch.ts`'s current model (solar-first,
  √0.85 one-way charge/discharge efficiency, 1C max charge power, no
  discharge power cap, greedy same-hour dispatch - see that file's own doc
  comment) - needs the actual paper before this can be scoped further.

## Decisions already made

Settled 26 August 2026. Each of these changed the shape of the plan below
enough to be worth recording rather than assuming.

1. **Backend platform: `gridsim-backend`.** Build on the Global Solar
   Council's existing FastAPI + SQLAlchemy + Postgres service
   (`github.com/afcrossland/gridsim-backend`, private repo) rather than a
   new managed platform or a hand-built API. Already deployed via Docker to
   Google Cloud with Terraform-managed infra. New policy-tool tables live in
   their own schema (or database) in the same Postgres instance, kept
   separate from gridsim's own simulation tables - shared infrastructure and
   deploy pipeline only. Two gaps to fill in that repo before this starts:
   no migration tooling (add Alembic or similar) and no auth system yet.
2. **Admin auth: one shared password.** No individual accounts. Simple to
   build; the accepted trade-off is that the future change log (below) can
   only ever say "an admin" made a change, not which one. Upgradable to
   named accounts later without a schema rewrite.
3. **Publish model: stays instant.** An edit is live for every visitor the
   moment it is made, no draft or review step - matches today's UX exactly,
   just now shared globally instead of trapped in one browser.
4. **Territory scope: toggle existing, not a geometry editor.**
   "Add/remove territories" means a visibility and grouping toggle (EU27/NEM
   style bloc membership) on jurisdictions Natural Earth already provides
   shapes for. Drawing or importing genuinely new custom shapes is out of
   scope.
5. **Frontend hosting: moves to Google Cloud.** The frontend leaves GitHub
   Pages and moves onto the same Google Cloud infrastructure as the
   backend, rather than staying static on GitHub Pages and calling the API
   remotely. This replaces the `.github/workflows/deploy.yml` pipeline
   described in `README.md`.

## The phases

Ordered so every phase leaves the app in a working state - nothing here
requires a big-bang cutover.

### Phase 0 - Foundations

Nothing else can start until there is a database and an API for the
frontend to talk to.

- Add the policy tool's schema to `gridsim-backend`: jurisdictions,
  sections, questions, rubric tiers, responses, evidence, suggestions,
  audit log.
- Introduce migration tooling (Alembic) in that repo - it has none today.
- Stand up the new router group alongside the existing `historic.py`,
  `irradiance.py`, `simulate.py` routers.

### Phase 1 - Serve the protocol from the database

Lowest-risk first step: move today's static JSON into the database, keep
behaviour identical. A read-only migration, no new features yet.

- One-time import of `protocol.seed.json` and `src/data/jurisdictions.json`
  into the new schema.
- Add read endpoints; the frontend fetches on load instead of importing a
  JSON file at build time (`src/stores/protocolStore.ts`'s `initialState()`
  and `seedResponses()` are the two places that currently do this).
- Ship this alone and confirm the app looks and behaves exactly as it does
  today, just from a live source.

### Phase 2 - Lock the admin console

Has to land before Phase 4's write path opens up - an authenticated-looking
screen backed by unauthenticated write endpoints is not actually locked.

- Shared password login in front of `AdminConsole.tsx`.
- Every write endpoint checks the same session server-side, not just the
  page route on the frontend.
- Retire the `stands in for auth` comments in `TopNavbar.tsx`,
  `SuggestionsReview.tsx` and `lib/suggestions.ts` once this ships.

### Phase 3 - (reserved)

Left as a gap in the numbering from earlier planning; folded into Phase 4
below rather than renumbering everything.

### Phase 4 - Admin edits become real, shared writes

- Question and section create/edit/delete goes through the authenticated
  API instead of `questionOverrides`/`sectionOverrides`/`customSections`/
  `customQuestions` sparse-override state in `protocolStore.ts`.
- Country answers and evidence write straight through too - editing stays
  live and immediate, matching today's UX, just shared globally instead of
  trapped in one browser.
- No draft/publish step (decision 3 above).

### Phase 5 - Territory management

- Shape/geometry data stays exactly what it is today: the offline Natural
  Earth build step. That part rarely changes and does not need a UI.
- A territory's visibility and grouping becomes a database-backed toggle
  instead of a build-time constant (`SUBDIVIDED`/`EXCLAVES` in
  `scripts/build_geometry.py`, the `mappable` flag in
  `src/data/jurisdictions.json`).
- An admin can then show or hide a territory from the frontend without a
  code change or a redeploy.

### Phase 6 - Full change log

Not possible at all today - there is no shared record to log against until
Phase 4 lands. This is what finally closes the cross-device gap already
called out as a `TODO` in `lib/suggestions.ts`.

- Every write (a question edit, an answer change, a territory toggle, a
  suggestion decision) records what changed, before/after, and when.
- A history view in the admin console, filterable by country or question.
- Suggestions become real database rows any admin can review from any
  device.

### Phase 7 - Cutover and cleanup

- Move the frontend off GitHub Pages onto the same Google Cloud
  infrastructure as the backend (decision 5).
- Edits already sitting in visitors' browser storage were always
  provisional - no migration needed, they are simply superseded by the
  database.
- `resetToSeed` in the admin console's Danger Zone needs new meaning once
  there is no local override state left to reset - repoint it at "revert
  to last published" or retire it.
- The PDF report export (`src/components/report/CountryReportDocument.tsx`)
  is unaffected - it already just renders whatever data is currently in
  memory.

## A fuller write-up

A more narrative version of this plan, with the reasoning behind the phase
ordering, was published as a Claude Artifact during planning:
<https://claude.ai/code/artifact/155348da-75f4-4a46-a26a-c83368d364e0>
(private to the account that created it - ask Andrew for access if needed).
