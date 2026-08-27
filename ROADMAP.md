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
