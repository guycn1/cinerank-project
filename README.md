# CineRank

A personal movie-ranking app where the database and the AI each earn their place:

- **The database** tracks a growing *taste profile* (your rated films + reviews) that
  is read back to ground AI recommendations, and it keeps an **audit log of every AI
  call** — prompt version, model, token count, estimated cost.
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
3. **Keys** — `cp .env.example .env` and fill in:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (the anon key only — never `service_role`)
   - `TMDB_API_KEY` (free, instant approval at themoviedb.org)
   - `OPENROUTER_API_KEY`
4. **Run**
   ```
   npm start        # http://localhost:3000
   ```

## Project layout

```
prompts/            versioned prompt files — recommend_v1.md, taste_verdict_v1.md
db/schema.sql       Supabase schema + RLS
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
scripts/scan-secrets.js   run before every commit
docs/DECISIONS.md   why the choices are what they are
```

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
