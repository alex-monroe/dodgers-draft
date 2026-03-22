-- 001_initial_schema.sql
-- Dodgers Season Ticket Draft App - Supabase Schema


-- 1. Users table extending Supabase auth.users
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a public.users row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Drafts table representing a single draft session
CREATE TABLE public.drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    season_year INT NOT NULL,
    status VARCHAR(50) DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. Draft Participants table (the 16 slots)
CREATE TABLE public.draft_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Null until claimed
    pick_order INT NOT NULL CHECK (pick_order >= 1 AND pick_order <= 16),
    display_name VARCHAR(100) NOT NULL, -- E.g. "Alex" or "Person 1"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(draft_id, pick_order)
);


-- 4. Draft Games table
CREATE TABLE public.draft_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE,
    mlb_game_pk INT,
    game_date DATE NOT NULL,
    day_of_week VARCHAR(10),
    opponent VARCHAR(100) NOT NULL,
    start_time VARCHAR(50),
    
    UNIQUE(draft_id, mlb_game_pk)
);


-- 5. Draft Picks table tracking the history of picks
CREATE TABLE public.draft_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.draft_participants(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.draft_games(id) ON DELETE CASCADE,
    pick_number INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(draft_id, pick_number)
);

-- Trigger to enforce the 2 pairs per game rule
CREATE OR REPLACE FUNCTION check_game_pick_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT count(*) FROM public.draft_picks WHERE game_id = NEW.game_id) >= 2 THEN
        RAISE EXCEPTION 'This game has already been picked twice.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_two_picks_per_game
BEFORE INSERT ON public.draft_picks
FOR EACH ROW
EXECUTE FUNCTION check_game_pick_limit();


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

-- For ease of use among friends, we allow any authenticated user to read/write.
-- In a production, zero-trust environment, you would restrict these further.

CREATE POLICY "Allow read access to authenticated users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update access to own user profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow all access to authenticated users" ON public.drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.draft_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.draft_games FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.draft_picks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow Realtime to listen to draft picks inserts/deletes
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_participants;
