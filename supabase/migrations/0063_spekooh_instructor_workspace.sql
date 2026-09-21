-- Instructor workspace for Spekooh marking requests (owner request,
-- 2026-09-21): the first version showed an instructor a subject name and a
-- link, which is not enough to decide whether to take a paper or to mark it.
--
-- 1. Paper context. Spekooh's new_request push now says what the paper is
--    (exam type, year, system, track, board, language, and the report
--    fields for reports), all nullable so rows written before this
--    migration -- or by a Spekooh that has not deployed the richer push
--    yet -- keep working and simply show less.
alter table spekooh_marking_requests add column if not exists category text;
alter table spekooh_marking_requests add column if not exists category_title text;
alter table spekooh_marking_requests add column if not exists exam_type text;
alter table spekooh_marking_requests add column if not exists system text;
alter table spekooh_marking_requests add column if not exists track text;
alter table spekooh_marking_requests add column if not exists exam_board text;
alter table spekooh_marking_requests add column if not exists exam_year integer;
alter table spekooh_marking_requests add column if not exists language text;
alter table spekooh_marking_requests add column if not exists report_title text;
alter table spekooh_marking_requests add column if not exists report_institution text;
alter table spekooh_marking_requests add column if not exists report_discipline text;

-- 2. Lifecycle timestamps, so the request page can show a real timeline
--    instead of only the current status. NULL = has not happened (or, for
--    rows that predate this migration, was not recorded).
alter table spekooh_marking_requests add column if not exists responded_at timestamptz;
alter table spekooh_marking_requests add column if not exists submitted_at timestamptz;

-- 3. Why an instructor declined. Kept on our side only: Spekooh's routing
--    only needs the decision, and the reason is for the instructor's own
--    history.
alter table spekooh_marking_requests add column if not exists decline_reason text
  check (decline_reason is null or char_length(decline_reason) <= 500);

-- 4. A saved draft of the marking guide, so an instructor working through a
--    long paper does not lose it by closing the tab. Separate from
--    `content`, which is only ever the guide actually submitted to Spekooh.
alter table spekooh_marking_requests add column if not exists draft_content jsonb;
alter table spekooh_marking_requests add column if not exists draft_saved_at timestamptz;

-- Clients have no UPDATE policy on this table by design (see 0061), and a
-- blanket one would let an instructor rewrite their own status or deadlines.
-- Draft saving is the one client-initiated write, so it goes through this
-- narrow function: it can only touch the two draft columns, only on the
-- caller's own row, and only while the request is accepted and no guide has
-- been submitted.
create or replace function save_spekooh_marking_draft(p_spekooh_request_id bigint, p_content jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_at timestamptz := now();
  updated_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_content is not null and jsonb_typeof(p_content) <> 'array' then
    raise exception 'Draft content must be a list of questions' using errcode = '22023';
  end if;
  if p_content is not null and pg_column_size(p_content) > 512 * 1024 then
    raise exception 'Draft is too large' using errcode = '54000';
  end if;

  update spekooh_marking_requests
     set draft_content = p_content,
         draft_saved_at = saved_at
   where spekooh_request_id = p_spekooh_request_id
     and instructor_id = auth.uid()
     and status = 'accepted';

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'No open marking request for this account' using errcode = 'P0002';
  end if;

  return saved_at;
end;
$$;

revoke all on function save_spekooh_marking_draft(bigint, jsonb) from public;
grant execute on function save_spekooh_marking_draft(bigint, jsonb) to authenticated;
