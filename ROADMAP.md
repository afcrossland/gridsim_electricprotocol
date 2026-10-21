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
  as of 2026-09-18 a `{ low, medium, high }` % per country for three fixed
  system tiers (low: 8 panels at 500Wp/5kWh battery/5,000 kWh/yr demand;
  medium: 10 panels/10kWh/4,000 kWh/yr, the same "normal house" default the
  Design tab itself starts from, and the only tier the map's own colour
  view currently reads; high: 14 panels/15kWh/3,500 kWh/yr), built by
  running the app's own real generation/demand/dispatch model
  (`genericSource.ts`, `demandProfile.ts`, `batteryDispatch.ts`) offline
  via `scripts/build_self_sufficiency.ts` rather than reimplementing the
  maths. **This file goes stale the moment any of those inputs change** - a
  `country-irradiance.json` rebuild (this already happened several times -
  2026-09-17's switch from a synthetic model to real PVGIS data, the
  `optimalangles=1` fix the same day, the `usehorizon=0` and
  biggest-city-point fixes 2026-09-18, each requiring this file to be
  manually regenerated afterward, which it was), a new demand
  shape/database (see the entry above and the "global household demand"
  item below), or a changed dispatch model (round-trip efficiency, charge
  power cap, export limit). Partially addressed 2026-09-18 per Andrew's own
  instruction ("update the code so this repeats every time we update the
  demand profile/irradiance"): `npm run calculator:build-datasets` (root
  `package.json`) now chains all three generator scripts in the right
  order, so regenerating either upstream dataset regenerates this one too
  in the same command - but running that command is still something a
  person has to choose to do, not something a build/CI step forces. A full
  fix would wire it into whatever pipeline updates those upstream datasets
  automatically, with no human step at all.
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

- **TODO: deliver submitted corrections to the team (backend).** Flagged
  2026-10-15. A correction submitted through "Suggest an edit" is still only
  saved in the submitter's own browser (see "Suggestions only ever show up in
  the browser that submitted them" above), so nobody on the team receives it.
  Deliberately deferred - the page is still a mockup - and closed properly by
  Phase 6. Until then no interim delivery (email / GitHub issue / form
  service) is wired up either.
- **TODO: wire login to the edit screen.** Flagged 2026-10-15. The suggestion
  dialog asks for a free-text name (required) and organisation; once login
  exists, "who sent it" should come from the signed-in account instead of
  being typed, and edit mode should require being signed in. Depends on
  Phase 2 (auth).
- **TODO: add a categorical badge to the map hover tooltip.** Flagged
  2026-09-29, when the tooltip's design was lifted from the sibling
  gridsim-frontend project's own map hover card (`shared/components/
  MapHoverTooltip.tsx`, now shared across policy, deployment and
  calculator). gridsim's own version shows a small colour-coded pill next
  to its value (e.g. a "Low/Moderate/High" carbon-intensity badge) -
  deliberately left out of this pass ("do not show the l/m/h tile (yet)")
  since each app's own equivalent needs its own design decision, not a
  blind copy of gridsim's carbon-specific colours: calculator already has
  real low/medium/high self-sufficiency tiers per country
  (`data/country-self-sufficiency.json`) that could become this badge
  directly; policy's own score bands (`SCORE_BANDS` in `lib/scoring.ts` -
  "Very ineffective" through "Very effective") are the closest existing
  equivalent there; deployment has no categorical concept at all yet.
  `MapHoverTooltip`'s own `value` prop already accepts any `ReactNode`, so
  adding a badge is a per-app content change, not a shared-component one.
  Not started.
- **TODO: the Solar Homes Calculator's ranked list doesn't scroll well once
  filtered to North America, Oceania, or Europe.** Flagged 2026-09-28,
  right after the ranked list gained a continent filter
  (`CountryLeagueTable.tsx`, on the shared `FilterBar`/`ContinentFilter`).
  Not yet reproduced/diagnosed - a quick programmatic check of the scroll
  container itself (`overflowY: auto`, `scrollHeight` genuinely taller than
  `clientHeight`) and a synthetic mouse-wheel scroll both looked fine, so
  the issue is either specific to a real trackpad/touch input this pass
  didn't simulate, or a rendering/interaction glitch only visible with the
  real row count these three continents produce (all three are among the
  longest lists - Europe and North America especially, once Russia/
  Bonaire-style edge cases are counted). A same-day "zoom the map to the
  filtered countries' extent" feature (`WorldMap.tsx`'s own `fitToCodes`
  prop) was tried and then reverted the same day at Andrew's request
  (unrelated to this bug, not because it caused it) - worth checking
  whether this scroll issue is still reproducible now that it's gone,
  before assuming it needs its own separate fix. Needs reproducing
  directly in a real browser before attempting anything. Not started.
- **TODO: port this app's own onboarding tour onto the shared tour engine.**
  Flagged 2026-09-19, as part of the ongoing shared-UI effort across this
  app, `deployment/`, and `calculator/` (see `shared/` and the doc comments
  throughout it for what's already common: header, footer composition,
  help page shell, map legend/zoom controls/colour ramp, ranked-list tile,
  country detail header, theme/CSS/fonts, language switcher, flags). This
  app's own tour (`src/scrollstory/`) is the richest and most divergent of
  the three - a `cta` scene layout, a `media` union, a Charter-reveal step -
  and was deliberately left un-ported when deployment's tour was extracted
  into `shared/tour/` and calculator got a brand-new tour built on it
  (2026-09-19), same "leave the most divergent one for later" call made for
  this app's map/sidebar in the first round. Porting it means either
  extending `shared/tour/types.ts`'s `SceneLayout`/`Scene` shape to cover
  the `cta` layout and `media` union, or confirming they can be expressed
  through the existing `spotlight`/`onEnter` shape instead. Not started.
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

  **First data point, 2026-09-30**: hand-checked one case directly against
  the official MGD003 lookup tables (`MGD003-LookupTables-FINAL.xlsx`,
  "In half the day" occupancy, 4,000-4,499 kWh annual demand band, 10 kWh
  usable battery) at three generation levels for a 5 kWp system. MGD003
  predicts self-sufficiency of ~81.8% at 5,000 kWh/year generation and
  ~87.2% at 5,699 kWh/year. The generic model's own prediction for a
  comparable UK case came out at 77% - on the low side of that band, a
  ~5-10 point gap. Not enough to say the generic model is wrong (only one
  case checked, and the demand/occupancy archetype wasn't matched exactly
  to the generic model's own PC1 demand shape), but worth keeping in mind
  as a lead for the fuller comparison above.
- **TODO: move the Solar Homes Calculator's irradiance data to a database.**
  Flagged 2026-09-30. `calculator/src/data/country-irradiance.json` (~10.7MB,
  built offline by `scripts/build_country_irradiance.py` from PVGIS's own
  `seriescalc` API - see the "Known gaps" entry above for the full history
  of fixes to this dataset) currently ships as a static JSON file in the
  repo, code-split via dynamic `import()` so it's not in the initial
  bundle. Moving it to a real database would let it be queried/updated
  without a full rebuild-and-redeploy cycle (the same motivation as the
  self-sufficiency snapshot's own staleness problem, same section above),
  and would open the door to storing more than one point per country (the
  single-biggest-city-point approximation flagged there). Not started - no
  database exists anywhere in this app today, so this would be a new piece
  of infrastructure, not a swap of one data source for another.
- **TODO: add battery cycling at night to the cashflow/savings model.**
  Flagged 2026-09-30. `calculator/src/lib/batteryDispatch.ts`'s dispatch
  loop only ever charges the battery from surplus solar (see its own doc
  comment); it never charges from the grid overnight to discharge against
  a more expensive daytime import rate or to firm up self-consumption -
  a real time-of-use arbitrage strategy the day/night import tariff
  sliders (`ResultsPanel.tsx`, `payback.ts`'s `NIGHT_HOURS`) already imply
  is possible but the dispatch model doesn't act on. Adding it would change
  `simulateDispatch` itself (a new grid-to-battery charge path, gated by
  some rule for when it's worth cycling) and would need its own cost/wear
  assumption before it could safely add avoided-cost savings to the
  Economics tab's payback/cashflow figures - not just a display change.
  Not started.
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

Settled 26 August 2026; decisions 1, 2 and 5 revised 21 October 2026 (the
originals are kept in each entry for the record). Each of these changed the
shape of the plan below enough to be worth recording rather than assuming.

1. **Backend platform: a FastAPI service in this repo, grown from the
   `/klute` gate.** *Revised 2026-10-21.* The gate (`klute/gate/`) is
   already a FastAPI service on Cloud Run with Firebase Auth, deployed by
   this repo's own Terraform (`infra/terraform/`) and workflows, so the
   policy API grows out of it rather than going into `gridsim-backend`.
   Data lives in **its own Postgres database (`electricfutures`, schema
   `policy`) on the existing gridsim Cloud SQL instance** - shared instance,
   nothing else shared with gridsim's simulation tables. Schema changes go
   through Alembic in `klute/gate/`. *Was:* build on `gridsim-backend`; set
   aside because Electric Futures infrastructure now deliberately lives in
   this repo, not in `gridsim-deploy`, and it would tie policy releases to
   the simulator's.
2. **Admin auth: Google sign-in (Firebase Auth) with an allowlist.**
   *Revised 2026-10-21.* Reuses what the `/klute` gate already does. Every
   write is attributable to a named email, so the change log (Phase 6) can
   say who made a change. *Was:* one shared admin password.
3. **Publish model: stays instant.** An edit is live for every visitor the
   moment it is made, no draft or review step - matches today's UX exactly,
   just now shared globally instead of trapped in one browser.
4. **Territory scope: toggle existing, not a geometry editor.**
   "Add/remove territories" means a visibility and grouping toggle (EU27/NEM
   style bloc membership) on jurisdictions Natural Earth already provides
   shapes for. Drawing or importing genuinely new custom shapes is out of
   scope.
5. **Frontend hosting: Firebase Hosting.** *Done 2026-10-21* (the
   Firebase hosting work, afcrossland/gridsim_electricprotocol#5): the
   public site is on Firebase Hosting, which rewrites `/klute/**` to the
   Cloud Run gate. The API's routes get the same kind of rewrite, so the
   frontend calls it on its own origin. *Was:* "moves to Google Cloud" with
   no specific product chosen.

## The phases

Ordered so every phase leaves the app in a working state - nothing here
requires a big-bang cutover.

### Phase 0 - Foundations

Nothing else can start until there is a database and an API for the
frontend to talk to.

- **Schema (done, #11).** SQLAlchemy
  models in `klute/gate/ep_db/models.py`, Alembic migrations in
  `klute/gate/migrations/`. Two kinds of data are kept apart:
  - *Imported research*: `sources`, `jurisdiction_groups`, and
    `researched_answers` (one row per entry of `sourced-answers.json` /
    `indicator-answers.json`, unresolved). The spreadsheet import owns
    these and replaces them wholesale, so a re-import never touches
    anything a person entered.
  - *Things people do*: `responses` + `response_evidence` (an edit made in
    the app; a row with no score records that someone cleared a researched
    answer), `suggestions`, `question_proposals`, `audit_log`.
  - The protocol's structure (`protocol`, `sections`, `questions`,
    `rubric_tiers`) and `jurisdictions` sit in between: seeded from JSON
    once, then edited by admins (Phases 4-5).
- **Import script (done, #11).** `python -m ep_db.import_json` loads
  today's four JSON files. `--check` exports the database back into those
  files' shapes and fails on any difference - the evidence that Phase 1 can
  serve identical data.
- **Terraform (done, #13)** (`infra/terraform/modules/electricfutures/database.tf`):
  the `electricfutures` database and login on each environment's gridsim Cloud SQL instance,
  and a Secret Manager `DATABASE_URL`. Apply steps and a permissions caveat in
  `infra/terraform/README.md`.
- **Dev: applied and loaded (2026-10-21).** Terraform applied on `gridsim-dev-db`, migration
  `0001` run, and the import loaded today's JSON (821 researched answers, 657 sources, 39
  questions, 317 jurisdictions); `--check` matches the files exactly. Nothing reads from it
  yet, and spreadsheet uploads still only update the JSON, so it falls behind until the
  import workflow writes to the database (Phase 1) - re-run the import by hand meanwhile.
- **Prod: not applied.** Same steps on `gridsim-prod-db`, each with its own go-ahead.
- **Not done:** the `REVOKE CONNECT ... FROM PUBLIC` grants from the Terraform README, which
  need the gridsim instance owner.
- Rename `klute/gate/` (e.g. to `api/`) once it serves more than `/klute`;
  left alone for now so Terraform and the workflows don't change in Phase 0.

### Phase 1 - Serve the protocol from the database

Lowest-risk first step: move today's static JSON into the database, keep
behaviour identical. A read-only migration, no new features yet.

- Apply Phase 0 on prod and load it the same way (dev is done).
- **Read endpoint (in progress, branch `feature/ep-db-phase1-read`).**
  `GET /api/policy/data` on the gate returns the four files' shapes from
  the database (503 on any problem); Firebase Hosting rewrites
  `/api/policy/**` to it; the gate's Cloud Run service mounts the Cloud SQL
  socket and gets `DATABASE_URL` (Terraform, needs applying per
  environment). The Policy Explorer fetches it before loading the app
  (`src/data/policyData.ts`, `src/main.tsx`) on **dev builds only**
  (`VITE_POLICY_API`), falling back to the bundled JSON on any failure.
  Answer resolution (specificity and basis precedence in
  `src/data/sourcedAnswers.ts`) stays in the frontend for this phase. The
  `/klute` explorer still imports `protocol.seed.json` directly
  (`klute/src/panels/PolicyPanel.tsx`, `klute/src/lib/countryStatus.ts`).
- Turn it on for prod (set `VITE_POLICY_API` for prod builds) once prod is
  applied and loaded and dev has run on it for a while; then the bundled
  JSON can stop shipping.
- Point `.github/workflows/import-input.yml` at the database instead of
  committing regenerated JSON.
- Ship this alone and confirm the app looks and behaves exactly as it does
  today, just from a live source.

### Phase 2 - Lock the admin console

Has to land before Phase 4's write path opens up - an authenticated-looking
screen backed by unauthenticated write endpoints is not actually locked.

- Google sign-in (Firebase Auth, allowlisted emails - decision 2) in front
  of `AdminConsole.tsx` and the country page's Edit mode.
- Every write endpoint verifies the same Firebase session server-side, not
  just the page route on the frontend.
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

- Frontend hosting already moved to Firebase (decision 5).
- Edits already sitting in visitors' browser storage were always
  provisional - no migration needed, they are simply superseded by the
  database.
- `resetToSeed` in the admin console's Danger Zone needs new meaning once
  there is no local override state left to reset - repoint it at "revert
  to last published" or retire it.
- The PDF report export (`src/lib/report/policyReportModel.ts`, rendered by `shared/pdf/`)
  is unaffected - it already just renders whatever data is currently in
  memory.

## A fuller write-up

A more narrative version of this plan, with the reasoning behind the phase
ordering, was published as a Claude Artifact during planning:
<https://claude.ai/code/artifact/155348da-75f4-4a46-a26a-c83368d364e0>
(private to the account that created it - ask Andrew for access if needed).

## Reports (shared PDF engine)

Added 2026-10-15. Reports across the Electric Protocol apps use one shared engine in `shared/pdf/`, ported from the
TUC workplace calculator: a tagged, accessible PDF (PDF/UA-1) made in the browser with PDFKit, shown in a preview window
before download. Nothing is sent anywhere. Each app supplies only a report *model* (pages of blocks: title, heading,
paragraph, metrics, table, list, bar chart).

- **Policy Explorer: done.** `src/lib/report/policyReportModel.ts`; replaces the old picture-of-a-page (html2canvas +
  jsPDF) export, which is removed.
- **TODO: Deployment Explorer report.** No report exists yet; needs a decision on what it contains.
- **Homes (Solar Homes Calculator) report: first version done** (2026-10-16): `calculator/src/lib/report/homesReportModel.ts`,
  opened from the "Download report" button on the Economics tab. One report, two parts: a first page answering "what do solar
  and storage do for my home" and "what does it add up to for a country"; Part A (the home: where power comes from, a summer
  and a winter day, monthly generation vs demand, 25-year cashflow, savings table); Part B (the same home scaled to 10,000 /
  100,000 / 1 million homes); "About these figures".
  - **Ranges and rounding (done 2026-10-16):** no figure is exact. Headline numbers are a range between a cautious case
    (solar output 10% lower, energy prices 20% lower, installed cost 15% higher) and an optimistic case (the reverse),
    rounded to two significant figures (money to the nearest 10 below 1,000; percentages to the nearest 5). Charts and
    tables show the typical case. Code: `calculator/src/lib/report/ranges.ts`.
  - **TODO: peak / evening demand reduction.** Removed from the report: it is not defendable unless the system is shown
    to deliver it on the worst solar day of the year (the single worst hour is usually a dark winter evening the battery
    cannot cover). Add back as a design check on the worst day, not an average. Wanted for the decision-maker view.
  - **Fixed 2026-10-16: solar was in UTC.** The irradiance dataset's hourly profiles are UTC, so away from Greenwich solar
    peaked at the wrong time of day (New Zealand's noon fell near midnight UTC) and battery / self-consumption results were
    wrong with it. `toLocalSolarTime` (`calculator/src/lib/genericSource.ts`) now rotates each profile into local solar time
    (UTC + longitude / 15 h). **TODO: use each country's real time zone and daylight saving** (demand follows the wall clock),
    which needs a time-zone dataset; the solar-time approximation can be an hour or so out.
  - **TODO: carbon.** Deliberately left out; needs country grid carbon intensity (Ember's open data is the likely source).
  - **TODO: Policy / Deployment context** in Part B (country policy score and barriers, solar's share of generation) - to come.
  - **TODO: real inputs.** The report states plainly that prices, install cost, solar output (a country-level placeholder,
    no roof tilt/direction) and demand pattern are placeholders; the figures become credible as those are replaced.
  - **TODO: the scaling to N homes assumes every home is the same** and says nothing about adoption speed.
- **TODO: run the veraPDF PDF/UA check in CI** (the TUC project does; `policyReport.test.ts` writes its PDFs to
  `test-output/reports/` for it).
- **Fonts: done.** Reports use the GSC's Eastman Grotesque (Bold headings, Demi-Bold emphasis, Regular body) from
  `shared/assets/fonts/`. **Check the font licence allows embedding in PDFs** - the web licence may not. Another
  brand's embeddable files can be dropped into `shared/pdf/fonts/brand/` and take precedence.
- **Links: done.** Web addresses in evidence are clickable (link annotations inside PDF/UA `Link` tags). Not yet
  verified by veraPDF (see the CI TODO above).
- The preview draws the PDF with pdf.js (`shared/pdf/PdfPreview.tsx`) rather than the browser's embedded viewer: in
  Chrome a link clicked in the embedded viewer replaces the whole tab. Here links open in a new tab, and the real text
  is laid over the page so it can be selected. The downloaded file is the same tagged PDF.
- The "score by policy area" bars replace the old radar (windrose) chart: same data, accessible as a bar chart with a
  written summary.
- Report text is English only for now (as before).

## Updating policy data from spreadsheets (Tim's workflow)

Added 2026-10-16. Tim uploads country spreadsheets to `input/` through the GitHub website (see `input/README.md`).
`.github/workflows/import-input.yml` then runs `scripts/import_output_sheets.py`, commits the regenerated
`src/data/` files to `main`, and starts the site deploy. No review step (Tim is trusted); a sheet that cannot be read
fails the run, commits nothing, and the run summary says what to fix. Country sheets are named
`<Country> Output Rev 8.xlsx`; spelling, case and a suffix after the rev are tolerated, and the country is looked up
in `src/data/jurisdictions.json`, so a new country needs no code change.

- **TODO: upload through the app itself.** Needs the backend and login (Phases 2 and 6): a signed-in upload would be
  parsed on the server and staged for approval. Until then GitHub is the upload route.
- **TODO: write accepted corrections back into the spreadsheets** (or store them server-side) so a re-import does not
  overwrite them.

## The Playbook - the unifying planner (members only)

Added 2026-10-16. A sixth tile on the Electric Futures main page (`index.html`) for a members-only planner: the
overarching optimisation layer that uses every tool - Deployment, Policy, Future Grid Simulator, Economics and the
Homes calculator - to produce a solar and storage plan for any country. Today it is only a "Members only / Speak to us"
placeholder; nothing sits behind it. On the main page it is shown as its own wide card above the
individual elements, under a line "Or explore the elements one at a time" - not as one more tile among the others.

- **TODO: make "Speak to us" a real link** (contact address or form) - none was given, so it is inert for now.
- **Vision (Andrew, 2026-10-19):** the Planner is the *unifying* tool. Eventually a user explores every element of the
  playbook in one place, or picks individual elements. So it is built from modules (Deployment, Policy, Future Grid,
  Economics, Homes), each usable alone or combined around one country, and the combined output is one plan.
- **TODO (agreed 2026-10-19): answer these before building the planner** -
  1. **Who is the main user?** A government / policy team, a developer or investor, or a utility? It decides what the
     summary page leads with.
  2. **What is a "plan"?** A report to read, a set of recommendations, or a scenario people can adjust? Start with the
     report.
  3. **Embed or link?** Show each tool's views inside one Planner page, or link out to each tool with the country
     carried across? Embedding feels more unified but is more work.
- **TODO (agreed 2026-10-19): build order.** (a) Agree the module contract: what a module takes in (a country, a
  scenario) and returns (headline figures, an on-screen panel, report pages). (b) Planner shell: country picker, element
  picker (all, or just some), members-only gate, embedding the existing views. (c) Combined report: the selected
  modules' report pages under a short summary page, on the shared PDF engine (`shared/pdf/`). (d) The optimisation layer
  across modules - last, once there is something to optimise across.
- **TODO: design and build the planner itself.** Open questions: what it optimises (cost, emissions, security of
  supply, policy readiness), which inputs it takes from each tool, what a "plan" contains, and how it is gated once
  real login exists (today's member gate is a shared client-side password - see `shared/lib/membership.ts`).
