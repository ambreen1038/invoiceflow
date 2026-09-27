# InvoiceFlow

Upload invoices (photos or PDFs). InvoiceFlow extracts the fields with an LLM, **checks that the
numbers add up**, and shows a human only what looks wrong. Approved invoices export to CSV.

> Status: work in progress. The backend, queue, tests and review UI are implemented; the accuracy
> table below is empty until I have run the evaluation set (see [docs/EVALUATION.md](docs/EVALUATION.md)).

## Why it exists

Small shops and accountants often retype invoice data by hand. LLMs read documents well but
occasionally misread a digit, so blindly trusting them is a bad idea. InvoiceFlow treats the model
as a fast first draft and puts a human in the loop only where the arithmetic disagrees.

## How it works

```
upload ──▶ FastAPI ──▶ private storage (Supabase)
              │
              └─▶ jobs table ──▶ worker ──▶ OCR/vision LLM ──▶ Pydantic parse
                                                  │
                                    arithmetic + completeness checks
                                    duplicate detection
                                                  ▼
                                   needs_review ──▶ human edits ──▶ approved ──▶ CSV
```

The checks (`backend/app/services/validation.py`):

- line: `quantity × unit price = amount`
- items add up to the subtotal (or subtotal + tax = total)
- required fields present and the date parses
- same vendor + number + total as an existing invoice is flagged as a duplicate

Approving an invoice that still fails a check requires an explicit acknowledgement, and the
server re-runs every check on each save, so the UI cannot be used to skip them.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript) |
| API | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database / auth / files | Supabase (Postgres, Auth JWTs, private Storage bucket) |
| Extraction | Groq vision model (configurable) via `httpx`; PDFs rendered with PyMuPDF |
| Queue | Postgres `jobs` table by default; Celery + Redis as an optional drop-in |
| Tests / CI | pytest (SQLite and real Postgres), ruff, GitHub Actions |

## The queue is swappable

The extraction pipeline is one plain function, `process_invoice()`. A queue backend only decides
*when* and *where* it runs. Pick one with `QUEUE_BACKEND`:

| Value | How it works | Extra services |
|---|---|---|
| `postgres` (default) | A worker loop inside the API claims rows from a `jobs` table with `SELECT … FOR UPDATE SKIP LOCKED`, retries with exponential backoff, and re-queues jobs stuck in `processing` after a crash or restart. | none |
| `celery` | The same function runs as a Celery task on a Redis broker. | Redis + a worker (`docker compose --profile celery up`) |

The job row is inserted in the same transaction as the invoice, so an invoice can never exist
without its job. Code is in `backend/app/queue/`.

Not yet done: the Celery backend is implemented but has no automated test yet, so treat it as
experimental until that is added.

## Running locally

Prerequisites: Python 3.12, Node 22, a Supabase project, a Groq API key.

1. Copy `.env.example` to `.env` and fill in your own values. **Never commit `.env`.** The
   service-role key is server-only.
2. Create the schema (uses your Supabase connection string from `.env`):
   ```bash
   cd backend && pip install -r requirements-dev.txt && alembic upgrade head
   ```
3. Run [`supabase/setup.sql`](supabase/setup.sql) once in the Supabase SQL editor. It creates the
   private bucket and turns on row-level security for every table.
4. Start everything:
   ```bash
   docker compose up --build
   ```
   or run `uvicorn app.main:app --reload` in `backend/` and `npm run dev` in `frontend/`.

Open http://localhost:3000, create an account, and upload an invoice.

Tests need no external services:

```bash
cd backend && pytest
```

## Security notes

- The bucket is private; files are served only through the API after an ownership check.
- Uploads are limited by size and checked by file signature, not just the declared type.
- Users only ever get a 404 for someone else's invoice.
- CSV cells that start with `=`, `+`, `-` or `@` are neutralised to stop spreadsheet formula injection.
- Row-level security is on for all tables as a second line of defence.

## Limitations

- Extraction quality depends on the model and the scan. That is why every result is reviewable.
- Only the first two pages of a PDF are read.
- The free Groq tier is rate limited; rate-limit errors are retried with backoff.

## Roadmap

- [ ] Run the evaluation set and publish field-level accuracy
- [ ] Automated test for the Celery backend
- [ ] Excel export
- [ ] Deploy (Vercel + Render + Supabase, all free tiers)
