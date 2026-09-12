import { supabase } from '../supabase.js';
import { config, estimateCostUsd } from '../config.js';
import { loadPrompt } from './promptLoader.js';
import { chat, OpenRouterError } from './openrouter.js';
import { verifyTitle } from './tmdb.js';

const PROMPT_VERSION = 'recommend_v3';
const REASON_MAX = 130; // safety ceiling; the prompt asks for 8–16 words

class RecommendationError extends Error {
  /**
   * Two flags, both additive and both about what the ROUTE may do with the
   * message — the service keeps writing the same technical text either way, and
   * that text keeps going to the log row's error_text where it belongs.
   *
   * @param userFacing  This message IS the answer, so show it verbatim. True for
   *   exactly one case: not enough rated films. Everything else here names an
   *   internal cause ("OpenRouter responded 401", "DB read failed: ...") that a
   *   user can neither act on nor should have to read.
   * @param logged  A recommendation_logs row was written for this failure, so a
   *   UI may point at the AI call log. Only true once an AI call has actually
   *   been made and its row committed: a failed DB read, an unmet threshold and
   *   a failed log write all produce NO row, and telling the user to go read one
   *   would send them to an empty page.
   */
  constructor(message, { userFacing = false, logged = false } = {}) {
    super(message);
    this.name = 'RecommendationError';
    this.userFacing = userFacing;
    this.logged = logged;
  }
}
export { RecommendationError };

// Review text is untrusted user input flowing into the prompt (CLAUDE.md
// § Security & Secrets, item 5 — there is no § Prompt Injection heading, which
// is what this comment used to point at). We cap length and keep it clearly
// inside the data block;
// the prompt itself instructs the model to treat the block as data only. Even if
// injection partly succeeds, the blast radius is "a weird title" — every title is
// then verified against TMDB before the user ever sees it.
function line(movie) {
  const review = (movie.review || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const base = `- "${movie.title}" (${movie.year ?? 'n/a'}) — rated ${movie.rating}/10`;
  return review ? `${base}; review: <<${review}>>` : base;
}

export function parseModelJson(text) {
  // Structured output only — no regex-parsing of prose (SPEC § 6). We tolerate a
  // markdown code fence but nothing looser than that.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch {
    throw new RecommendationError('Model did not return valid JSON');
  }
  if (!Array.isArray(arr)) throw new RecommendationError('Model JSON was not an array');
  return arr
    .filter((x) => x && typeof x.title === 'string' && typeof x.reason === 'string')
    .map((x) => ({ title: x.title.trim(), reason: tidyReason(x.reason) }))
    .slice(0, 6);
}

// Belt-and-suspenders: strip markdown, and if the model overshoots the word
// budget cut at the last sentence end (else last word), never mid-word.
export function tidyReason(raw) {
  let r = raw.replace(/\s+/g, ' ').trim().replace(/[*_`]+/g, '');
  if (r.length <= REASON_MAX) return r;
  const head = r.slice(0, REASON_MAX);
  const dot = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (dot > 40) return head.slice(0, dot + 1);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).replace(/[,;:—-]\s*$/, '') + '…';
}

/**
 * WHY a run produced nothing. The UI used to assert one cause — "the model only
 * named films already in your list" — for all of them, which is wrong three
 * times out of four and, in the tmdb-unreachable case, actively hides an outage
 * behind a confident false statement (user-raised, 2026-09-09).
 *
 * The service is the only place that knows, so it says so instead of leaving the
 * client to guess. Order matters: an unreachable TMDB outranks everything else,
 * because it is the only cause the user can neither see nor act on otherwise —
 * the run still logs status 'success' (the AI call really did succeed) and
 * nothing else in the app would mention it.
 *
 * `duplicate` cannot be non-zero here: the guard that increments it tests
 * `verified.some(...)`, which is false while `verified` is empty. It is counted
 * anyway so the tally in the log row adds up for a run that DID produce cards.
 */
function emptyReasonFor(tally) {
  if (tally.named === 0) return 'none-named';
  if (tally.tmdbErrors > 0) return 'tmdb-unreachable';
  if (tally.owned === tally.named) return 'all-owned';
  if (tally.unmatched === tally.named) return 'unverifiable';
  return 'mixed';
}

/**
 * Run one recommendation pass. Always writes a row to recommendation_logs
 * (SPEC § 2.2) — the audit record is the point, not a nice-to-have.
 */
export async function generateRecommendations() {
  // ONE unfiltered read, then split in JS. This used to be a single query
  // filtered `.not('rating', 'is', null)`, and the owned-titles set was built
  // from its result — so the set contained only RATED films and a film the user
  // had added but not yet rated was invisible to it. The model could then name
  // it, TMDB would happily verify it, and it came back as a recommendation for
  // something already in the list; the card's own "not yet rated" badge would
  // have been correct, and its Add button would have 409'd (backlog R2).
  //
  // The two sets are genuinely different questions and must not share a filter:
  // the TASTE PROFILE is "films you have scored", the OWNED set is "films you
  // have, at all". Reading everything once and deriving both is cheaper than two
  // round trips and leaves no filter for the two to drift apart on.
  // `nullsFirst: false` matches GET /api/movies so the sort is the app's one
  // ordering rule; the unrated rows are filtered out of `rated` anyway, but a
  // DESC sort puts NULLs first in Postgres by default and that is worth not
  // relying on.
  const { data: all, error } = await supabase
    .from('movies')
    .select('id, tmdb_id, title, year, rating, review')
    .order('rating', { ascending: false, nullsFirst: false });

  if (error) throw new RecommendationError(`DB read failed: ${error.message}`);
  const library = all ?? [];
  const rated = library.filter((m) => m.rating != null);
  if (rated.length < config.recommendations.minRatedMovies) {
    throw new RecommendationError(
      `Need at least ${config.recommendations.minRatedMovies} rated movies`,
      // The one cause a user can act on, so it reaches them word for word.
      { userFacing: true }
    );
  }

  const topN = rated.slice(0, config.recommendations.topN);
  const ownedTmdbIds = new Set(library.map((m) => m.tmdb_id));

  const { system, user, version } = await loadPrompt(PROMPT_VERSION, {
    TASTE_PROFILE: topN.map(line).join('\n'),
  });

  // From here on an AI call happens, so a row is ALWAYS written — success or a
  // handled model/parse failure. Failures matter in the audit trail as much as
  // successes (Module 13: make a failure visible, never a silent result).
  const startedAt = Date.now();
  let result = null;
  let picks = [];
  const verified = [];
  let status = 'success';
  let errorText = null;
  // What happened to each title the model named. Feeds emptyReasonFor() and is
  // written into the log row, so a run that returned nothing leaves a record of
  // WHY rather than just an empty suggested_titles.
  const tally = { named: 0, tmdbErrors: 0, unmatched: 0, owned: 0, duplicate: 0 };

  try {
    result = await chat({ system, user, maxTokens: 600, temperature: 0.8 });
    picks = parseModelJson(result.text);

    // Cross-check every title against TMDB; TMDB supplies all facts (SPEC § 2.2
    // #4). Already-owned titles are silently dropped (§ 2.2 #5), and so are
    // titles TMDB returns NO result for at all -- which is what "unverifiable"
    // means here, and is narrower than the word sounds: a near-miss resolves to
    // TMDB's top result rather than being dropped. See verifyTitle() and D-054.
    tally.named = picks.length;
    for (const pick of picks) {
      let movie = null;
      let reached = true;
      try {
        movie = await verifyTitle(pick.title);
      } catch {
        // A TMDB hiccup on one lookup still must not kill the whole run — but it
        // is now COUNTED separately from "TMDB answered and had no such film".
        // Collapsing the two is what let a TMDB outage be reported to the user as
        // "the model only named films already in your list".
        reached = false;
      }
      if (!reached) { tally.tmdbErrors += 1; continue; }
      if (!movie) { tally.unmatched += 1; continue; }
      if (ownedTmdbIds.has(movie.tmdb_id)) { tally.owned += 1; continue; }
      if (verified.some((v) => v.tmdb_id === movie.tmdb_id)) { tally.duplicate += 1; continue; }
      verified.push({ ...movie, reason: pick.reason });
    }
  } catch (err) {
    if (err instanceof OpenRouterError || err instanceof RecommendationError) {
      status = 'failed';
      errorText = err.message;
    } else {
      throw err; // unexpected — don't swallow
    }
  }

  const estCost = result
    ? result.costUsd ?? estimateCostUsd(result.model, result.tokensUsed)
    : null;

  const logRow = {
    prompt_version: version,
    input_movie_ids: topN.map((m) => m.id),
    // `verification` makes the audit row self-explaining: a run with empty
    // suggested_titles now records whether that was the model, TMDB, or the
    // owned-titles filter. jsonb, and nothing reads this column (checked against
    // routes/aiLog.js), so extending it needs no migration and breaks nothing.
    raw_model_output: result ? { text: result.text, parsed: picks, verification: tally } : null,
    suggested_titles: verified.map((v) => v.title),
    model_used: result?.model ?? config.openrouter.model,
    tokens_used: result?.tokensUsed ?? null,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    duration_ms: result?.durationMs ?? Date.now() - startedAt,
    status,
    error_text: errorText,
    estimated_cost_usd: estCost,
  };
  const { error: logError } = await supabase.from('recommendation_logs').insert(logRow);
  if (logError) {
    // Logging is a hard requirement (SPEC § 5.2), so a run that cannot be
    // audited is discarded rather than quietly shown -- INCLUDING a successful
    // run that has already been paid for. That is deliberate and must stay:
    // cards on screen with no row behind them are precisely the state the audit
    // trail exists to make impossible. Do not "rescue" `verified` here.
    //
    // What WAS a bug (R5): when the AI call had ALREADY failed, this threw the
    // insert's message and destroyed `errorText`. That cause then survived
    // nowhere at all -- the row that would have carried it is the write that
    // just failed, and the route answers a RecommendationError with a calm
    // sentence instead of letting it reach the central handler. Two failures,
    // zero records.
    const cause = errorText
      ? `${logError.message} (the AI call had already failed with: ${errorText})`
      : logError.message;
    // stderr is the ONLY sink left once the log table is unreachable, so the
    // operator gets the one record that can still be written. Deliberately not
    // shown to the user: the route's calm sentence is the right answer (R8) and
    // neither cause is anything they can act on.
    console.error('[cinerank] recommendation log write failed:', cause);
    throw new RecommendationError(`Recommendation log write failed: ${cause}`);
  }

  // The log row is committed by this point, so this is the only failure the UI
  // may point at the AI call log for. `errorText` is the technical cause and is
  // NOT what the user sees — the route replaces it (R8) — but it stays the
  // message so a server-side caller and the log agree on what happened.
  if (status === 'failed') throw new RecommendationError(errorText, { logged: true });

  return {
    suggestions: verified,
    // Null whenever there are cards to show — the client only consults it in the
    // empty branch, and a value there would invite it to be read as a warning.
    emptyReason: verified.length ? null : emptyReasonFor(tally),
    meta: {
      promptVersion: version,
      model: result.model,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: estCost,
      durationMs: result.durationMs,
      basedOn: topN.map((m) => m.title),
    },
  };
}
