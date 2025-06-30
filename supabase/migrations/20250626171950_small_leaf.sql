/*
  # Create Missing Database Tables

  1. New Tables
    - `memory_tokens` - Store user memory tokens and milestones
    - `health_metrics` - Store user health data and metrics  
    - `video_conversations` - Store Tavus video conversation records
    - `voice_sessions` - Store voice chat session data

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Add performance indexes for common queries
*/

-- Create memory_tokens table
CREATE TABLE IF NOT EXISTS memory_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  milestone_type text DEFAULT 'general',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create health_metrics table
CREATE TABLE IF NOT EXISTS health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create video_conversations table
CREATE TABLE IF NOT EXISTS video_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tavus_conversation_id text UNIQUE NOT NULL,
  conversation_url text NOT NULL,
  status text DEFAULT 'created',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create voice_sessions table
CREATE TABLE IF NOT EXISTS voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text UNIQUE NOT NULL,
  status text DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  transcript text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE memory_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;

-- Memory tokens policies
CREATE POLICY "Users can manage own memory tokens" ON memory_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Health metrics policies
CREATE POLICY "Users can manage own health metrics" ON health_metrics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Video conversations policies
CREATE POLICY "Users can manage own video conversations" ON video_conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Voice sessions policies
CREATE POLICY "Users can manage own voice sessions" ON voice_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memory_tokens_user_id ON memory_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_tokens_created_at ON memory_tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_id ON health_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_type ON health_metrics(type);
CREATE INDEX IF NOT EXISTS idx_video_conversations_user_id ON video_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);