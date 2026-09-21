# How CineRank was built — the LLM-augmented workflow

This is the *process* companion to [`docs/DECISIONS.md`](DECISIONS.md) (which
records the *why* behind each technical choice). The course is about practising
software development with an LLM in the loop, so this file is a first-class
deliverable, not an afterthought.

**Authors:** Guy Cohen & Michael Chernyak · **Course:** LLM-Augmented Software
Practice (ASE-26)


## 1. Working method

The app was built in a pair-with-an-agent loop: a human sets the goal and the
acceptance bar, the agent drafts code and prompts, the human reviews every diff
and runs the app, and each checkpoint is committed with a message that explains
the reasoning. Rules that keep this honest live in
[`CLAUDE.md`](../CLAUDE.md#version-control-workflow-non-negotiable):

- **Everything on `draft`; `main` only at a settled milestone, to fix a defect
  already published there, or as one close-out sync when the work is declared
  finished — and only ever with explicit human sign-off.** The first
  twenty-one merges were all the former, and nothing smaller was merged under it;
  every merge since has been the latter. Twenty-eight merges to `main` (verify with
  `git log --merges --oneline main`), each a deliberate decision. The
  twenty-first was the final *planned* one rather than a guarantee that no more
  would follow — and the twenty-second, later the same day, is that distinction
  being demonstrated rather than asserted: a rendering defect in
  [`docs/SECURITY.md`](SECURITY.md), visible to any reader of the repository's Security tab, was
  found, fixed, and merged under the same sign-off rule as the twenty-one before
  it. The twenty-third, the next day, carried the answer to the question that
  defect raised — a fifth gate that re-resolves every claim pointing at something,
  and the accuracy sweeps that went with it. The twenty-fourth, the same day,
  carried what that gate cannot reach: claims whose falsifier is not the thing
  they name. A uniqueness or coverage claim asserts something about everything
  the sentence leaves out, so checking it means going and looking at those
  — re-resolving what the sentence points at can never disprove it. The
  twenty-fifth carried this rule itself, after the user asked whether the run of
  non-milestone merges meant it had quietly died: the practice turned out to have
  been consistent and the rule TEXT out of date, and four files were still
  telling a reader that every merge follows a milestone while the log beside them
  showed three that did not. The twenty-sixth carried eleven accuracy defects
  found by the user asking, one at a time, whether particular claims resolve —
  including two that survived a sweep Claude had already run, because the
  sweep's own filter could not express them. The twenty-seventh carried two
  claims that were simply false on `main` — each contradicted by a sentence in
  its own section — and, with them, the legibility work that found them: a
  sweep two days earlier had reached the same sites, quoted them, and cleared
  them on a criterion read off the source rather than the rendered page. The
  twenty-eighth carried a defect a reader could SEE — the ranked list's score
  badges out of line by 28.1px on the deployed site — and, with it, the sweep
  written up [below](#keeping-the-record-true-and-what-the-2026-09-19-sweep-did-differently):
  fourteen documentation defects, of which the most instructive was one
  enumerable set described four mutually contradictory ways across four files.
- **Secrets never enter code.** `.env` gitignored from commit 1; a pre-commit
  [`npm run scan-secrets`](../scripts/scan-secrets.js) scans the staged diff for key-shaped strings. The same
  rule shaped the deploy: [`render.yaml`](../render.yaml) declares the four secrets as
  `sync: false`, so Render prompts for them in its dashboard and no value ever
  enters the committed file.
- **Dependency advisories get diagnosed, not force-fixed.** The first Render
  build flagged moderate advisories in `qs`, Express's query-string parser —
  **two of them**, `GHSA-x5fp-wj9c-mxmx` (array-limit bypass) and
  `GHSA-4mjr-xmp4-gh2g` (DoS via `isBuffer`), both named in [`package.json`](../package.json) beside
  the override. `npm audit fix` did nothing — and neither did `--force`, which is
  the point where it would have been easy to either shrug or reach for a major
  upgrade. The actual cause was that Express 4 pins `qs` to *exactly* the
  vulnerable `6.15.3`, leaving npm no semver room, so the only move it could see
  was Express 5 and its breaking changes. An `overrides` entry lifting `qs` to
  the patched `6.16.0` — a minor bump — cleared both, with the route tests
  covering exactly the surface involved (query strings, JSON bodies). Recorded in
  `package.json` next to the override, because an unexplained override is the
  kind of thing a later reader deletes. `npm audit` now reports zero across every
  severity, and `qs` resolves to a single `6.16.0` install that both `express`
  and `body-parser` share.
- **Five gates, wired into the commit rules rather than left to memory.**
  `npm test` (62 tests), `npm run lint` (ESLint, defect rules and complexity
  ceilings — added 2026-09-13, the project had no static analysis before that),
  `npm run scan-secrets` on every commit, [`npm run check-markdown`](../scripts/check-markdown.js) on every commit
  touching a `.md` file, and [`npm run check-claims`](../scripts/check-claims.js)
  on every commit, which
  re-resolves every claim in the repository that points at something — a path, a
  decision entry, a commit SHA, an identifier, a capture, a retired phrasing.
  **Two of them exist because a real defect got past human review**, which is the
  pattern worth naming: the markdown checker was written after both long documents
  were found rendering wrong on GitHub for weeks ([D-065](DECISIONS.md#d-065--the-markdown-separators-are-deleted-not-unescaped--and-two-of-the-four-suspected-escaping-defects-turned-out-not-to-be-defects-at-all)), and the claims
  checker after [`README.md`](../README.md) was found describing another file's verdict sixteen hours
  after that verdict changed — by a reader, not by a sweep ([D-072](DECISIONS.md#d-072--claim-checking-became-a-commit-gate-and-a-file-type-filter-is-why-it-was-needed)). Each gate was
  proved to bite before being trusted — see
  [`docs/MERGE-READINESS.md` § 2](MERGE-READINESS.md#2-sound-verification--met).
- **Every agent invocation starts from a committed checkpoint**, which is what
  makes reverting a cheap first move rather than a last resort. The rule in
  [`CLAUDE.md`](../CLAUDE.md#version-control-workflow-non-negotiable) is written the other way round — *every* modification is committed
  and pushed straight away, at natural checkpoints rather than once a session —
  and committing after each change is what leaves the tree clean before the next
  one begins. Measured over the whole history on 2026-09-19: **more than 500 commits across
  15 of the 16 days** the project has run, a **median of 2 files per commit** and
  a maximum of 14. (Deliberately not exact figures: they move with every commit,
  including the ones that would be needed to correct them. The single gap is
  2026-09-18 — this read "11 consecutive days, every day" until the figure was
  re-measured, by which point both the count and the word "consecutive" had
  stopped being true.) It was exercised twice for real, not merely available: four failed
  polish passes on the verdict glint were ended by reverting to the last commit
  and re-deriving one dial at a time ([D-055](DECISIONS.md#d-055--the-verdict-glint-overcorrection-a-revert-and-a-band-that-fades-along-a-path)), and the [RS-9](RESILIENCE.md#rs-9--a-recommendation-run-with-nothing-to-suggest) capture needed a
  deliberate one-line break in a service, undone with
  `git checkout -- server/services/recommendations.js` the moment the shot
  landed. Neither move needed a stash, a branch or a careful hand-undo, because
  the checkpoint was already there.
- **Every commit says why**, and design decisions go to the top of
  [`docs/DECISIONS.md`](DECISIONS.md) (newest first) at the moment they're made
  ([Module 8](../DOSSIER.md#module-8-interface-design-and-app-documentation): the
  reasons are clearest then and can't be reconstructed later). Entries record the
  alternatives rejected, the human pushback that changed the outcome, and the
  times the agent was wrong — a log of only wins is not evidence of process.

The UI polish phase leans hard on this loop. The AI call log dialog alone took
~100 small commits — the human runs the app, screenshots what looks off (a
border that doesn't line up mid-scroll, a caret nub, a scrollbar-coloured line
mistaken for a stray scrollbar), the agent explains the cause and fixes it, the
human re-checks. Several rounds caught regressions the agent introduced
(specificity conflicts leaking a desktop rule into the mobile card view, a
`::details-content` stacking-context trap). The screenshot-in / explanation-out
rhythm *is* the method for visual work — prose specs can't anticipate these.

## Who did what, and at which level of autonomy (Modules 1 and 2)

**[Module 1](../DOSSIER.md#module-1-what-is-agentic-software-engineering)'s
autonomy scale runs manual → task assistance → goal assistance → specialised →
general domain autonomy.** This build sat at **task and goal assistance
throughout, and never above it.** The loop in [§ 1](#1-working-method) is the
evidence: a human set the goal and the acceptance bar, the agent drafted, and a
human read every diff and ran the application before the next instruction.
Nothing here was delegated to a level the tool could technically have reached.

**[Module 1](../DOSSIER.md#module-1-what-is-agentic-software-engineering)'s
headline worry does not arise here, and the reason is structural rather than
virtuous.** It reports that more than 68% of agent-written pull requests sit
delayed or unreviewed, the surplus burying the people who must review it.
**There is no queue in this repository to bury anyone.** Two branches, no
long-lived feature branches, no pull requests: review is synchronous with
production rather than a stage afterwards, so output cannot accumulate faster
than it is judged. That works at one reviewer and one codebase, and would not
survive either being scaled.

**[Module 2](../DOSSIER.md#module-2-the-human-role-what-erodes-and-what-compounds)
sorts developer work into what erodes, what holds, and what compounds. The
division in this project falls along that line closely enough to be worth
stating plainly.** Routine implementation, boilerplate and pattern-matching
across the codebase — the eroding group — went to the agent. Framing the
problem, weighing trade-offs, taste, and judging what came back stayed human,
and the decision log records the latter happening by name rather than in the
abstract: the spotlight effect the agent argued against and the user overruled
([`D-049`](DECISIONS.md#d-049--the-recs-spotlight-is-ported-at-070--supersedes-d-048s-last-section)),
the card-sizing rule the user dictated in their own words
([`D-051`](DECISIONS.md#d-051--card-size-comes-from-the-viewport-never-from-the-result-count-r29)),
the measured call to fix the documentation instead of the matcher
([`D-054`](DECISIONS.md#d-054--the-tmdb-verification-claim-was-softened-instead-of-the-matcher-being-tightened)),
and the centring bug a human found with a screenshot after the agent's own
automated attempts had repeatedly misreported it
([`D-062`](DECISIONS.md#d-062--left-50--width-auto-was-silently-halving-the-shrink-to-fit-toasts-available-width--user-diagnosed-not-tooling-verified)).

**One uncomfortable reading of the same module, since the exercise is supposed
to be uncomfortable.**
[Module 2](../DOSSIER.md#module-2-the-human-role-what-erodes-and-what-compounds)
lists *documenting behaviour already known* among the work that erodes — and a
large share of this repository is exactly that. The defence is not that the
module is wrong but that the category shifts when the documentation **is** the
deliverable: here the trail is what the course grades and what
[`DOSSIER.md`](../DOSSIER.md) says is graded, so writing it is the work rather
than a record of it. Where that defence does not apply, it should not be
claimed.

## The workflow, and where each stage lives (Module 4)

[Module 4](../DOSSIER.md#module-4-the-anatomy-of-an-agentic-workflow-from-coding-to-engineering)
takes an agentic workflow apart and names its parts, then makes the claim this
repository is arranged to answer: **a workflow that cannot be inspected,
replayed, or judged after the fact is not engineering, it is craft.** Every
stage below is a file a reader can open.

| Stage | Where it lives | Studied by |
|---|---|---|
| **Intent** | [`FRAMING.md`](FRAMING.md) — problem, stakeholders, testable definition of done, out-of-scope list | [Module 6](../DOSSIER.md#module-6-intent-and-the-discipline-of-problem-framing) |
| **Specification** | [`SPEC.md`](../SPEC.md#specification-status--the-co-evolution-spiral-module-10) — unfrozen, annotated where the build diverged, three spiral turns recorded against commit ranges | [Module 10](../DOSSIER.md#module-10-specifications-and-co-evolution-spiral) |
| **Context** | [`CLAUDE.md`](../CLAUDE.md) — human-written, re-read every session, corrected in place when it was wrong | [Module 11](../DOSSIER.md#module-11-context-engineering-the-agents-briefing) |
| **Plan** | the backlogs inside [`CLAUDE.md`](../CLAUDE.md#agreed-order-of-work-from-here-set-by-the-user-2026-09-09), numbered and worked in order, with withdrawn items kept rather than deleted | — |
| **Execution** | more than 500 commits on `draft` across 15 of the project's 16 days, median 2 files each | — |
| **Verification** | five commit gates, plus [`ACCEPTANCE.md`](ACCEPTANCE.md) and [`RESILIENCE.md`](RESILIENCE.md) | [Module 13](../DOSSIER.md#module-13-verification-before-trust) |
| **Audit trail** | git history, [`DECISIONS.md`](DECISIONS.md), and the application's own [AI call log](AI-CALL-LOG.md) | [Module 4](../DOSSIER.md#module-4-the-anatomy-of-an-agentic-workflow-from-coding-to-engineering) |

**The last row is the one this project can show twice.**
[Module 4](../DOSSIER.md#module-4-the-anatomy-of-an-agentic-workflow-from-coding-to-engineering)
wants a frozen record linking intent to specification to context to trajectory
to output — which is the repository. This application then keeps a second audit
trail of its own, for its own AI calls, on the same principle and for the same
reason: an output with no account of how it was produced cannot be trusted past
the moment it ran. The discipline the course teaches about directing agents is
the discipline the product applies to the agent inside it.

## The environment this ran in, and what it was allowed to do (Module 5)

Unnumbered on purpose: `docs/PROCESS.md` [§ 1](#1-working-method) and
[§ 2](#2-prompt-engineering-as-version-control) are referenced by name from
[`CLAUDE.md`](../CLAUDE.md) and [`SPEC.md`](../SPEC.md), so the numbered
sections below keep their numbers.

**The ADE.** Claude Code in a terminal, on Windows, with Git Bash for POSIX
commands. That places this build in the **command-line family** — the one that
exposes the agent loop in the open, hands the developer control over context and
permissions, and composes with ordinary shell tools. The trade is real and went
the way it was meant to: less polish than an IDE-integrated agent, and in
exchange every tool call, every diff and every command was visible before it ran.

**Which pillars were actually in play**, since naming them is the point of the
typology rather than listing all six:

* **Tool augmentation** — file read and write, shell execution, network fetches.
  This is the pillar that carries the whole build, and it is the one that
  defines the blast radius.
* **Knowledge and memory** — [`CLAUDE.md`](../CLAUDE.md) is the durable
  briefing, re-read at the start of every session. It is human-written and
  human-corrected, which is the side of
  [Module 11](../DOSSIER.md#module-11-context-engineering-the-agents-briefing)'s
  finding worth being on.
* **Multi-agent coordination — implicit only.** The tool decomposes and
  parallelises internally on its own, which is
  [Module 14](../DOSSIER.md#module-14-multi-agent-decomposition-and-orchestration)'s
  *implicit* orchestration; explicit orchestration was never designed, and this
  project is the case where it should not be. One codebase, one reviewer, work
  that is mostly sequential because each step's output is what the next step
  reacts to. Module 14's own rule is that explicit orchestration is right only
  when the quality gain clears roughly fifteen times the tokens. It would not
  have here.
* **Computer use** — not used. Headless Chrome was driven a few times for
  screenshots, and it went badly enough to be written up
  ([D-062](DECISIONS.md#d-062--left-50--width-auto-was-silently-halving-the-shrink-to-fit-toasts-available-width--user-diagnosed-not-tooling-verified)):
  its reported viewport width repeatedly disagreed with the real browser, and
  the user's own screenshots were the authority that settled it.

**The permission stance, and the honest order it was arrived at.**
[Module 5](../DOSSIER.md#module-5-the-ade-typology-tooling-and-permissions)'s
principle is minimal footprint: grant only the permissions the task needs,
prefer reversible actions, and do less when uncertain. That is almost word for
word what the
[working agreements in `CLAUDE.md`](../CLAUDE.md#working-agreements-binding--added-after-incident-1)
now say — **and they were written after the damage, not before it.**
[Incident 1](../CLAUDE.md#incident-log) is the whole reason they exist: the
agent held write access to a live production database, used it exactly as
designed for routine cleanup, and destroyed the user's own ratings and reviews
with no point-in-time recovery to undo it. The stance below is a lesson, not a
precaution:

* No destructive operation against live data, ever. Tagged rows only, deleted by
  that exact tag.
* No broad process kills. Only a PID this session started, and test servers on a
  non-default port.
* Prefer not to touch the database at all for testing — which is why the
  recommendations work has a browser debug harness instead.
* No MCP servers and no third-party agent plugins, so the tool surface is the
  one the ADE ships with and nothing more.

**What stayed the human's, and could not be delegated.** Naming this is
[Module 5](../DOSSIER.md#module-5-the-ade-typology-tooling-and-permissions)'s
closing habit, and in this project it is not abstract — each of these was
exercised, repeatedly, and is traceable in the log:

* **The acceptance bar.** What "done" means, and when a thing is good enough to
  stop.
  [Step 5](../CLAUDE.md#agreed-order-of-work-from-here-set-by-the-user-2026-09-09)
  closed against a ~350px target the user set; R18 closed as won't-fix once
  measured.
* **The merge decision.** Every `draft` to `main` merge required explicit
  confirmation. None was automatic.
* **Catching the agent's wrong claims.** This is the one that recurs. A
  browser-support version, a font metric estimated twice and wrong twice, a
  dialog-dismissal claim, a set of repro steps written against an empty database
  — all caught by the user, none by a tool. [`docs/DECISIONS.md`](DECISIONS.md)
  records them where they happened rather than smoothing them out.
* **Judging visual work.** Screenshot in, explanation out. Several effects were
  built, measured, approved on paper and still rejected on sight — the verdict
  glint took four failed passes and a revert before it was isolated one dial at
  a time, on the user's call.

## 2. Prompt engineering as version control

Neither AI feature's prompt is inlined in code — each is a numbered file under
[`prompts/`](../prompts), never overwritten, and every log row records which
version produced it. The iteration history *is* the evidence of prompt
engineering:

| Feature | Versions | What each change fixed |
|---|---|---|
| Recommendations | `recommend_v1` → `v2` → `v3` | v1 read like a plot blurb → v2 second-person voice tied to the user's own ratings → v3 tightened to one 8–16-word sentence after reasons kept getting clamped in the card |
| Taste verdict | `taste_verdict_v1` → `v2` → `v3` → `v4` → `v5` → `v6` → `v7` | v1 cut mid-word and leaked `*markdown*` → v2 "finish the sentence, no markdown" → v3 over-corrected to one terse line that just parroted the numbers → v4 gave room back (2–3 sentences) and redirected it to *characterise the viewer*, not recite ratings → v5 changed the REGISTER and nothing else: v4 asked for "light and teasing" and got teasing in a literary voice, so v5 asks for plain spoken English — everyday words, contractions, sentences you could say out loud — with a worked example of the too-fancy version to steer away from → v6 because v5 half-landed in a way worth recording: it fixed the sentence SHAPE ("you hit a wall fast", "Basically") and left the critic vocabulary sitting inside those sentences ("gratuitously grim", "suffering played for shock value"), and used a semicolon v5 had asked it to split. v6 applies the out-loud test to every PHRASE rather than the sentence, bans semicolons outright instead of advising against them, and adds a rewrite table plus a third rejected example lifted from v5's own output — concrete sentences to steer away from have moved this prompt further than any adjective → **v7 threw that conclusion out.** v6 did not improve the register either, and counting the chain showed why: negative instructions went 16 → 30 → 37 while worked examples of the TARGET voice stayed at exactly one, and the file doubled in size for no visible gain. v6 had accidentally proved the split — its structural ban ("no semicolons, ever") landed in the very next verdict, its vocabulary bans did nothing. A ban removes an option and supplies no replacement, so the model obeys it and falls back to its own default voice for the words it does choose. v7 deletes the rewrite table, both rejected examples and the banned-word list, keeps the structural rules, and carries FOUR worked verdicts instead of one — shorter than v6 and than v5. Register is a sample, not a rule → **and v7 was the worst of the lot, which is where the honest finding is.** It still said "gratuitous" and it broke a rule every version since v4 has held: 4 sentences against a stated 2–3. Rolled back to v6. Three structurally different prompts — bans, more bans, examples — produced the same register, so the prompt was never the lever; what is left is the model (the cheaper tier, where register control is weakest), the 0.85 temperature, or real few-shot as example TURNS rather than prose. Recorded because a v-chain that only shows successful iterations would misrepresent what prompt engineering is actually like: three of these seven cost real money and moved nothing. **The fix was the MODEL, and v7 works on it unchanged** — same prompt, `claude-sonnet-5`, register landed and the sentence count came back into bounds on the first call. The verdict is now the one feature not on the cheaper tier ([D-053](DECISIONS.md#d-053--the-taste-verdict-alone-runs-on-a-stronger-model)) |

Each prompt file carries a "Change from vN" header explaining the delta. Server
-side `tidyReason()` / `tidyVerdict()` are belt-and-suspenders: even a
non-compliant model response is cleaned and truncated on a word boundary before
it reaches the DOM.

## 3. Guardrails against the model — naming the failure mode (Module 3)

[Module 3](../DOSSIER.md#module-3-mental-models-of-agents) catalogues the ways
an agent fails — hallucination, misalignment, ambiguity collapse, sycophancy —
and makes a claim about why the catalogue is worth learning: **"a student who
can name the mode can reach for the fix."**

This project meets one of them squarely, and in the product rather than in the
build. **Hallucination invents plausible-sounding falsehoods**, and a recommender
whose entire job is naming films will, sooner or later, name films that do not
exist. It is not an edge case here; it is the expected behaviour of the component.

**The remedy is not a better prompt.**
[`recommend_v3`](../prompts/recommend_v3.md) does instruct the model to
name only real, released films — and asking is not a guard, because the failure
mode is precisely that the model believes it complied. The guard is that **nothing
the model says is taken as fact**: every title it returns is looked up, and TMDB
supplies every fact that reaches a card.

**Measured rather than assumed.** Thirty probe titles were run against live TMDB
([`D-054`](DECISIONS.md#d-054--the-tmdb-verification-claim-was-softened-instead-of-the-matcher-being-tightened)):
**seven of twelve realistic invented titles returned zero results** and were
dropped exactly as the documentation claimed. The drop path is the common
outcome, not the rare one — which is the opposite of what this project's own
backlog had assumed in writing before anyone measured it.

**And demonstrated, not only described.**
[`RS-16` in `RESILIENCE.md`](RESILIENCE.md#rs-16--the-model-named-films-that-do-not-exist)
is the guard firing on every pick of a run at once: a well-formed list of
confident titles, none of which TMDB had heard of, and a page that says so and
still declares what the call cost.

- **Facts come from TMDB, never the model.** The recommendation prompt returns
  *titles only*; every title is looked up on TMDB, which supplies poster / year
  / overview. A title TMDB returns no result for is silently dropped, not shown
  as a broken card — measurement showed that is the common outcome for an
  invented title, not a rare one. The lookup keeps TMDB's best result when the
  titles do not match exactly, so it proves the card describes a real film
  rather than proving it is the film the model meant: a trade taken
  deliberately, with the numbers, in D-054.
- **Structured output, not prose parsing.** Recommendations must be a JSON
  array; `parseModelJson()` tolerates exactly one markdown fence and nothing
  looser.
- **Prompt injection.** User review text feeds both prompts as untrusted data,
  length-capped and wrapped in `BEGIN/END` markers, with the prompt telling the
  model the block is data. Worst case for recommendations is a weird title (then
  TMDB-filtered); worst case for the verdict is an off-tone banner line,
  rendered via `textContent`, never `innerHTML`.
- **Model choice is per feature, and it is a cost decision made in the open.**
  Recommendations run on `claude-haiku-4.5`; the taste verdict alone runs on
  `claude-sonnet-5`, after four prompt versions failed to move its register and
  the model turned out to be the constraint rather than the wording
  ([D-053](DECISIONS.md#d-053--the-taste-verdict-alone-runs-on-a-stronger-model)).
  OpenRouter's public model list was queried for the actual prices rather than
  guessed — $2/$10 per Mtok against Haiku's $1/$5, which worked out at about
  0.29¢ a verdict on the list as it stood that day. The shipped demo list is
  longer and the verdict reads all of it, so the figure in the call log is now
  0.37–0.40¢; the ratio this decision turned on is unchanged. The call log
  renders the model per row, so the split is auditable rather than
  buried in config.
- **Cost is logged, not estimated away.**
  [`openrouter.js`](../server/services/openrouter.js) sends `usage.include=true`
  and stores the exact `usage.cost`; a per-model price table in
  [`config.js`](../server/config.js) is only the fallback. Unknown model →
  `null`, never a guess.

**[Module 13](../DOSSIER.md#module-13-verification-before-trust)'s discipline,
running at product time.** "Verification before trust" is usually read as
checking what the agent produced while you build. The same rule runs here in
production, against the product's own model output: every suggestion is a
hypothesis until TMDB confirms it, and one that cannot be confirmed never
reaches a user. The two readings are the same discipline at two different
moments.

**Knowing where it does not apply is part of the same skill.** The taste verdict
is never fact-checked, and that is deliberate rather than an omission — it
asserts an opinion about the viewer, so there is nothing in it to check against
anything. It is contained differently instead: capped at 450 characters,
stripped of markdown, and rendered with `textContent`, so the worst case is an
off-tone sentence rather than a false claim. Running a verification pass over it
would be theatre, and
[Module 13](../DOSSIER.md#module-13-verification-before-trust) names theatre as
one of the ways verification fails while looking rigorous.

**The limit of the guard is stated rather than glossed.** The cross-check proves
a card shows **a** real film; it does not prove it shows **the** film the model
meant. `verifyTitle()` keeps TMDB's top result when nothing matches
title-for-title, which rescues a missing "The" or a misplaced hyphen and
occasionally substitutes a neighbour. That trade was taken with the numbers in
front of it
([`D-054`](DECISIONS.md#d-054--the-tmdb-verification-claim-was-softened-instead-of-the-matcher-being-tightened)),
and the documents that used to promise more were corrected rather than the
matcher being tightened.

## 4. Making failure visible (Module 13)

Once an AI call is attempted, a log row is **always** written — success *or*
failure — with `status`, `error_text`, token split and duration. A handled
model/parse/network failure logs `status='failed'` and then re-throws for a calm
inline message in the UI. The in-app "AI call log" viewer (footer button) shows
both log tables merged, so the audit trail is demonstrable in the browser, not
only in the Supabase table editor.

`GET /api/ai-log` is the primary audit surface: both features, successes and
failures, token split, duration, per-call cost, and totals. `GET
/api/recommendations/history` ([SPEC §4.5](../SPEC.md#45-api-endpoints-draft))
is deliberately kept as the narrower per-feature JSON view — recommendation runs
only — but nothing in the UI depends on it; the merged log is what the app and
the demo use.

One honest caveat: six of the earliest log rows predated the migration that
added the token split and duration columns, so they showed blanks in those
fields. They were deleted by hand, for presentation, rather than left to age out
of the 60-row window. **Rows have been removed by hand exactly twice in this
project's life, and both times are written up:** these six
([`docs/DECISIONS.md` D-019](DECISIONS.md#d-019--six-pre-migration-log-rows-deleted-rather-than-annotated-forever)),
and, on 2026-09-13, a set of failed-verdict rows that named a model the call
never used
([D-070](DECISIONS.md#d-070--log-rows-that-misnamed-their-model-were-deleted-by-hand-not-preserved-as-history)
— wrong data about a real event, rather than history worth preserving). No code
path in the app can delete a log row; both removals were deliberate, by hand,
and recorded as exceptions to the append-only argument the log rests on.

## Keeping the record true, and what the 2026-09-19 sweep did differently

The deliverable here is the repository, so its failure mode is not a crash — it
is a sentence that was true when written and quietly stopped being true. Ten
separate days between 2026-09-07 and 2026-09-19 carry a staleness sweep
(`git log --oneline --grep=sweep`). This section is about why the last one found
things the earlier ones had walked past for two weeks, because the method is
more reusable than the fixes.

**The diagnostic case.** On 2026-09-11 commit `cc41020` thinned the AI call
log's totals divider from 2px to 1.5px. The declaration changed; **three prose
descriptions of it did not** — two comments in
[`public/styles.css`](../public/styles.css), one of them nine lines above the
declaration it contradicted, and a sentence in
[`docs/AI-CALL-LOG.md`](AI-CALL-LOG.md) that disagreed with the code block
quoted five lines beneath it. Every sweep between then and 2026-09-19 read those
files and passed over all three.

**Why they did.** A sweep that reads each file forwards asking *"is this still
true?"* requires the reader to already know the truth. It also reads prose and
code in different modes, so a comment asserting `2px` directly above
`background-size: 100% 1.5px` does not register as a contradiction — it registers
as a comment, and then as a declaration.

**What changed was the direction of reading.** The claim was taken first and
resolved against its referent, with the worklist generated mechanically so
nothing was skipped for looking boring:

| Technique | What it is for |
|---|---|
| **Claim → source, never file → doubt** | Turns *"do I know this is wrong?"* into *"does this resolve?"* |
| **Vocabulary derived from the corpus** | 4,448 number-plus-noun pairs and 1,264 distinct noun heads, read off a frequency table. An allowlist decided in advance is a filter on what can be found — a 2026-09-16 pass proved that by filtering 3,681 figures through sixty nouns and therefore being unable to see three of them |
| **Cross-file comparison as its own pass** | The upgrade that matters most, and the one with a completeness argument behind it rather than a diligence one — see [below](#a-per-file-sweep-is-structurally-incomplete-not-merely-less-thorough) |
| **Enumerate the referent set** | *"These eight are all X"* is never falsified by any of the eight. It took listing the directory |
| **Open the artifacts, run the commands** | Reading the embedded log capture is what disproved a cost figure in [`README.md`](../README.md); the two git commands in [`ACCEPTANCE.md`](ACCEPTANCE.md) criterion 8 were re-run rather than quoted |

### A per-file sweep is structurally incomplete, not merely less thorough

This is the difference worth carrying forward, and it is a stronger claim than
"we looked harder". Every other technique above finds defects a sufficiently
diligent per-file reader could also have found. **Cross-file comparison finds a
class that a per-file sweep cannot reach even when executed perfectly**, because
each file is individually self-consistent and the contradiction exists only
*between* them. No amount of care inside one document gets you there; the unit
of inspection is simply wrong.

**This repository diagnosed that in September and then only half-acted on it.**
[`check-claims`](../scripts/check-claims.js) exists because
[`README.md`](../README.md) described another file's verdict sixteen hours
after it changed, and its header says why a sweep had missed it: a staleness
sweep *"reads each document forwards ('is what this file says about itself still
true') and cannot see a claim ABOUT ANOTHER FILE that the other file has since
falsified."* The gate closed that gap for every claim that **points at
something** — a path, an entry, a capture, an identifier. Nothing closed it for
claims that merely **characterise** something, and that is the half the
2026-09-19 sweep worked.

**The worked example.** Four documents described one enumerable set — the eight
`RS-n` states needing two captures — and all four disagreed:

| Document | What it said | Reality |
|---|---|---|
| [`MERGE-READINESS.md`](MERGE-READINESS.md) | all eight split page vs audit trail | five do |
| [`RESILIENCE.md`](RESILIENCE.md) | *every* other pair splits page vs audit trail | false of two of seven |
| [`screenshots/README.md`](screenshots/README.md) | "for four of them" | five, and three states went unexplained |
| [`CLAUDE.md`](../CLAUDE.md) | "the first four" | a listing-order artefact; the fifth is listed last |

**Be precise about what was invisible and what was merely unread**, because the
honest version is more useful than the flattering one. Only the
`MERGE-READINESS.md` sentence was strictly unfalsifiable from inside its own
file — it names no member of the set, so nothing in that document could
contradict it. The other three were falsifiable in principle and went unread in
practice for the same reason: checking a sentence that characterises an
eight-member set in the abstract means holding all eight in mind while reading
prose, which nobody does on the twelfth pass through a file they have read
eleven times.

**What actually broke it open was the combination.** A cross-file numeric
comparison over seventeen counted subjects flagged that two documents said
`8` and `4` about the same thing — that was the *trigger*, and without it the
set would not have been looked at. Listing the directory was the *resolution*:
eight states have two frames, and the second frame is an audit-trail shot for
five of them, a before-and-after for one, a second feature for one, and a
successful retry for one. **Neither step finds it alone.** The comparison says
*something here is wrong*; only enumerating the referent says *what*.

**By raw count this was not the most productive technique** — re-resolving a
claim against its source found more defects. It was the most *irreplaceable*
one, which is a different and more important property in a repository whose
documents cross-reference each other as heavily as these do.

**The finding, which is the part worth reusing.** Every defect sat in a claim
with **no resolvable referent** — a described value, a figure contradicted by an
embedded image, a set characterised in the abstract, an enumeration that was
complete when written. The counts everyone re-checks were correct in every file:
merges, tests, gates, captures, prompt versions, models, dependencies, reverts.
**Attention had been going where verification was already cheap.**

So: **a count is safest when it names its members.** Several now do — the gate
list, the nine decision entries behind the AI call log, the five RS states whose
second frame is an audit-trail shot. A named list is falsified by reading it; a
bare numeral is falsified only by someone independently recounting, which nobody
does.

**Three things this owes to earlier work, since the method was not invented from
nothing.** The [living log](../CLAUDE.md#project-status--living-log) already
recorded how merges 22 to 27 each failed — wrong render context, wrong file
types, a claim whose falsifier it never names, a test not re-applied as its
subject changed, a filter whose vocabulary limits its reach — and that list was
used as the specification for where to look. The earlier sweeps built
[`check-claims`](../scripts/check-claims.js), which had already eliminated
paths, commits, identifiers and capture counts as a class, so the whole budget
could go on claims nothing can resolve, which is exactly where the defects were.
And one find was luck: the divider surfaced only because a document happened to
quote its own source adjacent to its prose.

## 5. Incident 1 — and the guardrail it produced (Module 12)

During AI-path testing the agent ran a "delete all movies" cleanup step; a second
run also deleted real films the user had added (ratings + reviews, unrecoverable
— the Supabase free tier has no point-in-time recovery). A separate
`Get-Process node | Stop-Process` also killed the user's running dev server.

Both were process failures, not code bugs. The response is recorded in
[`CLAUDE.md`](../CLAUDE.md#working-agreements-binding--added-after-incident-1)
as **binding working agreements**: never run destructive operations against live
data, never bulk-kill processes, tag any unavoidable test rows and delete only
those. Documenting the failure and the resulting rule is itself part of the
practice.

[Module 12](../DOSSIER.md#module-12-safety-control-and-recovery) makes Git the
primary safety layer, and this is the case Git cannot reach: what was lost was
rows, not files, so there was nothing in the working tree to roll back to and no
point-in-time recovery behind it. Where recovery is unavailable the only
remaining layer is control — a rule about what the agent may do at all — which is
why the agreements above are written as prohibitions rather than as a cleanup
procedure.

## 6. Tests

`npm test` (Node's built-in runner, no dependency, 62 tests) covers:

- **Pure helpers** where every truncation bug actually lived — `parseModelJson`,
  `tidyReason`, `tidyVerdict`, `estimateCostUsd` — plus `loadPrompt` against the
  real prompt files, so a malformed prompt version fails the suite.
- **Routes** ([`test/routes.test.js`](../test/routes.test.js)): input validation
  (the 400s), duplicate add (409), `GET /api/config` / `/api/health`,
  TMDB-unreachable (502), the below-threshold guards (422), and — the one that
  matters most — OpenRouter unreachable returning 422 *and* still writing a
  `status='failed'` row to `recommendation_logs`. That's the "make failure
  visible" contract under test.
- **Regression guards**, each added the day the bug was found and each checked
  to fail without its fix: a film deleted in another tab returning 404 rather
  than a 500, TMDB's own rating actually reaching the insert, and TMDB's "no
  votes" `vote_average: 0` being stored as `null` instead of as a real score of
  zero.
- **The recommendation SUCCESS path**, added 2026-09-09 — until then the only
  recommendation tests were its two failure paths, so every rule deciding what a
  user actually sees was unproven. One run now asserts that of four model picks
  only the verified, unowned, non-duplicate one survives; another that an
  unrated film already in the list is never recommended back; five more that a
  run which returns nothing reports WHY truthfully, rather than always blaming
  the model for naming films the user already had.
- **One invariant written as a loop over BOTH AI features**, so they cannot
  drift into two answers: whenever a `status='failed'` row reaches a log table
  the response must advertise the AI call log, and whenever no row was written
  it must not. Each of these was verified by breaking the code it guards and
  confirming the intended test — and only that test — fails.
- **Two failures at once**, added 2026-09-11 and also written as a loop over
  both features: when the AI call fails AND the log write then fails, there is
  no row to hold either cause, so stderr is the only surviving record and the
  test asserts both causes reach it. Probed the same way — dropping the
  composition loses the AI cause, dropping the `console.error` loses both.

To keep the live database untouched
([§5](#5-incident-1--and-the-guardrail-it-produced-module-12)), the Supabase
client is swapped for a small in-memory fake
([`test/helpers.js`](../test/helpers.js)); TMDB and OpenRouter are stubbed
through `globalThis.fetch`. [`server/index.js`](../server/index.js) exports
`app` and only starts listening when run directly, so a test can drive it on an
ephemeral port.

Still manual: the resilience *UI* states (the calm inline messages) — worth a few
screenshots for the submission even though the server side is now tested.

## 7. Gaps named while building, and how each one closed

Every item here was written down while it was still open, and every one is now
closed. They are kept rather than deleted because *when* a gap was named is part
of the record this document exists to show.

- ~~Not yet deployed.~~ **Deployed 2026-09-07 to Render:
  https://cinerank-g6lx.onrender.com** — no application changes were needed,
  which is the point: the `start` script, `engines`, `process.env.PORT` handling
  and the `/api/health` probe had all been in place since before there was
  anywhere to deploy to. Netlify was ruled out from the beginning and stayed
  ruled out (static files + serverless functions only; this is a long-lived
  `app.listen` server). Free tier, so it sleeps after ~15 minutes idle and the
  first request then takes anywhere from a few seconds to a minute while the
  instance wakes; every load after that is immediate.
- ~~Resilience (TMDB down, OpenRouter down) is implemented but should be
  captured as screenshots for the submission. Deliberately deferred to a
  dedicated pre-submission session, so the shots match the finished UI rather
  than a mid-overhaul one.~~ **CLOSED 2026-09-13/14.** The deferral held and
  then paid off: the shots were taken against a settled UI, and the set grew
  well past the nine states this bullet anticipated. **Sixteen states,
  twenty-four frames**, embedded and argued in [`RESILIENCE.md`](RESILIENCE.md);
  the recipes are greppable in
  [`CLAUDE.md`](../CLAUDE.md#pre-submission-blockers--all-ticked-as-of-2026-09-14)
  as `RS-1` through `RS-16`. Shooting them found three real defects that nothing
  else would have, which is the entry worth reading here rather than the count.
- ~~**The recommendations error state is written and then immediately
  overwritten** by the availability-sync that runs in the same `finally`, so a
  failed run shows the user nothing. The verdict side already does it properly —
  its fallback links straight into the AI call log.~~ **Fixed 2026-09-09, and it
  was worse than written on both counts.** It was filed as an error-message bug;
  the `finally` reassigns the element unconditionally, so the SUCCESS line and
  the zero-result line died with it — a failed run, a successful run and a page
  that had never run were indistinguishable apart from the cards. And the
  verdict was *not* the model to copy: its fallback offered the AI call log for
  every failure, including CineRank itself being unreachable, where that log
  cannot load either. Reading the "good" implementation before copying it is
  what turned one fix into three (a guarded single-writer for the hint; a
  `logged` flag the server sets only when a row was really committed; the same
  treatment applied back to the verdict).
  [D-047](DECISIONS.md#d-047--a-failure-may-only-offer-the-ai-call-log-when-a-row-was-actually-written-r8-r9)
  has the reasoning.
- The prompt-injection defense should be shown with a concrete demo movie whose
  review is an injection attempt. **Done 2026-09-13** — the film is *The Room*,
  seeded by [`npm run seed-demo -- --with-injection`](../scripts/seed-demo.js)
  and removed after the captures. Five frames,
  [`docs/screenshots/pi-1` … `pi-5`](screenshots/README.md#pi---prompt-injection);
  analysis under
  [ASI01 in `docs/SECURITY.md`](SECURITY.md#asi01--agent-goal-hijack). Shooting
  it exposed a trap worth more than the screenshots: at its first rating the
  demo film sorted outside the recommendation prompt's top-five window, so half
  the evidence would have shown a feature resisting an attack it was never sent.
