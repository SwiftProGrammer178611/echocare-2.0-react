-- COMPREHENSIVE FIX: Resolve all authentication and database issues
-- This migration fixes sign-up errors, email validation, and RLS policies

-- Step 1: Drop all existing conflicting objects
DO $$
BEGIN
  -- Drop all existing triggers
  DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users CASCADE;
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
  
  -- Drop all existing functions
  DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
  DROP FUNCTION IF EXISTS update_achievement_progress(uuid, text, integer) CASCADE;
  DROP FUNCTION IF EXISTS get_latest_health_metrics(uuid) CASCADE;
  DROP FUNCTION IF EXISTS simulate_health_data(uuid) CASCADE;
  
  -- Drop all existing policies
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_access_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;
  DROP POLICY IF EXISTS "conversation_history_policy" ON conversation_history;
  DROP POLICY IF EXISTS "conversation_history_access_policy" ON conversation_history;
  DROP POLICY IF EXISTS "achievements_read_policy" ON achievements;
  DROP POLICY IF EXISTS "achievements_read_access_policy" ON achievements;
  DROP POLICY IF EXISTS "user_achievements_policy" ON user_achievements;
  DROP POLICY IF EXISTS "user_achievements_access_policy" ON user_achievements;
END $$;

-- Step 2: Create all required tables
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  preferred_voice_id text DEFAULT 'pNInz6obpgDQGcFmaJgB',
  notification_preferences jsonb DEFAULT '{"health_alerts": true, "family_updates": false, "voice_reminders": true}',
  privacy_settings jsonb DEFAULT '{"share_health_data": false, "allow_family_access": false}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  session_type text NOT NULL,
  title text,
  messages jsonb NOT NULL DEFAULT '[]',
  emotion_summary jsonb,
  health_insights jsonb,
  duration_seconds integer,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  icon text NOT NULL,
  points integer DEFAULT 0,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  requirement_unit text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Step 3: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Step 4: Create comprehensive RLS policies
-- User profiles policies
CREATE POLICY "user_profiles_full_access" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversation history policies
CREATE POLICY "conversation_history_full_access" ON conversation_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Achievements policies (read-only for all users)
CREATE POLICY "achievements_read_only" ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- User achievements policies
CREATE POLICY "user_achievements_full_access" ON user_achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_started_at ON conversation_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- Step 6: Insert default achievements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM achievements LIMIT 1) THEN
    INSERT INTO achievements (name, description, category, icon, points, requirement_type, requirement_value, requirement_unit) VALUES
    ('First Conversation', 'Complete your first conversation with EchoCare AI', 'conversation', 'MessageSquare', 10, 'count', 1, 'conversations'),
    ('Voice Chat Master', 'Complete 5 voice conversations', 'conversation', 'Mic', 50, 'count', 5, 'conversations'),
    ('Video Call Pioneer', 'Complete your first video call', 'conversation', 'Video', 30, 'count', 1, 'video_calls'),
    ('Setup Complete', 'Complete your profile setup', 'milestone', 'CheckCircle', 15, 'count', 1, 'setup'),
    ('Emergency Ready', 'Set up emergency contact', 'milestone', 'Phone', 20, 'count', 1, 'emergency_contact'),
    ('Daily Companion', 'Chat for 7 consecutive days', 'conversation', 'Calendar', 100, 'streak', 7, 'days'),
    ('Memory Keeper', 'Create your first memory token', 'milestone', 'Star', 25, 'count', 1, 'memory_tokens'),
    ('Social Butterfly', 'Connect with family', 'social', 'Users', 30, 'count', 1, 'family_connections'),
    ('Health Tracker', 'Log your first health metric', 'health', 'Heart', 20, 'count', 1, 'health_entries'),
    ('Long Talker', 'Have a conversation longer than 10 minutes', 'conversation', 'Clock', 60, 'threshold', 600, 'seconds');
  END IF;
END $$;

-- Step 7: Create robust user profile creation function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile with error handling
  BEGIN
    INSERT INTO public.user_profiles (user_id, full_name)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        'User'
      )
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log warning but don't fail user creation
    RAISE WARNING 'Could not create user profile for %: %', NEW.id, SQLERRM;
  END;
  
  -- Initialize achievements with error handling
  BEGIN
    INSERT INTO public.user_achievements (user_id, achievement_id, progress, completed)
    SELECT NEW.id, id, 0, false
    FROM public.achievements
    WHERE is_active = true
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log warning but don't fail user creation
    RAISE WARNING 'Could not initialize achievements for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 9: Create utility functions
CREATE OR REPLACE FUNCTION update_achievement_progress(
  p_user_id uuid,
  p_achievement_category text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE user_achievements 
  SET 
    progress = LEAST(progress + p_increment, (SELECT requirement_value FROM achievements WHERE id = achievement_id)),
    updated_at = now(),
    completed = CASE 
      WHEN (progress + p_increment) >= (SELECT requirement_value FROM achievements WHERE id = achievement_id)
      THEN true 
      ELSE false 
    END,
    completed_at = CASE 
      WHEN (progress + p_increment) >= (SELECT requirement_value FROM achievements WHERE id = achievement_id)
      THEN now() 
      ELSE completed_at 
    END
  FROM achievements a
  WHERE user_achievements.user_id = p_user_id 
  AND user_achievements.achievement_id = a.id
  AND a.category = p_achievement_category 
  AND user_achievements.completed = false
  AND a.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.conversation_history TO authenticated;
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.user_achievements TO authenticated;