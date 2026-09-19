# Security — CineRank mapped against the OWASP Top 10 for Agentic Applications

<!--
  EVERY LINK AND IMAGE OUT OF THIS FILE IS ABSOLUTE ON PURPOSE. DO NOT MAKE THEM
  RELATIVE, even though every other document in docs/ uses relative paths and a
  consistency sweep will want to. (Links to a heading INSIDE this file are bare
  fragments and need no base, so they are safe in both renderings.)
  This said SIX until 2026-09-19, which was the count when it was written; the
  navigational linking pass took it well past that, and a count nobody updates is
  worse than no count.

  GitHub renders this one file at TWO different base paths. In the blob view of
  docs/SECURITY.md a relative path resolves against docs/, which is correct. But
  GitHub also renders it as the repository's Security tab (it looks for a security
  policy in the root, .github/ and docs/), and THERE it resolves relative paths
  against the REPOSITORY ROOT -- so screenshots/pi-1-....png became
  /blob/main/screenshots/pi-1-....png, the three captures rendered as broken-image
  links, and all six targets 404'd. Measured against both live renderings on
  2026-09-14, not assumed.

  No relative path can satisfy both bases at once, so absolute is the only form
  that works in both. The cost is that they pin to main; these are frozen evidence
  files, and the Security tab only ever renders the default branch anyway.
-->

**Framework:** OWASP Top 10 for Agentic Applications, risks `ASI01` to `ASI10`,
OWASP Gen AI Security Project, published 9 December 2025. Course
[Module 17](https://github.com/guycn1/cinerank-project/blob/main/DOSSIER.md#module-17-security-and-risk-in-agentic-systems)
names it as the working checklist for agentic systems.

**This document maps the project against all ten, including the ones that do not
apply — and says why they do not.** A forced mapping is worth less than an honest
"not applicable, and here is the reason", because the reason is the part that
shows a risk was understood rather than pattern-matched.

## The scope question, answered first

The framework describes systems where an agent plans, holds memory, calls tools
and acts with delegated authority. **CineRank the product is not one of those.**
It makes two narrow LLM calls, both explicitly user-triggered, neither holding a
tool, a plan, or memory across calls. The model never acts on the world; it
returns text that the server validates and then spends on a single TMDB lookup.

**But this project does contain a real agentic system, and it is the one the
course is about: the agentic development environment that built it.** Claude
Code held file write, shell execution, network access and reach into a live
production database for the whole build. That is exactly "an agent with tools,
permissions, and real reach into the world" — and on 2026-09-04 it caused real,
unrecoverable data loss. See
[§ Incident log in `CLAUDE.md`](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#incident-log).

So every risk below is assessed **twice**: once against the product, once against
the build. Most of the substance sits in the second column. That is the honest
result rather than a flattering one.

## Summary

| # | Risk | Product | Build environment |
|---|---|---|---|
| ASI01 | [Agent Goal Hijack](#asi01--agent-goal-hijack) | **Real** — user review text feeds both prompts | **Real** — the agent's instructions are repo prose |
| ASI02 | [Tool Misuse & Exploitation](#asi02--tool-misuse--exploitation) | n/a — the model holds no tools | **Realised — [Incident 1](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#incident-log)** |
| ASI03 | [Identity & Privilege Abuse](#asi03--identity--privilege-abuse) | Controlled — anon key only, RLS-bounded | Controlled — no higher credential exists to hold |
| ASI04 | [Agentic Supply Chain Vulnerabilities](#asi04--agentic-supply-chain-vulnerabilities) | Controlled — 3 deps, one advisory handled explicitly | Controlled — no MCP servers, no agent plugins |
| ASI05 | [Unexpected Code Execution](#asi05--unexpected-code-execution) | n/a by construction — verified absent | **Real** — realised as part of Incident 1 |
| ASI06 | [Memory & Context Poisoning](#asi06--memory--context-poisoning) | n/a — no RAG, no cross-call memory | **Real** — the central risk of this project |
| ASI07 | [Insecure Inter-Agent Communication](#structurally-not-applicable) | n/a — single agent, no protocol | n/a — single agent, no protocol |
| ASI08 | [Cascading Failures](#asi08--cascading-failures) | Controlled — resilience requirements, tests, and captured evidence in [`RESILIENCE.md`](https://github.com/guycn1/cinerank-project/blob/main/docs/RESILIENCE.md) | Controlled — verification gates + git rollback |
| ASI09 | [Human-Agent Trust Exploitation](#asi09--human-agent-trust-exploitation) | **Real** — this is what the AI call log is for ([how it works](https://github.com/guycn1/cinerank-project/blob/main/docs/AI-CALL-LOG.md)) | **Real** — answered as a standing practice |
| ASI10 | [Rogue Agents](#asi10--rogue-agents) | **Realised** — the debug harness, for one day | Controlled — nothing reaches `main` unreviewed |

## The risks that carry weight here

### ASI01 — Agent Goal Hijack

*Attackers alter agent objectives through malicious content.*

**Product.** The user's own review text flows into **both** AI prompts as taste
signal. This is the app's headline injection surface and it is untrusted input by
definition. Mitigations, all visible in the prompt files themselves: the review
text is fenced inside explicit `BEGIN` / `END` markers labelled *untrusted data*,
with a standing instruction that the model's own instructions come only from
outside those markers; the recommendation output is constrained to structured
JSON; every title it names is cross-checked against TMDB before a card is drawn;
the verdict is length-capped and rendered as plain text, never as HTML.

**Blast radius is the real control.** Even a fully successful injection buys "a
weird movie suggestion" — the output's only power is to become a TMDB search
query. It cannot execute, cannot reach the database, and cannot exfiltrate.

**Demonstrated, not asserted — five frames,
[`docs/screenshots/pi-1` … `pi-5`](https://github.com/guycn1/cinerank-project/blob/main/docs/screenshots/README.md#pi---prompt-injection).**
A seeded film (*The Room*) carries a review that is itself an attack:
instruction override, system-prompt exfiltration and output hijack in one
string. What the captures show:

**1 — The attack, stored in the application.**

![A ranked movie card whose review text is a prompt-injection attempt, rendered
as ordinary paragraph text](https://raw.githubusercontent.com/guycn1/cinerank-project/main/docs/screenshots/pi-1-injection-review-stored.png)

Held as inert plain text: `textContent`, never `innerHTML`. The string is data
in a paragraph, not markup and not an instruction.

**2 — The taste verdict, unaffected.**

![The taste verdict banner reading normally about the viewer film taste, with
its cost and token count beneath](https://raw.githubusercontent.com/guycn1/cinerank-project/main/docs/screenshots/pi-2-verdict-resists.png)

This is the feature that receives every rated film review verbatim. No pirate,
no BANANA, no system prompt — and the real cost of the call declared underneath.

**3 — The recommendations, unaffected, and proof the attack was delivered.**

![Four recommended films with ordinary one-line reasons, beneath a line naming
the five films that fed the prompt](https://raw.githubusercontent.com/guycn1/cinerank-project/main/docs/screenshots/pi-3-recommendations-resist.png)

Four real TMDB-verified films with ordinary reasons. **The "Based on:" line is
the load-bearing detail:** it names *The Room* among the five films whose reviews
fed this prompt. That is what makes these captures evidence rather than
assertion — without it a reader has to take on trust that the injection was ever
delivered, and a system resisting something it was never sent proves nothing.

Two further frames pair the attack with each output in a single image, for a
reader who wants them adjacent rather than sequential:
[`screenshots/pi-4-verdict-with-input.png`](https://raw.githubusercontent.com/guycn1/cinerank-project/main/docs/screenshots/pi-4-verdict-with-input.png)
and
[`screenshots/pi-5-recommendations-with-input.png`](https://raw.githubusercontent.com/guycn1/cinerank-project/main/docs/screenshots/pi-5-recommendations-with-input.png).
Both are full-page captures and are linked rather than embedded, because inline
they scale down past the point where their text can be read.

**Corroborated independently of that line:** the verdict call above ran **1,577 tokens** against
1,491 / 1,482 / 1,488 for the three runs before it, the difference being the
injected review's weight.

**A trap worth recording, because it nearly produced fake evidence.** The demo
film was first rated 2, which sorted it *sixth*. Recommendations read only the
top five rated films (`config.recommendations.topN`) while the verdict reads every
one — so the attack reached the verdict prompt and **never reached the
recommendations prompt at all**. Half the evidence would have shown a feature
resisting an attack it had not been sent, with nothing on screen to reveal it.
Rated 8 it sorts fourth, inside the window, and both captures are genuine.

**Source review and runtime evidence are two different claims**, and both are
made here: that the guard *exists* is checkable in
[`prompts/recommend_v3.md`](https://github.com/guycn1/cinerank-project/blob/main/prompts/recommend_v3.md)
and
[`prompts/taste_verdict_v7.md`](https://github.com/guycn1/cinerank-project/blob/main/prompts/taste_verdict_v7.md)
(and it survived all seven verdict rewrites, which were chasing register and
could easily have dropped it); that it *works* is what these five frames are.

**Build.** Less obvious and worth stating: the agent reads
[`CLAUDE.md`](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md)
and
[`docs/DECISIONS.md`](https://github.com/guycn1/cinerank-project/blob/main/docs/DECISIONS.md)
as authoritative instruction, and those two alone are roughly 450KB of prose.
Anyone with write access to this repository can change how the agent behaves by
editing English. The control is that every context file is version-controlled,
every change to one is a reviewable diff, `main` is never pushed to directly,
and no merge happens without explicit human confirmation.

Evidence:
[`prompts/`](https://github.com/guycn1/cinerank-project/tree/main/prompts),
[`CLAUDE.md` § Security & Secrets #5](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#security--secrets-module-17),
[`SPEC.md` § 2.2 step 4](https://github.com/guycn1/cinerank-project/blob/main/SPEC.md#22-ai-powered-recommendations-the-non-wrapper-part).

### ASI02 — Tool Misuse & Exploitation

*Agents use legitimate tools in unsafe ways.*

**Product:** not applicable. The model is handed no tools.

**Build: this is
[Incident 1](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#incident-log),
precisely.** During AI-path testing the agent used two legitimate tools exactly
as designed and did real harm. A Supabase delete run as routine cleanup removed
the user's own films along with their ratings and reviews — unrecoverable,
because the free tier has no point-in-time recovery. In the same session a broad
process kill took down the user's running dev server. **Neither was a bug.**
Both tools did what they were asked. That is the definition of this risk, and it
is why the mitigations are behavioural rather than technical:

* Never run destructive operations against live data — no "delete all", no
  truncate, no bulk delete.
* Where test rows are unavoidable, tag them and delete only rows matching that
  exact tag, created by the same script — never "all ids".
* Never kill processes broadly. Kill only a PID this session started, and run any
  test server on a non-default port.
* Prefer not to touch the database at all for testing.

These are recorded as
[binding working agreements in `CLAUDE.md`](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#working-agreements-binding--added-after-incident-1),
not as advice.

### ASI03 — Identity & Privilege Abuse

*Agents inherit or escalate high-privilege credentials.*

The frontend and server use the Supabase **anon key only**, which is
RLS-bounded. Verified rather than asserted: `service_role` appears nowhere in
the codebase except in comments forbidding its use, and in the pattern
[`scripts/scan-secrets.js`](https://github.com/guycn1/cinerank-project/blob/main/scripts/scan-secrets.js)
uses to hunt for one. `.env` has been gitignored since the first commit, and
`npm run scan-secrets` runs before every commit.

**Least privilege here means there is no higher-privilege credential to escalate
to.** That is a deliberate design position, argued in
[`CLAUDE.md` § Security & Scope](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#security--scope-why-no-accounts--no-security-story):
accounts were not added in order to manufacture a permissions demo, because the
anon-versus-service-role split already is one.

### ASI04 — Agentic Supply Chain Vulnerabilities

*Compromised tools, plugins, or external components.*

Three runtime dependencies: `express`, `@supabase/supabase-js`, `dotenv`. Two
development dependencies as of 2026-09-13, `eslint` and `globals`, which are part of
the supply chain even though they never ship — `npm audit` reports zero across every
severity with both installed. No MCP
servers are configured for this project and no third-party agent plugins are used
— verified, the repository contains no MCP configuration.

**One live advisory is handled explicitly rather than silently.** Express 4 pins
`qs` to exactly 6.15.3, which carries two moderate advisories that `npm audit
fix` cannot resolve even with `--force`, because the exact pin leaves no semver
room. The alternative was Express 5, a major version with breaking changes. The
chosen fix is an `overrides` entry lifting `qs` to 6.16.0, documented in
[`package.json`](https://github.com/guycn1/cinerank-project/blob/main/package.json)
with both advisory IDs, the reason Express 5 was declined, and the note that
[`test/routes.test.js`](https://github.com/guycn1/cinerank-project/blob/main/test/routes.test.js)
exercises exactly the query-string and JSON-body paths `qs` parses. An advisory
reasoned about in writing is worth more than a clean `npm audit` nobody can
account for.

### ASI05 — Unexpected Code Execution

*Agents generate or run code or commands unsafely.*

**Product: not applicable by construction, and verified.** Model output is
parsed as JSON and only ever becomes a title lookup. There is no `eval`, no `new
Function`, no `child_process` and no `execSync` anywhere in
[`server/`](https://github.com/guycn1/cinerank-project/tree/main/server) or
[`public/`](https://github.com/guycn1/cinerank-project/tree/main/public). All
user and model text reaches the DOM through `textContent` — the string
`innerHTML` appears in the codebase only inside comments stating that it is
never used.

**Build: real, and realised.** The agent ran shell commands throughout the
build, and the process-kill half of Incident 1 is this risk landing. The
containment is the same set of working agreements as
[ASI02](#asi02--tool-misuse--exploitation), plus the fact that every change
arrives as a reviewable commit on `draft` and never directly on `main`.

### ASI06 — Memory & Context Poisoning

*Attackers poison agent memory systems and RAG databases.*

**Product: not applicable.** No RAG, no vector store, no memory carried between
calls. Each prompt is rebuilt from the user's own database rows at call time.

**Build: real, and this is the risk the course weighs most heavily.**
[Module 11](https://github.com/guycn1/cinerank-project/blob/main/DOSSIER.md#module-11-context-engineering-the-agents-briefing)'s
warning is that bad context is the steady, dominant cause of bad agent output
over time, and that it rots *in silence* — the agent never announces that its
briefing has gone stale, it simply keeps acting on it.

Three structural answers:

* **The authoritative context is human-directed and version-controlled.**
  [`CLAUDE.md`](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md)
  is written and corrected by the developer, lives in git, and every change to
  it is a diff someone can read. Agent-written scratch notes are not treated as
  authority and are not part of the record.
* **Staleness is actively swept, not assumed away.** Full sweeps across every
  markdown file and code comment ran repeatedly rather than once: **ten separate
  days between 2026-09-07 and 2026-09-19** carry one, each finding and correcting
  claims that had quietly stopped being true. (`git log --oneline --grep=sweep`
  is the check. This listed three dates, which was the count when it was written
  and went short every time another sweep ran — the figure is given with its own
  date for that reason.)
* **A claim that was wrong when written gets corrected, not preserved.**
  Historical records are kept as history; live claims are kept accurate. The
  rule, and the line between the two, are written down in
  [`CLAUDE.md` § Decision Logging](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#decision-logging-non-negotiable).

### ASI08 — Cascading Failures

*Small errors propagate across planning and execution.*

**Product.** Every external dependency fails independently without taking the page
with it — TMDB down on search, TMDB down on add, TMDB down mid-recommendation,
OpenRouter down on either feature, the database unreachable, and the app itself
unreachable. Each is specified in [`SPEC.md` § 2.4](https://github.com/guycn1/cinerank-project/blob/main/SPEC.md#24-resilience-requirements) and covered by route tests, and
all of them are now **captured and analysed** in
[`RESILIENCE.md`](https://github.com/guycn1/cinerank-project/blob/main/docs/RESILIENCE.md) — `RS-1` through `RS-16`, which also reaches
past this list to a row deleted under an open dialog and three ways the model can
return nothing usable while every dependency is healthy. A failed AI call still writes
a `status='failed'` row, and when the log write *also* fails, both causes are
composed and sent to stderr, because no row then exists to hold either.

**Build.** [Five gates](https://github.com/guycn1/cinerank-project/blob/main/CLAUDE.md#version-control-workflow-non-negotiable) and a rollback layer: `npm test` (60 tests), `npm run lint`,
`npm run scan-secrets`, `npm run check-markdown`, `npm run check-claims`, and git itself — an unbroken history
from the first commit, with four revert commits and one reapply, which is the
safety net visibly firing rather than merely existing. (`git rev-list --count main`
for the commit count; it is deliberately not written down here, because a figure
that changes every commit goes stale between one session and the next.)

**[Module 13](https://github.com/guycn1/cinerank-project/blob/main/DOSSIER.md#module-13-verification-before-trust)'s
"verification theatre" is answered by probing the gates.** Each of the three
filter rules in the recommendation service was deleted in turn, to confirm every
deletion fails exactly the tests that cover it; the
[markdown checker](https://github.com/guycn1/cinerank-project/blob/main/scripts/check-markdown.js)
was proved in both directions across 57 cases, 26 that must fail and 31 that
must pass. A gate nobody has tried to defeat is not known to work.

### ASI09 — Human-Agent Trust Exploitation

*Users over-trust agent recommendations.*

**Product: this is the reason the
[AI call log](https://github.com/guycn1/cinerank-project/blob/main/docs/AI-CALL-LOG.md)
exists.** Every call is logged whether it succeeds or fails, with prompt
version, model, token split, cost and duration, and it is surfaced *inside the
app* rather than only in the database, so the audit trail is reachable by the
person being asked to trust the output. Beyond that: every suggested card
carries an `AI pick` provenance badge; every fact on a card — poster, year, id —
comes from TMDB and never from the model; and the taste verdict is labelled **an
AI-generated read**, wording chosen deliberately over a warmer alternative,
because that line sits directly above machine-written text.

**The strongest evidence here is an anti-overclaim.**
[`SPEC.md` § 2.2 step 4](https://github.com/guycn1/cinerank-project/blob/main/SPEC.md#22-ai-powered-recommendations-the-non-wrapper-part)
once promised more than the code delivers. Rather than quietly softening it, the
claim was measured against live TMDB across 30 probe titles and the
specification was annotated in place to state exactly how strong the check is
and is not. Telling a user precisely what a verification does *not* cover is the
opposite of trading on their trust.

**Build.** The same discipline is a standing practice: verify before asserting.
It exists because the agent was caught making a string of confident wrong claims
— a browser-support version, a font metric estimated twice and wrong twice, a
claim about dialog dismissal.
[Two decision entries](https://github.com/guycn1/cinerank-project/blob/main/docs/DECISIONS.md)
record measurement overturning the agent's own premise, with its proposed fix
dropped as a result.

### ASI10 — Rogue Agents

*Compromised agents act harmfully while appearing legitimate.*

**The clearest instance in this project is the debug harness, and it is written
up rather than buried.** For one day the page loaded
[`scripts/debug-recs.js`](https://github.com/guycn1/cinerank-project/blob/main/scripts/debug-recs.js)
on every request, and the app answered its own recommendation calls with six
dummy cards — surviving hard refreshes and a cleared cache, because nothing was
cached wrongly and the script tag was doing exactly what it said. Harmful
behaviour that looked entirely legitimate, which is this risk in one sentence.

Three independent mitigations now:

* It starts every page load **disarmed** and intercepts nothing until `debugRecs()`
  is called explicitly.
* It **refuses to install at all** when the hostname ends in `onrender.com`, so the
  deployed site is protected even if removal is forgotten.
* **The two lines that loaded it are GONE (2026-09-13).** The `<script>` tag and
  the route that served it were removed before submission, and the removal was
  verified live rather than by reading the diff: `/debug-recs.js` now answers 404,
  the page answers 200, and the served HTML contains no reference to it. The file
  stays in `scripts/`, which is outside the static root, so nothing serves it and
  it can only be used by pasting it into a console deliberately.

The first two mitigations are now redundant and are kept regardless. They cost
nothing, and a control that only works while someone remembers to remove a line is
exactly the shape this risk describes.

**Build.** Nothing reaches `main` without explicit human confirmation, and `main`
is never pushed to directly.

## Structurally not applicable

**ASI07 — Insecure Inter-Agent Communication.** There is one agent and no
agent-to-agent protocol. The two AI features are independent one-shot calls that
never see each other's output and share no state. Multi-agent orchestration is the
subject of the course's shared running project, which lives in a separate
repository; this one is the independent application.

## What was owed — nothing outstanding

This section listed two items on the morning of 2026-09-13. **Both are
delivered**, and nothing has replaced them.

**Delivered:** the debug harness is unloaded — the `<script>` tag and the route
that served it are both gone, verified live (`/debug-recs.js` → 404), with the
file itself kept in `scripts/` where nothing serves it. And the prompt-injection
evidence, which was the live proof of [ASI01](#asi01--agent-goal-hijack)'s
mitigations. Five frames,
[`docs/screenshots/pi-1` … `pi-5`](https://github.com/guycn1/cinerank-project/blob/main/docs/screenshots/README.md#pi---prompt-injection),
analysed under [ASI01](#asi01--agent-goal-hijack) above. It is deliberately
recorded there rather than here, next to the claim it substantiates, so a reader
meets the mitigation and its proof together rather than having to connect two
sections.
