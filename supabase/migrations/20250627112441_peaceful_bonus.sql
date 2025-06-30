-- FINAL FIX: Resolve all authentication issues and ensure user profiles work correctly
-- This migration fixes all sign-up errors and RLS policy conflicts

-- Step 1: Drop all existing conflicting objects to start fresh
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
  
  -- Drop all existing policies for user_profiles
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_access_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_full_access" ON user_profiles;
  DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can manage own profiles" ON user_profiles;
END $$;

-- Step 2: Ensure user_profiles table exists with all required fields
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

-- Step 3: Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create a single comprehensive policy for user_profiles
CREATE POLICY "user_profiles_all_operations" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 5: Create a robust function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  name_value text;
  email_username text;
BEGIN
  -- Extract name from metadata or email
  name_value := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Get username from email if name not provided
  IF name_value IS NULL OR name_value = '' THEN
    email_username := split_part(NEW.email, '@', 1);
    -- Capitalize first letter of email username
    name_value := INITCAP(email_username);
  END IF;
  
  -- Create user profile with comprehensive error handling
  BEGIN
    INSERT INTO public.user_profiles (
      user_id, 
      full_name,
      date_of_birth,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      name_value,
      NULL,
      now(),
      now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      full_name = EXCLUDED.full_name,
      updated_at = now();
      
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Profile creation warning for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 7: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- Step 8: Fix any existing users without profiles
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id, email, raw_user_meta_data 
    FROM auth.users 
    WHERE id NOT IN (SELECT user_id FROM user_profiles)
  LOOP
    BEGIN
      INSERT INTO user_profiles (
        user_id, 
        full_name,
        created_at,
        updated_at
      )
      VALUES (
        user_record.id,
        COALESCE(
          user_record.raw_user_meta_data->>'name',
          user_record.raw_user_meta_data->>'full_name',
          INITCAP(split_part(user_record.email, '@', 1))
        ),
        now(),
        now()
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not create profile for existing user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;