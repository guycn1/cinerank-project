# Decision log — the *why*

Started at project conception, not bolted on afterwards (course Module 8: the
reasons behind a choice are clearest at the moment it's made, and the agent can't
recover them later). **Newest first — a new entry goes at the TOP of this
file, directly under this header.**

---
## D-057 · The verdict typing effect: a single writer, and two separate children for what is seen vs. what is heard

**The choice.** `#verdict-text`'s content is now written through ONE function,
`setVerdictText(text, { typed })`, rather than eight scattered
`textContent =` assignments. It builds two child spans every call: a
`.sr-only` one holding the FULL text immediately, and an `aria-hidden`
`.verdict__typed` one that is what actually animates. Only the success path
passes `{ typed: true }`; every placeholder, the busy line and both error
messages render instantly, unchanged from before this item existed.

**Why not the obvious approach — typing straight into `#verdict-text`'s own
text node.** That element is `aria-live="polite"` (SPEC's accessibility work,
already covered by R22's lesson about that same recs-hint region): mutating
it character-by-character would announce it character-by-character. The
element needs to carry the FULL, correct text for assistive tech from the
first frame it changes, while the sighted view is free to animate — those are
two different requirements on the same node, so they got two different
children instead of one compromise.

**A pure-CSS reveal was considered and rejected.** The classic typewriter
trick — `white-space: nowrap; width: 0` animated to the content width with
`steps(N)` — only works for a single unbroken line. The verdict is 2–3
sentences (~35–60 words) that wrap across several lines at the banner's
width, and there is no CSS-only mechanism that reveals wrapped,
proportional-width text character-by-character without JS measuring each
line — the kind of measurement this project has gotten wrong twice before
by estimating instead (D-030's Fraunces figure widths). JS driving a
`textContent.slice()` loop on a dedicated node was more work than the CSS
idea but had no hidden measurement step to get wrong.

**Cancellation is a generation counter, not a boolean flag.** Every call
bumps `verdictTypeGen`; a running loop checks its captured `gen` against the
current value on every tick and quietly stops if it no longer matches. This
is the same shape D-040's single-writer fix used for expanded reviews, and it
is what makes the hazard this item was flagged with — `syncVerdictAvailability()`
or a second click landing mid-type — a non-event: the new call's own
`setVerdictText()` invocation cancels the old one as a side effect of running,
so no caller needs to know a typewriter exists or ask "is one running?" first.

**One call site deliberately bypasses the helper**, and it is commented at
the point it does: the `err.logged` branch builds a link (text node + `<a>` +
text node), not a single string, so there is nothing plausible to type. It
still benefits from the guarantee: the busy branch that always runs first in
that handler has already cancelled any leftover typer for this run, so the
bypass cannot race a live animation.

**The pace, 18ms/char, is a tuned dial, not a decision** — the user tried 18ms,
then 15ms, then reverted to 18ms, all by eye, and none of that is logged as a
decision; recorded here only so a future session does not "helpfully" retune
it by misreading this entry.

---
## D-056 · The busy cue changes playbackRate, not animation-duration (supersedes one call in D-055)

Step 4b's last glint item: while "New verdict" is generating, the band travels ~5x
faster and brightens. Two dials, and they ended up in two different places.

**D-055 got one of them wrong, and said so confidently.** It worked out that the
twenty layers' delays are derived from the duration, prescribed a `--sheen-dur`
custom property so one value could drive the duration and all twenty delays, and
then added: the dash will JUMP when the speed changes, but that is *"accepted
rather than fixed… it happens at the instant of a click, when the eye is on the
button; machinery to smooth it would cost far more than it buys."*

That was built, and the user rejected it on sight — **"it is noticeable even when
the eyes are on the button"**. They were right, and the cost estimate was wrong:
the fix is four lines.

**Why a duration change cannot avoid the jump.** A CSS animation's progress is
`(currentTime / duration)`. Changing the duration re-evaluates that fraction at
the current instant, so the position necessarily moves. Measured at the moment of
the switch, a layer went from 0.4867 of its cycle to 0.4333. No amount of
delay-rescaling helps, because the delays were never the problem.

**`playbackRate` fixes it by construction.** The Web Animations API preserves
`currentTime` when the rate changes, so only velocity changes. The same layer
stayed at 0.4867 exactly. `setSheenRate()` in `app.js` sets it on the twenty
animations obtained via `getAnimations()`.

**It also solves the layer-registration problem for free**, which the CSS route
had to work for: each layer's phase lives in its own `currentTime`, so preserving
every `currentTime` preserves every offset between them. Inter-layer spacing held
at 0.045 across the switch, with no `--shift` arithmetic involved at all.

**What survives from D-055.** The `--sheen-dur` machinery stays and is still
correct — it is now the RESTING speed knob, where one value drives the duration
and all twenty delays. Only the claim that it should drive the BUSY state is
superseded. The CSS carries a matching warning not to reintroduce a duration
override there.

**The split as shipped, and the rule behind it: each half is done wherever it can
be done without a visible seam.** Brightness is CSS (`opacity` on the group via
`:has([aria-busy])`) because opacity transitions smoothly and has nothing to
hide. Speed is JS because it is the one thing CSS cannot do cleanly here. The
instinct to keep the whole cue declarative is what produced the jump.

**Unchanged and still right:** no class and no state of our own — `busyButton()`
already sets `aria-busy` for exactly the right window and clears it in the
`finally` that restores the label, so the cue cannot stick on and it ends on an
error as well as on success. Under `prefers-reduced-motion` the global
`animation: none` means `getAnimations()` returns nothing, so `setSheenRate()` is
a no-op precisely where it should be, while the brightness half still lands.

**Residual, accepted knowingly this time:** velocity changes instantaneously
rather than ramping. That is a different artefact from a position jump, it reads
as "it sped up", and the user approved it after looking. A rAF ramp of
`playbackRate` is the fix if it is ever wanted.

---
## D-055 · The verdict glint: overcorrection, a revert, and a band that fades along a path

The mechanism (an SVG stroke dash on `pathLength="100"`) was settled on
2026-09-11. This entry is about everything after it — the polish, which went
badly before it went well, and is recorded for the METHOD rather than the values.
The final numbers live in `public/styles.css`; do not mirror them here.

### The failure: four compounding passes, and a framing error under them

The user asked for the band to be subtler, softer-edged and lower-contrast. Four
passes followed in one day, each moving several values at once: warm the stroke,
add a blur, cut the alpha, narrow the ring, slow the travel. Contrast over the
ring's three base stops went 3.54 / 2.34 / 1.62 down to 1.40 / 1.26 / 1.12, and
the user's verdict was that we were "in a loop… overcorrecting more and more".
They were right. **Nothing could be attributed, because nothing was isolated.**

Underneath it sat a framing error worth naming, because Claude repeated it three
times. **The user asks for OUTCOMES — "more subtle", "even fainter", "more
transparent". WHICH PROPERTY DELIVERS AN OUTCOME IS CLAUDE'S CALL.** Claude had
written into the CSS that a further reduction should come from the halo and the
speed and NOT the stroke alpha, then reached for the alpha anyway and described
it as the user overruling that advice. The user challenged it directly — *"why
do you keep saying I'm asking about the alpha?"* — and was right. Dressing up a
poor mechanism choice as deference is worse than simply making the choice, and it
corrupts the record: an earlier version of this entry stated Claude's inference
as the user's instruction.

Straightening it out paid at once. The next request was "more transparent +
softer edges", and on a 2px stroke those are THE SAME DIAL: raising `blur()`
softens the edges and cuts peak brightness together. Both asks, alpha untouched.
Three passes had been spending alpha on what the blur was giving away free.

### The fix: revert to the last commit and move ONE dial at a time

The user's call, and the transferable part: revert the working tree to the
pre-polish commit, **stop committing and stop editing docs**, then move one
property at a time and judge each alone. Deliberately radical values, so an
effect is unmistakable rather than a matter of taste — alpha 0.98 -> 0.3,
`blur()` 0 -> 15px, halo 5px -> 20px. Three dials were bracketed and settled in
minutes, after four passes had failed to settle any. Two were rejected outright
(a large blur destroys the band; a wide halo is all bloom), and the finding was
that the effect wants to be TIGHT and dim rather than diffuse.

### The mechanism that finally worked, and the three non-obvious things in it

The user asked for the band's ends to taper — `linear-gradient(transparent,
#fff, transparent)` along the direction of travel — while the ring's thickness
stayed crisp. A blur cannot do that (it softens the thickness too, which is what
made 15px useless), and a stroke dash has hard ends by definition.

Answer: **stack many dashes of decreasing length, centred on each other, and let
their alphas composite into a falloff.**

**1. Centre them with negative `animation-delay`, never `stroke-dashoffset`.** A
static offset leaves each layer travelling less than a full 100 units, so every
layer snaps at its own loop point. A negative delay shifts where in the cycle a
layer starts while it still runs the whole cycle. **Consequence, and it is a
trap: the delays are DERIVED FROM THE DURATION.** Changing the duration alone
multiplies every phase shift and the layers stop nesting.

**2. The alphas must be SOLVED, not chosen — and they are not monotonic.**
Layers composite multiplicatively (`1 - PROD(1 - a)`), so scaling them all
saturates the core toward 1 while the tips rise linearly, FLATTENING the taper
into the hard bar it was meant to replace. The user tried exactly that
(quadrupling every alpha) and reported it looked worse; measured, the core/tip
ratio fell from 7:1 to 4.4:1. The right method is to pick the target profile and
solve backwards, `a_k = 1 - (1 - C_k) / (1 - C_k-1)`. **The alphas then peak in
the MIDDLE layer and come back down**, because inner layers paint onto an
already-part-opaque stack. No intuitive sequence produces that, which is why the
block is generated rather than hand-written.

**3. The layer COUNT is an anti-banding parameter, not a detail.** A dash has
hard ends, so N layers can only ever make N steps. At five the band was a visible
STAIRCASE — the user photographed it — with a max step of 0.176 in composite
opacity. Twenty puts it at 0.043, under the threshold where the eye reads a seam.
**That was Claude's design flaw rather than a tuning error**, and the first
instinct (brighter values) had merely made the existing artefact visible.

### Performance: measured, then accepted

Twenty animated elements drew a fair question from the user.
`stroke-dashoffset` is a PAINT property, so unlike every other infinite
animation on the page (all transform/opacity) it cannot be composited — each
frame re-rasterises the strokes plus the halo filter.

Measured rather than argued, the user running each configuration:

| condition | effect of the sheen |
|---|---|
| unthrottled | none (below measurement noise) |
| 6x CPU throttle | none |
| 20x CPU throttle | 3 late frames in ~240 |
| software rendering, unthrottled | none |
| software rendering + 6x | none |
| software rendering + 20x | 26% fps drop, ~41% of frames late |

Two corrections Claude had to make mid-investigation, both prompted by the user
pushing back. **DevTools CPU throttling slows the MAIN THREAD ONLY** — not the
GPU, not raster threads — so the first "concern closed" was premature and was
withdrawn; the user's suspicion that the GPU had been doing the heavy lifting was
correct, and software rendering is the test that addresses it. Even that bound is
optimistic, because raster still runs on 20 unthrottled desktop cores.

**Decision: keep the look, change nothing.** The only failing configuration needs
no GPU AND a CPU 20x slower than the developer's, which no real device occupies.
The levers that would have helped — fewer layers, dropping the halo — both
degrade a design the user had signed off, to buy back frames on hardware the
audience does not have.

**One mitigation was taken**, and its justification is battery, not frame rate:
`pauseSheenOffscreen()` stops the animation when the banner scrolls out of view.
It does NOT address the measured cost, which occurs while the banner is visible;
that was said plainly rather than sold as a fix.

### Traps for the pending busy-state item (4b)

The spec is ~3s and a ~0.8 peak while "New verdict" is busy. Both dials are
booby-trapped by the above, and both have a one-line answer:

* **Duration cannot move alone** (trap 1). Express each delay as a fraction of a
  `--sheen-dur` variable, and one value then drives the duration and all twenty
  delays.
* **Brightness cannot be scaled** (trap 2). Author the layers at the BUSY peak
  and scale down at rest with one group `opacity`: group opacity scales the
  composite linearly, and `0.8 * bell(x) * (0.55/0.8)` is exactly
  `0.55 * bell(x)`, so the shape is preserved rather than approximated.

That makes the whole busy state two declarations and no JS — `busyButton()`
already sets `aria-busy`, so a `:has()` selector suffices and it cannot stick on.

### The lesson worth keeping

When tuning turns into a loop, **stop committing, revert to a known state, and
move one dial at a time with deliberately extreme values.** Four passes of
simultaneous changes produced something the user disliked and nobody could
explain; an afternoon of single-variable tests produced something they called
"almost perfect" and a mechanism nobody had thought of. And when a request names
an outcome, pick the lever yourself and own that choice — never attribute a
mechanism to the person who only described a result.

---
## D-054 · The TMDB "verification" claim was softened instead of the matcher being tightened

Backlog item R6 said `verifyTitle()` was overselling itself: it looks for a
case-insensitive exact title match and otherwise returns `results[0]`, so SPEC
§2.2 #4 and the README promised a drop path that the item claimed was "nearly
unreachable". The item asked for a deliberate matching rule and a statement of
what it costs.

**The first finding is that the item's own premise was false, and it was false
when written.** It asserted "TMDB search is fuzzy, so a hallucinated title
usually resolves to SOME real film". Probing 30 titles against live TMDB (free,
so this cost nothing but time) shows the search is close to token matching:

| probe class | n | outcome |
|---|---|---|
| invented titles, realistic shapes | 12 | **7 returned ZERO results** and were dropped correctly |
| invented titles that are real obscure films | 4 of the above | **EXACT-matched** — no rule can catch these |
| genuine fallback substitutions | 2 | `Arrival 2` → a 1906 newsreel; `Blade Runner 3` → `Blade Runner 2049` |
| legitimate picks the fallback RESCUED | 4 | Shawshank, LOTR Fellowship, Spider-Verse, Dr. Strangelove |

So the drop path is the common outcome, not an unreachable one, and the audit
had inverted the cost/benefit. Worth stating plainly: this was Claude's own
earlier item, written from reading the code without running it against the real
API. **Reading the code told us what the fallback COULD do; only measuring told
us how often it does.**

**The tiered matcher that was designed and then not built.** The two populations
separate cleanly on Dice bigram similarity — legitimate rescues score 0.83–1.00,
the bad substitutions 0.36–0.38 — so the obvious fix was: exact → normalised
(accents, punctuation, `&`, commas) → article-stripped → prefix containment →
similarity floor ~0.75 → drop. It works on paper. Three things argued against
shipping it:

1. **It cannot touch the commonest failure.** `The Silent Echo`, `Last Light`,
   `Shadow of the Wolf` and `The Long Road Home` all sound invented and are all
   real films that exact-match. The strictest possible matcher admits every one.
2. **Dice alone gets Dr. Strangelove wrong.** The correct long title scores 0.41
   while a wrong `National Theatre Live: Dr. Strangelove` scores 0.60, so the
   rule needs a containment tier purely to avoid a confident wrong answer — new
   machinery whose job is to patch the new machinery.
3. **It costs run size on a graded demo.** Four of the sample's picks survive
   only because of the fallback, and a recommendation run capped at six cards
   cannot afford to silently shed a third of them for a rare correctness gain.

**The user's call, given those numbers, was to leave the code and fix the
claim** — the cheapest honest option, and the one that does not risk the demo.
Claude had recommended the 0.75-floor matcher; the measurements are what changed
the recommendation's footing, and the user weighed run size higher. Corrected
instead: the JSDoc on `verifyTitle()` (which claimed "or null if no confident
match", where no confidence test has ever existed), the comment in
`generateRecommendations()`, SPEC §2.2 #4 and §6, the README, `docs/PROCESS.md`
and `CLAUDE.md` § Prompt Versioning. SPEC is ANNOTATED rather than rewritten,
following the precedent §2.3 already set for the verdict length — the
requirement as written stays visible beside what was actually built.

**The line that matters, and the one to keep saying:** the check confirms a card
shows **a real film**, not that it shows **the** film the model named. Every fact
on the card still comes from TMDB and never from the model, which is the half of
the SPEC clause that was always exactly true.

**One residual, deliberately not fixed.** `WALL-E` resolves to `East of Wall`
(2025). TMDB's own title is `WALL·E` with an interpunct, and the real film is not
in the top 20 results for any spelling tried — so tightening would drop it rather
than find it, and only a query-side change (searching alternative titles, or
using TMDB's `/find`) would help. It is the clearest example that the fallback
and the matcher are two different problems.

**Traps.** Do not re-open this from the code alone — the numbers above are the
whole argument, and they are not visible in `verifyTitle()`. Do not "fix" the
docs back to a stronger promise. And if the matcher is ever tightened after all,
[routes.test.js](../test/routes.test.js)'s duplicate-pick test is built ON the
fallback (`Collateral` → Heat), so it would need rewriting to a pick that
legitimately resolves to the same film — a green suite after tightening, without
touching that stub, would mean the tightening did not take.

---
## D-053 · The taste verdict alone runs on a stronger model

The user asked for the verdict to sound less formal. **Four prompt versions
later it still didn't**, and the useful part of this entry is how long it took to
stop blaming the prompt.

| version | strategy | result |
|---|---|---|
| v5 | ask for plain spoken English, 17 banned phrases | fixed sentence SHAPE, kept critic vocabulary |
| v6 | 22 banned phrases + a rewrite table | "no improvement" |
| v7 | delete the bans, 4 worked examples of the voice | worst of the chain — and broke the 2–3 sentence rule |

Counting the chain is what broke the loop: the file went 2405 → 4963 chars,
banned phrases went 1 → 17 → 22, and **worked examples of the target voice
stayed at exactly one until v7**. Two separate lessons fell out, and both are
worth more than the fix:

*A structural ban lands; a vocabulary ban does not.* v6 said "no semicolons,
ever" and the semicolon was gone from the very next verdict. Every vocabulary
ban in the same file did nothing. A ban removes one option and supplies no
replacement, so the model obeys it and falls back to its own default voice for
the words it does choose. **Register is a sample, not a rule.**

*And when three structurally different prompts produce the same output, the
prompt is not the variable.* v7 was written as a falsifiable test — examples
instead of bans — with the prediction stated in its commit that if it failed,
the lever was elsewhere. It failed. Haiku 4.5 on the same v7 prompt also broke a
rule it had held since v4 (four sentences against a stated 2–3), which is
plain instruction-following rather than taste, and pointed the same way.

**So the fix was the model, and it worked on the first try.** Same prompt (v7),
`anthropic/claude-sonnet-5`: the register landed, and the sentence count came
back into bounds — the second symptom resolving with the first is what makes
"the tier was the constraint" more than a story that fits.

**Cheapest real-time Sonnet, checked rather than remembered.** OpenRouter's
public model list (free, no key, no quota) prices sonnet-5 at **$2/$10 per Mtok**
against Haiku's $1/$5 — 2x, not the 3–5x guessed, and about **0.29¢ a verdict**.
The newest Sonnet is also the cheapest; every older one is $3/$15. The `:batch`
variants undercut it at $1/$5 and are a trap — asynchronous endpoints that would
break a live request.

**Per-FEATURE, not app-wide, because the user is short on quota.** `chat()` takes
an optional `model` defaulting to the app-wide one; only `tasteVerdict.js`
overrides it. Recommendations stay on Haiku deliberately: that task is "name some
films", nothing about it depends on voice, and it is the feature that burns
tokens. The AI call log already renders model per row, so the split is visible in
the audit trail rather than buried in config — which turns a cost decision into
demonstrable evidence.

**The honest cost of getting here:** four real OpenRouter calls spent on prompt
versions that moved nothing, and a wrong conclusion published in v6's commit
message ("concrete sentences to steer away from have moved this prompt further
than any adjective") that v7 disproved a day later. `docs/PROCESS.md` records the
wrong turns alongside the fix, because a prompt chain showing only successful
iterations would misrepresent what this work is actually like.

**Trap for later:** v7 is live and it is the version that FAILED on Haiku. If the
verdict model is ever moved back down a tier, move the prompt back to v6 with
it — v7's four examples dilute the rules underneath them on a small model, which
is exactly how the four-sentence break happened.

---
## D-052 · `--ink-faint` stays below WCAG AA, on purpose

Claude flagged that `--ink-faint` (#6b6760) measured **3.49:1** on the page and
**3.11:1** on a card — under AA's 4.5 for normal text, and `.no-review` and
`.score-tmdb.is-muted` are normal-size text on a card. The user asked for it to
be brightened, with one constraint: *"its brightness should still be closer to
how it is right now than to `--ink-dim`; the difference between 'faint' and 'dim'
should remain noticeable."*

Claude picked the brightest value satisfying that constraint — **#868178**, AA
clear on both grounds at 5.07 / 4.51.

### The false alarm, which is worth recording on its own

The user reported back that faint was now *"almost indistinguishable"* from dim.
**That report was mistaken, and they caught it themselves.** They had compared
"No movies yet — search for one above to get started." against "Rate at least 3
movies to unlock recommendations (you have 0).", expecting the first to be faint
and the second dim. But the empty-list line had been moved to `--ink-dim` in the
*same commit*, so they were looking at dim against dim and correctly concluding
the two were identical.

**The mechanism is the lesson: two changes to the same visual question shipped
together, and one of them silently destroyed the test for the other.** Nothing
was wrong with either change. Worth remembering when a token and one of its
consumers move in one commit — say what is left to compare against, or the next
comparison is meaningless.

Claude did not catch it either, and acted on the report at face value.

### What re-testing actually found

The user then tried candidates in devtools and reported precisely: #868178 *was*
too close to dim, though not indistinguishable, and the #76716a correction had
gone a shade too dark. Settled at 30% of the way back: **#7b766e**.

**The metric that decides this is not the one AA is defined against.** Whether
two type tiers read as two tiers depends on their contrast with *each other*:

| | vs `--ink-dim` | on `--bg` | on a card | separation kept |
|---|---|---|---|---|
| `#6b6760` original | **2.09** | 3.49 | 3.11 | 100% |
| `#868178` AA-clearing | **1.44** | 5.07 | 4.51 | 69% |
| `#76716a` over-correction | **1.79** | 4.06 | 3.61 | 86% |
| `#7b766e` shipped | **1.67** | 4.36 | 3.87 | 80% |

Clearing AA would have cost nearly a third of the separation this token exists
to draw. Claude had optimised a number it was measuring and damaged one it was
not — that part of the original finding survives the false alarm intact, because
it is arithmetic rather than an observation.

### So the app knowingly ships two tokens below AA

`#7b766e` is 4.36 on the page and 3.87 on a card — closer to the line than
before, still short of it. Not a shrug at accessibility, and not something to
re-open with a contrast audit:

*The mitigation is the tier above it.* R26 and D-051 moved every line that is the
**only thing on its surface** up to `--ink-dim` (7.28:1) — the availability
sentences, all five zero-result messages, the failure line, the empty ranked
list. What remains on `--ink-faint` sits beside content that carries the meaning:
`No TMDB rating` next to a title, a poster and a score; `Based on: …` directly
above the cards it introduces; the metadata footer under the result it describes.
None of it is the sole carrier of anything.

*And two tiers that read as one is not an accessibility win either* — it removes
a signal from everybody, including the people the contrast rule is written for.

**The transferable lesson:** when a token's job is to be *quieter than another
token*, contrast against the background is not the whole specification. Measure
the pair.

---
## D-051 · Card size comes from the viewport, never from the result count (R29)

D-050 moved the recs grid's column count into JS but left the tracks filling the
section, so the COUNT still decided the width. The user sent a screenshot of the
consequence: one recommendation on a four-wide viewport rendered as a single
card spanning the whole column, with a poster taller than the window. Two cards
was the same fault, milder.

**The user's rule, in their words:** *"I do not believe that a card's size should
ever depend on how many cards returned. A better fix for the ugly unoccupied
space in a row is to just center it all — and screw the spaces in the side
edges: an evenly distributed space to the right of the row AND to the [left] of
it looks far less hideous than having all that space in one side, trust me."*

**That overruled Claude, and the record should say so.** Two turns earlier Claude
had argued against exactly this shape, on the grounds that a centred grid sits
narrower than the heading, the hint and the ranked list above it, breaking the
page's single left margin. The user weighed that against a card stretched to
1000px and chose the margins. They were right: the misalignment is a static
quality of the layout, while the stretched card is a defect that gets worse the
wider the window.

**How, and the alternative that was rejected.** `balancedColumns()` became
`balancedLayout()` and returns a width beside the count: the width from `fit`
(the widest packing the viewport allows), the count from the balancing. The
obvious implementation was to size each track — `repeat(2k, <half-track>)` plus
`justify-content: center`. Rejected: it puts a computed pixel length into
`grid-template-columns`, where D-050's doubled-track arithmetic lives, so the
half-column offset that centres a short last row would have to be re-derived
against it. Capping the CONTAINER instead (`max-width: var(--rec-width)` +
`margin-inline: auto`) leaves the `1fr` tracks dividing a width that is already
correct, so every piece of D-050 is untouched — and when the balanced count
equals what fits, the cap IS the container width and both declarations are
inert.

**The trap, and it would have been silent.** `balancedLayout()` measures
`grid.parentElement.clientWidth`, never `grid.clientWidth`. The grid's own width
is what this function sets; reading it back would feed each answer into the next
and ratchet the cards smaller on every frame of a window drag. Nothing about the
rendered result would look wrong on the first run — it would only degrade while
resizing, which is exactly the kind of bug that gets reported as "sometimes the
cards go tiny".

**This retires D-050's `> 1` restraint.** That restraint kept six cards at 4 + 2
rather than 3 + 3, because balancing then made every card ~36% wider. With the
width fixed by `fit` it cannot, so 3 + 3 is the same card and the same two rows,
and the restraint is deleted rather than kept as dead weight.

**The metadata footer moved out of the grid**, settled before building. The
deciding fact is not obvious: `grid-column: 1 / -1` spans the TRACK LIST, not
the container, so with the tracks capped and centred the footer would have
shrunk to match — one card wide on a single-card run. Spanning it to the
container would need a flexible gutter track at each end, shifting every column
index, adding two gaps to the width arithmetic, breaking the half-column offset,
and dropping auto-placed cards into gutters. Out of the grid it is a plain block
underneath, full width, coupled to nothing.

**Added hours later, once the user looked at it: a card also needs a MAXIMUM
width, and the reason is height.** Decoupling width from the count fixed the
one-card case only in the sense that the count no longer chose the width — the
width still came from `fit`, so each time one fewer column fitted, the survivors
inherited the space. The poster is `aspect-ratio: 2/3`, so a pixel of width
costs 1.5 of height, and at one card per row that was a 390px card carrying a
**585px poster on an 869px window**. The user sent screenshots from either side
of all three column boundaries, which is what made the pattern legible: the
symptom is not "one card is too wide", it is "the card gets taller every time a
column drops out".

`--rec-max: 250px`, alongside the existing `--rec-min: 190px`, so the two are the
card's allowed width band and both live in the stylesheet. Chosen against the
user's own evidence rather than picked: they called 258px (the 4→3 boundary)
"slightly" too tall and 291px and 390px clearly too tall, so the cap sits just
under the mildest case they objected to. Wide layouts are untouched — a
four-column card is 237px and already under it.

**Capping only ever shrinks, which is why it does not disturb the arithmetic
above.** `fit` is still "how many `--rec-min` cards fit", and a capped card is
narrower than an uncapped one, so no cap can ever let more cards fit. The
centring machinery R29 had just built absorbs the leftover space for free.

**The consequence of the footer move which was easiest to miss:** the spotlight (D-049)
dimmed the footer only because it was a grid child — that is the whole of its
`> *` rather than `> .rec-card`. Moving the footer out would have silently undone
that and left it the single brightest thing on screen at the moment attention is
meant to be on one card. The `:has()` anchor moved up to `.recs`, and the rule is
now two selectors, scoped through `.recs__meta` so the verdict banner's own
`.ai-meta` is untouched.

---
## D-050 · The recs grid picks its own column count, and deliberately stops short

`repeat(auto-fill, minmax(190px, 1fr))` fills each row as far as it will go and
strands whatever is left over. The user brought two cases: **four cards where
three fit** renders 3 + 1, with two thirds of the second row empty, and **five
cards where four fit** renders 4 + 1, with four fifths empty. Both are widths
where 2 + 2 and 3 + 2 fit perfectly well.

**The column count moves into JS.** There is no CSS-only fix — `auto-fill` and
`auto-fit` are the only two packing modes, and neither knows the item count. The
standard balanced-rows formula is two lines: how many rows does the widest layout
need, then spread the cards evenly over exactly that many. It can never add a
row, so it can never make the section taller.

**The interesting decision is not to apply it everywhere.** Ran unrestricted, it
also rewrites the commonest case: six cards where four fit becomes 3 + 3 instead
of 4 + 2. That is tidier, and it was rejected — 4 + 2 strands nothing, and
balancing it makes every card ~36% wider and the whole section markedly taller.
The user's rule was "avoid rows with only 1 card unless it really has no choice",
which is narrower than "always even the rows out", and the narrower rule is the
one implemented: the formula runs only when the natural layout would strand a
single card. One `> 1` in `balancedColumns()` is the whole of the difference, and
it is commented as such, because the temptation to "finish the job" is obvious.
> **2026-09-10:** the restraint is gone, and not because anyone finished the job
> — its premise expired. It existed solely because balancing made every card
> ~36% wider; R29 (D-051) decoupled card width from the count, so it cannot any
> more, and six cards where four fit now render 3 + 3. `balancedColumns()` is
> also now `balancedLayout()`. The paragraph stands as the reasoning at the time.

**Centring a short last row needs half-column granularity, so the tracks are
doubled and every card spans two.** This is the part most likely to be
"simplified" later. In a plain three-column grid the two cards of a 3 + 2 layout
sit hard left with a third of the row hanging off the right; there is no grid
property that centres a partial last row. The alternatives were worse:

*`justify-content: center`* centres the track LIST, which does nothing when the
tracks are `1fr` and already fill the width.

*A `translateX` on the first card of the last row* was the near miss. It works
geometrically, and it is unusable here: `.rec-card` already carries a hover
`transform` and an entrance animation on the same property, so a layout offset
expressed as a transform would be silently overwritten by both.

*Doubling the tracks* costs nothing, and that is arithmetic rather than hope: a
card spans two tracks **and the gap between them**, so three cards and their two
gaps come to 3(2t + g) + 2g = 6t + 5g — exactly what six tracks and five gaps
occupy. A doubled grid and a plain k-column grid produce identical cards. JS then
places only the FIRST card of the last row, at column (k − m) + 1; the rest
auto-place after it, which the spec's placement cursor guarantees.

**Two smaller things worth not rediscovering.** The custom property holds the
already-doubled track count rather than a column count multiplied by two in CSS,
because a math function in `repeat()`'s first argument is not somewhere to be
adventurous. And `.rec-card` is `grid-column: auto / span 2`, not the shorter
`span 2` — one value leaves `grid-column-end: auto`, so the moment JS writes a
`grid-column-start` the card would collapse to a single half-width track.

---
## D-049 · The recs spotlight IS ported, at 0.70 — supersedes D-048's last section

**D-048 records Claude rejecting the ranked list's spotlight dimming for the recs
grid. The user overruled that the same day, and was right.** This entry exists
because a future session reading D-048 alone would find a confident argument for
removing a feature that is now deliberately there.

Claude's two objections, and what happened to each:

*"A grid is for side-by-side comparison; dimming five of six fights that."* The
real objection was to the **strength**, not to the idea. The ranked list dims to
`0.55`, which is heavy enough to take the other cards out of play — fine in a
column you are scanning top to bottom, too much in a gallery. The user's answer
was to port it far lighter — tried at **0.75**, settled at **0.70** minutes
later: the section still recedes, and every unhovered card stays perfectly
readable. Claude had treated the ranked list's number as part of the pattern
rather than as a dial, which is the actual error here; the exact figure was
always going to be found by looking at it.

*"`.recs__grid` also holds the metadata footer as a grid child, so dimming only
the cards leaves it the single brightest thing on screen."* True, and it turned
out to be one character rather than a blocker: the selector is `> *`, not
`> .rec-card`, so the footer dims with them. The residual worry — that this dims
the AI-call-log link, the section's only route into the audit trail — does not
survive contact with 0.70, where the link is plainly legible and one
pointer-move from full strength. Hovering the footer itself dims nothing, since
the `:has()` tests for a hovered **card**.

**The lesson worth keeping is about how the objection was framed.** Both
arguments were about the effect at a strength nobody had proposed. Rejecting a
port on the grounds of a value that came with it, without asking whether the
value should travel, is how a pattern stops being a pattern and becomes a rule.

Nothing else changed: `:has()` for the same gap-strobe reason as the ranked list,
`opacity` added to `.rec-card`'s existing transition (declared in the base state,
or it would ease in and snap back), and the footer's transition scoped to the
grid because `.ai-meta` is shared with the verdict banner. The hovered card's
`z-index: 3` — added for the badge arithmetic in D-048 — now also does the job
the ranked list needed `z-index: 1` for: `opacity < 1` makes each dimmed sibling
paint as though positioned at `z-index: 0`, which would otherwise clip the
hovered card's glow.

---
## D-048 · The rec-card enter/exit is two CSS phases, not a View Transition (R27, R14)

The user asked for "a smooth entering animation to recs-cards as they're being
added to the page — one by one, like cards", and then, after watching it run,
wrote a precise sequence: **cards arrive → scroll the section into view → wait
~200ms → entrance animation**, all of it after the response has landed and none
of it on a run that produced no cards. That sequence is theirs and was recorded
as non-negotiable; what follows is only about the mechanism underneath it.

**The backlog told the next session to use a View Transition, and that was the
wrong instruction.** The R27 entry says so in as many words — "Prefer the View
Transition route: it is the mechanism this codebase already chose for exactly
this problem" — and the ranked list really does use one for its re-sort (D-031).
Reading it against the actual shape of this feature is what killed it:

*A View Transition animates one atomic old→new swap.* Here the two halves are
**seconds apart and on opposite sides of an AI call**. The old cards become
stale the moment the trigger is clicked; the new ones exist only after
OpenRouter and six TMDB lookups have answered. `startViewTransition()` accepts an
async callback and will wait for it — which is precisely the problem, because it
holds a frozen snapshot of the whole page for the length of the request. The
busy spinner would stop spinning, and nothing else on the page could move.

*It also cannot express any of the three things the user asked for.* A View
Transition cross-fades a group; it has no per-card stagger, no lead-in, and no
place to put a scroll in the middle. Getting the stagger back would mean naming
each card and writing keyframes per pseudo-element — more machinery than the
two-phase version, to reach the same picture.

So: **a CSS animation each way, and a two-phase render**. The click applies
`.is-leaving` and removes each node on its own `animationend`; the response
renders fresh cards whose `animationDelay` carries the lead-in and the stagger.

**Two things about that are not obvious.**

*The exit removal cannot be driven by `animationend` alone.* The
`prefers-reduced-motion` block sets `animation: none !important`, so for those
users no animation runs and **the event never fires** — the old cards would sit
on screen for good, replaced only by the next render. `exitRecCards()` therefore
checks the media query first and clears instantly. Found by reasoning about the
reduced-motion block, not by testing, and it is the kind of bug that would only
ever have been reported by the one user least able to tolerate it.

*The lead-in is an `animationDelay`, not a `setTimeout`.* No timer to leak or
cancel if a second run starts. This only works because the fill is `backwards`:
during the delay each card holds the from-state instead of sitting fully visible
and then jumping. That is D-043's mechanism doing real work, and one more reason
the fill must never go back to `both`.

**`html { scroll-behavior: auto }` was missing from the reduced-motion block and
is added here.** The block kills `animation` and `transition`; a programmatic
`scrollIntoView()` is neither, and obeys `scroll-behavior` instead. It was latent
— nothing in the app scrolled programmatically and there are no in-page anchors —
and went live the moment this feature landed.

**R14 (grow-on-hover on `.rec-card`) rode along**, because it lands on the same
element and shares the `backwards` constraint: a forwards fill would have pinned
`transform: none` and silently cancelled the hover, which is exactly what D-043
found on the ranked card. The effect is the ranked card's vocabulary ported
verbatim — scale only, no `translateY`, three glow layers at a **zero Y-offset**,
no black layer — with two deliberate differences:

*The halo is tighter* (34/50px against 40/60px), because these cards sit in a
grid with a 17.6px horizontal gap rather than a column with a 16px vertical one,
and a halo that crosses the gap reads as two cards sharing one glow.
> **2026-09-09, later the same day:** the user widened these by eye to 40/100px
> — looser than the ranked card, not tighter — and the reasoning above did not
> survive the spotlight added in D-049 between the two edits: with every other
> card at 0.7, a halo crossing the gap falls on something already receding. The
> paragraph stands as written; the live values are in `styles.css`.

*`z-index: 3`, not the ranked card's `1`.* Arithmetic, not taste: every
`.rec-card::before` badge carries `z-index: 2` and resolves in the same stacking
context as the cards, so a hovered card at `1` would have a NEIGHBOUR's badge
painting over its glow.

**The spotlight dimming was considered and rejected**, which is the part most
likely to be "fixed" later. On the ranked list, dimming every card but the
hovered one helps you keep your place in a vertical column you are scanning. The
recs grid is a gallery of six whose job is side-by-side comparison, and dimming
five of them fights that. Worse, `.recs__grid` also holds the metadata footer as
a grid child: `:not(:hover)` over cards alone would leave the footer at full
strength in the middle of a dimmed grid, and including it would dim the
AI-call-log link, which is the section's only route into the audit trail.

---
## D-047 · A failure may only offer the AI call log when a row was actually written (R8, R9)

The recommendations route answered every `RecommendationError` with
`Couldn’t generate recommendations: ${err.message}`, under a code comment
claiming "Calm, specific message — never a raw dump". It was a raw dump. The
causes are internal — `OpenRouter unreachable (TimeoutError)`,
`OpenRouter responded 401`, `Model did not return valid JSON`,
`DB read failed: <postgres text>` — so an outage named our vendor and a
JavaScript error class to somebody who wanted a film suggestion. The movie path,
two files away, has said `Couldn’t reach the movie database. Try again in a
moment.` since D-042.

Nobody had seen it, because R1 wiped the message in the same tick it appeared.
Fixing R1 is what made this visible, and the user confirmed it in the browser
with a bogus OpenRouter key.

**Where to draw the line between "show it" and "hide it".** One cause is not a
fault report at all: *not enough rated films* is the answer to the user's
question. Two ways to spare it:

*Pattern-match in the route* — check the message, or the absence of "OpenRouter".
Rejected outright: it makes the route's behaviour depend on the exact wording of
a string thrown three files away, which is the same "second copy of a rule" shape
D-039 deleted and D-046 refused to recreate.

*Flag it at the throw site.* Chosen. `RecommendationError` takes
`{ userFacing }`, set on exactly one of its six throw sites. The knowledge lives
where the decision is made.

**The part worth recording is R9, where the backlog's own instruction was
wrong.** The seed item said the verdict "already does this properly (points at
the AI call log); copy that shape". Reading it, the verdict's fallback offers the
log **unconditionally** — so when CineRank itself is unreachable, it tells the
user to go read a log that cannot load either, and swallows the real cause
("Couldn’t reach CineRank…") entirely. Copying that shape would have propagated
the bug into a second feature.

So the offer became conditional, and the condition is a fact the server knows and
the client cannot: *was a `recommendation_logs` row committed for this failure?*
Of the six throw sites only one qualifies — the failure re-thrown after the log
insert. A failed DB read happens before any AI call, an unmet threshold never
reaches one, and a failed log write is by definition unlogged. All three now say
"Try again in a moment" and offer nothing to read.

That fact travels as `logged: true` beside `error`, which is **exactly D-042's
`short` mechanism**: additive, absent from nearly every response, and invisible to
any consumer reading only `body.error`. `api()` carries it onto the thrown error
the same way it carries `short`.

**Traps.**

* **Do not make `logged` default to true**, and do not set it on the
  `RecommendationError` constructor's other call sites. It is a claim that a row
  exists; a wrong one sends the user to an empty log. Flipping the default fails
  one test, by construction.
* **Do not re-append `err.message` to the user-facing string.** The technical
  cause is not lost — it is written to the log row's `error_text`, which a test
  now asserts, and that is the only place it belongs.
* **The route must not sniff the message text** to decide which branch to take.
  Both flags are set at their throw sites for that reason.
* **The verdict still has the unconditional-link bug** (recorded as R23). It was
  left alone deliberately: this pass is R8/R9, and fixing the verdict is a change
  to a second feature that the user has not looked at yet. Do not "unify" the two
  by copying the verdict's version back over this one — that is backwards.

---
## D-046 · The recommendations read stopped filtering in SQL, because the test could not see the bug otherwise (R2)
`generateRecommendations()` read the library with one query filtered
`.not('rating', 'is', null)` and then built **two** things out of that one result:
the taste profile (`topN`) and the owned-titles set used to drop picks the user
already has. The taste profile was right. The owned set was not — it contained
only RATED films, so a film the user had added and not yet rated was invisible to
it, and the model could name it, TMDB would verify it, and it came back as a
recommendation for something already in the list. The card's own
`AI pick · not yet rated` badge would even have been accurate; the Add button
under it would have returned a 409.

**Two fixes were on the table.**

*Add a second query* for `tmdb_id` with no filter, and keep the filtered one for
the profile. Obvious, minimal, and the first thing I reached for. Rejected: it
costs a second round trip, and it leaves the two sets sharing a subject but not a
source — the exact shape that let them disagree in the first place.

*One unfiltered read, split in JS.* Chosen. `rated` is
`library.filter((m) => m.rating != null)` and the owned set is
`library.map((m) => m.tmdb_id)`. One round trip, and the two derivations sit two
lines apart where a reader can see that they answer different questions: the
profile is "films you have scored", the owned set is "films you have, at all".

**What actually settled it was a failed test, not the argument above.** The test
was written first, as the R19 work had just established. It asserted that an
unrated film in the library is never recommended back — and it **passed against
the buggy code**. The reason is `test/helpers.js`: every filter method on the
fake Supabase builder is a no-op (`not: () => b`), so the fake returned all rows
regardless of the `.not()` that caused the bug. The test proved nothing, and
would have gone on proving nothing.

That left a real choice about where the truth should live. Teaching the fake to
honour `.not('rating','is',null)` was possible, but it makes the fake a small
query engine, and every future test then depends on that engine being right.
Moving the filter out of SQL and into JS puts the rule somewhere the tests can
actually observe, and makes the production path and the tested path the same
path. The bug was in application logic, so application logic is where it should
be visible.

**Claude was wrong twice here and both are the point.** The first write-up of
this item (R2, in CLAUDE.md) was correct. But the sibling item R20 — "the client
hardcodes thresholds the server owns" — was **wrong and was withdrawn**: the
client fetches `/api/config` at boot and the literals are a documented fallback.
That claim came from grepping `state.cfg`, which shows the reads and the literals
but not the assignment that overwrites them. And then the R2 test passed for the
wrong reason, which would have shipped a green suite over an unfixed bug if it
had been written after the fix instead of before it.

**Traps.**

* **Do not push the filter back into the query.** `.not('rating', 'is', null)`
  on that read looks like free work for the database and would immediately make
  the R2 test vacuous again, because the fake ignores it. The comment in
  `helpers.js` says so at the no-op itself.
* **The owned set must come from the unfiltered `library`, never from `rated`.**
  Reverting that one word restores the bug and fails exactly one test — verified
  by doing it.
* `nullsFirst: false` is on the order to match `GET /api/movies`. The unrated
  rows are filtered out of `rated` anyway, but a DESC sort puts NULLs first in
  Postgres by default and `topN` should not depend on that being remembered.
* This is the SERVER half only. The client half — rec cards never re-syncing
  their Add button when ownership changes — is R3 and is still open.

---
## D-045 · `overflow-wrap: anywhere`, not `break-word` — the difference is intrinsic sizing
Found by the user after the backlog closed, with a review consisting of ~400
unbroken `f`s. The ranked list did not merely overflow: the card widened, the
section widened, and the whole page layout broke, with no scrollbar to reveal
what had been pushed off-screen.

**Why one word can do that.** `.movie-card` is a grid with
`grid-template-columns: 64px var(--poster-w) 1fr auto`. A `1fr` track is
`minmax(auto, 1fr)`, and that `auto` minimum resolves to the item's **min-content
width** — which, for a single unbreakable word, is the entire word. The track grew
to fit it and everything downstream followed. `.review` already had
`overflow: hidden` from its line clamp and it did not help at all, because
clipping governs PAINTING, not the intrinsic size a track is measured from.

### The obvious fix would not have worked
`overflow-wrap: break-word` is what anyone reaches for, and on screen it wraps
**identically**: normal breaks at spaces, mid-word only when a word cannot fit a
line by itself — precisely the behaviour the user asked for. It would still have
left the bug in place, because `break-word`'s break opportunities are **not
counted when min-content is calculated**. The track would have been sized to the
unbroken word exactly as before, and the page would have blown out exactly as
before, while the review itself looked correctly wrapped — the most expensive
kind of near-miss, since the visible symptom would have moved without the cause.

`overflow-wrap: anywhere` is identical in rendering and different in
**measurement**: its break opportunities DO count toward intrinsic sizes, so
min-content collapses to roughly one character and the track can no longer be
pushed open. Same appearance, different arithmetic. **Do not "simplify" it to
`break-word`.**

The property inherits, so one declaration on `.movie-card__body` covers the
title, the review, #20's placeholder and the unrated hint. It is also the
property `.log-error` already uses, for the same reason, in the AI call log.

### `min-width: 0` alongside it
`overflow-wrap` governs TEXT only. The user's requirement was categorical —
"ensure no user input can ever widen a card's width" — so the grid item also gets
`min-width: 0`, which makes the track structurally incapable of being pushed open
by anything, including future non-text content with its own intrinsic width. The
`overflow-wrap` line is what fixes the reported bug; this one closes the class.

### Two surfaces guarded defensively, and labelled as such
* `.rec-card__body` — the recs grid is `minmax(190px, 1fr)`, a FIXED minimum, so
  it cannot be pushed open the way the ranked card was. But the reason text is
  model output derived from the user's own reviews, which is the prompt-injection
  surface, and the card title is not clipped the way `.reason` is.
  > **2026-09-09:** this premise expired. D-050 replaced those tracks with plain
  > `1fr` — i.e. `minmax(auto, 1fr)` — so the automatic minimum is back in play
  > and the guard above is now load-bearing rather than defensive. The sweep that
  > noticed also found the gap it left: `.rec-card` ITSELF, which is the grid
  > item, never carried `min-width: 0`, so a poster's intrinsic width could push
  > the track open on a phone. Fixed there. The paragraph stands as the reasoning
  > at the time.
* `.result-row` — a flex container, and a flex item's automatic minimum size is
  min-content, the same mechanism. Its text comes from TMDB, so nothing is known
  to be broken.

Both are marked in the CSS as defensive rather than corrective, so a later reader
does not mistake them for evidence of bugs that happened.

---
## D-044 · On a near-black page, elevation is made of light — superseding D-043's "keep the amber weak"
Still #19. The user, after the symmetry fix: *"Please make the box-shadow more
pronounced, and more importantly - brighter. It's barely visible against the dark
background."*

**They were describing a real physical limit, not a preference.** The hover
shadow led with `0 28px 55px -20px rgba(0, 0, 0, 0.95)`. The page is
`--bg: #0b0b0f`. A black shadow works by darkening what is behind it, and there
is essentially nothing left to darken — the layer was doing almost no work at
any opacity. That is why the effect read as "barely visible" even after the
scale was raised. On a dark UI, elevation cannot be a shadow; it has to be light.

So the black layer is **removed rather than reduced** — it was not earning its
place — and the amber glow carries the whole effect: a lit edge, a warm pool
below the card, and a wide halo into the page.

### This supersedes a trap D-043 recorded, and that is the point of the entry
D-043 said, in its own Traps section: *"The amber must stay weak … diffuse at
0.10–0.12 alpha specifically so 'the pointer is over this' cannot be confused
with 'this has keyboard focus'."* Followed literally, that guidance is exactly
what produced an invisible effect. **The instinct was right and the mechanism was
wrong.**

What actually separates hover from focus here is **shape, not dimness**:

* `:focus-visible` draws a **crisp, fully opaque, 2px SOLID outline, held 3px off
  the element** by `outline-offset` — a detached hard line with a visible gap.
* The hover glow is **translucent, diffuse, and attached to the card's edge.**

Those read as different things at any brightness, which is what makes a bright
glow safe. Dimming was never the load-bearing property; it was a proxy for
"don't make it look like an outline", and a bad one, because it also made it
look like nothing.

**The revised trap:** the glow may be as bright as it likes, but it must never
become a hard-edged, opaque amber line sitting at an offset from the card. That
is the state where the two genuinely converge — not brightness.

### Note on process
This is a case where a trap written in good faith made the next change worse, and
it took a user report to catch it. The fix is a NEW entry rather than an edit to
D-043, per the rule in CLAUDE.md: D-043 records what was decided and why at the
time, including the reasoning that turned out to be too blunt, and that record is
worth more intact than tidied.

---
## D-043 · The card hover was not subtle, it was being cancelled by the entrance animation
Backlog #19. The user asked for a more pronounced grow-on-hover, describing the
existing one as "too subtle - I can only notice it on the poster". That sentence
turned out to be literally, mechanically true, in two ways at once.

**First, the card never grew.** `.movie-card:hover` set `translateY(-3px)` and a
slightly lighter border. Nothing scaled except `.movie-card__poster`. So "I can
only notice it on the poster" was an accurate description of the CSS.

**Second, and worse: even the 3px lift did nothing on a freshly loaded page.**
`.movie-card.is-entering` carried `animation: fade-slide 0.45s var(--ease)
**both**`, and `is-entering` is added on first paint and **never removed**.
`both` is `backwards` + `forwards`, and a *forwards*-filling animation keeps
applying its final keyframe indefinitely — while **animation declarations outrank
normal author declarations in the cascade**. `fade-slide` ends at
`transform: none`. So every first-paint card was pinned to `transform: none` for
the life of the page, silently beating the `:hover` rule's transform. Only the
poster still moved, because the poster has no animation of its own.

It came back after any add, rate or remove, because those re-renders rebuild the
cards WITHOUT `is-entering` (D-031 restricted the entrance to first paint). An
effect that works only after you interact with the list, and never on the page
you first look at, reads exactly as "too subtle" rather than as broken. That is
why it survived this long.

### Two fixes, and why the JS one lost
* **Remove `is-entering` on `animationend`.** The reflex answer, and rejected: it
  adds a listener per card on every first render, needs its own teardown, and
  re-couples a purely presentational concern to JS. It also has failure modes the
  CSS fix does not — an animation that never runs or never completes (a
  backgrounded tab, `prefers-reduced-motion` removing it entirely) leaves the
  class attached forever, which is the very state being fixed.
* **`both` → `backwards`** (chosen). One word, no JS. It keeps the half that is
  actually needed — holding the from-state through this card's stagger delay (set
  in JS, up to 400ms) so a card cannot flash at full opacity before its turn —
  and drops the half that caused the bug. **Provably equivalent at rest:** the
  final keyframe is `opacity: 1; transform: none`, which is identical to the
  card's natural resting state, so removing the forwards fill changes nothing
  visually.

`.rec-card` had the same `both` and was fixed with it. No hover transform exists
there today, so nothing was visibly broken — but it is the same latent trap, and
adding one later would have silently done nothing.
> **2026-09-09, later the same day:** "later" arrived — R14 put a grow-on-hover
> on `.rec-card`, and it works precisely because this fix had already landed.
> The sentence above stands as the reasoning at the time; the card does have a
> hover transform now.

### The other half: a lift with no elevation cue
`box-shadow` was set on `.movie-card` and **was not in its `transition` list, and
was not changed on hover**. So the card rose against a completely static shadow.
Elevation is sold by the shadow growing and softening; without that a 3px lift
reads as nothing. The fix was never "make the 3px bigger" — the shadow had to
join the transition and change on hover.

### What shipped, and the choice the user made
Three options were laid out: (A) elevation only, no scale, text stays crisp;
(B) elevation plus a real scale; (C) elevation, scale, and a faint warm rim in
the app's amber. **The user chose C.**

### Traps
* **Do not restore `both` on either entrance animation.** If a card ever flashes
  before its stagger delay, `backwards` is already the fix for that; `both` adds
  only the forwards fill, which is what broke the hover.
* **The amber must stay weak.** `--amber` is already the `:focus-visible` ring (a
  crisp 2px solid), the #1 crown and the "Not rated yet" chip. The hover glow is
  diffuse at 0.10–0.12 alpha specifically so "the pointer is over this" cannot be
  confused with "this has keyboard focus". Strengthening it breaks that.
* **`@media (hover: hover)`, never a width query.** The gate exists because
  `:hover` sticks on a touch screen after a tap — a card would stay parked in the
  grown state after pressing Edit. Gating on input capability keeps the effect on
  a narrow desktop window, which a `min-width` query would wrongly remove.
* **`prefers-reduced-motion` suppresses the transform but keeps the colour.**
  Killing the transition alone was not enough: the lift and scale still applied,
  just instantly, which is precisely what a motion-sensitive user is asking to
  avoid. The deepened shadow, warm rim and border still respond, so the card is
  not left inert.

---
## D-042 · A failure message is a context plus a cause, and the cause carries its own short form
Backlog #16(c). The add and remove toasts showed the CAUSE alone, so a failed add
or remove named no film — with several cards on screen, nothing said which one
had not been removed. The obvious fix, putting the context in front of whatever
came back, was recorded months earlier as unsafe because it produces
"Couldn’t remove “Dune” — Couldn’t reach CineRank. Check your connection and try
again." Two subjects, two "couldn’t"s, one failure.

**The user's field testing is what produced the design, and it corrected two
things Claude had assumed.** They worked through ten scenarios by hand (offline
via DevTools; a bogus `SUPABASE_ANON_KEY` for the DB-down case) and reported each
sink's actual output. That established:

* The doubling was **not hypothetical** — it already existed at two sinks that
  DO prefix: the boot toast ("Could not load your movies: Couldn’t reach
  CineRank…") and the AI log's cell ("Couldn't load the log: Couldn’t reach
  CineRank…"). Claude had described it only as the failure mode of a proposed
  fix, and had told the user it was not currently reproducible. It was.
* It is **not limited to the transport error**. The TMDB 502 is also a
  self-contained sentence starting with "Couldn't", so a naive prefix doubles
  there too.
* Two incidental bugs: the verdict fallback ended "See the AI call log for
  details" with **no full stop**, and the app spelled the same word three ways —
  `Couldn’t` (curly), `Couldn't` (straight), and `Could not`.

### The reframing that made it tractable
The user asked how to handle "the unpredictability of the exact error message".
It is not unpredictable. There are exactly **two kinds** of message arriving at
these sinks, and the client always knows which it holds: either it fabricated the
cause itself (`api()`'s transport failure) or the server sent it. So the short
form can be attached **at the source**, and the composer only has to prefer it.

### Options
* **A — prefix unconditionally.** Rejected: the doubling above.
* **B — drop the context when the cause is self-contained.** Rejected, and this
  is the interesting one. It reads fine in isolation, but it means the film is
  named only *sometimes* — and the user cannot know that the omission is a
  property of the error rather than of their action. Naming it inconsistently is
  worse than never naming it.
* **C — reorder: cause first, consequence appended** ("Couldn’t reach CineRank.
  “Dune” was not removed."). Rejected: it makes every toast longer, and a toast
  is on screen for 3.2 seconds.
* **D — a `short` form attached at the source, one composer** (chosen).
  `err.short ?? err.message`, prefixed with the context. An endpoint that sends
  no `short` behaves exactly as it did.

### The risk cap shaped the server half
The user approved the server change **"as long as it does not make this change
noticeably riskier — I do not have time to debug all error scenarios from
scratch."** That turned into a hard rule: **add a key, never edit an existing
`error` string.** The consequence is that adding `short` cannot change any
existing behaviour, by the same argument the confirm dialog used for sharing
selector lists — nothing that already reads `body.error` can observe a new
sibling key.

It also settled a temptation. The server carries the same straight-apostrophe
inconsistency (three messages), but `test/routes.test.js` asserts one of them
verbatim with a straight apostrophe, so a tidy-up sweep would have broken a test
for a cosmetic gain. Left alone and reported instead.

### Punctuation
The composer normalises the terminal stop, rather than each cause being fixed by
hand. The causes disagree — the 409 is "Already in your list" with no stop, the
500 is "Something went wrong." with one — and most are not ours to edit. Without
this the same toast would end with a full stop or not depending on which failure
produced it, which is the defect the verdict's missing "for details." already
was. Caught by running the composer over every scenario, not by eye.

### Traps
* **Do not lowercase or re-flow the cause to make it read as one sentence.** It
  may start with a proper noun ("TMDB…", "Already…") and it is user-facing text
  the server owns.
* **The add handler's `settle()` must keep reading `err.message`, not the
  composed string.** It tests for "Already" to decide whether the button is
  retryable, and the composed text contains a film title that could itself
  contain that word.
* **`short` is optional on purpose.** Most endpoints will never need one —
  "Something went wrong." composes correctly as it is. Do not "finish the job"
  by adding one everywhere; the field exists only for causes too self-contained
  to sit after a prefix.
* Sinks that are already surrounded by their own context — the search note, the
  verdict banner, the rate dialog's inline error — deliberately do NOT compose.
  The user tested all three and found them correct; they were left untouched, and
  the transport message they receive is byte-identical to before.

### Verified, not assumed
The shipped `failureText()` was extracted from `public/app.js` and run over all
ten reported scenarios plus the no-title fallback: every result names the
operation, names the film where one exists, says "couldn’t" exactly once and ends
in a full stop. `npm test` 38/38, including a new guard that the TMDB 502 carries
`short` **and** that its `error` text is unchanged.

---
## D-041 · A rating-less review is forbidden by the database, not displayed by the renderer
Backlog #15. `renderRanked()` branches `if (!isRated) … else if (m.review)`, so a
film that is unrated but carries a review drew the "Not rated yet" chip and its
review was never rendered at all — the text sat in the table and no screen ever
showed it.

**Claude proposed the wrong fix, and the user replaced it.** The proposal was to
split the branch into two independent `if`s so an unrated card showed the chip
AND the review. The user's question was better: the UI already refuses to create
this state, so *should the state exist at all?* The rating is the required part
and the review the optional one — that is the product rule, and it was written
down nowhere except in the shape of the rate dialog.

### What was verified first
The backlog row said only "the PATCH endpoint permits that state", which is true
but stops short. Tracing every writer showed the state is **unreachable from the
UI**: `POST /api/movies` writes neither column, and the rate dialog's Save always
sends `Number(el.rateRange.value)` from a range input that cannot be empty. So
#15 was latent, not a live bug — worth saying, because the row read as though
there might be hidden reviews already. A pre-check (`where review is not null and
rating is null`) returned zero rows before anything was changed.

### Three options
* **A — render both** (Claude's). Rejected: it copes with data the product does
  not want instead of preventing it, and adds a permanent branch to
  `renderRanked()` for a state nothing should ever produce.
* **B — validate in the PATCH route.** Rejected on a finding, not on taste: the
  rule is about the **resulting row**, not about the patch. `PATCH {review}`
  alone is perfectly valid when the film is already rated, so the route would
  have to re-read the row to judge it. Postgres already knows the resulting row.
* **C — a `check` constraint** (the user's). Chosen. `check (review is null or
  rating is not null)`, migration 004, folded into `db/schema.sql`. It is the
  only layer that can enforce the rule in one place at no cost, and it turns the
  renderer's `else if` from accidentally correct into **provably exhaustive**.

### The consequence, accepted deliberately
This converts a silent hide into a loud failure. That is the right direction —
fail at the boundary rather than accept-and-hide — but it has a concrete cost:
**the demo seed helper must send rating and review in the same PATCH**, or it
will error. That failure lands during seed development rather than silently in
front of a reader, which is the good version of the problem, but it is a real
constraint on code not yet written, so it is recorded here and under the
pre-submission blockers.

`PATCH` still accepts an explicit `rating: null`; after this that call fails for
any film that has a review. No UI path sends it.

### Traps
* The `else if` in `renderRanked()` is exhaustive **because of this constraint**.
  Do not "fix" it into two independent `if`s — that adds a branch for a state the
  schema forbids. A comment at the branch says so; if the constraint is ever
  dropped, that comment is what stops being true.
* The route maps `23514` to a 400 **matched on the constraint name**, not on the
  code alone: the table carries two range constraints as well, and the review
  message must never be shown for a violation of either. Both halves have a test,
  and both were verified to fail without their fix rather than assumed to work.
* One-directional on purpose. A rating with **no** review stays valid — that is
  the common case, and backlog #20 is about labelling it in the UI, not
  forbidding it.

---
## D-040 · Expanded reviews survive a re-render by lifting the state, not by reusing the elements
Backlog #14. Expand a review with "view more…", then rate, add or remove a
*different* film, and it snapped shut. `renderRanked()` opens with
`replaceChildren()`, and every rebuilt review was constructed with
`setReviewExpanded(r, toggle, false)` — so the expanded state existed only as a
class on a node that every render destroys.

**The backlog row asserted for two days that "only the element-reuse rewrite
rejected in D-031 fixes it". That claim was wrong, and Claude wrote it.** It was
caught only because the user declined to take it at face value and asked for it
to be re-assessed before any work started.

Why it was wrong: it read #14 as a symptom of *elements being destroyed*, and
filed it beside the animation churn and poster churn that D-031's option B was
designed for. Those two genuinely are about element identity. #14 is not — it is
a **state-persistence** problem wearing the same coat. The generic fix for "DOM
state is lost on re-render" is to move the state somewhere the render cannot
reach and re-apply it on the way out, not to stop re-rendering.

Three options:

* **A — reuse card elements keyed by movie id** (D-031's option B). Fixes #14 as
  a side effect of never destroying the node. **Rejected again, for a reason that
  has strengthened since:** D-031 rejected it because a missed field on a reused
  card produces a *stale card that still looks correct*. `renderRanked()` has
  since absorbed the competition-ranking and tie logic (D-038) and the whole
  TMDB score column (D-036/D-037), so there is strictly more per-card state to
  get silently wrong today than when it was first turned down.
* **B — persist to `localStorage`.** Rejected: expansion is a transient reading
  state, not a preference. The user confirmed the scope explicitly — it should
  not survive a page reload.
* **C — a `Set` of movie ids on `state`, seeded into each rebuilt card.** Chosen.
  Eight lines of non-comment code, and no change to how often anything renders.

**Why C composes instead of colliding with item #5.** `syncReviewToggles()`
already runs on a `requestAnimationFrame` after every render, already captures
`wasExpanded` from the class, and already collapses / measures / restores.
Seeding the class at build time means that pass sees `wasExpanded = true` and its
existing `it.clips && it.wasExpanded` rule treats a rebuilt card exactly as it
already treats a resize: still clips, stays open; no longer clips, collapses. No
new rule was introduced into the code that #5 took four commits (b59a893,
59127cc, e0038a3, dd5ce2d) to settle — the three-pass measurement, the
both-ways `hidden` assignment, and the deliberate absence of any line count in
JS are all byte-identical.

**The load-bearing detail: the `Set` is written by `setReviewExpanded()`, not by
the click handler.** That function's docblock already declared it the single
writer for the class, the label and `aria-expanded`, because those three had
drifted once. The `Set` is a fourth facet of the same fact. Had the click handler
owned it, `syncReviewToggles()`'s collapse of a no-longer-clipping review would
have gone unrecorded, and the DOM and the `Set` would have disagreed from the
very next render onward — the same drift, one layer down.

### Traps
* `syncReviewToggles()`'s first pass collapses with a bare `classList.remove()`
  and **must not be tidied into a `setReviewExpanded()` call.** That collapse is
  a measuring fixture, not a state change: routing it through the writer would
  rewrite the label and `aria-expanded` on every resize frame, and would clear
  the `Set` entry before pass three has decided whether to put it back.
* `r.dataset.movieId` must stay **above** the first `setReviewExpanded()` call in
  `renderRanked()`, which reads it back out.
* `movies.id` is a `uuid`, so it is already a string and `dataset`'s
  stringification cannot make the keys disagree. A numeric id would need
  `String()` at both ends or `has(5)` would miss `"5"`.
* Expansion is pruned in `loadMovies()` for any film that no longer has a review.
  Without it, clearing a review and later writing a new one would render the new
  text pre-expanded, inheriting a decision the user made about different text.

The user's condition for approving the work was that it must not make the ranked
list rebuild its HTML any more often than it already does. Verified rather than
asserted: the diff touches no `replaceChildren`, `requestAnimationFrame`,
`startViewTransition` or `refreshRanked` line.

---

## D-039 · "The ranking changed" is not "the order changed" — superseding D-034's signature
Reported by the user within minutes of D-038 shipping. Two films were tied at
first place; they lowered the rating of the one already drawn *second*. Its card
correctly went from `1 tied` to `2` — and the toast said only "saved", with no
"ranking updated" clause.

**D-034 stands; its signature does not.** The decision — say "ranking updated"
only when it is observably true — is unchanged and still right. What was wrong is
the definition of "the ranking". That signature was `id + rated`, and this case
changes neither: the film kept its position, because it was already below its
twin, and it stayed rated. Nothing in the fingerprint moved, so the detector saw
nothing.

Ironically D-034 already recorded that *position alone* is insufficient, and
added the rated flag for the `?` → number case. D-038's competition ranking then
introduced a third axis — the displayed NUMBER — and the signature was not
revisited. Checking the new signature against the old across nine cases found the
old one blind to **four** of them, not one: this bug, its mirror (breaking the
same tie by RAISING the upper film), a tie *forming* without reordering, and a
three-way tie losing a member.

**The real fix was not a better signature — it was deleting the second copy.**
The ranking logic lived only in `renderRanked()`, so the detector had to
approximate it, and an approximation of a rule is exactly the thing that goes
stale when the rule changes. `displayedRanking()` now computes it once and both
callers read it, so what is drawn and what counts as a change cannot disagree
again. The signature is `id + displayed rank + tie state`: literally what the
card shows.

**Where the old counter went.** D-029 named this counter `rankNo` and recorded a
trap against it — that it must never be "simplified" back to the loop index `i`,
because the two agree only by the coincidence of the server sorting nulls last.
That trap still holds, but the identifier does not exist any more: the counter is
now `position` inside `displayedRanking()`. Noted here rather than by editing
D-029, which is a record of what was decided then and stays as written.

This is the same failure mode `busyButton()` was extracted for — CLAUDE.md notes
the two AI trigger buttons "had already drifted apart twice" before their
behaviour was made one function. A rule expressed twice will be changed once.

**Rejected: adding a tie flag to the old signature.** It would have fixed the
reported case and left the duplication, so the next change to the ranking rule
would break the detector again, silently. The signature must be *derived from*
the ranking, not a parallel description of it.

Verified by simulation over nine before/after pairs rather than by reasoning:
the five that must fire, and the four that must NOT — a review edited alone, a
re-rating that crosses no neighbour, and an untouched tie among them — since a
signature that is merely more sensitive would be its own bug. Related: [D-034],
[D-038].

---

## D-038 · Tied films share a rank number, and say so
Backlog #13. Two films the user scored 8.0 displayed as **#3** and **#4**. The
order between them comes from `created_at desc` — which was added more recently —
so the numbers asserted a ranking the data does not contain. The defect was never
the ordering (something has to be drawn first); it was the *claim*.

*(Signpost added 2026-09-09, and the paragraph above is deliberately NOT rewritten:
it records the state that made #13 a bug. `created_at desc` was accurate then. The
tie-break has since been flipped to ASCENDING at the user's request, so a new film
appends below the ones it ties with instead of jumping above them. Nothing in this
entry's reasoning changes — the whole point of D-038 is that the order within a tie
is arbitrary and must not be asserted as a ranking, which is as true ascending as
descending.)*

**Settled on competition ranking (1, 2, 2, 4)**, the convention charts and sport
use, plus a small muted `tied` caption under the numeral. The skipped number is
the point: two films are jointly 2nd, so nothing is 3rd.

**Rejected: a tie marker without changing the numbers.** Cheaper, and
self-defeating — the numbers would still say one film beat the other while a
badge next to them said otherwise.

**Rejected: breaking ties by `tmdb_rating`**, which had just been added and was
sitting right there. It would let TMDB's opinion silently order a list whose
entire premise is that it is the user's own. **Rejected: alphabetical**, which
swaps one arbitrary order for another and still leaves the numbers lying.

**Rejected: rendering the numeral as `=2`**, the UK chart convention, which is
the most compact way to say "joint". It would widen the glyph and walk straight
into the figure-width budget solved by measurement in D-030 — where two
*estimates* were already wrong twice. A separate caption leaves that arithmetic
untouched.

**The layout problem, and the two ways out of it.** The caption must not move the
numeral: the rank cell is centred by the grid, so anything that makes the cell
taller shifts its numeral up while untied neighbours stay put — a visible
inconsistency between adjacent cards for a feature that only affects some of
them. Reserving the space on *every* card fixes the inconsistency by moving every
numeral instead, which is worse.

The obvious remedy is `position: relative` on the rank plus an absolutely
positioned caption. **Rejected**, for a non-obvious reason: it would move the
cell into the positioned-paint layer, and the poster — later in DOM order and
*not* positioned — would then paint UNDER an overflowing numeral instead of over
it, silently reversing the overlap order D-030's note describes.

Used instead: `height: 1em` on the rank, and the caption simply overflows it.
`line-height: 1` already makes that box exactly one em tall, so the declaration
is a **no-op on every card that has no caption** — provably zero layout change —
while pinning the height for the ones that do. `em` rather than a length so it
tracks the clamp and both `.is-unranked` and `.is-wide`.

**Accepted consequence: a tie at the top crowns BOTH films.** `is-top` fires on
the displayed rank, so two films at the same top score both get the amber
treatment. That is correct rather than a side effect — D-029 defines the crown as
"your top-rated film", and if two are scored the same then both are.

**The caption is readable text, not an `aria-label`.** A label on a generic
`<div>` is not reliably exposed by assistive tech, so the honest choice is text
a screen reader reads anyway: "2 tied".

Verified by simulating the algorithm over nine cases rather than by reading it —
ties at the top, middle and bottom, a three-way tie, everything tied, unrated
films mixed in, 0.0 as a real rating, and the 99→100 `is-wide` boundary.

---

## D-037 · TMDB's `vote_average: 0` is an absence, not a score
Found by the user immediately after D-036 shipped, from two screenshots of the
same film: *Barack Obama (2008)* showed **no** TMDB rating in the search results,
then appeared in the ranked list as **"TMDB 0.0"**. Their reading was the right
one — 0.0 says "worst possible film", when the truth is "nobody has rated this".

**The diagnosis.** TMDB reports `vote_average: 0` for a title with no votes. Its
user vote scale starts at 0.5, so an average of exactly 0 cannot be a real score
— it is always the absence of one. `shapeMovie()` passed the number straight
through, so migration 002's column (and the backfill) recorded a genuine `0`.

**Why the two surfaces disagreed** is the part worth keeping. The search row
tested `r.tmdb_rating ? …` — truthiness — and `0` is falsy, so it hid the value
and looked correct **by accident**. The ranked card tested `!= null`, which was
deliberately chosen so a legitimate `0.0` would not be swallowed (the same trap
`isRated` documents). Both readings were defensible; they simply disagreed,
because the underlying value was wrong and each renderer was papering over it
differently.

**Fixed at the source, not in either renderer.** The tempting fix is to make the
ranked card test `> 0` and move on — one character, invisible, and it would have
worked. Rejected: the wrong value would still be in the database, the two
renderers would still be encoding the same domain rule in two different ways, and
anything added later (the recs cards, an export, a future "sort by TMDB score")
would have to rediscover it. `shapeMovie()` now maps the no-votes case to `null`,
so "no rating" has exactly one representation everywhere.

`vote_count` is the direct signal and is used whenever TMDB sends it, with
`avg > 0` as a fallback — so a payload that happens to omit `vote_count` can
never null out a rating that is genuinely there. **Do not "simplify" this back to
`typeof avg === 'number'`**; that is precisely the bug.

The search row was also switched from truthiness to `!= null` and given
`toFixed(1)`, so both surfaces now state the same number the same way and are
absent for the same reason rather than by coincidence.

**Migration 003** nulls the zeros already written by 002 and the backfill. It is
non-destructive — it replaces a value that was never meaningful, and the real
figure is re-derivable with `npm run backfill-tmdb-rating` at any time.

This does not supersede [D-036]; the snapshot-at-add-time decision stands
unchanged. It corrects what a stored value of `0` means.

---

## D-036 · TMDB's rating is a snapshot taken at add time, not a live figure
Backlog #11. `shapeMovie()` had always returned `tmdb_rating` and the search
results had always displayed it, but `POST /api/movies` dropped it because no
column existed — the number was fetched, shown once, and thrown away the moment
the film was added. Migration 002 adds the column; the interesting question was
what the stored value should *mean*.

**Settled on: the score the film had when it entered your list, written once and
never refreshed.** That is a defensible thing to compare a personal rating
against — "you rated it 8.5, the crowd said 7.2 when you added it" — and it is
stable, so the comparison does not silently change under the user.

**Rejected: refreshing it.** The obvious alternative is to re-read TMDB when the
ranked list loads, so the figure is always current. Rejected on three counts.
It costs one TMDB call **per film per page load**, on a free-tier key, to update
a decorative caption. It makes the ranked list depend on a third party being up
for something that is not the list's job — today the list renders fine with TMDB
down, and that is one of the resilience states being screenshotted for
submission. And a figure that drifts makes the comparison meaningless: the user
would have no idea whether a gap they see now is the gap that existed when they
formed their opinion. A future session that "improves" this by adding a refresh
should read this paragraph first.

**Shown on unrated cards too**, not only as the "yours vs theirs" pair. It is
explicitly labelled `TMDB`, so it cannot be misread as the user's own score, and
it is the only number a film has before it has been rated. The alternative —
restricting it to rated cards to keep the comparison framing pure — throws away
useful information for no gain.

**The value is `null`-able and must stay so.** Rows added before migration 002
have no value, and TMDB genuinely returns no rating for titles nobody has voted
on. `shapeMovie()` already maps that to `null`, and the renderer tests
`!= null` rather than truthiness — 0.0 is a real average and is falsy, the same
trap `isRated` documents one block above it.

**Backfill, and why it is a separate opt-in script.** Existing rows would stay
blank forever otherwise. `scripts/backfill-tmdb-rating.js` is dry-run by
default and needs `--write`, updates one row at a time BY ID, writes exactly the
one column migration 002 just created — so no pre-existing value can be
overwritten by it — and skips rows that already have a value, making a re-run a
no-op. It is not run by Claude: after Incident 1 the standing rule is that the
user drives anything that touches live data.

**Trap.** Applying migration 002 is a prerequisite, not an optional follow-up:
until the column exists, PostgREST rejects the insert with PGRST204 and adding
any film fails. Adding a nullable column is backward compatible with the
already-deployed code, so the migration can and should be applied BEFORE the
next merge to `main`.

---

## D-035 · The Remove button's label is light, and arithmetic decided that
Yesterday's hover pass (#10) gave the confirm dialog's Remove button a darker
crimson fill on hover. The user then asked two things of it: make the rest→hover
difference **more pronounced**, and **respect the label's contrast**. Measuring
showed those two requests were in direct conflict, and that the existing button
already failed WCAG AA on hover — `#2a0f0c` on `#c4433a` measured **3.59:1**
against a 4.5 requirement. At rest it scraped by at 4.86:1.

**The finding that settled it.** A *dark* label on a fill imposes a **floor** on
how dark that fill may go: `#2a0f0c` needs the fill at ≥ 0.2137 relative
luminance, and pure black still needs ≥ 0.1750. The original fill was `--crimson`
(#e2574c) at **0.2351** — barely above the floor. So with a dark label the hover
could not get meaningfully darker *at all*, and every step in the direction the
user asked for made the contrast worse. A *light* label inverts the same
arithmetic into a **ceiling**, which the fill is then free to sit well below.

The obvious fixes were enumerated and all failed. Five candidate labels were
measured against both states — `#ffffff`, `--ink`, `#000000`, `#1a0605`,
`#140404` — and **not one passed on both**: white passes on hover (4.99) and
fails at rest (3.68); black is the best dark option and still only reaches 4.21
on hover. No label choice alone fixes it; the fills themselves had to move.

**Settled on:** a dedicated pair of role-named fill tokens, `--danger-fill`
(#c83a2f) and `--danger-fill-hover` (#9a2d24), with `--ink` as the label.
Measured: **4.54:1** at rest, **6.71:1** on hover, and the rest→hover luminance
step went from **0.683 to 0.572** — the "more pronounced" the user asked for.

**Why the tokens are role-named and NOT `--crimson-something`.** `--crimson` is
the error *text and border* colour, used in about a dozen places, and it is too
light to carry a readable label as a *fill*. Naming these after the role stops a
future session reaching for `--crimson` as a button background again, which is
exactly the bug being fixed. `--crimson-deep`, introduced the previous day and
consumed by this one rule, is retired.

**Why Save keeps its dark label.** The same question was asked of the amber
`.primary` next door, and the answer is different because amber is ~2.5× brighter
(relLum 0.583 vs 0.235). `#1a1205` measures 11.18:1 and 7.66:1 on the two amber
states — enormous headroom. The two buttons look inconsistent in label colour on
purpose; matching them would break one or the other.

**Rejected:** keeping the punchy `--crimson` rest fill and flipping the label
from dark to light only on hover. It satisfies every constraint and is the most
*visually* pronounced option — but the user asked for "slightly" more pronounced,
and a label inverting from near-black to near-white is a dramatic change, not a
slight one.

**Trap.** Do not put a dark label back on this button, and do not "simplify"
`background: var(--danger-fill)` back to `var(--crimson)` — either one silently
re-fails AA. If either token moves, re-measure; do not re-tune by eye. Related:
D-030, where two eyeballed estimates were both wrong and only a measurement
settled it.

---

## D-034 · "ranking updated" is checked before it is claimed
The three confirmation toasts had three different shapes and two named no film
at all (`Added “X” — rate it any time.` / `Saved — ranking updated.` /
`Removed.`). The user asked for one shape with the film first, which is what
they now are: `“X” added…` / `“X” saved…` / `“X” removed.`

The interesting part is the second clause of the save toast, which took three
passes.

**First pass — deleted it.** The reasoning was that editing only a review does
not change the ranking, so the clause was an unverified claim of the same kind
as the central 500 handler's "on our side" (removed the same afternoon on the
user's own principle: a vaguer message that is true beats a specific one that is
not).

**The user pushed back, and was right.** Every save calls `loadMovies()`, which
re-fetches the entire list server-sorted and re-renders it — so a ranking update
really is triggered on every save, unconditionally. The claim was never false,
and backlog #16's original wording ("claims a ranking change even when only the
review was edited") was unfair on the same count. Recorded plainly: the argument
for deleting the clause was overstated.

**What survived the pushback** is a narrower objection. "Ranking updated" reads
as a claim about the OUTCOME, not about an internal recompute. When the film
stays at #3 the user goes looking for a change that is not there. That is a
wording problem, not a truth problem — which makes it the user's call, not a
correctness fix to be made unilaterally.

**Settled on: say it only when it is observably true.** A signature of the
ranking as displayed is captured before the write and compared after the reload.
Costs one comparison, and the sentence becomes true in the strong sense — the
app claims only what it verified. The two rejected options are both defensible
and are one line each: restore the clause unconditionally (true, per the
pushback above) or leave it off permanently (never wrong, and the re-sort
animation already shows a move).

**The trap, and Claude got this wrong first.** The obvious signature is the list
of ids in order — and it is not sufficient. Unrated films already sort last, so
rating the only unrated film with a low score can leave it in exactly the same
POSITION while its rank slot changes from `?` to a real number: a visible
ranking change with no reordering. `rankSignature()` therefore pairs each id
with whether the film is rated. Do not "simplify" it back to positions.

**Not changed: the two error toasts.** They pass the server's own wording
through by design, and prefixing it client-side produces doublings like
`Couldn’t remove “Dune” — Couldn’t reach CineRank…`. Fixing that means changing
the messages at the source; it stays on backlog #16.

---

## D-033 · The unrated line is a chip, because muting it was the wrong correction
`.movie-card__body .unrated` — "Not rated yet — rate it to place it in the
ranking." — was `--crimson`, the app's error colour, on a state where nothing
has failed. That much was clear from the audit (backlog item #8).

**The obvious fix was to mute it, and it was rejected.** The precedent was
right there and was the one cited when the item was raised: the search panel's
"No matches" had already moved out of `makeError()` into the muted
`.search-note`, precisely because an empty result set is not a failure. Applying
the same move here — `--ink-dim`, review size — would have landed the line in
the same colour, the same weight and the same position as a review. The user
pushed back before it was built: an unrated film is a *pending* state the user
should stay aware of, and dropping it to the tone of body prose lets the
surrounding elements swallow it. The two cases only look alike. "No matches" is
transient text in a panel that is about to be replaced; "Not rated yet" is a
persistent property of a card that will sit in the list until acted on.

**So the correction is a demotion in urgency, not in prominence.** The line is
distinguished by **shape first, colour second**: `Not rated yet` became a chip,
which no review and no title ever is, so it reads as a status marker before its
colour registers at all. The instruction ("Rate it to place it in the ranking.")
stays beside it as quiet `--ink-dim` prose, and wraps below on a narrow card.
The em dash that joined them is gone — the chip's edge is the separator.

**Amber was not picked because it is the accent colour.** It was picked because
the app already has a marker for this exact idea: `.rec-card::before` renders
"AI pick · not yet rated" as an amber pill, which is the "clear but subtle
visual marker" CLAUDE.md's design notes call for. A film you added but haven't
rated is that same state on the other side of the list, so it should not invent
a second visual language for it. `.unrated__badge` therefore borrows that rule's
sizing, letter-spacing and radius on purpose — retune one and retune both.

Alternatives weighed and dropped:
- **Plain amber text, no chip.** One line of CSS, but amber alone is this app's
  *interactive* colour (`.review-toggle`, links, `.recs__trigger`), so a
  non-clickable amber sentence sitting directly above a "Rate" button invites a
  click that does nothing. The chip's `--amber-deep` border reads as a label,
  not a control, and the element is not focusable.
- **A left border / leading dot with muted text.** Distinguishes structurally
  without touching colour, but it is a shape the app uses nowhere else — the
  chip already exists in the vocabulary.
- **Making the rank slot's `?` amber too.** Rejected: D-029 sized and faded that
  `?` so it reads as an *absence* beside the ranking rather than competing with
  the rank numerals, and lighting it up would undo that. One marker, in the body,
  next to the button that resolves it.

Not changed: the `?`, the missing score badge, and the button reading "Rate"
instead of "Edit" are the card's other three unrated signals and are all correct
as they stand.

---

## D-032 · A failed save reports inside the rate dialog, not via the toast
Testing the save-failure path (throttled to Offline) showed the crimson toast
appearing *behind* the rate dialog and dimmed by its backdrop — legible only if
you already knew it was there.

**The obvious fix does not exist.** A modal `<dialog>` opened with `showModal()`
is in the **top layer**, which paints above every normal element *regardless of
`z-index`* — there is no value that lifts the toast above it, and the
`::backdrop` dims everything beneath as well. The only ways into the top layer
are another modal dialog or the Popover API. Converting the toast to a popover
would work, but it means fighting the UA's `[popover]` defaults (`position:
fixed; inset: 0; margin: auto; border: solid`) on a component every flow depends
on, hours before submission, to serve one call site.

Decision: report the failure **inline in the dialog**, above the buttons, and
leave the toast for confirmations. This is not a workaround — it is what the rest
of the app already does. Search failures render in the results panel via
`searchNote()`, the verdict's failure replaces the verdict text, the recs error
belongs in `#recs-hint`. **Errors go next to the thing that failed; the toast
reports things that succeeded.** The rate dialog was the one place breaking that
pattern, and the top-layer problem was the symptom rather than the cause.

**Trap: do not "fix" this later by making the toast a popover and reverting the
inline error.** That would restore a page-level error message for a failure whose
context is entirely inside the dialog, and it would put the rate dialog back out
of step with the other three sections.

Two toast calls still fire while a dialog is *closing* ("Added … — rate it any
time" on Skip, and "Saved — ranking updated"). Both are dimmed for the ~250ms of
the dialog's fade-out. Both are confirmations rather than errors and remain
readable for the other ~3s, so they are deliberately left alone.

---

## D-031 · The ranked list re-sorts with a View Transition, not a rewritten renderer
`renderRanked()` opens with `replaceChildren()`, so every render destroys and
rebuilds every card — and each card carried `animation: fade-slide` with a
staggered delay. Rating one film therefore replayed the *entire* list's entrance:
~850ms of the whole page shimmering because one number changed. Removing a film
was worse — the list vanished and re-entered. Meanwhile the README's demo script
promises "the ranked list **re-sorting live** as ratings change", and there was
no re-sorting to watch: the list blinked out and a new one faded in.

Four options were laid out:

* **A — animate first paint only** (~6 lines). Kills the churn, keeps the
  entrance on load. But the list still hard-swaps, and expanded reviews still
  collapse.
* **B — reuse card elements keyed by movie id** (~50 lines). The "proper" fix:
  fixes the churn, the collapsing reviews and the poster churn, and is the
  prerequisite for C.
* **C — B plus a FLIP transition** (~25 more lines). Cards visibly slide.
* **D — `document.startViewTransition()`** (~10 lines). The browser snapshots
  before and after and morphs between them, matching elements by
  `view-transition-name` — so it delivers C's effect *without* B's refactor,
  because it does not care that the elements were destroyed.

**Claude recommended B, then C. The user overruled it, correctly, on time and
risk.** With hours left before submission, B's failure mode is the wrong shape:
a missed field on a reused card produces a *stale card that still looks
correct*, which is the most expensive kind of bug to find under time pressure —
and B meant rewriting the function whose rated/unrated logic D-029 had just
settled. D's failure mode is the opposite: feature-detect, and an unsupported
browser gets exactly today's behaviour. Nothing half-renders.

**A and D ship together, not D alone.** D on its own would fight the existing
entrance: every rebuilt card still runs `fade-slide` *inside* a snapshot that is
simultaneously cross-fading it. Muddy. A is what makes D legible.

### The user's question that changed the design

Asked what a removal would look like after generating recommendations and a
verdict — and whether other sections would morph "just because something updated
in the ranked list". The answer required correcting the framing: **a View
Transition snapshots the whole document and cannot be scoped to one section.**
What follows from that is two cases, not one:

1. **Unchanged, unmoved content** (header, verdict, search) cross-fades against
   an identical copy of itself. `(1−t)·X + t·X = X` — invisible by construction,
   not by luck.
2. **Content that moved** is the real problem. Removing a card shortens the list,
   so `.recs` and the footer genuinely shift up — they do today too, instantly.
   Unnamed, they belong to the single `root` group, and cross-fading something
   that moved renders it as a **ghosted double image at both positions**. With
   four tall poster cards that would have been glaring.

Hence two mitigations that would not otherwise exist: `view-transition-name` on
`.recs` and `.site-foot` so they *morph* between positions instead of ghosting,
and — less obvious — **running the three `sync*()` calls BEFORE the transition
rather than inside it**, so the recs hint, verdict placeholder and search buttons
are already settled when the first snapshot is taken. That leaves the ranked list
as the only difference between the two frames, which is as close to "scoped" as
the API permits.

### Two Claude errors, both caught

* **Risk "the grain will double-composite" was wrong.** Both root snapshots are
  flattened images containing the same grain layer, so the cross-fade preserves
  it at constant strength; only the animation freezes for ~250ms, at
  `opacity: 0.06`. The user pushed back that the grain was not what worried them
  — the other *sections* were — and they were right that the analysis had aimed
  at the wrong target.
* **Firefox support was recalled as "~139".** MDN says **144** (Chrome/Edge 111,
  Safari 18). The user checked rather than taking it, and verified live in Edge
  152, Chrome 152 and Firefox 155. The recollection was close enough to be
  dangerous — the habit of verifying is what caught it.

### What this deliberately does NOT fix

Expanded reviews still collapse on any re-render, and posters still re-decode,
because the DOM is still rebuilt. Only option B addresses those; the review
collapse stays open as its own item. This is a chosen trade, not an oversight.

### Traps

* **Do not name `.ranked` itself.** Cards inside it are named individually, and
  nesting a named element inside another named one changes which snapshot owns
  what.
* **Keep the `sync*()` calls outside the transition callback.** Moving them in
  reintroduces cross-fading of unrelated text.
* **`view-transition-name` must be unique per document**, hence the `movie-`
  prefix on the UUID — a bare UUID can begin with a digit, which is not a valid
  CSS ident, and a duplicate aborts the entire transition.

---

## D-030 · Three-digit ranks are capped, not documented away
A forced test (ranks rewritten to 250+ in the console) showed three-digit
numerals running under the poster: the rank font clamps at `3.4rem` = 54.4px and
Fraunces Black figures measure 0.66em, so "250" paints ~109px. Its budget is ~99px
— the 64px track *plus* the 17.6px card padding and 19.2px gap it may
legitimately spill into — and the poster, later in DOM order, paints over the
overflow.

**Claude first recommended NOT fixing it**, and wrote that up as a measured
non-fix: unreachable below 100 films, demo seed list is 3–4, and each candidate
fix looked more expensive than the defect. **The user overruled it on grounds
Claude had not weighed** — that a grader reading an unchecked TODO box may not
read the paragraph under it, and will score "documented limitation" as "too lazy
to fix edge cases". That is a judgement about the audience, and the audience is
the point of the artefact. Recorded because the reasoning is invisible in the
diff: the code now contains a fix for a case nobody will hit, and a later reader
would reasonably wonder why.

The counter-argument Claude *did* win: the user proposed `scale: 0.5` for 100+,
calling it "ugly, sloppy, but better grading-wise". Both halves were pushed back
on and the user accepted:

* **0.5 is roughly twice the shrink needed.** The numeral does not have to fit
  the 64px track — it only has to avoid the card border and the poster, a ~99px
  budget, so something near 0.8× was argued to be enough (it was not — see the
  three sizing passes below; the *principle* held, the first number did not).
  A subtle step reads as typographic fitting where a halved numeral reads as a
  bug, and a visible hack grades worse than the honest TODO it was meant to
  replace.
* **`font-size`, not `scale`/`transform`.** A transform shrinks the absolute
  `1.5px -webkit-text-stroke` with the glyph, so the numeral would sit beside its
  two-digit neighbours with a visibly thinner, washed-out outline. Changing the
  font size leaves the stroke at its intended weight. Neither affects layout —
  the track is fixed and only the *text* ever overflowed — so posters stay
  aligned card to card either way.

CSS cannot count characters, so `renderRanked()` marks the digit count with an
`is-wide` class; the threshold is 99 and not 9 because two digits were measured
and fit at every width.

**The size took three passes, because the first two were estimated instead of
measured — this is the substantive lesson of the entry.** `2.75rem` was derived
from a guess that Fraunces Black's figures are ~0.63em; it still clipped.
`2.1rem` then over-corrected to a pessimistic ~0.8em, which cleared but made
#100 conspicuously smaller than #99 — sliding back toward the "ugly, sloppy"
look the fix existed to avoid. Only then was the value actually measured, with
`Range.getBoundingClientRect()` on a live `222`: **0.66em per digit** (66.5px at
a 33.6px font). Solving against that gives `clamp(1.5rem, 4vw, 2.4rem)` —
*larger* than the pass before it. A further pass then widened the card-mode
clearance again — 6.8px was mathematically sufficient but still read as cramped,
because the eye judges the gap against the 40px track beside it rather than
against zero. Final: ≥10.8px clear on desktop, ≥12.3px in card mode,
and a 0.71× step down from the two-digit size. **Re-measure, never re-tune by
eye.**

Two details that fall out of the real numbers. The binding side is the card's
**17.6px padding**, not the 19.2px gap, so the left edge is what constrains the
size. And the `4vw` middle term is load-bearing rather than decorative: it
brings the numeral to ~24.8px by the 620px breakpoint, where the track drops
64px → 40px and the budget collapses from 99px to 75px in a single step. Lower
the ceiling freely; do not raise that coefficient without re-checking the 620px
case, which is the one the whole clamp is shaped around.

**Three agent errors, all caught by the user.** (1) The first description of the
failure claimed the numeral "sits flush against the [card] border" and that
nothing clipped it — a screenshot showed it vanishing under the poster instead.
Corrected in place rather than preserved, per the "wrong when written"
exception. (2) The claim that the fix was a no-op in card mode, and that card
mode already cleared the poster on its own — both followed from the same bad
figure-width estimate; the 40px track is in fact *tighter* relative to its font
than the 64px one, so the clamp floor had to come down as well as the ceiling.
(3) The original audit flagged *two*-digit ranks as broken on mobile; they are
not, and the user disproved it with a sharper test than the one suggested —
forcing ranks to 20+ instead of 10+, so the narrow `1` could not flatter the
result.

**Do NOT "fix" this by auto-sizing the rank track** (`minmax(64px, auto)`). It is
the obvious move and it is wrong: cards with wider ranks get a wider first
column, so poster left edges stop aligning down the list — trading a problem
nobody reaches for one everybody sees. Ranks of 1000+ remain unhandled by choice.

---

## D-029 · Only a rated film earns a rank number — and the crown is not `:first-child`
The ranked list numbered every card `i + 1`, unrated films included. So an
unrated film was handed a rank, directly under its own caption saying "Not rated
yet — **rate it to place it in the ranking**." It had already been placed. The
second half was worse: the `#1` treatment (solid amber, glow) was
`.movie-card:first-child .movie-card__rank`, pure DOM position, so on a list
where nothing was rated yet the golden **#1** landed on a film with no rating at
all.

Four options were weighed:

* **Reword the caption** ("ranked last by default") — cheapest, and rejected.
  It fixes the sentence without fixing the claim: an unrated film genuinely has
  no rank, so "#7" stays false, just more carefully worded. It also leaves the
  crown bug standing.
* **Group unrated films into a labelled sub-section**, or **move them out of the
  ranked list entirely** — both rejected for the same reason: they fight the add
  flow. Adding a film opens the rate dialog with **"Skip for now"**, which is a
  deferral, not a rejection. The film should stay in the list you just added it
  to, quietly nagging. Relocating it makes "Skip for now" feel like the film went
  *somewhere else*.
* **Chosen: one list, but only rated films consume a number.** A counter
  (`rankNo`) that increments only when `m.rating != null`; unrated cards show a
  glyph in the rank slot instead.

**The glyph: `?`, not `—`.** Claude proposed `—` in `--ink-faint`, reusing the AI
call log's missing-Tokens/Cost vocabulary (D-021, shared UI vocabulary). The user
chose `?` instead. It is the better call: `—` means "this value does not exist",
which is what an empty log cell means, but an unrated film's rank is not absent —
it is *undetermined pending an action the user can take*. `?` says "unknown, ask
me" where `—` says "nothing here". Styled much smaller and faint so it reads as
an absence beside the ranking rather than an entry competing within it.

**Two traps this decision creates, both handled and both easy to undo later:**

1. `const isRated = m.rating != null` — **never truthiness.** `0` is falsy, and
   0.0 is a rating the user deliberately gave. A later "simplification" to
   `m.rating ? …` would silently strip a 0.0 film of its rank, its score badge
   and its Edit label in one move. The four sites that branch on rated-ness now
   all read the single `isRated` const so they cannot drift apart.
2. **`rankNo` must not be "simplified" back to the loop index `i`.** They agree
   today only because the server sorts `nulls last`, making rated films
   contiguous at the top — that is a coincidence of the sort order, not the rule.
   The counter states the rule; `i` merely happens to match it.

Screen readers: the `<ol>` still numbers every `<li>` implicitly, so an unrated
card could be announced as "list item 7" while showing `?`. The rank slot is
therefore `aria-hidden` on unrated cards and the "Not rated yet" line carries the
meaning. Splitting the list into two elements purely to fix the announcement was
considered and judged disproportionate.

Deliberately **not** changed: unrated films still sort to the very bottom, so on
a long list a just-skipped film is far out of sight. Raised with the user, who
chose to leave it — noted here so the omission reads as a decision rather than an
oversight.

---

## D-028 · Search stays typo-intolerant; the empty state explains instead
Search is strict: "obamma" returns nothing, "obama" returns plenty. First
established that this is **TMDB's** behaviour, not ours — `searchMovies()` passes
the query straight through with no filtering, TMDB's `/search/movie` has no
fuzzy or edit-distance parameter to enable, and TMDB's own website behaves the
same way. So there was nothing to un-break on our side.

**A local, no-AI spellcheck is not merely expensive, it is impossible here.**
Correction needs a corpus to correct *toward*, and we have none: the catalogue
lives at TMDB, we only ever see the twelve results of one query, and on a typo we
see zero. A generic dictionary would not help either — film titles are full of
proper nouns, invented words and stylised spellings. Nothing in this repo can
turn "obamma" into "obama".

That left one real fix — ask the model, then re-query TMDB — and it was
**rejected on scope**. It would actually fit the never-trust-the-model posture
perfectly (D-002/D-005: the model produces only a search string, TMDB still
supplies every fact, blast radius is a weird result). But it is a *third* AI
feature where SPEC scopes two, and CLAUDE.md requires every OpenRouter call to be
logged with tokens and cost — neither existing log table fits, so it needs
migration 002, a new service, a versioned prompt file and tests, days before
submission. Revisit post-submission if ever.

Decision: reword the empty state to echo the query back —
`No matches for "obamma". Check the spelling, or try a different title.` It
detects nothing; it just makes the typo self-evident, since after typing fast
you do not reliably recall what you typed. It also fixes a small dishonesty: the
old "try a different title" implied the film was absent, sending the user hunting
for a different film rather than checking their spelling, when both causes are
possible. The query is capped at 40 characters so a pasted block cannot blow the
message out, and echoing raw input is safe by construction because `searchNote()`
builds with `textContent`.

**Two agent errors worth recording, both caught by the user.** The options were
presented with a "~15 minutes" estimate for this one; it is two lines, and the
number was inflated to make three options feel more differentiated — which is
padding, not estimating. And a "full" and a "trimmed" variant were offered as if
they were different options when they were *identical code* with a different
sentence; the difference was the agent disagreeing with its own copywriting. The
user asked what the real implementation difference was, and there was none.

## D-027 · Icons are inline SVG or plain characters — never emoji
Three icon choices in the Search section landed on the same rule, so it is
written once here.

**Emoji are rejected outright.** A colour emoji is a fixed full-colour image: it
ignores `color`, so it cannot go amber on hover or dim under a `:disabled`
opacity the way its neighbouring text does; it ignores `font-weight`; and it
carries its own metrics, so it sits off the baseline next to Inter. It also
renders differently on every platform — the opposite of the consistency it is
usually reached for.

- **"+ Add"** uses a plain `+` (U+002B), not the heavy-plus emoji. It is
  `currentColor`, so it follows hover and the disabled dim for free, and it
  matches the text-glyph checkmark already in "Added".
- **The Search button's magnifier is an inline SVG**, not the magnifier emoji and
  not the text glyph `⌕`. `⌕` looks like the right answer and is a trap: it lives
  in Miscellaneous Technical (its actual Unicode name is TELEPHONE RECORDER),
  which is *outside the Inter subset this page downloads*. It would fall through
  to whatever the OS happens to have, or render as tofu — worse device
  consistency than the emoji, not better. Forcing text presentation with VS15 is
  ignored by Chrome and Android. An SVG is our own vector: identical everywhere,
  and `stroke="currentColor"` follows every state. Same pattern as
  `.log-cta__icon`.

**Its orientation is deliberate: lens upper-left, handle down-right** — the
Material / Feather / Heroicons convention, which users recognise
pre-attentively. Do not flip it. Note this is *not* the orientation of the emoji
it replaced: `&#128270;` is U+1F50E "MAGNIFYING GLASS TILTED **RIGHT**", the
mirrored variant (lens upper-right, handle lower-left); the conventional one is
U+1F50D. The naming is counterintuitive — "tilted left" describes the lens
rotating leftward, which swings the handle right — and it was misread once
already, so the switch to SVG quietly *corrected* the orientation rather than
preserving it. Mirroring is standard only in RTL locales, which this
single-locale `lang="en"` app is not.

Mechanically the button carries both a `.search-btn__label` and the SVG, and the
500px breakpoint swaps which displays — cleaner than a `::after`, and
`busyButton()` stashes and restores both for free. `busyButton()` wraps its own
label in a `.busy-label` span for the same reason, so the breakpoint can hide it
and leave the spinner standing alone. Separately, `.search button` is
`flex-shrink: 0`: a flex item's automatic minimum size is not reliable on a
`<button>` across engines, and shrinking is what clipped the label to begin with.

## D-026 · A sync must not stomp a deliberate state ("Added" is sticky)
Reported as "skipping the rate dialog does not sync the search results". It was
the reverse — skipping was correct, and **saving** was the bug. Saving a rating
runs `loadMovies()` a second time, whose `syncSearchResultButtons()`
unconditionally reset every owned button to "In your list", wiping the "Added"
confirmation set moments earlier. Skipping runs nothing, so it kept it. One
state, two labels, decided by an unrelated round-trip.

Decision: make the "Added" confirmation **sticky** (a `dataset.justAdded` flag
honoured by `setAddButtonState`) rather than make skipping reset it. It is the
more informative of the two labels — it marks what *you* just added versus what
was already in the list, which matters when adding several films from one result
set — and it is the state D-024 went out of its way to keep visible. Removing the
film clears the flag, so the row offers "+ Add" again.

**The pattern is what matters here, because this is the third instance:** a sync
function that runs unconditionally will silently overwrite a deliberate transient
state set moments earlier.

1. The recommendations error message, written into `#recs-hint` and then wiped by
   `syncRecommendationsAvailability()` in the handler's own `finally` — still
   open, see CLAUDE.md.
2. `syncSearchResultButtons()` writing `textContent` into a button that was still
   mid-request, destroying its spinner. Fixed by skipping anything with
   `aria-busy`.
3. This one.

*(Two dated corrections, 2026-09-09, added rather than folded into the text above,
which stays as written. **Item 1 is no longer open** — it was fixed as backlog R1,
and it turned out to be bigger than described here: the same `finally` wiped the
SUCCESS and zero-result messages too, not only the error. **`syncSearchResultButtons()`
is now `syncAddButtons()`**, renamed when R3 widened it from the search panel to
the whole document; the `aria-busy` skip described in item 2 is unchanged and is
still the reason it exists. The pattern this entry names — an unconditional sync
overwriting a deliberate transient state — went on to catch a fourth and fifth
instance, so the entry's real content has aged well.)*

Before adding a sync call, check which deliberate states it can reach.

## D-025 · Hide the browser's search clear button rather than theme it
`<input type="search">` makes Chromium/Safari draw their own clear "×" inside the
field. On a near-black amber panel it renders as an unthemed blue glyph — the most
literal instance of the "generic default-component appearance" CLAUDE.md's design
notes rule out.

The obvious fix is to style it via `::-webkit-search-cancel-button`. Rejected:
**Firefox draws no clear button at all**, so styling leaves the browsers still
disagreeing — just with a nicer × in two of them. Hiding it is the only option
that renders identically everywhere, and cross-browser sameness matters more here
than a prettier glyph for a submission opened on a browser we do not control.

It was also only half-wired: the native × clears the input but leaves
`.search-results` showing matches for a query no longer in the box. Keeping it
honestly would have meant extra JS to close the panel, for a control much of the
audience never sees. `type="search"` stays — the semantics and the mobile
keyboard's Search key are unaffected; only the chrome goes.

## D-024 · The search results panel is a persistent surface, not a dropdown
Three separate questions — should an outside click dismiss it, should adding a
film dismiss it, should it get its own "×" — all resolve to one distinction:

**A floating layer must be dismissible; an in-flow one need not be.** The AI-log
reveal panels are `position: absolute` and sit ON TOP of table rows, so they have
to get out of the way, and they earn their outside-click handler.
`.search-results` is in normal flow. It pushes the page down and obscures
nothing, so there is nothing to get out of the way of.

Both auto-dismissals were built and then removed:
- **Outside click** (33ad1ec) — pattern-matched from the reveal panels without
  checking whether the reason applied. A stray click cost the user a re-typed
  query and another TMDB round-trip.
- **Close on add** (fdf7ec6) — worse, it was self-defeating. It ran in the same
  tick as `settle('✓ Added')`, so that confirmation could never be painted, and
  it cancelled out `syncSearchResultButtons()` — renamed `syncAddButtons()` in
  2026-09-09's R3, and still existing precisely to update
  the OTHER open rows after an add. Keeping the panel open serves the real flow:
  search once, add two films.

**No "×" either**, declined for a second reason: `type="search"` already renders
a native × a few pixels away (see D-025), and the two would do *different* things
— native clears the input, ours would close the results. Adjacent identical
glyphs with different meanings is a trap. Escape closes it; a new search replaces
it; otherwise it stays.

## D-023 · The reveal-panel fade animates the panel, never `::details-content`
*Recorded retroactively — decided 2026-09-05 over commits bfafeb2, 1476446,
de244d7.*

The obvious place to animate a `<details>` open/close is `::details-content`,
which is what the pseudo exists for. Doing that made the panel flicker BEHIND
later table rows mid-fade.

Cause: `0 < opacity < 1` creates a stacking context, `opacity: 1` does not. So
animating opacity on `::details-content` made *that pseudo* a transient stacking
context only while the fade was running, trapping the panel underneath rows that
come later in paint order. Raising `z-index` on `.log-reveal` did not help — it
is a table-cell stacking context and cannot lift past later `<tr>`s at all.

Decision: the opacity transition and `@starting-style` live on the panel itself
(`.log-reveal ul/p`), which is already `position: absolute` + `z-index` and so a
*stable* stacking context at every opacity. `::details-content` transitions only
`content-visibility` (`allow-discrete`), to keep the panel rendered through the
close.

The trap that follows: those two durations live on different elements but MUST
match, or the panel is yanked mid-fade-out. Both read one custom property,
`--reveal-fade` on `.log-reveal` — the single knob. Do not split them.

## D-022 · The AI-log Total row rides on a curtain, not on a sticky `<tfoot>`
*Recorded retroactively — decided 2026-09-05 after four attempts (842fe03,
6c08db4, 188b6bf, 58f787b).*

Pinning the Total row to the bottom of the log dialog looks like a one-liner and
is not. What failed, in order:

1. **`position: sticky` on the `<tfoot>` alone.** A sticky element can never be
   positioned outside its own containing block, and the tfoot's is the `<table>`.
   It therefore cannot reach the dialog's bottom edge, and table rows peeked
   underneath it mid-scroll.
2. **An absolutely-positioned bar toggled by an IntersectionObserver.** Floated
   mid-content instead of pinning.
3. **A sticky tfoot plus a non-sticky spacer row.** Same clamping problem.

What works — and the reason to keep it: `.log-curtain`, an opaque `--bg-raised`
band that is a **direct child of the dialog**, so its containing block is the
dialog and it is never clamped. It is `position: sticky; bottom: 0; z-index: 2`;
the Total row pins at `bottom: var(--log-curtain-h)` with `z-index: 3`, exactly
on top of it. The two form one solid block down to the dialog edge, so nothing
shows underneath.

The curtain's `border-top` is also the table's closing rule, because the curtain
is the only element adjacent to the Total row in BOTH states (pinned and at
rest) — anywhere else the rule goes missing mid-scroll or doubles up at rest.

**This is why `.log-scroll` is square.** It must stay `overflow: visible` (the
dialog is the single scroller), so it cannot clip its sticky children to a
radius; a rounded border around square cell fills looked broken. "Round it when
the row sits naturally, square when stuck" has no CSS expression — there is no
is-stuck selector — so it would need a scroll listener or a sentinel observer.
Not worth it. Do not "simplify" any of this.

## D-021 · The two AI features share one UI vocabulary, enforced by shared builders
Recommendations and the taste verdict are separate services with separate
prompts, but to a user they are the same kind of thing: press a button, wait,
read a generated result, see what it cost. Their UI had drifted anyway — the
"New verdict" button was missing the busy state entirely, then had the wrong
cursor, then kept its hover while disabled. Each was reported separately.

Decision: the shared surfaces are built by shared functions rather than
reimplemented per feature — `busyButton()` (disable, spinner + "Thinking…",
lock the width, restore), `aiMetaFooter()` (the prompt/model/tokens/cost/duration
line plus a link into the log), `logLink()` (the link-styled button that opens
the log dialog). One CSS block each, with only *placement* differing per host.
A third feature would get the same treatment for free, and neither existing one
can drift again without the other following.

Two implementation notes worth keeping:

- **The busy width lock is measured, not declared.** `getBoundingClientRect()`
  at click time, cleared on restore. A hardcoded `min-width` silently goes wrong
  the moment a label or font changes, and the two buttons have different labels.
- **`visibility`, never `display`, for the wrapped-separator fix.** The log link
  sits inline after the metadata joined by a "·", and must drop to its own line
  as a whole unit when short of room. CSS has no "did this wrap" selector, so
  `syncMetaSeparator()` measures. Hiding the "·" with `display: none` changes
  layout, so the link would then fit, so the "·" would return, so it would wrap
  again — an infinite oscillation. `visibility: hidden` keeps the box, so the
  hide cannot alter the thing it is reacting to.

## D-020 · The AI-log table view is frozen; card-view work must prove it can't touch it
The desktop/table view of the AI call log took ~100 commits of screenshot-driven
polish to settle (sticky thead/tfoot via `.log-curtain`, the collapsed-border
divider painted as gradients, the reveal panel's caret + flip, themed
scrollbars). It is done and it is fragile — several of those rules are the only
CSS expression of a hard-won layout fact.

Decision: once the table view was signed off, **every** subsequent AI-log change
(the mobile card view, and anything later) must be provably unable to affect it.
Concretely: card-view CSS lives only inside `@media (max-width: 850px)`, and each
change is verified with `git diff <last-merge>..HEAD` showing (a) the only file
touched is `styles.css` — no shared JS/HTML — and (b) every hunk falls between
the `@media (max-width: 850px) {` line and its matching close. A browser never
applies those rules above 850px, so the table view is unaffected by construction,
not by inspection.

Corollary: the card view's own bugs are fixed *in place* at matching-or-higher
CSS specificity (the shared `.log-table` rules use `:last-child` /
`:not(:last-child)` selectors at 0,2,1–0,3,1 that keep winning into card mode),
never by refactoring the shared rules — that would put the table view back in
scope.

## D-019 · Six pre-migration log rows deleted, rather than annotated forever
The six oldest AI-log rows predate migration 001, so they carry no token split
and no duration — the columns simply did not exist when they were written. The
footer's summed `in / out` and total duration therefore covered only a subset,
and showing that honestly meant a `· 13/19` marker plus tooltips in the Total
row. That was a permanent piece of UI complexity paying for a temporary data
gap: the viewer only ever shows the 60 most recent calls, so those rows will
fall out of the window on their own after ~47 more calls.

Decision: delete those six rows and drop the coverage markers. The predicate is
self-describing — `prompt_tokens is null and completion_tokens is null and
duration_ms is null` matches exactly the pre-migration rows and can never match
a new one (every post-migration write records a duration, success or failure).

**This is a deliberate exception, recorded because the log's whole argument is
that it is an append-only audit trail.** Six rows were removed from it by hand,
once, for presentation reasons — not by any code path. The app itself still has
no way to delete a log row. `totals.detailed` / `totals.timed` stay in the
`/api/ai-log` response (and under test) so the partial-coverage case is still
handled correctly if it ever recurs; it is just not surfaced in the UI.

## D-018 · Route + resilience tests without touching the live DB
Added `test/routes.test.js` covering the SPEC §7.1 checklist items that the pure
-helper tests couldn't: validation 400s, duplicate 409, TMDB-down 502,
below-threshold 422, and OpenRouter-down 422 **with** a `status='failed'` row
written (the Module 13 "make failure visible" contract, now enforced). The
constraint was the binding working agreement to never touch the user's Supabase
data — so the client is replaced with an in-memory fake query builder
(`test/helpers.js`, keyed by `"<table>:<op>"`, recording writes so a test can
assert "a log row was written"), and TMDB/OpenRouter are stubbed via
`globalThis.fetch`. `server/index.js` now `export`s `app` and guards `listen()`
behind an is-this-the-entrypoint check so a test can run it on an ephemeral port.
No runtime behaviour changed. Chose Node's `--experimental-test-module-mocks`
(built-in, no dependency) over adding `supertest`/`sinon`.

## D-017 · Keep `/api/recommendations/history` rather than delete it
`/api/ai-log` (added in D-010) is a strict superset of `/history` for the
recommendation side — both tables, failure status, token split, duration,
totals — and it's the only log endpoint the UI calls. `/history` is unused and
untested, so code-hygiene says delete it. Decided to **keep** it: it's listed in
SPEC §4.5 (as optional), removing it is a SPEC-table deviation that buys nothing
on the impression/creativity axes and only a marginal workflow point, and a
pre-submission deletion carries dangling-reference risk. Instead: one sentence in
`docs/PROCESS.md` frames `/api/ai-log` as the primary audit surface and
`/history` as the narrower per-feature JSON view. Revisit as post-submission
cleanup.

## D-016 · Accessibility pass
Per-item action buttons (Rate/Edit/Remove, rec cards' Add) got name-specific
`aria-label`s so a screen reader in a 20-row list hears which film, not just
"Remove, button" repeated. Added live regions (`role="status" aria-live="polite"`)
on search results, the recs hint, and the verdict text so async results and
errors are announced, not just visually swapped. `aria-busy` on the two AI
trigger buttons while a call is in flight. The review "view more" toggle got
`aria-expanded`/`aria-controls`. Both `<dialog>`s got `aria-labelledby` (native
`showModal()`/`.close()` already handles focus trap and return-focus, so no JS
needed there). Poster `<img alt>` now reads "{title} — poster"; the no-poster
placeholder is `role="img"` with a labelled fallback instead of decorative-only.
Fixed a real heading-hierarchy bug: recommendation cards used `<h4>` directly
under the section's `<h2>` (skipping `<h3>`) — now `<h3>`, matching the ranked
list's card headings. Decorative spinners are `aria-hidden`. No visual change.

## D-015 · Test suite, health probe, process doc
Added `npm test` on Node's built-in runner (no new dependency) covering the pure
helpers where every truncation bug actually lived — `parseModelJson`,
`tidyReason`, `tidyVerdict`, `estimateCostUsd` — plus `loadPrompt` against the
real `prompts/` files, so a malformed prompt version fails the suite. Those four
helpers were made `export`-ed for testability; no behaviour change. `GET
/api/health` added for a future Node host. `docs/PROCESS.md` collects the
LLM-augmented workflow story (the recommend v1→v3 / taste_verdict v1→v4 prompt
chains as prompt-engineering evidence, the model guardrails, Incident 1 and the
binding agreement it produced) — the course grades process, so it's a
deliverable, not a note. Route-level and resilience tests remain manual.

## D-014 · Taste verdict over-corrected → `taste_verdict_v4`
v3's "ONE sentence, 20–30 words" landed, but the output degenerated into a bare
ratings-paraphrase ("Matt Murdock's darkness scores higher than Superman's
earnestness") — a readout, not a verdict, and too terse (user: "shouldn't go this
far with being short"). v4 gives the room back — 2–3 finished sentences, ~35–60
words — and redirects the content: characterise the person as a viewer (what they
chase, what bores them, what kind of moviegoer that makes them), name a film only
as evidence, never just recite the numbers. `max_tokens` 100 → 180, server
truncation ceiling 350 → 450. Tone + injection guard unchanged. New prompt file;
v1–v3 untouched.

## D-013 · Taste verdict still too long → `taste_verdict_v3`
v2's "one or two sentences, ~260 chars" still produced ~330-char run-ons
(em-dashes splicing three clauses). v3 is blunt: ONE sentence, 20–30 words, no
dash/semicolon/"yet/while" clause-chaining, "cut detail not the sentence". Also
`max_tokens` 160 → 100 so a rambler is physically bounded, and the server
truncation ceiling 300 → 350 (user request) so a marginally-long verdict still
shows in full. New prompt file; v1/v2 untouched.

## D-012 · Recommendation reason length → `recommend_v3`
v2 reasons ran 25–30 words and got clamped in the card ("…delivers that same…").
Two-sided fix: v3 prompt tightens to one short sentence, 8–16 words, no
clause-splicing dashes/semicolons; `tidyReason()` in the service strips markdown
and truncates at a sentence/word boundary past a 130-char ceiling; and the card
`.reason` clamp goes 3 → 5 lines so a compliant reason never clips. New prompt
file; v1/v2 untouched.

## D-011 · Taste verdict truncation + markdown → `taste_verdict_v2`
v1 output was hard-sliced at 240 chars, cutting mid-word ("…over c"), and the
model leaked markdown emphasis (`*Saw*`) that the plain-text banner rendered
literally. v2 prompt: explicit "finish the sentence", ban asterisks/markdown/
title-quotes, target ~260 chars. Service: `tidyVerdict()` strips `* _ \``, and
if still over a 300-char ceiling truncates at the last sentence end (else last
word + "…"), never mid-word. `max_tokens` 120 → 160 for headroom. New prompt
file; `taste_verdict_v1.md` untouched.

## D-010 · In-app AI call log + failure logging (migration 001)
Added `GET /api/ai-log` (both log tables merged, newest first, with totals) and a
wide modal viewer reachable from a footer link — so the audit trail can be shown
in the browser during the demo, not only in the Supabase table editor (SPEC § 7.2
step 4). Migration 001 adds `prompt_tokens`, `completion_tokens`, `duration_ms`,
`status`, `error_text` to both tables. The services were restructured so that once
an AI call is attempted a row is **always** written — a handled model/parse/network
failure logs `status='failed'` with the message, then re-throws for the calm inline
UI error. Pre-call guards (not enough rated movies, DB read failure) still throw
without logging — those aren't AI calls.

## D-009 · Recommendation reason voice → `recommend_v2`
The v1 reason read like a plot blurb ("A crime thriller about a bank robbery").
v2 asks for a second-person line tied to the user's own ratings/reviews
("You rated Whiplash a 10 — this has the same slow-burn dread"). Logic change, so
a new prompt file per CLAUDE.md § Prompt Versioning; `recommend_v1.md` is kept
untouched and every past `recommendation_logs` row still names the exact prompt
that produced it. `taste_verdict_v1` is unaffected — versioned independently.

## D-008 · Taste verdict never auto-runs
The banner shows a threshold message or a "tap for a verdict" prompt on load, and
only calls OpenRouter on the explicit "New verdict" click — no burning credit on
an unrequested repeat call every page load (SPEC § 2.3).

## D-007 · Ranking is derived, never stored
`GET /api/movies` returns movies ordered by `rating desc nulls last`; the
frontend numbers them 1..N on render. No stale `rank` column (SPEC § 2.1).

## D-006 · Frontend: vanilla, but not plain
No framework. The "polished, distinctive" bar (SPEC § 3) is met with deliberate
choices: poster as the anchor of every card, Fraunces display numerals for rank,
a marquee-amber accent on near-black, film grain, motion on hover/entry, a
gradient-sheen verdict banner. AI-suggested cards reuse the card language but
carry a quiet "AI pick · not yet rated" marker (SPEC § 3.3).

## D-005 · Prompt-injection posture
Review text is untrusted user input flowing into both prompts. Mitigations, in
layers: (1) the text is length-capped and wrapped in explicit BEGIN/END data
markers; (2) each prompt tells the model the block is data and to ignore embedded
instructions; (3) recommendation output is constrained to a JSON array and every
title is TMDB-verified, so a partial injection yields at worst a strange
suggestion; (4) the verdict is length-capped server-side and rendered as
`textContent`, so at worst it's an off-tone banner line.

## D-004 · Model choice: cheap by default
`anthropic/claude-3.5-haiku` via OpenRouter. The tasks are small (pick 3–6 titles;
write one teasing sentence). Module 9: match the model to the task's difficulty;
the biggest cost lever is model choice. Overridable via `OPENROUTER_MODEL`.

## D-003 · Cost logging is structural, not decorative
`recommendation_logs` and `taste_verdict_logs` store `tokens_used` and
`estimated_cost_usd` per call. `config.estimateCostUsd` uses a small per-model
price table; unknown models log `null` rather than a wild guess. A log-write
failure is surfaced as an error, not swallowed — the audit record is the point.

## D-002 · The AI is a component, not the product
Two narrow LLM features (recommendations, taste verdict), each in its own service
module, each with its own versioned prompt file. Either can be mocked or removed
without touching movie CRUD. The model never supplies a fact shown to the user:
recommendations return *titles only*, and TMDB supplies poster/year/overview after
a cross-check. This is the concrete guard against hallucinated movies.

## D-001 · Scope: single-user, no auth — and why that isn't a security hole
The app is one person's movie list. Module 17's real topics — injection, secrets,
prompt injection, least privilege — are all demonstrable without multi-user auth.
Least privilege here = the frontend/back-end use the Supabase **anon key**, which
is RLS-bounded, never the `service_role` key. Adding accounts would be
manufacturing a demo the app doesn't need.
