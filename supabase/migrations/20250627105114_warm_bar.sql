-- CRITICAL FIX: Create all required tables for sign-up process
-- This migration ensures sign-up works without any database errors

-- Step 1: Safely remove any existing conflicting objects
DO $$
BEGIN
  -- Drop triggers first (they depend on functions)
  DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users CASCADE;
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
  
  -- Drop functions if they exist
  DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS update_achievement_progress(uuid, text, integer) CASCADE;
  DROP FUNCTION IF EXISTS get_latest_health_metrics(uuid) CASCADE;
  DROP FUNCTION IF EXISTS simulate_health_data(uuid) CASCADE;
  
  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "conversation_history_policy" ON conversation_history;
  DROP POLICY IF EXISTS "achievements_read_policy" ON achievements;
  DROP POLICY IF EXISTS "user_achievements_policy" ON user_achievements;
  
  -- Also drop any other potential policy names
  DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can manage own conversation history" ON conversation_history;
  DROP POLICY IF EXISTS "Users can view achievements" ON achievements;
  DROP POLICY IF EXISTS "Users can manage own achievements" ON user_achievements;
END $$;

-- Step 2: Create user_profiles table (CRITICAL for sign-up)
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

-- Step 3: Create conversation_history table (for chat history)
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

-- Step 4: Create achievements system (simplified)
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

-- Step 5: Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies (with unique names to avoid conflicts)
CREATE POLICY "user_profiles_access_policy" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversation_history_access_policy" ON conversation_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "achievements_read_access_policy" ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_achievements_access_policy" ON user_achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_started_at ON conversation_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- Step 8: Insert basic achievements (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM achievements LIMIT 1) THEN
    INSERT INTO achievements (name, description, category, icon, points, requirement_type, requirement_value, requirement_unit) VALUES
    ('First Conversation', 'Complete your first conversation with EchoCare AI', 'conversation', 'MessageSquare', 10, 'count', 1, 'conversations'),
    ('Voice Chat Master', 'Complete 5 voice conversations', 'conversation', 'Mic', 50, 'count', 5, 'conversations'),
    ('Video Call Pioneer', 'Complete your first video call', 'conversation', 'Video', 30, 'count', 1, 'video_calls'),
    ('Setup Complete', 'Complete your profile setup', 'milestone', 'CheckCircle', 15, 'count', 1, 'setup'),
    ('Emergency Ready', 'Set up emergency contact', 'milestone', 'Phone', 20, 'count', 1, 'emergency_contact');
  END IF;
END $$;

-- Step 9: Create SAFE user profile creation function
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile with comprehensive error handling
  BEGIN
    INSERT INTO user_profiles (user_id, full_name)
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
    
    -- Initialize basic achievements
    INSERT INTO user_achievements (user_id, achievement_id, progress, completed)
    SELECT NEW.id, id, 0, false
    FROM achievements
    WHERE is_active = true
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but NEVER fail the user creation
    RAISE WARNING 'Profile creation warning for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create trigger for automatic profile creation
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Step 11: Create utility function for achievements
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

-- Step 12: Ensure existing tables have proper indexes (for tables that might already exist)
DO $$
BEGIN
  -- Add indexes for existing tables if they exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'memory_tokens') THEN
    CREATE INDEX IF NOT EXISTS idx_memory_tokens_user_id ON memory_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_memory_tokens_created_at ON memory_tokens(created_at DESC);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'emotion_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id ON emotion_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_created_at ON emotion_logs(created_at DESC);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'voice_sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'video_conversations') THEN
    CREATE INDEX IF NOT EXISTS idx_video_conversations_user_id ON video_conversations(user_id);
  END IF;
END $$;