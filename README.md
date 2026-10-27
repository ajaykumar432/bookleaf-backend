# BookLeaf Author Support Portal — Backend

Node.js + Express + MongoDB (Mongoose) REST API with Server-Sent Events and Claude-powered ticket triage / reply drafting.

## Run locally
```bash
cp .env.example .env        # set MONGODB_URI, JWT_SECRET, (optional) AI_API_KEY
npm install
npm run seed                # loads the 10 authors / 18 books + 5 demo tickets
npm run dev                 # http://localhost:5000
npm run test:unit           # DB-free checks of triage rules, prompt slicing, royalty calendar, AI fallback
```
No `AI_API_KEY`? Everything still works: keyword triage + template drafts (the same path used during an AI outage).

## Test logins (after `npm run seed`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@bookleaf.com / ops@bookleaf.com | `Admin@123` |
| Author | any email from the dataset, e.g. `ananya.reddy@email.com` (zero payouts), `kavita.deshmukh@email.com` (book in production) | `Author@123` |

## Structure
```
src/
  config/        env (fail-fast validation), db
  models/        User, Book, Ticket (+ atomic ticket counter)
  middleware/    auth (JWT, RBAC), validate (zod), errorHandler
  routes/        index.js (all routes) + schemas.js (zod)
  controllers/   thin HTTP layer
  services/      ticket.service, classification.service, events (SSE), serializers
  services/ai/   client (retry/timeout/circuit breaker), classifier, drafter, knowledgeBase, context, fallback
```
Design notes: controllers → services → models; **serializers** are the single place deciding what an author may see (priority, AI metadata, drafts, assignee and internal notes never reach authors). Authors requesting someone else's ticket get **404**, not 403.

## API (all under `/api`, JSON; errors: `{ "error": { "code", "message", "details?" } }`)
| Method & path | Role | Purpose |
|---|---|---|
| POST `/auth/login` | public | `{email,password}` → `{token,user}` |
| GET `/auth/me` | any | current user |
| GET `/books` | any | author: own books; admin: all (`?authorId=`) |
| GET `/books/:id` | any (own) | single book |
| GET `/tickets` | any | author: own; admin: all. Filters: `status,category,priority,assigned=me\|unassigned,authorId,q,from,to,sort=urgency\|newest\|oldest,page,limit` |
| POST `/tickets` | author | `{bookId\|null, subject, description, attachments?[{name,size}]}` → 201; AI triage runs async |
| GET `/tickets/:id` | any (own) | detail (role-shaped view) |
| POST `/tickets/:id/replies` | any (own) | `{message, status?, fromDraft?}`; admin reply auto-assigns + moves Open→In Progress; author reply reopens a Resolved ticket; Closed → 409 |
| PATCH `/admin/tickets/:id` | admin | `{status?, category?, priority?, assignedTo?: "me"\|null}` — category/priority edits are recorded as admin overrides |
| POST `/admin/tickets/:id/notes` | admin | `{note}` internal only |
| POST `/admin/tickets/:id/draft` | admin | `{regenerate?, instruction?}` → AI draft (cached) |
| POST `/admin/tickets/:id/reclassify` | admin | re-run AI triage; `{force:true}` also overrides admin edits |
| GET `/admin/stats` | admin | counts by status / active priority, unassigned, oldest active |
| GET `/events/stream?token=JWT` | any | SSE: `ticket.created`, `ticket.updated` (ids only; client refetches via RBAC-checked REST) |
| GET `/health` | public | liveness + db/ai state |

## AI integration
- **Model/provider:** configurable via `AI_PROVIDER` (`groq` default, `gemini`, `openrouter`, `anthropic`). Groq's free tier needs no credit card; the default Llama 3.3 70B follows JSON and tone instructions well, and its low latency suits per-ticket calls. All providers sit behind one function in `ai/client.js`, so swapping is an env change.
- **Classification + priority:** one call, JSON-only output validated with zod, `temperature 0`, ~120 max output tokens, ~250 input tokens (subject + trimmed description + book title/status). No KB, no history.
- **Business-rule floor:** code enforces KB policy the model can't override — ISBN issues are never below High.
- **Drafting:** only when an admin opens the ticket (not on creation → no spend on tickets never opened), then cached on the ticket. Prompt = base rules + **only the KB slice for that category** + tone guidelines + that category's example guidance + **facts for the ticket's own book** + a computed royalty calendar (real quarter-end / payout-by dates, so the model never invents them) + last 4 messages (truncated). Admin can regenerate with an instruction ("shorter", "ask for photos").
- **Grounding:** the model is told to use only supplied FACTS, put `[ADMIN: …]` where data is missing, and never invent numbers. Unpublished books are explicitly flagged so no royalty talk appears for them; sub-₹1,000 pending balances and "never paid" cases get explicit notes.
- **Degradation:** 429/5xx/network → retry with backoff; 3 consecutive failures → 60 s circuit breaker. On failure tickets are still created and triaged by keyword rules (`categorySource: "fallback"`), and drafts fall back to editable templates (`source: "template"`). Admin overrides are re-checked after the LLM call returns so they're never clobbered.
- **Security:** key read from env only, used server-side only, never serialized; AI endpoints are rate-limited.

## Assumptions / known limitations
- Royalty quarters are assumed to be calendar quarters (KB doesn't define them). Set `REFERENCE_DATE` to pin "today" for demos since sample data is dated 2025.
- Attachments store metadata only (UI-level, as specified). SSE hub is in-memory (single instance); use Redis pub/sub to scale out.
- No automated DB/integration tests yet; unit checks cover the pure logic. Passwords for authors are seeded (no self-signup/reset).
