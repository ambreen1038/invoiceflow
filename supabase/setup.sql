-- InvoiceFlow: Supabase-specific setup.
-- Run this ONCE in the Supabase SQL editor, AFTER `alembic upgrade head` has created the tables.
--
-- Security model
--   * The FastAPI backend connects as the database owner and enforces ownership itself.
--   * Browsers only ever hold the public anon key. Row Level Security makes sure that even if
--     someone calls the Supabase REST API directly, they can only READ their own invoices,
--     and can never write anything or see the job queue.
--   * The storage bucket is private; only the backend (service-role key) reads/writes files.

-- 1. Private bucket for uploaded invoices (idempotent).
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;

-- 2. Turn RLS on for every app table (also alembic_version, which would otherwise be
--    readable through the auto-generated REST API).
alter table public.invoices        enable row level security;
alter table public.invoice_items   enable row level security;
alter table public.jobs            enable row level security;
alter table public.alembic_version enable row level security;

-- 3. Clients get read-only access to their own rows; nothing else.
revoke all on public.invoices, public.invoice_items, public.jobs, public.alembic_version
  from anon, authenticated;
grant select on public.invoices, public.invoice_items to authenticated;

drop policy if exists "own invoices are readable" on public.invoices;
create policy "own invoices are readable" on public.invoices
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own invoice items are readable" on public.invoice_items;
create policy "own invoice items are readable" on public.invoice_items
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id and i.user_id = (select auth.uid())
  ));

-- jobs and alembic_version: RLS on + no policies + no grants = invisible to clients.
-- storage.objects: no policies for anon/authenticated = no direct access to files.
