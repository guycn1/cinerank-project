# FRAMING.md — CineRank

The Module 6 framing document: the problem, who it is for, when it is finished,
and what will deliberately not be built. It is the brief the agent works from.
`SPEC.md` says how the thing behaves; this says why it exists and where its edges
are.

**What is new here and what is not, stated up front.** Three of the four artefacts
below have been in the repository since `aadaf18` (2026-09-04), the commit that
added `SPEC.md` and `CLAUDE.md`: the problem statement and the out-of-scope list
as `SPEC.md` § 1, and the testable definition of done as `SPEC.md` § 7.1. What
this file adds is the **stakeholder list**, which was genuinely missing, and one
place where the four sit together and can be read as a brief rather than found
scattered. The out-of-scope list is also reconciled here — `SPEC.md` § 1 carried
three exclusions and `CLAUDE.md` carried four, which is one list too many.

## Problem statement

*The situation, not the fix.*

Someone who watches films steadily accumulates opinions faster than they
accumulate any way of holding on to them. The opinions end up in three places and
none of them is much use later: memory, which reorders itself; scattered notes,
which are never read again; and a streaming service's history, which was built to
predict what will keep a subscription rather than to reflect a taste back at the
person who has it.

A personal ranking is the obvious answer and it fails for a specific reason: **a
list that only stores is a chore.** Every entry costs effort and returns nothing
beyond the entry itself. The list decays because keeping it up to date buys the
owner nothing.

So the problem is not "there is nowhere to record film ratings". It is that
**recorded ratings stay inert.** Something has to read them back and return
something the owner could not have got by re-reading their own list.

There is a second problem underneath, and since this is coursework it is named
rather than hidden. A project of this shape usually ends up with a database that
is a spreadsheet with extra steps and an AI feature that is a chat box wearing the
app's colours — both present because the marking scheme expects them. The
engineering problem is to build one where **the database and the model each earn
their place**: where the stored ratings are genuinely the input to something, and
where the model has one narrow job it is actually suited to.

`SPEC.md` § 1 states the same problem from the solution's side and predates this
file; neither supersedes the other.

## Stakeholders

*Who is affected, how, and what trade-off that licenses the agent to make.*

| Stakeholder | Affected how | The trade-off it settles |
|---|---|---|
| **The list owner** (single user; the app has no accounts by design) | Their ratings and reviews are the entire value of the app, and they are not recoverable — the Supabase free tier has no point-in-time recovery | Durability and honesty about AI output beat feature count. This is the stakeholder who makes "never run destructive operations against live data" a binding rule rather than a preference |
| **The course grader** | Reads the repository, never the running app. Cannot ask a question | Legibility is a deliverable. A markdown file that renders wrong is a defect, not a cosmetic issue — which is why `npm run check-markdown` exists and is a commit gate |
| **The two authors, as future maintainers** | Return to the project across many sessions with no memory of why a choice was made | A decision that is not recoverable later will be silently undone. Hence `docs/DECISIONS.md`, written at the moment of the choice rather than afterwards |
| **The agent (Claude Code), as executor** | Acts on this brief and on `CLAUDE.md`; ambiguity becomes a confident wrong guess | Precision in the brief is worth more than precision in any individual instruction. Where the spec is deliberately open, it says so explicitly (§ 3.2) so the openness is not mistaken for an omission |
| **TMDB and OpenRouter** | Bear the request volume, and OpenRouter's calls are paid for out of the owner's own quota | Prefer one call to many. TMDB's rating is captured once at add time and never refreshed (D-036); the console debug harness exists so that UI work on the recommendations grid costs no OpenRouter calls at all |

The last row is the one that looks like padding and is not: two real design
decisions in this repo exist because of it.

## Definition of done

*Specific enough to be tested against.*

**The enumerated, testable form is `SPEC.md` § 7.1 — eight criteria, each a
checkbox.** They are not restated here, because a definition of done that exists
in two places drifts and then neither is trustworthy. § 7.1 is the authority.

What § 7.1 does not carry, and belongs in the framing:

* **Done means the gates pass, not that the code runs.** `npm test`,
  `npm run scan-secrets` and `npm run check-markdown` all green. Module 10's
  warning is exact here: leave out success criteria and the agent stops when the
  code runs rather than when it works.
* **Done means the trail is legible.** The repository is the deliverable, so a
  feature that works and is undocumented is not finished. In practice: a
  non-obvious choice has a `docs/DECISIONS.md` entry, and `CLAUDE.md`'s living log
  reflects the current state.
* **Done means merge-ready**, which for this project means `draft` merged to
  `main` with explicit human confirmation, and that merge is also what closes the
  third turn of the spiral (`SPEC.md` § Specification status).

**Deliberately not part of done:** visual perfection below ~350px viewport width,
and anything at all below ~290px. That is a scope boundary set with a deadline in
view, and it is written into `CLAUDE.md` as a rule the agent enforces rather than
one the authors have to remember.

## Out of scope

*What will not be built, said plainly.* This is the reconciled list — it
supersedes the three-item version in `SPEC.md` § 1 and matches `CLAUDE.md`.

1. **User accounts, authentication, multi-user support.** Single personal list.
   This is not a security gap; the anon-key-versus-service-role split is the
   least-privilege demonstration, and adding accounts to manufacture a better one
   would be theatre. See `CLAUDE.md` § Security & Scope and `docs/SECURITY.md`
   ASI03.
2. **Social features** — sharing rankings, following other people, public lists.
3. **Editing an AI suggestion before accepting it** — neither its reason text nor
   its position. A suggestion is accepted or dismissed.
4. **Automatic or background regeneration** of recommendations or taste verdicts.
   Both are always explicitly user-triggered and never regenerated silently on
   page load. This one is load-bearing rather than cosmetic: silent regeneration
   would spend the owner's OpenRouter quota without being asked, and it would make
   the AI call log a record of things nobody requested.

Each keeps the agent from solving an adjacent problem nobody asked about, which is
the job Module 6 gives this list.

## What the framing actually bought

The test of a framing document is not that it exists but that it constrained
something. Four places where it visibly did:

* **The out-of-scope list held under pressure.** Recommendations go stale the
  moment any rating changes, and regenerating them automatically is the obvious
  fix. It was never built, because exclusion 4 forbids it. R16 instead clears a
  locked section's stale output and leaves regeneration to the user.
* **The stakeholder list decided a data question.** TMDB's own score is a snapshot
  written once at add time. Refreshing it would cost a TMDB call per film per page
  load and make the ranked list depend on TMDB being reachable — a trade the list
  owner loses (D-036).
* **The definition of done stopped work twice.** Step 5 closed against the ~350px
  target with known imperfections below ~310px, because the boundary was set in
  advance rather than argued each time. R18 closed as won't-fix on measurement for
  the same reason.
* **Naming the grader as a stakeholder changed a whole class of work from
  cosmetic to blocking.** Both long markdown files were found rendering wrong on
  GitHub. If the only stakeholder had been the list owner, that would have been a
  shrug; naming a reader who only ever sees the repository made it a defect, a
  fix, and a permanent verification gate (D-065, D-066).
