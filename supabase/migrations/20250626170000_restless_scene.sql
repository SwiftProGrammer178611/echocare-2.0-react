/*
  # Fix RLS Policies for Users Table

  1. Security Updates
    - Drop existing problematic RLS policies
    - Create correct RLS policies that allow users to manage their own data
    - Ensure policies use proper auth.uid() function calls
    - Fix policy syntax and permissions

  2. Policy Changes
    - INSERT: Allow authenticated users to insert their own profile using auth.uid()
    - SELECT: Allow authenticated users to read their own data
    - UPDATE: Allow authenticated users to update their own data
    - DELETE: Allow authenticated users to delete their own data (optional)

  3. Important Notes
    - Uses auth.uid() instead of uid() for better compatibility
    - Ensures WITH CHECK clauses are properly configured
    - Maintains data security while allowing proper user operations
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can manage own data" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can delete own data" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy - allows users to create their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create SELECT policy - allows users to read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create UPDATE policy - allows users to update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create DELETE policy - allows users to delete their own data (optional but good practice)
CREATE POLICY "Users can delete own data" ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Verify the policies are created correctly
DO $$
BEGIN
  -- Check if policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    RAISE EXCEPTION 'INSERT policy was not created correctly';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can read own data'
  ) THEN
    RAISE EXCEPTION 'SELECT policy was not created correctly';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can update own data'
  ) THEN
    RAISE EXCEPTION 'UPDATE policy was not created correctly';
  END IF;
  
  RAISE NOTICE 'All RLS policies created successfully!';
END $$;