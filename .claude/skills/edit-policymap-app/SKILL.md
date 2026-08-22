---
name: edit-policymap-app
description: Use when making code changes to the Solar Policy Wiki app (ep_policymap) - UI components, the Zustand store, the map, scoring logic, or the geometry/import build scripts. Covers the verification workflow, the store's persistence contract, the jurisdiction model, and house style rules (no em dashes, no CER/CP acronyms) that are easy to violate by accident.
---

# Editing the Solar Policy Wiki app

This is a React 19 + TypeScript + Vite app (MUI 7, Zustand, MapLibre via
react-map-gl) that scores countries and states against the Electric Protocol.
No backend - the shared dataset is JSON files in git; a visitor's own answers
live in their browser's localStorage only.

## Before you start

Read `README.md` in the repo root. It documents the data model, the
inheritance rules, the scoring formula and the deployment setup in more detail
than is worth repeating here. This skill covers the things that are easy to
get wrong even after reading it.

## Verification - run all three after every change

```sh
npx tsc -b        # typecheck
npx vitest run    # 28 tests as of writing
npm run build:dev # production build, catches anything the other two miss
```

All three must be clean before considering a change done. `npm run build:dev`
has caught things `tsc -b` alone missed (stale tsconfig excludes, unused
imports in files outside the default include path) - do not skip it as
redundant with typecheck.

## The store's persistence contract - the single most important rule here

`src/stores/protocolStore.ts` uses Zustand's `persist` middleware with a
**strict split**: `partialize` writes only `role`, `threshold`, `mapMetric`,
`sections`, `questions`, and `responses.filter(r => !r.seeded)` to
localStorage. Seeded answers (from `protocol.seed.json`, `sourced-answers.json`,
`indicator-answers.json`) are **never persisted** - they are rebuilt fresh from
the JSON files on every load via `merge`.

**Why this matters**: earlier in this project's history, seeded answers were
persisted like everything else. Every time new research was added to the data
files, visitors with a cached copy in localStorage would see the *old* data
shadowing the new - Australia, then newly-added US states and South Asian
countries, went blank or stale for real users. This was fixed once by bumping
a `version` number (fragile - depends on remembering to bump it every time
data changes) and properly by excluding seeded data from persistence entirely
(robust - works automatically).

**If you add a new field to `ProtocolState`**: decide immediately whether it
is user-authored (persist it, add to `partialize`) or derived from the JSON
data files (do not persist it - it will be rebuilt from source on load).
Getting this wrong reintroduces the stale-cache bug.

**If you change the *shape* of persisted state** (rename a field, change what
a section id means, restructure `Question`): bump `version` and write a
`migrate` function that salvages user-entered data and discards the rest.
Recent precedent: `version: 5` when section ids changed after stripping the
"Electric Protocol" prefix from headings; `version: 6` when the default
completeness threshold changed from 40% to 30%. Comment *why* next to the
version number, the same way the existing history does - a future reader (you,
in six months) needs the reason, not just the number.

## The jurisdiction model

`src/lib/jurisdictions.ts` distinguishes two things that look similar but are
not:

- **`isSubdivided(code)`**: true only when the country has **no shape of its
  own** on the map - Australia, the US, Canada. Every answer written against
  the country code must be pushed down to its children via `resolveTargets`.
- **A country with children that is *not* subdivided**: France, after its
  overseas exclaves (French Guiana, Guadeloupe, Martinique, Réunion, Mayotte)
  were split out into their own mappable jurisdictions. France still has an
  "FR" shape and answers written against "FR" must stay on "FR", not leak onto
  French Guiana.

This distinction is keyed off the `mappable` flag on each jurisdiction's index
entry (`src/data/jurisdictions.json`), not off "has children" - an earlier
version of `resolveTargets` used "has children" as the test and broke the
France case immediately (every EU answer written for France would have
silently applied to French Guiana instead). If you touch `resolveTargets`,
`isSubdivided`, or `childrenOf`, re-run `sourcedAnswers.test.ts` - it has a
regression test for exactly this.

**Building geometry**: `npm run build:geometry` runs `scripts/build_geometry.py`,
which fetches Natural Earth boundaries and writes `src/assets/jurisdictions.geojson`
(the shapes) and `src/data/jurisdictions.json` (a lightweight index). Two
mechanisms live there:

- `SUBDIVIDED` - countries drawn entirely as their subnational units.
- `EXCLAVES` - countries that keep their own shape but have a distant,
  disjoint overseas territory split out (classified by testing each polygon
  part's centroid against a bounding box). Currently only France. Natural
  Earth's admin-0 layer shows the same attached-territory shape for Norway
  (Svalbard), the Netherlands (Caribbean municipalities) and Chile (Easter
  Island) - not yet split; do the same treatment before writing
  jurisdiction-specific answers for any of them, or they will inherit answers
  meant for the mainland.

## Answer inheritance and precedence

`src/data/sourcedAnswers.ts` merges hand-written (`sourced-answers.json`) and
generated (`indicator-answers.json`) answers, resolving conflicts by:

1. **Specificity** - an exact jurisdiction beats a named group (`EU27`, `NEM`,
   `WEM`) beats a country-level answer pushed down to children.
2. **Evidence basis**, at equal specificity - `national` beats
   `directive-baseline` beats `proxy-indicator`.

If you add a new group or a new basis level, both dimensions need updating
together (`SPECIFICITY` and `BASIS_RANK` constants) or the merge silently
picks the wrong winner.

## House style - enforced, not just preferred

- **No em dashes anywhere in the repo** - code, comments, docs, data notes,
  UI copy. Use a spaced hyphen (` - `) instead. This was a deliberate,
  repo-wide cleanup; do not reintroduce the character in new writing.
- **No `CER`/`CERs`/`CP`/`CPs` acronyms** in anything user-facing or in
  research notes. Say "behind-the-meter technology" (CERs) and
  "customer"/"customers" (CP/CPs) instead - these are the app's own plain-
  language terms for the Charter's definitions. `scripts/_text.py` has a
  `humanize()` helper used by the generator scripts for this; if you write a
  new answer note by hand, apply the same substitutions yourself.
- Component comments should explain *why*, not *what* - the existing files are
  the reference for the level of comment density expected. Sparse, and only
  where the reasoning isn't obvious from reading the code.

## Component conventions worth matching

- **Map + sidebar layout** (`src/App.tsx`): the map is a flex sibling of the
  sidebar, not an overlay. Opening a country view or Settings resizes the map
  container, which needs an explicit `map.resize()` call inside a
  `ResizeObserver` - MapLibre does not pick this up automatically. See
  `PolicyMap.tsx` for the pattern if adding another sidebar view.
- **Settings and the country panel** are sidebar views, not full-screen
  takeovers - the map stays visible and clickable underneath. Follow this
  precedent rather than reaching for a modal or a full-page route for new
  full-panel content.
- **Tests read real data, not fixtures**, where practical -
  `sourcedAnswers.test.ts` and `boundsOf.test.ts` load the actual generated
  JSON/geometry files. This catches data-shape regressions that a synthetic
  fixture would miss (it caught the France bug above). Prefer this pattern for
  new tests over hand-rolled fixtures when the real data is small enough to
  load fast.
