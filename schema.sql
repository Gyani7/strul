-- ─────────────────────────────────────────────────────────────
-- ShorTul Database Schema (Supabase / PostgreSQL)
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── USERS (managed by Supabase Auth; this extends auth.users) ──
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── WORKSPACES ──
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── LINKS ──
CREATE TABLE IF NOT EXISTS public.links (
  id BIGSERIAL PRIMARY KEY,
  shortcode TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  is_guest BOOLEAN DEFAULT FALSE,
  guest_session_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  password_hash TEXT,
  permanent BOOLEAN DEFAULT TRUE,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes for fast lookups ──
CREATE INDEX IF NOT EXISTS idx_links_shortcode ON public.links (shortcode);
CREATE INDEX IF NOT EXISTS idx_links_creator ON public.links (creator_id);
CREATE INDEX IF NOT EXISTS idx_links_expires ON public.links (expires_at);
CREATE INDEX IF NOT EXISTS idx_links_active ON public.links (is_active);
CREATE INDEX IF NOT EXISTS idx_links_guest ON public.links (is_guest) WHERE is_guest = TRUE;

-- ── GUEST LINKS (view for quick guest link management) ──
CREATE VIEW public.guest_links AS
SELECT id, shortcode, destination_url, title, is_active, expires_at,
       guest_session_id, created_at
FROM public.links
WHERE is_guest = TRUE;

-- ── CLICK STATISTICS (per shortcode/date/hour/country/device/referrer) ──
CREATE TABLE IF NOT EXISTS public.click_statistics (
  id BIGSERIAL PRIMARY KEY,
  shortcode TEXT NOT NULL,
  click_date DATE NOT NULL,
  click_hour INTEGER CHECK (click_hour >= 0 AND click_hour <= 23),
  country TEXT,
  device_type TEXT,
  referrer TEXT,
  click_count INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shortcode, click_date, click_hour, country, device_type, referrer)
);

CREATE INDEX IF NOT EXISTS idx_click_stats_shortcode ON public.click_statistics (shortcode);
CREATE INDEX IF NOT EXISTS idx_click_stats_date ON public.click_statistics (click_date);
CREATE INDEX IF NOT EXISTS idx_click_stats_shortcode_date ON public.click_statistics (shortcode, click_date);

-- ── DAILY STATISTICS (rolled up per shortcode/date) ──
CREATE TABLE IF NOT EXISTS public.daily_statistics (
  id BIGSERIAL PRIMARY KEY,
  shortcode TEXT NOT NULL,
  click_date DATE NOT NULL,
  total_clicks INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shortcode, click_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_shortcode ON public.daily_statistics (shortcode);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON public.daily_statistics (click_date);

-- ── ROW LEVEL SECURITY ──
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Users can see/update their own profile
CREATE POLICY "users_read_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Users can manage their own links
CREATE POLICY "links_select_own" ON public.links FOR SELECT USING (creator_id = auth.uid() OR is_guest = TRUE);
CREATE POLICY "links_insert_own" ON public.links FOR INSERT WITH CHECK (creator_id = auth.uid() OR creator_id IS NULL);
CREATE POLICY "links_update_own" ON public.links FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "links_delete_own" ON public.links FOR DELETE USING (creator_id = auth.uid());

-- Workspaces: owner access
CREATE POLICY "workspace_owner" ON public.workspaces FOR ALL USING (owner_id = auth.uid());

-- Click/daily statistics: readable by link owner (via shortcode join)
-- For simplicity, allow authenticated reads; admin reads via service role
CREATE POLICY "stats_read" ON public.click_statistics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "daily_stats_read" ON public.daily_statistics FOR SELECT USING (auth.role() = 'authenticated');

-- ── TRIGGER: auto-create user profile on signup ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── TRIGGER: update updated_at ──
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER links_updated_at BEFORE UPDATE ON public.links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
