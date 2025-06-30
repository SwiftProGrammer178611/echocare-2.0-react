/*
  # Create emotion_logs table for voice chat emotion tracking

  1. New Tables
    - `emotion_logs` - Store emotion detection data from voice conversations
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `emotion` (text, detected emotion)
      - `confidence` (numeric, confidence score)
      - `source` (text, source of detection - voice/text)
      - `context` (jsonb, additional context data)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on emotion_logs table
    - Add policy for authenticated users to manage their own emotion data

  3. Indexes
    - Add performance indexes for user queries and date sorting
*/

-- Create emotion_logs table
CREATE TABLE IF NOT EXISTS emotion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emotion text NOT NULL,
  confidence numeric DEFAULT 0,
  source text DEFAULT 'unknown',
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own emotion logs
CREATE POLICY "Users can manage own emotion logs" ON emotion_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id ON emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_created_at ON emotion_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_emotion ON emotion_logs(emotion);