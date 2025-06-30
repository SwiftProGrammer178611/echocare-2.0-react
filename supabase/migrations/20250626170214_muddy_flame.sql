/*
  # Fix RLS Policies for Users Table

  1. Security Updates
    - Drop existing problematic policies
    - Create correct RLS policies that allow users to manage their own data
    - Ensure policies use proper auth.uid() syntax
    - Fix INSERT policy to allow profile creation during signup

  2. Policy Details
    - INSERT: Allow authenticated users to create their own profile (auth.uid() = id)
    - SELECT: Allow authenticated users to read their own data (auth.uid() = id)
    - UPDATE: Allow authenticated users to update their own data (auth.uid() = id)
    - DELETE: Allow authenticated users to delete their own data (auth.uid() = id)
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can delete own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "enable_insert_for_authenticated_users" ON users;
DROP POLICY IF EXISTS "enable_select_for_users_based_on_user_id" ON users;
DROP POLICY IF EXISTS "enable_update_for_users_based_on_user_id" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new policies with correct syntax
CREATE POLICY "users_insert_own_profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_select_own_data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete_own_data" ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);