-- 002_anon_access.sql
-- Add anonymous (unauthenticated) read access to active drafts
-- and allow anonymous pick insertion for active drafts.

-- Anon can see active drafts
CREATE POLICY "Allow anon to read active drafts"
  ON public.dd_drafts FOR SELECT TO anon
  USING (status = 'active');

-- Anon can see participants of active drafts
CREATE POLICY "Allow anon to read participants of active drafts"
  ON public.dd_draft_participants FOR SELECT TO anon
  USING (draft_id IN (SELECT id FROM public.dd_drafts WHERE status = 'active'));

-- Anon can see games of active drafts
CREATE POLICY "Allow anon to read games of active drafts"
  ON public.dd_draft_games FOR SELECT TO anon
  USING (draft_id IN (SELECT id FROM public.dd_drafts WHERE status = 'active'));

-- Anon can read picks of active drafts
CREATE POLICY "Allow anon to read picks of active drafts"
  ON public.dd_draft_picks FOR SELECT TO anon
  USING (draft_id IN (SELECT id FROM public.dd_drafts WHERE status = 'active'));

-- Anon can insert picks into active drafts
CREATE POLICY "Allow anon to insert picks into active drafts"
  ON public.dd_draft_picks FOR INSERT TO anon
  WITH CHECK (draft_id IN (SELECT id FROM public.dd_drafts WHERE status = 'active'));

-- Ensure only one draft can be active at a time
CREATE UNIQUE INDEX idx_one_active_draft
  ON public.dd_drafts ((true))
  WHERE status = 'active';
