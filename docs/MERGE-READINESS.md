# Merge-Readiness Pack — CineRank

Module 16's standard: five criteria, each with explicit evidence. **Satisfy all
five and the work is merge-ready; fail one and it is not, however correct it
appears.**

## Verdict as of 2026-09-14

**MERGE-READY. All five criteria are met.**

| # | Criterion | Status |
|---|---|---|
| 1 | Functional completeness, shown end to end | **Met** (2026-09-14) |
| 2 | Sound verification that probes real behaviour | **Met** |
| 3 | SE hygiene: static analysis, linting, complexity | **Met** |
| 4 | Rationale and communication | **Met** |
| 5 | Full auditability | **Met** |

**This is the first time this document has read merge-ready, and the sequence
matters more than the verdict.** It was written on 2026-09-13 and immediately
failed its own first criterion — at a point when the application was deployed,
working, and covered by a green test suite. By the usual informal reading it
looked finished. Criterion 1 is the one that refuses that reading, and holding it
open for a day produced twenty-six captures, two evidence documents, three real
defects and three untested happy paths.

**A standard that had passed on the first attempt would have been worth nothing.**

## 1. Functional completeness — MET

*Shown by end-to-end results, not by passing tests alone.*

### What changed on 2026-09-13

This criterion had two blockers that morning. **Both are now closed** — the
larger one on 2026-09-13, the second the following day.

* **All sixteen resilience states are captured** — twenty-four frames, since eight
  states split their claim between the page and the audit trail. They are
  embedded and analysed in [`RESILIENCE.md`](RESILIENCE.md), grouped by which
  dependency failed and each measured against a stated definition of "graceful".
* **`SPEC.md` § 7.1 has been walked end to end** and written up in
  [`ACCEPTANCE.md`](ACCEPTANCE.md): all eight criteria, evidence classified by
  strength, every one reading a clean `yes`.
* **Thirty-seven captures now exist**, indexed in `docs/screenshots/README.md`.
  Beyond the resilience set: five frames of a real prompt-injection attempt with
  both AI features resisting it, five tied to specific acceptance criteria, and
  three product shots embedded in the README. (Counts drift; the index is the
  authority.)
* **The demo seed list is loaded**, so the deployed app is in the state the
  evidence describes rather than empty.

**Assembling that evidence found three untested happy paths and three real
defects.** That is the return on this criterion existing at all, and it is worth
stating precisely because passing tests had not revealed any of them:

| Found | How |
|---|---|
| A failed verdict logged against a model it never called | reading a log screenshot taken for something else |
| "Get recommendations" fully enabled above a list that had failed to load | shooting the database-down state |
| The verdict placeholder never retiring on that same failure | the same frame |
| Search returning results — untested | walking criterion 1 |
| Deleting a film — **zero** coverage | walking criterion 3 |
| A verdict being logged on success — untested | walking criterion 6 |

Every one of those six was invisible to the tests, the linter and the render
audits, because each of those inspects **structure** and none of them puts the
application into a state and looks at it.

### How it closed

**`SPEC.md` § 7.1’s eight acceptance boxes were ticked by the authors on
2026-09-14**, against the evidence assembled in
[`ACCEPTANCE.md`](ACCEPTANCE.md).

**That division of labour is the point, not a formality.** The agent gathered the
material, classified it by strength, and stopped there — because ticking an
acceptance criterion is a claim that it was verified *for submission*, and that
claim belongs to the people submitting. A document cannot sign for them, and an
agent marking its own homework as accepted would make the whole exercise
circular.

**Two submission items sat outside this criterion** and were tracked in
`CLAUDE.md` rather than here: putting the live URL on the project sheet, and the
joint-project registration email. **Both were completed on 2026-09-14.** They are
recorded separately because they are administration rather than functional
completeness, and conflating the two would have let a clerical task masquerade as
an engineering one — in either direction.

**This criterion is the pre-submission blocker list in `CLAUDE.md`.** It is not
separately tracked here, because a checklist held in two places drifts.
## 2. Sound verification — MET

*A test plan that probes real behaviour.*

`npm test` runs 60 tests on the Node built-in runner: pure helpers, the prompt
loader, and route-level behaviour with Supabase swapped for an in-memory fake and
TMDB and OpenRouter stubbed, so the suite never touches live data.

**What makes this criterion met is not the count.** Module 13 names three ways
verification fails while looking rigorous, and each is answered concretely:

* **Self-confirming tests** — the recommendation service's three filter rules were
  each deleted in turn, and every deletion fails exactly the tests that claim to
  cover it. A test that does not fail when you break the thing it tests is not a
  test. The same probing was done for R23's log-advertisement invariant (three
  ways) and R5's dual-failure stderr sink (both ways).
  **Three more tests were added on 2026-09-13 while walking § 7.1, and each was
  probed the same way**: the search happy path (break the poster guard, then the
  year conversion), `DELETE` (drop the error guard so a failed delete answers a
  false 204), and the verdict's success log row (make it ignore OpenRouter's
  reported cost). Every probe failed exactly the intended test and nothing else.
* **Verification theatre** — the markdown checker was proved in *both*
  directions across 57 cases, 26 that must fail and 31 that must pass. The
  must-pass half is the half that matters; a checker that fires on valid input
  gets switched off within a week.
* **Gate bypass under deadline pressure** — the gates are wired into the commit
  rules in `CLAUDE.md` rather than left to memory, and one of them
  (`check-markdown`) exists precisely because a class of defect had been slipping
  past human review for weeks.

**One honest limitation, stated rather than papered over.** The client has no
automated test harness. Client behaviour is verified by reading, by hand testing,
and by a console debug harness that fakes a recommendation response so UI work
costs no OpenRouter credit. Several client-side findings in this project were
caught by the author with a screenshot and not by any tool — that is recorded in
the decision log where it happened rather than smoothed over.

## 3. SE hygiene — MET as of 2026-09-13

*Evidenced by static analysis, linting, and complexity checks.*

**This criterion was the one genuine hole, and it was closed by measuring rather
than by declaring.** There was no linter in the project until 2026-09-13.

`npm run lint` runs ESLint 9 over all 23 JavaScript files (6,101 lines) across
three environments — Node ES modules, the browser ES module, and the one browser
*classic* script that `index.html` loads with a bare tag. **Current state: zero
errors.**

**The config is deliberately not a style linter**, and `eslint.config.js` says so
at the top. Formatting rules are left out entirely: this codebase was written
under one consistent set of conventions, so reformatting it would produce a large
diff that proves nothing and buries the history the repository exists to show.
What is enabled is the set of rules that can catch a *defect* — unused bindings,
shadowing, unreachable code, duplicate keys and imports, self-comparison,
unmodified loop conditions, atomic-update races — plus complexity ceilings.

**The first run found five errors, and the triage is the evidence, not the
count:**

* A duplicated `node:path` import in `scripts/check-markdown.js` — real, fixed.
* Two `let` bindings never reassigned, in the two `tidy*` helpers — real, fixed.
* **A dead `eslint-disable` directive in `server/index.js`** that had been written
  speculatively, before the project had a linter at all, to suppress a warning
  that the eventual config does not produce. A suppression that suppresses nothing
  still tells a reader that a problem exists. Removed.
* Two `require-atomic-updates` reports, both **investigated and confirmed false
  positives**, both suppressed in place with a comment explaining why rather than
  by switching the rule off globally. The rule fires on any property write to an
  outer-scope object after an `await`; in one case the object is a `const` object
  literal declared once and never reassigned (checked, not assumed), and in the
  other the save-replace-restore pattern it flags *is* the helper's whole purpose.

**Then the linter caught a mistake in the fix itself**, which is the best possible
argument for having one: both suppression comments were written with the
`eslint-disable-next-line` directive at the *top* of the explanation block, so the
"next line" was another comment and the directive did nothing. ESLint reported
both as unused directives and the real errors as still open. Repositioned.

### Complexity: measured, reported, and deliberately not refactored

Five functions exceed the ceiling of 20 and are reported as warnings on every run:

| Function | Complexity |
|---|---|
| `generateRecommendations` (`server/services/recommendations.js`) | 30 |
| the per-line rule engine (`scripts/check-markdown.js`) | 29 |
| the `PATCH` handler (`server/routes/movies.js`) | 24 |
| `chat` (`server/services/openrouter.js`) | 22 |
| `generateTasteVerdict` (`server/services/tasteVerdict.js`) | 21 |

**They are left as they are, and the reason is not deadline pressure.** In
`generateRecommendations` the branches *are* the feature: each `continue` guard
and each tally arm exists because of a specific documented finding — the owned
filter that was reading only rated films (R2), the verification fallback that was
overclaimed and then measured (R6/D-054), and the five distinct reasons a run can
come back empty, one of which was reported to the user as a different reason
entirely until it was fixed (R28). Extracting them into helpers would lower the
number without removing a single branch, which is metric-gaming rather than
simplification — the hygiene equivalent of the verification theatre Module 13
warns about.

It is also the most heavily probed function in the codebase: seven tests cover it,
and three of them were confirmed load-bearing by deleting the guards they test.
Refactoring well-covered, working, deliberately-branchy code days before a
deadline trades a real regression risk for a lower number in a report.

The same argument applies to the fifth. `check-markdown`’s rule engine is seven
rules evaluated over one pass of a file, and every one of them was added because a
specific defect had already shipped past human review. Its branch count is its
rule count.

**The ceiling stays at 20 rather than being raised to hide this.** A warning that
fires on five real functions is a measurement; a threshold tuned until nothing
fires is the thing this document exists to rule out.

## 4. Rationale and communication — MET

*A human-readable account of approach and trade-offs.*

* **`docs/DECISIONS.md`** — written at the moment each choice was made
  and in the same commit as the change it explains. The standard it is held to is
  written into `CLAUDE.md`: an entry must name the alternatives and why each was
  rejected, record where the author overruled the agent *and* where the agent
  talked the author out of something, and state plainly where the agent was wrong.
  A log that only records wins is not evidence of process.
* **`docs/FRAMING.md`** — the problem, the stakeholders, the definition of done,
  and what is deliberately not being built.
* **`docs/PROCESS.md`** — the workflow narrative: prompt version chain,
  guardrails, and Incident 1.
* **`docs/SECURITY.md`** — all ten OWASP agentic risks, including the ones that do
  not apply and why.
* **Commit messages** explain *why*, not just what — across five hundred–odd
  commits (`git rev-list --count main` for the exact figure; a number that moves
  every commit is not written into a document).

## 5. Full auditability — MET

*A frozen record tying intent, context, tools, and trajectory to the output.*

* **Intent** — `SPEC.md`, annotated in place across the spiral's recorded turns
  rather than rewritten to agree with the code, so where the two diverged is still
  readable.
* **Context** — `CLAUDE.md`, human-directed and version-controlled, with every
  change to it a reviewable diff.
* **Tools** — the ten versioned prompt files in `prompts/`, never overwritten. A
  past recommendation or verdict is traceable to the exact prompt text that
  produced it, because the version string is stored on every log row.
* **Trajectory** — an unbroken commit history from the very first commit, 22 merges
  to `main` — the twenty-first was the last *planned* one, and the twenty-second
  carried a fix for a rendering defect found afterwards on the repository's
  Security tab — and **four** revert commits plus one reapply, which is the safety
  layer visibly firing rather than merely existing.
  *(This said five reverts until 2026-09-14. It was wrong when written, not merely
  stale: a loose grep for "revert" had counted two commits that merely MENTION
  reverting in their subject line. Corrected rather than preserved — the rule for
  a claim that was false when written.)*
* **The product audits itself, which is unusual and is the point.** Every
  OpenRouter call, success or failure, writes a row with prompt version, model,
  token split, cost and duration — and the in-app AI call log surfaces both tables
  merged, so the audit trail is reachable by the person being asked to trust the
  output, not just by someone with database access.

## How to re-run this

```
npm test
npm run lint
npm run scan-secrets
npm run check-markdown
```

All four are wired into the commit rules in `CLAUDE.md`. **Criterion 1 is the only
one that cannot be re-run from a terminal** — which is precisely why it was the
last to close, and why it needed twenty-six captures and two evidence documents
rather than a command.
