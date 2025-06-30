/*
  # Fix User Profiles RLS Policy

  1. Problem
    - Users cannot create their own profiles during signup
    - RLS policy is blocking INSERT operations even for authenticated users
    - Policy check is failing because auth.uid() might not match user_id during creation

  2. Solution
    - Drop existing problematic policies
    - Create new policies that properly handle profile creation
    - Ensure INSERT policy allows users to create profiles with their own user_id
    - Separate policies for different operations (SELECT, INSERT, UPDATE, DELETE)

  3. Security
    - Users can only create profiles for themselves
    - Users can only read/update their own profiles
    - Maintains data isolation between users
*/

-- Drop all existing policies for user_profiles table
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_access_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON user_profiles;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create separate policies for each operation to avoid conflicts

-- Allow users to INSERT their own profile
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to SELECT their own profile
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to UPDATE their own profile
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own profile
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a function to automatically create user profile after auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;