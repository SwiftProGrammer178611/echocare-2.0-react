/*
  # Fix RLS Policies for Users Table - Final Version
  
  This migration fixes the RLS policy issues by:
  1. Dropping all existing policies (including the ones that already exist)
  2. Creating new policies with unique names
  3. Ensuring proper auth.uid() syntax
  
  This should resolve the authentication errors you're experiencing.
*/

-- Drop ALL existing policies with various names that might exist
DROP POLICY IF EXISTS "Users can delete own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "users_insert_own_profile" ON users;
DROP POLICY IF EXISTS "users_select_own_data" ON users;
DROP POLICY IF EXISTS "users_update_own_data" ON users;
DROP POLICY IF EXISTS "users_delete_own_data" ON users;
DROP POLICY IF EXISTS "enable_insert_for_authenticated_users" ON users;
DROP POLICY IF EXISTS "enable_select_for_users_based_on_user_id" ON users;
DROP POLICY IF EXISTS "enable_update_for_users_based_on_user_id" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new policies with unique names and correct syntax
CREATE POLICY "allow_user_insert_own_profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_user_select_own_data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "allow_user_update_own_data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_user_delete_own_data" ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Verify the policies were created successfully
DO $$
BEGIN
  -- Check if all policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'allow_user_insert_own_profile'
  ) THEN
    RAISE EXCEPTION 'INSERT policy was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'allow_user_select_own_data'
  ) THEN
    RAISE EXCEPTION 'SELECT policy was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'allow_user_update_own_data'
  ) THEN
    RAISE EXCEPTION 'UPDATE policy was not created';
  END IF;
  
  RAISE NOTICE 'SUCCESS: All RLS policies created successfully!';
  RAISE NOTICE 'You can now test authentication - signup and signin should work.';
END $$;