# Electric Protocol — Policy Map

A web platform for scoring national electricity policy against the Electric
Protocol: a world map coloured by score, a per-country questionnaire with
sources, a ranked list of the highest-impact changes each country could make,
and a scoreboard.

Built on the same foundations as `gridsim-frontend` — React 19 + TypeScript +
Vite, MUI 7 with the GSC theme and Eastman Grotesque, MapLibre via
`react-map-gl`, Zustand for state, Firebase Hosting for deploys.

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
who views the site — that is inherent to a browser-based map, not a mistake.
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
everyone sees is a commit to this repository** — there is no backend and nothing
the site can write to.

Anything a visitor does in the browser — answering a question, editing one as
admin — is written to their own `localStorage` and goes no further. On the next
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
| rows 6–7 | completeness and score formulas — recomputed in the app, not imported |

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

- `src/assets/jurisdictions.geojson` — the shapes, each carrying one `code`
- `src/data/jurisdictions.json` — a lightweight index of code, name, level and
  parent, so nothing has to parse 2.4MB of geometry to resolve a name

A `code` is either **ISO 3166-1 alpha-2** for a country (`DE`, `GB`) or **ISO
3166-2** for a subnational jurisdiction (`AU-SA`, `US-CA`). Countries listed in
`SUBDIVIDED` are drawn as their states instead of as one shape, so a country is
never painted on top of its own states. Australia and the United States are
subdivided today.

This replaced the grid-level `world.geojson` inherited from GridSim, which split
countries by balancing authority — Malaysia in two, the US into 55 BAs. Correct
for a grid simulator, wrong for a policy map.

### Answer inheritance

An answer can be written against a country, a named group, or one exact
jurisdiction. More specific always wins:

| Written against | Applies to | Precedence |
| --- | --- | --- |
| a country (`AU`) | every state of it | lowest |
| a group (`NEM`, `EU27`) | the group's members | middle |
| one jurisdiction (`AU-SA`) | itself | highest |

Australia shows why this matters. Federal rules — SRES, customs, AS/NZS 4777.2 —
are written against `AU` and inherited by all eight states, and inherited
answers say so in the note. National Electricity Market rules are written
against the `NEM` group, so Western Australia and the Northern Territory
correctly do not receive them. And row 47 is written against `AU-SA`, because
South Australia has run at negative operational demand while Australia as a
whole has not — so SA scores 81.8% against 77.1% for the other NEM states.

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

- **`national`** — evidence specific to that country (a national rule, regulator
  determination or scheme document). Strongest.
- **`directive-baseline`** — an EU instrument creates the right, but this
  country's transposition has not been individually verified. The note field
  says so on every such answer.
- **`proxy-indicator`** — derived from a cross-country statistic rather than a
  policy document. Weakest, and always overridden by a researched answer.

### Indicator answers

`src/data/indicator-answers.json` is **generated** by `npm run build:indicators`
(`scripts/build_indicator_answers.py`) — do not edit it by hand.

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
national implementation detail — Article 11 dynamic pricing requires a smart
meter, for instance — the answer is scored 1 rather than 2.

Current coverage — 1,082 answers across 223 jurisdictions, 14 of them ranked:

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
| India, Sri Lanka, Bangladesh, Pakistan | 2–4 / 39 | 8–15% | — | no |
| Rest of world (lending rate only) | 1 / 39 | 4.6% | — | no |

The EU-27 and most US states sit under the 40% threshold, so they appear grey
and unranked.

Read these scores with the completeness column, not on their own. The questions
answerable from EU-level instruments are disproportionately the ones Europe
scores well on, which is why the EU reads highest of all on the thinnest
evidence. Australia's remaining 22 questions are concentrated in the
ancillary-services block where it would not score full marks. California's lower
figure is the most honest of the set, because two of its federal answers are
zeros — border tariffs and the terminated residential tax credit.

**Australia** is scored through its states. Most of what is answerable is
Commonwealth-level — SRES, AS/NZS 4777.2, SAA accreditation, customs — but row
47 shows why states matter: South Australia has run at negative operational
demand while the NEM-wide distributed share is far lower.

**The United States** has a federal layer inherited by all 51 states (FERC Order
2222, IEEE 1547/UL 1741, AD/CVD tariffs, the post-OBBBA loss of section 25D),
with California, New York, Hawaii, Massachusetts and Texas overriding it. Four
of those five clear the threshold; Texas does not, and is the lowest-scoring
ranked-adjacent jurisdiction in the set — no statewide net metering, no
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
unanswered question as a zero — that is why it reports NZ at 50.2% against GB's
68.9% despite NZ having answered almost everything. Normalising over answered
weight instead gives NZ 54.2%, and completeness is reported alongside the score
so a thinly-evidenced number can be read as such.

Countries below **40% completeness** are not ranked on the scoreboard and are
drawn in grey on the map rather than coloured, so a country with two confident
answers cannot top the board.

**Highest-impact changes** rank every question not already at full marks by
`weight × (2 − current answer)`. Unanswered questions are included, since an
unknown is as much of an opportunity as a known zero.

## Roles

There is no authentication yet. The navbar toggles between:

- **Registered** — answer questions, attach sources and notes.
- **Admin** — the above, plus add/edit/delete questions, edit weights and
  rubric wording, and clear any response.

State persists to `localStorage` behind the actions in
`src/stores/protocolStore.ts`. Nothing above that layer knows where data lives,
so adding Firestore means reimplementing those actions and leaving the
components alone.

**Only user-authored state is persisted** — role, admin edits to questions, and
answers someone typed. Seeded answers are derived from `protocol.seed.json` and
`sourced-answers.json` and are rebuilt on every load. Persisting them meant a
cached copy shadowed later data updates, so newly researched jurisdictions did
not appear until the store version was bumped by hand. Adding data to the JSON
files is now sufficient on its own; `version` only needs bumping when the
*shape* of stored state changes. `protocolStore.test.ts` locks this in.

## Layout

```
src/
  lib/scoring.ts        score, completeness and impact ranking (+ tests)
  lib/types.ts          shared domain types
  stores/protocolStore.ts   all mutable state and every mutation
  components/map/       PolicyMap choropleth + legend
  components/layout/    TopNavbar, Scoreboard, CountryPanel, ImpactList
  data/protocol.seed.json   generated — edit the importer, not this file
scripts/import_xlsx.py  the one-time spreadsheet import
```

`src/assets/world.geojson` comes from GridSim and is grid-level, so a country
can be several features (Malaysia is split into peninsular and Borneo).
Promoting `country_iso2` as the feature id means one score colours every piece
of a country at once.
