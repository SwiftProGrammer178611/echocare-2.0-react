/*
  # Fix Sign-up Database Errors

  1. New Tables
    - `user_profiles` - User profile information (CRITICAL for sign-up)
    - `achievements` - Achievement definitions
    - `user_achievements` - User achievement progress
    - `conversation_history` - Chat session history
    - `health_integrations` - Health data from various sources
    - `calendar_events` - Calendar integration data

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
    - Achievements are read-only for all authenticated users

  3. Functions & Triggers
    - Safe trigger creation for automatic user profile setup
    - Achievement progress tracking functions
    - Health data simulation functions

  4. Fixes
    - Removes conflicting triggers and functions safely
    - Creates all missing tables needed for sign-up process
    - Ensures user_profiles table exists to prevent sign-up failures
*/

-- Step 1: Safely remove existing conflicting objects
DO $$
BEGIN
  -- Drop triggers first (they depend on functions)
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'create_user_profile_trigger') THEN
    DROP TRIGGER create_user_profile_trigger ON auth.users;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
  
  -- Drop functions if they exist
  DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS update_achievement_progress(uuid, text, integer) CASCADE;
  DROP FUNCTION IF EXISTS get_latest_health_metrics(uuid) CASCADE;
  DROP FUNCTION IF EXISTS simulate_health_data(uuid) CASCADE;
  
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "Users can view achievements" ON achievements;
  DROP POLICY IF EXISTS "achievements_read_policy" ON achievements;
  DROP POLICY IF EXISTS "Users can manage own achievements" ON user_achievements;
  DROP POLICY IF EXISTS "user_achievements_policy" ON user_achievements;
  DROP POLICY IF EXISTS "Users can manage own conversation history" ON conversation_history;
  DROP POLICY IF EXISTS "conversation_history_policy" ON conversation_history;
  DROP POLICY IF EXISTS "Users can manage own health data" ON health_integrations;
  DROP POLICY IF EXISTS "health_integrations_policy" ON health_integrations;
  DROP POLICY IF EXISTS "Users can manage own calendar events" ON calendar_events;
  DROP POLICY IF EXISTS "calendar_events_policy" ON calendar_events;
END $$;

-- Step 2: Create user_profiles table (CRITICAL for sign-up process)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  preferred_voice_id text DEFAULT 'pNInz6obpgDQGcFmaJgB',
  health_app_connected boolean DEFAULT false,
  smartwatch_connected boolean DEFAULT false,
  calendar_connected boolean DEFAULT false,
  notification_preferences jsonb DEFAULT '{"health_alerts": true, "family_updates": false, "voice_reminders": true}',
  privacy_settings jsonb DEFAULT '{"share_health_data": false, "allow_family_access": false}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Create achievements system tables
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- 'conversation', 'health', 'social', 'milestone'
  icon text NOT NULL,
  points integer DEFAULT 0,
  requirement_type text NOT NULL, -- 'count', 'streak', 'threshold', 'time_based'
  requirement_value integer NOT NULL,
  requirement_unit text, -- 'conversations', 'days', 'minutes', etc.
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

-- Step 4: Create conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  session_type text NOT NULL, -- 'voice', 'video', 'text'
  title text,
  messages jsonb NOT NULL DEFAULT '[]',
  emotion_summary jsonb,
  health_insights jsonb,
  duration_seconds integer,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Step 5: Create health integrations table
CREATE TABLE IF NOT EXISTS health_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'apple_health', 'google_fit', 'fitbit', 'manual'
  data_type text NOT NULL, -- 'heart_rate', 'steps', 'sleep', etc.
  value numeric NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Step 6: Create calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text,
  title text NOT NULL,
  description text,
  event_type text DEFAULT 'general', -- 'medication', 'appointment', 'social', 'general'
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  reminder_minutes integer DEFAULT 15,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  source text DEFAULT 'manual', -- 'google', 'outlook', 'apple', 'manual'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 7: Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies
CREATE POLICY "user_profiles_policy" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "achievements_read_policy" ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_achievements_policy" ON user_achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversation_history_policy" ON conversation_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_integrations_policy" ON health_integrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_events_policy" ON calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_session_type ON conversation_history(session_type);
CREATE INDEX IF NOT EXISTS idx_conversation_history_started_at ON conversation_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_integrations_user_id ON health_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_health_integrations_data_type ON health_integrations(data_type);
CREATE INDEX IF NOT EXISTS idx_health_integrations_recorded_at ON health_integrations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);

-- Step 10: Create indexes for existing tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'memory_tokens') THEN
    CREATE INDEX IF NOT EXISTS idx_memory_tokens_user_id ON memory_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_memory_tokens_created_at ON memory_tokens(created_at DESC);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'emotion_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id ON emotion_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_created_at ON emotion_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_emotion ON emotion_logs(emotion);
  END IF;
END $$;

-- Step 11: Insert default achievements (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM achievements LIMIT 1) THEN
    INSERT INTO achievements (name, description, category, icon, points, requirement_type, requirement_value, requirement_unit) VALUES
    ('First Conversation', 'Complete your first conversation with EchoCare AI', 'conversation', 'MessageSquare', 10, 'count', 1, 'conversations'),
    ('Chatty Friend', 'Have 10 conversations with EchoCare AI', 'conversation', 'MessageSquare', 50, 'count', 10, 'conversations'),
    ('Daily Companion', 'Talk with EchoCare AI for 7 consecutive days', 'conversation', 'Calendar', 100, 'streak', 7, 'days'),
    ('Health Tracker', 'Log your first health metric', 'health', 'Heart', 20, 'count', 1, 'health_entries'),
    ('Wellness Warrior', 'Log health data for 30 days', 'health', 'Activity', 200, 'count', 30, 'health_days'),
    ('Social Butterfly', 'Connect with family through EchoCare', 'social', 'Users', 30, 'count', 1, 'family_connections'),
    ('Memory Keeper', 'Create your first memory token', 'milestone', 'Star', 25, 'count', 1, 'memory_tokens'),
    ('Setup Master', 'Complete your profile setup', 'milestone', 'CheckCircle', 15, 'count', 1, 'profile_complete'),
    ('Health Integration', 'Connect a health app or device', 'milestone', 'Smartphone', 40, 'count', 1, 'health_integrations'),
    ('Calendar Sync', 'Connect your calendar', 'milestone', 'Calendar', 35, 'count', 1, 'calendar_connections'),
    ('Emergency Ready', 'Set up emergency contact', 'milestone', 'Phone', 20, 'count', 1, 'emergency_contacts'),
    ('Video Pioneer', 'Complete your first video call', 'conversation', 'Video', 30, 'count', 1, 'video_calls'),
    ('Voice Master', 'Complete 5 voice conversations', 'conversation', 'Mic', 75, 'count', 5, 'voice_calls'),
    ('Long Talker', 'Have a conversation longer than 10 minutes', 'conversation', 'Clock', 60, 'threshold', 600, 'seconds'),
    ('Health Conscious', 'Maintain healthy metrics for a week', 'health', 'TrendingUp', 150, 'streak', 7, 'healthy_days');
  END IF;
END $$;

-- Step 12: Create safe user profile creation function
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile with error handling
  BEGIN
    INSERT INTO user_profiles (user_id, full_name)
    VALUES (
      NEW.id, 
      COALESCE(
        NEW.raw_user_meta_data->>'name', 
        NEW.raw_user_meta_data->>'full_name', 
        split_part(NEW.email, '@', 1)
      )
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Could not create user profile for %: %', NEW.id, SQLERRM;
  END;
  
  -- Initialize user achievements with error handling
  BEGIN
    INSERT INTO user_achievements (user_id, achievement_id, progress, completed)
    SELECT NEW.id, id, 0, false
    FROM achievements
    WHERE is_active = true
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Could not initialize achievements for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Create trigger for automatic profile creation
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Step 14: Create utility functions
CREATE OR REPLACE FUNCTION update_achievement_progress(
  p_user_id uuid,
  p_achievement_category text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  achievement_record RECORD;
BEGIN
  -- Update progress for achievements in the specified category
  FOR achievement_record IN 
    SELECT a.id, a.requirement_value, ua.progress, ua.completed
    FROM achievements a
    JOIN user_achievements ua ON a.id = ua.achievement_id
    WHERE a.category = p_achievement_category 
    AND ua.user_id = p_user_id 
    AND ua.completed = false
    AND a.is_active = true
  LOOP
    -- Update progress
    UPDATE user_achievements 
    SET 
      progress = LEAST(achievement_record.progress + p_increment, achievement_record.requirement_value),
      updated_at = now(),
      completed = CASE 
        WHEN (achievement_record.progress + p_increment) >= achievement_record.requirement_value 
        THEN true 
        ELSE false 
      END,
      completed_at = CASE 
        WHEN (achievement_record.progress + p_increment) >= achievement_record.requirement_value 
        THEN now() 
        ELSE completed_at 
      END
    WHERE user_id = p_user_id 
    AND achievement_id = achievement_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_latest_health_metrics(p_user_id uuid)
RETURNS TABLE(
  data_type text,
  value numeric,
  unit text,
  recorded_at timestamptz,
  source text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (hi.data_type) 
    hi.data_type,
    hi.value,
    hi.unit,
    hi.recorded_at,
    hi.source
  FROM health_integrations hi
  WHERE hi.user_id = p_user_id
  ORDER BY hi.data_type, hi.recorded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION simulate_health_data(p_user_id uuid)
RETURNS void AS $$
DECLARE
  i integer;
  base_date timestamptz;
BEGIN
  base_date := now() - interval '7 days';
  
  -- Generate sample health data for the last 7 days
  FOR i IN 0..6 LOOP
    INSERT INTO health_integrations (user_id, source, data_type, value, unit, recorded_at) VALUES
    (p_user_id, 'apple_health', 'heart_rate', 65 + (random() * 20)::integer, 'bpm', base_date + (i || ' days')::interval + interval '8 hours'),
    (p_user_id, 'apple_health', 'steps', 3000 + (random() * 5000)::integer, 'count', base_date + (i || ' days')::interval + interval '23 hours'),
    (p_user_id, 'apple_health', 'sleep', 6.5 + (random() * 2), 'hours', base_date + (i || ' days')::interval + interval '7 hours'),
    (p_user_id, 'fitbit', 'blood_pressure_systolic', 110 + (random() * 20)::integer, 'mmHg', base_date + (i || ' days')::interval + interval '9 hours'),
    (p_user_id, 'fitbit', 'blood_pressure_diastolic', 70 + (random() * 15)::integer, 'mmHg', base_date + (i || ' days')::interval + interval '9 hours')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;