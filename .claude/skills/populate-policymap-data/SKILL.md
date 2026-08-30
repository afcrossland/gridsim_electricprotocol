---
name: populate-policymap-data
description: Use when researching and adding policy answers to the Solar Policy Explorer (ep_policymap) - filling in a country/state/province against the Electric Protocol's 39 questions, or building a bulk data source. Covers the citation requirement, the rubric-matching rule, the specificity and evidence-basis system, and where to look for high-leverage sources.
---

# Populating Electric Protocol answers

The map's data is a scoring exercise against 39 questions across 9 sections,
weight 65 total. Every answer needs a real source - nothing is scored on
inference or plausibility.

## The non-negotiable rule: cite something real

Before writing a score, find and read an actual source - a law, a regulator
determination, a market operator's own documentation, or (as a fallback,
clearly marked) a secondary explainer site. Use WebSearch. A test in
`sourcedAnswers.test.ts` asserts every answer's `source` field contains a URL,
but that only catches a missing citation, not an invented one - the discipline
has to come from you, not the test suite.

**Verify current status, don't rely on memory.** Several answers in this
dataset exist specifically because a policy changed recently and memory would
have gotten it wrong: France's self-consumption subsidy was abolished in June
2026, Indonesia abolished net metering outright in 2024, Section 201 solar
tariffs expired in February 2026. Search with the current year.

## Where to add answers

**`src/data/sourced-answers.json`** - hand-written, the default place for
almost everything. Each answer needs:

```json
{
  "countries": ["DE"],        // or "group": "EU27" / "NEM" / "WEM"
  "row": 17,                  // spreadsheet row - see the row-to-topic table below
  "score": 2,                 // MUST exist in that row's rubric - see below
  "basis": "national",        // "national" | "directive-baseline" | "proxy-indicator"
  "sourceId": "de-eeg-fit",   // key into the "sources" map in the same file
  "note": "..."               // why this score, in plain language, no CER/CP/em dash
}
```

Add the citation once to the `sources` map (`title`, `url`, `quality`), then
reference it by `sourceId` from as many answers as apply - don't duplicate the
citation text.

**Set `quality` on every source you add.** `"primary-official"` means the
source *is* the regulator, market operator, statute text or other official
body's own material - it need not be a literal `.gov` domain (a market
operator like the Indian Energy Exchange counts). `"secondary"` means it
*describes* that material instead of being it - a news article, law firm
briefing or explainer site. Prefer a primary-official source when one exists;
use a secondary one only as the documented fallback in the rule above, and say
so in the note. This field is optional in the schema (existing sources from
before it existed are not backfilled), but every source you add from now on
should have it - `sourcedAnswers.test.ts` checks that wherever it is set, it
is one of these two values.

**`src/data/indicator-answers.json`** - generated, not hand-edited. Only for
questions with a rubric that maps onto a real cross-country statistical
indicator (currently: row 12, cost of finance, from the World Bank lending
rate). If a question is answerable from one dataset for many jurisdictions at
once, extend `scripts/build_indicator_answers.py` rather than writing
per-country entries by hand - see "Bulk sources" below.

## The rubric-matching rule

**A score must be one of the values the question's rubric actually defines.**
Not every question has a 0/1/2 ladder - some are binary (0/2 only, no middle
tier). Check before you write the score:

```sh
python3 -c "
import json
d = json.load(open('src/data/protocol.seed.json'))
q = [x for x in d['questions'] if x['sourceRow'] == 36][0]
print(q['text'])
print(q['rubric'])
"
```

This caught a real bug: row 36 ("no barriers to connecting for
self-consumption") is binary - 0 or 2, no middle ground - but an answer had
been written with score 1 for a country with capacity caps but no outright
ban. The test suite (`only uses scores that exist in the question's rubric`)
failed immediately. The fix was not to invent a fractional tier but to
recognise the rubric is genuinely binary and put the caveat in the `note`
field instead of forcing a score that doesn't exist.

## Specificity and evidence basis - how conflicts resolve

An answer can target a **country** (`"countries": ["AU"]`, inherited by every
state/province if the country is subdivided), a **named group**
(`"group": "EU27"`, `"NEM"`, `"WEM"` - defined in the same file's `groups`
map), or **one exact jurisdiction** (`"countries": ["AU-SA"]`). More specific
always wins over less specific.

At equal specificity, evidence basis breaks the tie: `national` > `directive-
baseline` > `proxy-indicator`. This is why a country-specific national answer
should always be added even when an EU directive or a World Bank indicator
already covers the question - it will automatically supersede the weaker
answer, and the weaker one still helps every EU country or every country
without a national answer.

**Groups are a judgement call, not a geography lookup** - if a policy area
divides differently than expected (National Electricity Market rules in
Australia apply to five states but not Western Australia or the Northern
Territory), define or use the group that matches, don't assume political
geography.

**Overseas exclaves don't inherit automatically.** France's overseas
territories (French Guiana, Guadeloupe, Martinique, Réunion, Mayotte) are
separate mappable jurisdictions precisely because their electricity
regulation differs from mainland France's - a `"countries": ["FR"]` answer
will not apply to them. If researching one, address it by its own code
(`FR-GF`, etc.), same as any other jurisdiction.

## `basis` values, precisely

- **`national`** - evidence specific to that jurisdiction: a law, regulator
  decision, market operator document. Use whenever you have it.
- **`directive-baseline`** - an EU directive/regulation creates the right, but
  you have not verified this specific member state's transposition. Score
  conservatively (often 1, not 2) when the directive's effect depends on
  national implementation detail that varies - e.g. EU dynamic-pricing rights
  require a smart meter, and rollout is uneven, so that answer is scored 1
  even though the directive itself is EU-wide.
- **`proxy-indicator`** - derived from a general statistical indicator, not a
  policy document (currently only the World Bank lending-rate answers for row
  12). Always the weakest basis, always overridden automatically by a
  `national` answer for the same jurisdiction and question.

## House style for notes

No em dashes (use ` - `), no `CER`/`CERs`/`CP`/`CPs` acronyms (say
"behind-the-meter technology" and "customer(s)"). Write the note so someone
can judge the score without reading the source: what the rule is, why this
score rather than one tier up or down, and any caveat (secondary source,
partial coverage, expiring soon).

## Bulk sources - worth far more than one-country-at-a-time research

The highest-leverage single addition in this project's history was the World
Bank lending-rate pipeline: one API call scored 148 countries on row 12 in one
pass, versus researching each individually. Look for the same opportunity
before doing per-country research:

**What worked**: World Bank Open Data API (`api.worldbank.org`) - genuinely
open, no key required, returns per-country values directly.

**What didn't work, and why it's worth knowing before trying again**:
- **DSIRE** (US state incentive database) - the real per-state data exists but
  the API returns 403 without a license key. Would need Andrew to request
  access; don't assume this is fixable by retrying or changing headers.
- **ACER/CEER retail market reports, ACEEE's state interconnection database** -
  both publish real findings but only as aggregate counts ("10 member states
  have X") or with data over 5 years stale, not attributable to named
  jurisdictions. Not usable as a per-country source no matter how the search
  is phrased.

The pattern: a source is only useful here if it names the jurisdiction and the
data is current. Aggregate statistics ("34 states have adopted X") read like
they'd save time but cannot actually be converted into per-jurisdiction
answers - confirm a source gives named, current, per-jurisdiction figures
before investing time extracting from it.

## Row-to-topic quick reference

Weight-3 (highest impact) rows: 10 (finance access), 11 (affordability - no
answers exist for this yet, needs a scoring methodology decided with Andrew
before starting), 12 (cost of finance), 36 (self-consumption barriers), 47
(system operator dispatch share), 52 (safety standards), 58 (training access).
Weight-0.3 rows 24-33 are the ancillary-services block - ten questions for
4.6% of total weight combined; low priority per question, deprioritise unless
doing a country you're already deep in.

Run this to see current coverage gaps by weight before choosing where to
research next:

```sh
cd ep_policymap && python3 -c "
import json
seed = json.load(open('src/data/protocol.seed.json'))
sourced = json.load(open('src/data/sourced-answers.json'))
indicator = json.load(open('src/data/indicator-answers.json'))
answered = {a['row'] for a in sourced['answers'] + indicator['answers']}
for q in seed['questions']:
    if q['sourceRow'] not in answered:
        print(f\"row {q['sourceRow']:2d}  w{q['weight']:<4}  {q['text'][:60]}\")
"
```

## After adding answers

Run the verification workflow from `edit-policymap-app` (tsc, vitest, build).
If you added answers for a new jurisdiction, spot-check its resulting score
and completeness make sense:

```sh
cd ep_policymap && python3 -c "
import json
seed = json.load(open('src/data/protocol.seed.json'))
# ... or just run the app and check the country panel directly
"
```
