# Solar Policy Explorer

A web platform for scoring electricity policy against the Electric Protocol: a world map coloured by score, a per-country questionnaire with
sources, a ranked list of the highest-impact changes each country could make,
and a scoreboard.

Built on the same foundations as `gridsim-frontend` - React 19 + TypeScript +
Vite, MUI 7 with the GSC theme and Eastman Grotesque, MapLibre via
`react-map-gl`, Zustand for state, GitHub Pages for deploys.

## Site structure

The built site has two HTML entries, not one - see `vite.config.ts`'s
`build.rollupOptions.input`:

- **`/`** - `index.html` at the repo root is a static, unbundled splash page
  (the "Electric Futures Playbook") linking out to this app and to the
  sibling `gridsim-frontend` site. It has no JS bundle of its own; its fonts
  and favicon live in `public/`.
- **`/policy/`** - `policy/index.html` is the actual React app's entry point
  (mounts `src/main.tsx`, same as any normal Vite SPA). Everything else in
  this README describes what lives here.

Both entries share the same `base` (see Deployment below), so asset URLs
resolve correctly under either the GitHub Pages subpath or a custom domain
regardless of which entry references them.

Two URL params the app itself understands, both meant for links coming from
the playbook splash: `?skipIntro=1` marks the onboarding tour as already seen
(skips straight to the app), `?showTour=1` forces the tour open even for a
returning visitor. Both strip themselves from the URL after taking effect -
see the two mount-time effects near the top of `App.tsx`.

## Running it

```sh
npm install
npm run dev
```

`.env.dev` / `.env.prod` need `VITE_MAPTILER_KEY`. They are gitignored; copy the
key across when setting up a new machine.

```sh
npm test              # scoring tests
npm run build:dev     # typecheck + production build
npm run import:xlsx   # regenerate seed data from the spreadsheet
npm run build:geometry    # regenerate map geometry from Natural Earth
npm run build:indicators  # regenerate World Bank indicator answers
```

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow typechecks and runs the tests
before building, so a failing test blocks the deploy.

Two pieces of setup are needed once, in the repository settings:

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → new repository secret
   `VITE_MAPTILER_KEY`.**

The key is compiled into the client bundle and is therefore readable by anyone
who views the site - that is inherent to a browser-based map, not a mistake.
Restrict it by domain in the MapTiler console (the Pages origin plus
`localhost` for development), and use a key dedicated to this project so that
revoking it never affects anything else.

`VITE_BASE` sets the asset path prefix. The workflow derives it from the
repository name, because a GitHub Pages project site is served from a subpath.
Pointing a custom domain at the site later means setting `VITE_BASE=/` rather
than changing any code.

## How data gets updated

The shared dataset lives in git: `protocol.seed.json`, `sourced-answers.json`,
`indicator-answers.json` and `jurisdictions.json`. **The only way to change what
everyone sees is a commit to this repository** - there is no backend and nothing
the site can write to.

Anything a visitor does in the browser - answering a question, editing one as
admin - is written to their own `localStorage` and goes no further. On the next
load, current git data is rebuilt from the JSON files and their local edits are
layered back on top, so a data push reaches every visitor without discarding
their work. Clearing site data resets them to the shared dataset.

## Where the data comes from

`Electric Protocol - Policy Map - v2.xlsx` (in the parent directory) is a
**one-time import**, not a live source. `npm run import:xlsx` regenerates
`src/data/protocol.seed.json` from it.

The spreadsheet layout the importer expects:

| Location | Meaning |
| --- | --- |
| col B | question text, or a section heading when the cell is filled orange |
| col C | scoring rubric, newline separated, `<score> = <description>` |
| col D | impact weighting (1 low, 2 medium, 3 high) |
| row 8, col F onwards | one column per country |
| rows 6–7 | completeness and score formulas - recomputed in the app, not imported |

The importer corrects two defects in the source sheet and reports each one it
applies. Both corrections live in the script; the spreadsheet is left alone.

1. **Rows 26–33** had their first rubric tier mislabelled with an incrementing
   counter (`1 =`, `2 =` … `8 =`) instead of `0 =`, apparently from a fill-down.
   All eight are renumbered to 0/1/2.
2. **Row 44** duplicated row 24 word for word at a different weight (2 vs 0.3).
   Row 44 is dropped; row 24 is authoritative.

A third, smaller inconsistency is handled silently: row 10 separates its middle
tier with `-` rather than `=`, so the tier parser accepts either.

That leaves **39 questions across 9 sections, total weight 65**, with New
Zealand (35 answered) and Great Britain (39 answered) seeded from the sheet.

## Jurisdictions and the map

The map is built from Natural Earth boundaries by `npm run build:geometry`
(`scripts/build_geometry.py`), which writes two files:

- `src/assets/jurisdictions.geojson` - the shapes, each carrying one `code`
- `src/data/jurisdictions.json` - a lightweight index of code, name, level and
  parent, so nothing has to parse 2.4MB of geometry to resolve a name

A `code` is either **ISO 3166-1 alpha-2** for a country (`DE`, `GB`) or **ISO
3166-2** for a subnational jurisdiction (`AU-SA`, `US-CA`). Countries listed in
`SUBDIVIDED` are drawn as their states instead of as one shape, so a country is
never painted on top of its own states. Australia and the United States are
subdivided today.

This replaced the grid-level `world.geojson` inherited from GridSim, which split
countries by balancing authority - Malaysia in two, the US into 55 BAs. Correct
for a grid simulator, wrong for a policy map.

### Overseas exclaves

Separately from full subdivision, a handful of countries carry a distant,
disjoint overseas territory attached to their main polygon - clicking French
Guiana used to select "FR" and show metropolitan France's directive-baseline EU
answers, none of which apply to an isolated grid outside the European
synchronous system. `EXCLAVES` in `build_geometry.py` pulls these out into
their own mappable jurisdictions (`FR-GF`, `FR-GP`, `FR-MQ`, `FR-RE`, `FR-YT`)
by testing each polygon part's centroid against a bounding box, while "FR"
keeps its own shape and still means metropolitan France specifically.

This is a different case from full subdivision and the two must not be
confused: Australia has no "AU" shape and every answer written against it has
to be pushed down to its states, but France still has an "FR" shape and an
answer written against it must stay there. `isSubdivided` and `resolveTargets`
key off `mappable`, not off "has children" - France now has children (its five
exclaves) without being subdivided. Natural Earth's admin-0 layer shows the
same attached-territory shape for Norway (Svalbard), the Netherlands (the
Caribbean municipalities) and Chile (Easter Island), none of which are split
yet.

### Answer inheritance

An answer can be written against a country, a named group, or one exact
jurisdiction. More specific always wins:

| Written against | Applies to | Precedence |
| --- | --- | --- |
| a country (`AU`) | every state of it | lowest |
| a group (`NEM`, `EU27`) | the group's members | middle |
| one jurisdiction (`AU-SA`) | itself | highest |

Australia shows why this matters. Federal rules - SRES, customs, AS/NZS 4777.2 - are written against `AU` and inherited by all eight states, and inherited
answers say so in the note. National Electricity Market rules are written
against the `NEM` group, so Western Australia and the Northern Territory
correctly do not receive them. And row 47 is written against `AU-SA`, because
South Australia has run at negative operational demand while Australia as a
whole has not - so SA scores 81.8% against 77.1% for the other NEM states.

Groups are defined in `sourced-answers.json`; membership is a policy judgement,
not geography, which is why it is hand-maintained rather than generated.

## Researched answers

`src/data/sourced-answers.json` holds answers researched outside the
spreadsheet. Entries are keyed by **spreadsheet row**, not question id, so any
one of them can be checked against the sheet directly. Every entry must cite a
source; nothing is scored on inference.

Each answer declares a `basis`, surfaced as a chip in the UI. Where two answers
cover the same jurisdiction and question at the same specificity, the stronger
basis wins:

- **`national`** - evidence specific to that country (a national rule, regulator
  determination or scheme document). Strongest.
- **`directive-baseline`** - an EU instrument creates the right, but this
  country's transposition has not been individually verified. The note field
  says so on every such answer.
- **`proxy-indicator`** - derived from a cross-country statistic rather than a
  policy document. Weakest, and always overridden by a researched answer.

### Indicator answers

`src/data/indicator-answers.json` is **generated** by `npm run build:indicators`
(`scripts/build_indicator_answers.py`) - do not edit it by hand.

Some questions ask something numeric that a single comparable dataset answers
for every country at once, far more cheaply than researching each jurisdiction.
Row 12, "cost of finance at rates to scale technology", has a rubric of explicit
interest-rate bands, so the World Bank's lending interest rate (`FR.INR.LEND`)
scores it directly for **148 countries** in one pass.

These carry `proxy-indicator` because a general commercial lending rate is not
evidence about consumer energy finance specifically: a country with a subsidised
green-loan scheme may do better for CERs than its headline rate suggests. The
note says so on every generated answer, and any hand-written national answer
replaces it automatically.

Answers may target an explicit `countries` list or a named `group` (currently
`EU27`). Scores are chosen conservatively: where a directive's effect depends on
national implementation detail - Article 11 dynamic pricing requires a smart
meter, for instance - the answer is scored 1 rather than 2.

Current coverage - 1,082 answers across 223 jurisdictions, 14 of them ranked:

| Scope | Questions | Completeness | Score | Ranked |
| --- | --- | --- | --- | --- |
| Australian states (NEM) | 17 / 39 | 49.1% | 77–82% | yes |
| Western Australia, NT | 12 / 39 | 41.5% | 77.8% | yes |
| Germany | 15 / 39 | 43.5% | 85.3% | yes |
| New York, Hawaii, Massachusetts | 13–14 / 39 | 42.5% | 55–61% | yes |
| Italy | 14 / 39 | 42.0% | 84.8% | yes |
| California | 12 / 39 | 41.5% | 59.3% | yes |
| Spain | 14 / 39 | 38.9% | 75.7% | no |
| Texas | 11 / 39 | 38.5% | 50.0% | no |
| France, Netherlands, Poland | 13 / 39 | 37.4% | 71–83% | no |
| Other EU-27 | 11–12 / 39 | 29.7–34.3% | ~84% | no |
| Other US states | 9 / 39 | 32.3% | ~53% | no |
| India, Sri Lanka, Bangladesh, Pakistan | 2–4 / 39 | 8–15% | - | no |
| Rest of world (lending rate only) | 1 / 39 | 4.6% | - | no |

The EU-27 and most US states sit under the 40% threshold, so they appear grey
and unranked.

Read these scores with the completeness column, not on their own. The questions
answerable from EU-level instruments are disproportionately the ones Europe
scores well on, which is why the EU reads highest of all on the thinnest
evidence. Australia's remaining 22 questions are concentrated in the
ancillary-services block where it would not score full marks. California's lower
figure is the most honest of the set, because two of its federal answers are
zeros - border tariffs and the terminated residential tax credit.

**Australia** is scored through its states. Most of what is answerable is
Commonwealth-level - SRES, AS/NZS 4777.2, SAA accreditation, customs - but row
47 shows why states matter: South Australia has run at negative operational
demand while the NEM-wide distributed share is far lower.

**The United States** has a federal layer inherited by all 51 states (FERC Order
2222, IEEE 1547/UL 1741, AD/CVD tariffs, the post-OBBBA loss of section 25D),
with California, New York, Hawaii, Massachusetts and Texas overriding it. Four
of those five clear the threshold; Texas does not, and is the lowest-scoring
ranked-adjacent jurisdiction in the set - no statewide net metering, no
hosting-capacity mandate, and DER aggregation still confined to the ERCOT ADER
pilot.

Answers may target an explicit `countries` list or a named `group` (`EU27`,
`NEM`, `WEM`).

## How scoring works

```
score        = Σ(weight × answer) ÷ (Σ weight over answered questions × 2)
completeness = Σ weight over answered questions ÷ Σ weight over all questions
```

The spreadsheet divides by the weight of *every* question, which treats an
unanswered question as a zero - that is why it reports NZ at 50.2% against GB's
68.9% despite NZ having answered almost everything. Normalising over answered
weight instead gives NZ 54.2%, and completeness is reported alongside the score
so a thinly-evidenced number can be read as such.

Countries below **40% completeness** are not ranked on the scoreboard and are
drawn in grey on the map rather than coloured, so a country with two confident
answers cannot top the board.

**Highest-impact changes** rank every question not already at full marks by
`weight × (2 − current answer)`. Unanswered questions are included, since an
unknown is as much of an opportunity as a known zero.

## Editing and the Admin console

There is no authentication - the padlock button in the nav opens the Admin
console for anyone. It's a stand-in for auth rather than a real gate: it lets
add/edit/delete on questions, weights and rubric wording, and it's where
suggestions get reviewed (below). There is no separate "Registered" role or
role toggle any more; the app just has questions anyone can answer and an
Admin console anyone can open.

A country's own page is read-only until its **Edit** button (top right of the
panel) is clicked - rubric tiles, evidence fields and the clear-response
control all gate on this. It resets to read-only on every jurisdiction
switch, so browsing a new country never silently inherits an edit session
left open on the last one.

Editing itself is still live and immediate, not held back for approval - what
*is* held back is attribution and review. **Submit revised evidence** (in the
section rail, once something has actually changed this session) bundles
every edit made to that country since its page was opened into one
`Suggestion` (`src/lib/suggestions.ts`), asks for the submitter's name and
organisation, and files it under Admin console → Suggestions. An admin
Accepts it (no-op - the data's already live) or Rejects it, which reverts
exactly the responses that suggestion touched back to their pre-edit
baseline, nothing more. This only lives in the submitter's own browser today
- there's no backend to make a suggestion visible to anyone else's browser
yet, tracked as a known gap rather than a bug.

State persists to `localStorage` behind the actions in
`src/stores/protocolStore.ts`. Nothing above that layer knows where data lives,
so adding a real backend means reimplementing those actions and leaving the
components alone.

**Only user-authored state is persisted** - admin edits to questions, answers
someone typed, submitted suggestions, and small preferences like the
light/dark toggle (see Dark mode below). Seeded answers are derived from
`protocol.seed.json` and `sourced-answers.json` and are rebuilt on every load.
Persisting them meant a cached copy shadowed later data updates, so newly
researched jurisdictions did not appear until the store version was bumped by
hand. Adding data to the JSON files is now sufficient on its own; `version`
only needs bumping when the *shape* of stored state changes.
`protocolStore.test.ts` locks this in.

## Dark mode

`src/mui-theme.tsx` exports `getTheme(mode)`, not a single static theme -
brand hues (aqua, citrus, teal, orange) stay the same in both modes; only
neutrals (backgrounds, text, dividers, and every literal colour baked into
the MUI component overrides) flip. `main.tsx` mounts a small `ThemedApp` that
reads `mode` from the store and rebuilds the theme via `useMemo` when it
changes; the toggle itself is the sun/moon icon in the nav.

The live map gets its own dark variant too - `src/assets/map_gsc_dark.json`
is a transformed copy of the base MapTiler style (`map_gsc.json`: dark
background/water, light label text, dark label halos), picked by
`PolicyMap.tsx` based on `theme.palette.mode`. The country-score choropleth
colours themselves (`SCORE_RAMP`) are unchanged in both modes, since that's
the actual data being visualised, not UI chrome.

## Layout

```
index.html               root entry - the static playbook splash, no bundle
policy/index.html         app entry - mounts src/main.tsx
public/fonts/, favicon.png   assets both entries reference by root-absolute path
src/
  main.tsx               mounts ThemedApp (theme + store wiring) -> App
  mui-theme.tsx           getTheme(mode) - see Dark mode above
  scrollstory/            the scroll-driven onboarding tour (ScrollStory, scenes.ts)
  lib/scoring.ts          score, completeness and impact ranking (+ tests)
  lib/types.ts            shared domain types
  lib/suggestions.ts       Suggestion diffing - see Editing and the Admin console
  stores/protocolStore.ts   all mutable state and every mutation
  components/map/         PolicyMap choropleth + legend (light/dark map styles)
  components/layout/      TopNavbar, Scoreboard, CountryPanel, ImpactList, AdminConsole
  data/protocol.seed.json   generated - edit the importer, not this file
scripts/import_xlsx.py    the one-time spreadsheet import
```

`src/assets/world.geojson` comes from GridSim and is grid-level, so a country
can be several features (Malaysia is split into peninsular and Borneo).
Promoting `country_iso2` as the feature id means one score colours every piece
of a country at once.
