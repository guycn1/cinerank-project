# CineRank

### ▶ Live app: **https://cinerank-g6lx.onrender.com**

> Hosted on Render's free tier, which sleeps after ~15 minutes idle — **the first
> request after a quiet spell takes anywhere from a few seconds to a minute**
> while the instance wakes. Every load after that is immediate. Worth opening the
> link shortly before you need it.

A personal movie-ranking app where the database and the AI each earn their place:

- **The database** tracks a growing *taste profile* (your rated films + reviews) that
  is read back to ground AI recommendations, and it keeps an **audit log of every AI
  call** — prompt version, model, token split, duration, success/failure, estimated
  cost. Viewable in-app via the "AI call log" button in the footer.
- **The AI** (via OpenRouter) has one narrow job: given your top-rated films, name
  similar ones you haven't added — and it is **never trusted for facts**. Every
  suggested title is cross-checked against TMDB, which supplies the real poster,
  year and overview.
- **A Taste Verdict banner** gives a short, teasing one-liner about your taste — the
  low-stakes, fun AI touch, logged with the same discipline.

Stack: Node + Express · Supabase (Postgres) · vanilla HTML/CSS/JS · TMDB · OpenRouter.

## Setup

1. **Install**
   ```
   npm install
   ```
2. **Supabase** — create a project, then run `db/schema.sql` in its SQL editor.
   For an existing project, also run any newer files in `db/migrations/` in order.
3. **Keys** — `cp .env.example .env` and fill in:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (the anon key only — never `service_role`)
   - `TMDB_API_KEY` (free, instant approval at themoviedb.org)
   - `OPENROUTER_API_KEY`
4. **Run**
   ```
   npm start        # http://localhost:3000
   npm test         # 48 tests — helpers, prompt loader, routes, resilience
   ```
   Health probe for a host: `GET /api/health`.

## Project layout

```
prompts/            versioned prompt files, never overwritten — recommend_v1..v3,
                    taste_verdict_v1..v4 (live: recommend_v3, taste_verdict_v4)
db/schema.sql       Supabase schema + RLS — fresh installs
db/migrations/      numbered, re-runnable; applied by hand in the SQL editor
server/
  config.js         the only place env/secrets enter the process
  supabase.js       one anon-key client; all DB access via the query builder
  services/
    tmdb.js         all TMDB HTTP; the trusted source of movie facts
    openrouter.js   low-level OpenRouter transport
    recommendations.js  reads taste profile → prompt → parse JSON → verify vs TMDB → log
    tasteVerdict.js     rated movies → prompt → plain-text verdict → log
  routes/           thin Express routes; no inline fetch(), no inline SQL
public/             the cinematic frontend
scripts/scan-secrets.js         run before every commit
scripts/backfill-tmdb-rating.js  one-off fill for rows predating migration 002
test/              npm test — helpers, prompt loader, routes, resilience
                   (Supabase faked, TMDB/OpenRouter stubbed — never hits live data)
docs/DECISIONS.md   why the choices are what they are
docs/PROCESS.md     how it was built with an LLM in the loop
```

## Demo script (for grading)

1. Start from an empty list → add 3–4 real movies via TMDB search, rate them.
2. Show the ranked list re-sorting live as ratings change; hit **New verdict** for
   a fresh taste one-liner.
3. Trigger a recommendation run, narrating: top-N pulled → versioned prompt sent →
   each returned title cross-checked against TMDB → row written to
   `recommendation_logs`.
4. Open the in-app **AI call log** (footer button) — show prompt version, model,
   token split, duration, status, and per-call cost for both features.
5. Try a duplicate add and a recommendation run below the 3-rated threshold — show
   both graceful states.
6. (Optional) add a movie whose review is an injection attempt ("ignore previous
   instructions…") and show the verdict staying on-topic.

## Deployment

Hosted on **Render**. The Express server (`app.listen`) needs a Node host —
Netlify is not an option (static files + serverless functions only). `render.yaml`
in the repo root is the blueprint; a service created by hand in the dashboard
behaves identically and ignores the file.

**Live URL:** https://cinerank-g6lx.onrender.com

The `-g6lx` suffix is Render's own: it appends a random string to every new
`onrender.com` subdomain so they can't be squatted or guessed. It is not a name
collision, and renaming the service does not remove it.

Deploying it yourself:

1. Push to GitHub, then Render → **New** → **Web Service** → connect the repo.
2. Branch **`main`**, runtime **Node**, build `npm ci`, start `npm start`.
3. Add the four secrets under **Environment**: `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` (anon key only, never `service_role`), `TMDB_API_KEY`,
   `OPENROUTER_API_KEY`. `PORT` is injected by Render and must not be set —
   `server/config.js` already reads it.
4. Health check path `/api/health`.

**Free-tier caveat:** the instance sleeps after ~15 minutes idle, so the first
request after a quiet period takes anywhere from a few seconds to a minute while
it wakes. Subsequent loads are immediate. Worth opening the link shortly before
demoing it.

## Security notes (course Module 17)

- `.env` is gitignored from the first commit; `npm run scan-secrets` checks staged diffs.
- Frontend uses the Supabase **anon key** only — least privilege, RLS-bounded.
- User review text feeds both prompts as *untrusted data*, clearly delimited; the
  recommendation model's output only ever drives a TMDB title lookup, so the blast
  radius of a successful prompt injection is "a weird suggestion", not code execution.
- All DB access is through the Supabase query builder — no string-concatenated SQL.
- User/model text is rendered with `textContent`, never `innerHTML`.

## Workflow

Day-to-day work happens on `draft`; `main` is merged only at settled milestones and
only with explicit sign-off. Every change is committed with a message that says
*why*.
