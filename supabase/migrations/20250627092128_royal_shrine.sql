/*
  # Comprehensive EchoCare Improvements

  1. New Tables
    - `user_profiles` - Extended user profiles with emergency contacts and settings
    - `achievements` - Achievement definitions and progress tracking
    - `conversation_history` - Chat history for both voice and video
    - `health_integrations` - Health data from smartwatches and health apps
    - `calendar_events` - Calendar integration for reminders

  2. Enhanced Tables
    - Update existing tables with better structure
    - Add proper relationships and constraints

  3. Security
    - Enable RLS on all new tables
    - Add comprehensive policies for data access

  4. Functions
    - Auto-create user profile on signup
    - Achievement progress tracking
    - Health data aggregation
*/

-- Create user_profiles table for extended user information
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
  notification_preferences jsonb DEFAULT '{"voice_reminders": true, "health_alerts": true, "family_updates": false}',
  privacy_settings jsonb DEFAULT '{"share_health_data": false, "allow_family_access": false}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- 'conversation', 'health', 'social', 'milestone'
  icon text NOT NULL,
  points integer DEFAULT 0,
  requirement_type text NOT NULL, -- 'count', 'streak', 'threshold', 'time_based'
  requirement_value integer NOT NULL,
  requirement_unit text, -- 'conversations', 'days', 'minutes', 'steps', etc.
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create user_achievements table for tracking progress
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

-- Create conversation_history table for chat history
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

-- Create health_integrations table for smartwatch/health app data
CREATE TABLE IF NOT EXISTS health_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'apple_health', 'google_fit', 'fitbit', 'manual'
  data_type text NOT NULL, -- 'heart_rate', 'steps', 'sleep', 'blood_pressure', etc.
  value numeric NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create calendar_events table for calendar integration
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text, -- ID from external calendar service
  title text NOT NULL,
  description text,
  event_type text DEFAULT 'general', -- 'medication', 'appointment', 'social', 'general'
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  reminder_minutes integer DEFAULT 15,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text, -- 'daily', 'weekly', 'monthly'
  source text DEFAULT 'manual', -- 'google', 'outlook', 'apple', 'manual'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Achievements policies (read-only for users)
CREATE POLICY "Users can view achievements" ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- User achievements policies
CREATE POLICY "Users can manage own achievements" ON user_achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversation history policies
CREATE POLICY "Users can manage own conversation history" ON conversation_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Health integrations policies
CREATE POLICY "Users can manage own health data" ON health_integrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar events policies
CREATE POLICY "Users can manage own calendar events" ON calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
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

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Function to update achievement progress
CREATE OR REPLACE FUNCTION update_achievement_progress(
  p_user_id uuid,
  p_achievement_category text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  achievement_record RECORD;
  current_progress integer;
BEGIN
  -- Get all active achievements in the category
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE category = p_achievement_category AND is_active = true
  LOOP
    -- Get or create user achievement record
    INSERT INTO user_achievements (user_id, achievement_id, progress)
    VALUES (p_user_id, achievement_record.id, 0)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
    
    -- Update progress if not already completed
    UPDATE user_achievements 
    SET 
      progress = progress + p_increment,
      updated_at = now()
    WHERE 
      user_id = p_user_id 
      AND achievement_id = achievement_record.id 
      AND completed = false
    RETURNING progress INTO current_progress;
    
    -- Check if achievement is completed
    IF current_progress >= achievement_record.requirement_value THEN
      UPDATE user_achievements 
      SET 
        completed = true,
        completed_at = now(),
        updated_at = now()
      WHERE 
        user_id = p_user_id 
        AND achievement_id = achievement_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default achievements
INSERT INTO achievements (name, description, category, icon, points, requirement_type, requirement_value, requirement_unit) VALUES
-- Conversation achievements
('First Chat', 'Complete your first conversation with EchoCare AI', 'conversation', '💬', 10, 'count', 1, 'conversations'),
('Chatty Friend', 'Have 10 conversations with EchoCare AI', 'conversation', '🗣️', 50, 'count', 10, 'conversations'),
('Daily Companion', 'Chat for 7 days in a row', 'conversation', '📅', 100, 'streak', 7, 'days'),
('Marathon Talker', 'Spend 60 minutes in conversation', 'conversation', '⏰', 75, 'time_based', 60, 'minutes'),
('Video Pioneer', 'Complete your first video call', 'conversation', '📹', 25, 'count', 1, 'video_calls'),

-- Health achievements
('Health Tracker', 'Log your first health metric', 'health', '❤️', 15, 'count', 1, 'health_logs'),
('Wellness Warrior', 'Log health data for 30 days', 'health', '🏃', 150, 'streak', 30, 'days'),
('Step Master', 'Walk 10,000 steps in a day', 'health', '👟', 50, 'threshold', 10000, 'steps'),
('Heart Healthy', 'Maintain normal heart rate for a week', 'health', '💓', 75, 'streak', 7, 'days'),

-- Social achievements
('Memory Keeper', 'Create your first memory token', 'social', '🏆', 20, 'count', 1, 'memory_tokens'),
('Storyteller', 'Create 5 memory tokens', 'social', '📚', 100, 'count', 5, 'memory_tokens'),
('Family Connected', 'Set up emergency contact', 'social', '👨‍👩‍👧‍👦', 25, 'count', 1, 'emergency_contacts'),

-- Milestone achievements
('Welcome Home', 'Complete your EchoCare setup', 'milestone', '🏠', 30, 'count', 1, 'setup_complete'),
('Tech Savvy', 'Connect a health app or smartwatch', 'milestone', '📱', 50, 'count', 1, 'integrations'),
('Calendar Master', 'Connect your calendar', 'milestone', '📆', 40, 'count', 1, 'calendar_connected')
ON CONFLICT DO NOTHING;

-- Function to get real-time health data (placeholder for actual integrations)
CREATE OR REPLACE FUNCTION get_latest_health_metrics(p_user_id uuid)
RETURNS TABLE(
  heart_rate numeric,
  steps integer,
  sleep_hours numeric,
  blood_pressure_systolic integer,
  blood_pressure_diastolic integer,
  last_updated timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT hi1.value FROM health_integrations hi1 WHERE hi1.user_id = p_user_id AND hi1.data_type = 'heart_rate' ORDER BY hi1.recorded_at DESC LIMIT 1),
    (SELECT hi2.value::integer FROM health_integrations hi2 WHERE hi2.user_id = p_user_id AND hi2.data_type = 'steps' ORDER BY hi2.recorded_at DESC LIMIT 1),
    (SELECT hi3.value FROM health_integrations hi3 WHERE hi3.user_id = p_user_id AND hi3.data_type = 'sleep' ORDER BY hi3.recorded_at DESC LIMIT 1),
    (SELECT hi4.value::integer FROM health_integrations hi4 WHERE hi4.user_id = p_user_id AND hi4.data_type = 'blood_pressure_systolic' ORDER BY hi4.recorded_at DESC LIMIT 1),
    (SELECT hi5.value::integer FROM health_integrations hi5 WHERE hi5.user_id = p_user_id AND hi5.data_type = 'blood_pressure_diastolic' ORDER BY hi5.recorded_at DESC LIMIT 1),
    (SELECT MAX(hi6.recorded_at) FROM health_integrations hi6 WHERE hi6.user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to simulate health data (for demo purposes)
CREATE OR REPLACE FUNCTION simulate_health_data(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert simulated health data for the last 7 days
  INSERT INTO health_integrations (user_id, source, data_type, value, unit, recorded_at) VALUES
  (p_user_id, 'apple_health', 'heart_rate', 72 + (random() * 20 - 10), 'bpm', now() - interval '1 hour'),
  (p_user_id, 'apple_health', 'steps', 5000 + (random() * 5000)::integer, 'count', now() - interval '1 hour'),
  (p_user_id, 'apple_health', 'sleep', 7 + (random() * 2), 'hours', now() - interval '8 hours'),
  (p_user_id, 'apple_health', 'blood_pressure_systolic', 120 + (random() * 20 - 10)::integer, 'mmHg', now() - interval '2 hours'),
  (p_user_id, 'apple_health', 'blood_pressure_diastolic', 80 + (random() * 10 - 5)::integer, 'mmHg', now() - interval '2 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;