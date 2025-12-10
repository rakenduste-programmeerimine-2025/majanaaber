-- =====================================================
-- MAJANAABER DATABASE SCHEMA BASELINE
-- Consolidated from 36+ migrations (2024-11-04 to 2024-12-03)
-- =====================================================

-- Enable required extensions
-- pg_net extension is pre-installed in Supabase

-- =====================================================
-- 1. CORE TABLES
-- =====================================================

-- Profiles table (users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'resident' CHECK (role IN ('resident', 'building_manager')),
  is_deactivated BOOLEAN DEFAULT FALSE NOT NULL,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buildings table
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  street_name TEXT,
  house_number TEXT,
  apartment_count INTEGER,
  city TEXT NOT NULL,
  county TEXT,
  postal_code TEXT,
  full_address TEXT NOT NULL,
  ads_code TEXT, -- Estonian ADS system code
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Building residents (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.building_residents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  apartment_number TEXT NOT NULL,
  resident_role TEXT DEFAULT 'resident' NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE NOT NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique combination of building and profile
  CONSTRAINT unique_building_profile UNIQUE (building_id, profile_id),
  CONSTRAINT valid_resident_role CHECK (resident_role IN ('resident', 'apartment_owner'))
);

-- Login attempts tracking
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- Not a foreign key since user might not exist yet
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure we have either user_id or email
  CONSTRAINT has_user_identifier CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

-- =====================================================
-- 2. NOTICES SYSTEM
-- =====================================================

-- Notices table
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'maintenance', 'event', 'urgent', 'announcement')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  event_date DATE,
  expires_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notice attachments
CREATE TABLE IF NOT EXISTS public.notice_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id UUID REFERENCES public.notices(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  content_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notice read receipts
CREATE TABLE IF NOT EXISTS public.notice_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id UUID REFERENCES public.notices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique read receipt per notice per user
  CONSTRAINT unique_notice_read_receipt UNIQUE (notice_id, user_id)
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  email_notices BOOLEAN DEFAULT TRUE NOT NULL,
  email_messages BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique preferences per user per building
  CONSTRAINT unique_user_building_preferences UNIQUE (user_id, building_id)
);

-- =====================================================
-- 3. MESSAGING SYSTEM
-- =====================================================

-- Building-wide messages
CREATE TABLE IF NOT EXISTS public.building_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  reply_to_message_id UUID REFERENCES public.building_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent empty messages and enforce max length
  CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0),
  CONSTRAINT content_max_length CHECK (length(content) <= 1000)
);

-- Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.building_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique reaction per message per user per emoji
  CONSTRAINT unique_user_message_emoji UNIQUE (message_id, user_id, emoji)
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.building_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique read receipt per message per user
  CONSTRAINT unique_message_read_receipt UNIQUE (message_id, user_id)
);

-- Message attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.building_messages(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Peer messaging conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure participants are different users
  CONSTRAINT different_participants CHECK (participant1_id != participant2_id),
  -- Ensure participant1_id is always less than participant2_id for consistency
  CONSTRAINT ordered_participants CHECK (participant1_id < participant2_id),
  -- Ensure unique conversations between two users
  CONSTRAINT unique_conversation UNIQUE (participant1_id, participant2_id)
);

-- Peer messages
CREATE TABLE IF NOT EXISTS public.peer_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  reply_to_message_id UUID REFERENCES public.peer_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Prevent empty messages and enforce max length
  CONSTRAINT non_empty_peer_content CHECK (length(trim(content)) > 0),
  CONSTRAINT peer_content_max_length CHECK (length(content) <= 1000),
  -- Ensure sender and receiver are different
  CONSTRAINT different_sender_receiver CHECK (sender_id != receiver_id)
);

-- Peer message reactions
CREATE TABLE IF NOT EXISTS public.peer_message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.peer_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique reaction per message per user per emoji
  CONSTRAINT unique_peer_user_message_emoji UNIQUE (message_id, user_id, emoji)
);

-- Peer message read receipts
CREATE TABLE IF NOT EXISTS public.peer_message_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.peer_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique read receipt per message per user
  CONSTRAINT unique_peer_message_read_receipt UNIQUE (message_id, user_id)
);

-- Peer message attachments
CREATE TABLE IF NOT EXISTS public.peer_message_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.peer_messages(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_deactivated ON public.profiles(is_deactivated);

-- Buildings indexes
CREATE INDEX IF NOT EXISTS idx_buildings_manager_id ON public.buildings(manager_id);
CREATE INDEX IF NOT EXISTS idx_buildings_city ON public.buildings(city);
CREATE INDEX IF NOT EXISTS idx_buildings_ads_code ON public.buildings(ads_code);

-- Building residents indexes
CREATE INDEX IF NOT EXISTS idx_building_residents_building_id ON public.building_residents(building_id);
CREATE INDEX IF NOT EXISTS idx_building_residents_profile_id ON public.building_residents(profile_id);
CREATE INDEX IF NOT EXISTS idx_building_residents_approved ON public.building_residents(is_approved);
CREATE INDEX IF NOT EXISTS idx_building_residents_role ON public.building_residents(resident_role);

-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON public.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON public.login_attempts(ip_address);

-- Notices indexes
CREATE INDEX IF NOT EXISTS idx_notices_building_id ON public.notices(building_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_by ON public.notices(created_by);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_category ON public.notices(category);
CREATE INDEX IF NOT EXISTS idx_notices_priority ON public.notices(priority);
CREATE INDEX IF NOT EXISTS idx_notices_pinned ON public.notices(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notices_archived ON public.notices(is_archived);
CREATE INDEX IF NOT EXISTS idx_notices_expires_at ON public.notices(expires_at);

-- Notice attachments indexes
CREATE INDEX IF NOT EXISTS idx_notice_attachments_notice_id ON public.notice_attachments(notice_id);

-- Notice read receipts indexes
CREATE INDEX IF NOT EXISTS idx_notice_read_receipts_notice_id ON public.notice_read_receipts(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_read_receipts_user_id ON public.notice_read_receipts(user_id);

-- Notification preferences indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_building_id ON public.notification_preferences(building_id);

-- Building messages indexes
CREATE INDEX IF NOT EXISTS idx_building_messages_building_id ON public.building_messages(building_id);
CREATE INDEX IF NOT EXISTS idx_building_messages_created_at ON public.building_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_building_messages_sender_id ON public.building_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_building_messages_reply_to ON public.building_messages(reply_to_message_id);

-- Message reactions indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- Message read receipts indexes
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message_id ON public.message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user_id ON public.message_read_receipts(user_id);

-- Message attachments indexes
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON public.message_attachments(message_id);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_participant1 ON public.conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant2 ON public.conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- Peer messages indexes
CREATE INDEX IF NOT EXISTS idx_peer_messages_conversation_id ON public.peer_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_peer_messages_sender_id ON public.peer_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_peer_messages_receiver_id ON public.peer_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_peer_messages_created_at ON public.peer_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_messages_reply_to ON public.peer_messages(reply_to_message_id);

-- Peer message reactions indexes
CREATE INDEX IF NOT EXISTS idx_peer_message_reactions_message_id ON public.peer_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_peer_message_reactions_user_id ON public.peer_message_reactions(user_id);

-- Peer message read receipts indexes
CREATE INDEX IF NOT EXISTS idx_peer_message_read_receipts_message_id ON public.peer_message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_peer_message_read_receipts_user_id ON public.peer_message_read_receipts(user_id);

-- Peer message attachments indexes
CREATE INDEX IF NOT EXISTS idx_peer_message_attachments_message_id ON public.peer_message_attachments(message_id);

-- =====================================================
-- 5. FUNCTIONS & TRIGGERS
-- =====================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Email sync function
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conversation management function
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user1_id UUID,
  user2_id UUID
) RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  p1_id UUID;
  p2_id UUID;
  caller_id UUID;
BEGIN
  -- Get the caller's user ID
  caller_id := auth.uid();

  -- Security check: caller must be authenticated and be one of the participants
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF caller_id != user1_id AND caller_id != user2_id THEN
    RAISE EXCEPTION 'Not authorized: you can only create conversations you are a participant in';
  END IF;

  -- Ensure participant1_id is always less than participant2_id
  IF user1_id < user2_id THEN
    p1_id := user1_id;
    p2_id := user2_id;
  ELSE
    p1_id := user2_id;
    p2_id := user1_id;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO conv_id
  FROM public.conversations
  WHERE participant1_id = p1_id AND participant2_id = p2_id;

  -- If not found, create new conversation
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant1_id, participant2_id)
    VALUES (p1_id, p2_id)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_or_create_conversation(UUID, UUID) IS
'Gets or creates a conversation between two users. Uses SECURITY DEFINER to bypass RLS
for the INSERT operation while maintaining security through explicit auth.uid() checks.
The caller must be authenticated and must be one of the two participants.';

-- Profile creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Extract role from metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'resident');
  
  INSERT INTO public.profiles (id, first_name, last_name, phone_number, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    NEW.email,
    user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update last message timestamp function
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET last_message_at = NEW.created_at 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notice email notification function
CREATE OR REPLACE FUNCTION public.send_notice_email()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  -- TODO: Add webhook notification when needed
  -- Currently disabled to avoid dependency on pg_net extension
  -- 
  -- payload := json_build_object(
  --   'notice_id', NEW.id,
  --   'building_id', NEW.building_id,
  --   'title', NEW.title,
  --   'content', NEW.content,
  --   'priority', NEW.priority,
  --   'created_by', NEW.created_by
  -- );
  --
  -- PERFORM net.http_post(
  --   url := 'https://your-app.com/api/send-notice-email',
  --   headers := '{"Content-Type": "application/json"}'::jsonb,
  --   body := payload::text
  -- );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY DEFINER function to check if user is approved resident of a building
-- This bypasses RLS to avoid circular dependencies in policies
CREATE OR REPLACE FUNCTION public.user_is_approved_resident_of_building(check_building_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.building_residents
    WHERE building_id = check_building_id
    AND profile_id = check_user_id
    AND is_approved = true
  );
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_buildings
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_notices
  BEFORE UPDATE ON public.notices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_notification_preferences
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Profile creation trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Email sync trigger
CREATE TRIGGER sync_email_to_profile
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

-- Conversation last message update trigger
CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT ON public.peer_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Notice email trigger
CREATE TRIGGER send_notice_email_trigger
  AFTER INSERT ON public.notices
  FOR EACH ROW
  EXECUTE FUNCTION public.send_notice_email();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_message_attachments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get building IDs for a user (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_user_building_ids(user_id UUID)
RETURNS UUID[]
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  building_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT building_id) 
  INTO building_ids
  FROM building_residents 
  WHERE profile_id = user_id AND is_approved = true;
  
  RETURN COALESCE(building_ids, ARRAY[]::UUID[]);
END;
$$;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Profiles policy using helper function to avoid RLS conflicts
CREATE POLICY "Users can view profiles in appropriate contexts"
  ON public.profiles
  FOR SELECT
  USING (
    -- Users can always see their own profile
    auth.uid() = id
    OR
    -- Building managers can see all profiles (check via auth metadata)
    (auth.jwt() ->> 'role')::text = 'building_manager'
    OR
    -- Building managers can see all profiles (fallback check via buildings table)
    EXISTS (
      SELECT 1 FROM public.buildings WHERE manager_id = auth.uid()
    )
    OR
    -- Residents can see profiles of other people in their buildings using helper function
    id = ANY(
      SELECT br.profile_id 
      FROM building_residents br 
      WHERE br.building_id = ANY(public.get_user_building_ids(auth.uid()))
      AND br.is_approved = true
    )
    OR
    -- Users can see building managers for buildings they're in
    id IN (
      SELECT b.manager_id 
      FROM buildings b 
      WHERE b.id = ANY(public.get_user_building_ids(auth.uid()))
    )
  );

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- BUILDING RESIDENTS POLICIES (DISABLED FOR DEBUGGING)
-- =====================================================

-- Temporarily disabled building_residents policies while RLS is off
-- Will re-enable after confirming messaging functionality works

-- =====================================================
-- BUILDINGS POLICIES
-- =====================================================

-- Authenticated users can view buildings (addresses aren't sensitive data)
CREATE POLICY "Authenticated users can view buildings"
  ON public.buildings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert buildings for themselves
CREATE POLICY "Users can insert buildings for themselves"
  ON public.buildings
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND manager_id = auth.uid()
  );

-- Only building managers can update their buildings
CREATE POLICY "Managers can update their buildings"
  ON public.buildings
  FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (true); -- Allow changing manager_id to transfer ownership

-- Only building managers can delete their buildings
CREATE POLICY "Managers can delete their buildings"
  ON public.buildings
  FOR DELETE
  USING (manager_id = auth.uid());

-- =====================================================
-- BUILDING RESIDENTS POLICIES
-- =====================================================

-- Users can read their own resident records, managers can read their building residents, and residents can see other residents in same building
CREATE POLICY "Users can read building resident records"
  ON public.building_residents
  FOR SELECT
  USING (
    -- Users can see their own resident record
    profile_id = auth.uid()
    OR
    -- Building managers can see all residents in their buildings
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
    OR
    -- Residents can see other residents in buildings they belong to
    building_id = ANY(public.get_user_building_ids(auth.uid()))
  );

-- Building managers can insert residents
CREATE POLICY "Building managers can insert residents"
  ON public.building_residents
  FOR INSERT
  WITH CHECK (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );

-- Building managers can delete residents
CREATE POLICY "Building managers can delete residents"
  ON public.building_residents
  FOR DELETE
  USING (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );

-- Building managers can update residents
CREATE POLICY "Building managers can update residents"
  ON public.building_residents
  FOR UPDATE
  USING (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  )
  WITH CHECK (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );

-- =====================================================
-- NOTICES POLICIES
-- =====================================================

-- Users can view notices - building-specific filtering done at application level
CREATE POLICY "Users can view notices for their buildings"
  ON public.notices
  FOR SELECT
  USING (
    -- Building managers can see all notices
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
    OR
    -- Residents can see notices for buildings they belong to
    EXISTS (
      SELECT 1 FROM public.building_residents
      WHERE building_id = notices.building_id
      AND profile_id = auth.uid()
      AND is_approved = true
    )
  );

-- Building managers can create notices
CREATE POLICY "Building managers can create notices"
  ON public.notices
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
  );

-- Building managers can update notices
CREATE POLICY "Building managers can update notices"
  ON public.notices
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
  );

-- Building managers can delete notices
CREATE POLICY "Building managers can delete notices"
  ON public.notices
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
  );

-- =====================================================
-- MESSAGING POLICIES
-- =====================================================

-- Message attachments policies
CREATE POLICY "Users can view message attachments for their buildings"
  ON public.message_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.building_messages bm
      WHERE bm.id = message_attachments.message_id
      AND (
        -- Building managers can see all messages
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
        OR
        -- Residents can see messages for buildings they belong to
        EXISTS (
          SELECT 1 FROM public.building_residents br
          WHERE br.building_id = bm.building_id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
        )
      )
    )
  );

CREATE POLICY "Users can create message attachments for their buildings"
  ON public.message_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.building_messages bm
      WHERE bm.id = message_attachments.message_id
      AND (
        -- Building managers can create attachments
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
        OR
        -- Residents can create attachments for buildings they belong to
        EXISTS (
          SELECT 1 FROM public.building_residents br
          WHERE br.building_id = bm.building_id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
        )
      )
    )
  );

CREATE POLICY "Users can delete their own message attachments"
  ON public.message_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.building_messages bm
      WHERE bm.id = message_attachments.message_id
      AND bm.sender_id = auth.uid()
    )
  );

-- Building messages policies
CREATE POLICY "Users can view messages in their buildings"
  ON public.building_messages
  FOR SELECT
  USING (
    -- Building managers can see all messages
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
    OR
    -- Approved residents can see messages for buildings they belong to
    EXISTS (
      SELECT 1 FROM public.building_residents
      WHERE building_id = building_messages.building_id
      AND profile_id = auth.uid()
      AND is_approved = true
    )
  );

CREATE POLICY "Approved users can send messages in their buildings"
  ON public.building_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND (
      -- Building managers can send messages
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
      OR
      -- Approved residents can send messages in their buildings
      EXISTS (
        SELECT 1 FROM public.building_residents
        WHERE building_id = building_messages.building_id
        AND profile_id = auth.uid()
        AND is_approved = true
      )
    )
  );

-- Peer messaging policies
CREATE POLICY "Users can view their own conversations"
  ON public.conversations
  FOR SELECT
  USING (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  );

CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (auth.uid() = participant1_id OR auth.uid() = participant2_id)
  );

CREATE POLICY "Users can view messages in their conversations"
  ON public.peer_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = peer_messages.conversation_id
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.peer_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = peer_messages.conversation_id
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.peer_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON public.peer_messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- =====================================================
-- ADDITIONAL POLICIES (Reactions, Read Receipts, etc.)
-- =====================================================

-- Message reactions
CREATE POLICY "Users can manage reactions in their buildings"
  ON public.message_reactions
  FOR ALL
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.building_messages bm
      JOIN public.buildings b ON bm.building_id = b.id
      WHERE bm.id = message_reactions.message_id
      AND (
        b.manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.building_residents br
          WHERE br.building_id = b.id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
        )
      )
    )
  );

-- Read receipts policies (similar pattern for all read receipt tables)
CREATE POLICY "Users can manage their read receipts"
  ON public.message_read_receipts
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their notice read receipts"
  ON public.notice_read_receipts
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their peer message read receipts"
  ON public.peer_message_read_receipts
  FOR ALL
  USING (user_id = auth.uid());

-- Peer message reactions
CREATE POLICY "Users can manage reactions on peer messages they have access to"
  ON public.peer_message_reactions
  FOR ALL
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.peer_messages pm
      JOIN public.conversations c ON pm.conversation_id = c.id
      WHERE pm.id = peer_message_reactions.message_id
      AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

-- Peer message attachments
CREATE POLICY "Users can manage attachments in their conversations"
  ON public.peer_message_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      JOIN public.conversations c ON pm.conversation_id = c.id
      WHERE pm.id = peer_message_attachments.message_id
      AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

-- Notification preferences
CREATE POLICY "Users can manage their notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- =====================================================
-- 8. STORAGE BUCKETS
-- =====================================================

-- Create storage buckets for file attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('notice-attachments', 'notice-attachments', false, 52428800, '{"image/*", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}'),
  ('message-attachments', 'message-attachments', false, 52428800, '{"image/*", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}')
ON CONFLICT (id) DO NOTHING;

-- Storage policies for notice attachments
CREATE POLICY "Users can view notice attachments"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'notice-attachments');

CREATE POLICY "Building managers can upload notice attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'notice-attachments' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
  );

CREATE POLICY "Building managers can delete notice attachments"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'notice-attachments' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
  );

-- Storage policies for message attachments
CREATE POLICY "Users can view message attachments in their conversations"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'message-attachments' AND
    (
      -- Users can view their own uploaded attachments
      (auth.uid()::text = split_part(name, '/', 1))
      OR
      -- Users can view attachments in peer conversations they participate in
      EXISTS (
        SELECT 1 FROM public.peer_message_attachments pma
        JOIN public.peer_messages pm ON pm.id = pma.message_id
        JOIN public.conversations c ON c.id = pm.conversation_id
        WHERE pma.file_path = name
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
      )
      OR
      -- Users can view attachments in building messages they have access to
      EXISTS (
        SELECT 1 FROM public.message_attachments ma
        JOIN public.building_messages bm ON bm.id = ma.message_id
        WHERE ma.file_path = name
        AND (
          -- Building managers can see all messages
          (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'building_manager'
          OR
          -- Residents can see messages for buildings they belong to
          EXISTS (
            SELECT 1 FROM public.building_residents br
            WHERE br.building_id = bm.building_id
            AND br.profile_id = auth.uid()
            AND br.is_approved = true
          )
        )
      )
    )
  );

CREATE POLICY "Users can upload their own message attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments' AND
    (auth.uid()::text = split_part(name, '/', 1))
  );

CREATE POLICY "Users can delete their own message attachments"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'message-attachments' AND
    (auth.uid()::text = split_part(name, '/', 1))
  );

-- =====================================================
-- 9. REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.building_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_message_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buildings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.building_residents;

-- =====================================================
-- BASELINE MIGRATION COMPLETE
-- =====================================================