import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Heart, Database, CheckCircle, XCircle, Loader2, AlertTriangle, Copy, ExternalLink, Mic, Video } from 'lucide-react'
import { supabase, testSupabaseConnection, testUsersTable } from '../lib/supabase'
import { testElevenLabsConnection } from '../lib/elevenlabs'
import { testTavusConnection } from '../lib/tavus'
import { toast } from 'sonner'

export default function SetupDatabase() {
  const [isSetupRunning, setIsSetupRunning] = useState(false)
  const [setupResults, setSetupResults] = useState<Record<string, 'pending' | 'success' | 'error'>>({})
  const [setupLogs, setSetupLogs] = useState<string[]>([])
  const [apiStatus, setApiStatus] = useState<{
    elevenlabs?: any,
    tavus?: any
  }>({})

  const addLog = (message: string) => {
    setSetupLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const updateResult = (step: string, result: 'pending' | 'success' | 'error') => {
    setSetupResults(prev => ({ ...prev, [step]: result }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('SQL copied to clipboard!')
  }

  const testApiConnections = async () => {
    addLog('🔌 Testing API connections...')
    
    // Test ElevenLabs
    updateResult('elevenlabs', 'pending')
    addLog('Testing ElevenLabs connection...')
    const elevenLabsResult = await testElevenLabsConnection()
    setApiStatus(prev => ({ ...prev, elevenlabs: elevenLabsResult }))
    
    if (elevenLabsResult.connected) {
      updateResult('elevenlabs', 'success')
      addLog(`✅ ElevenLabs connected - ${elevenLabsResult.charactersUsed}/${elevenLabsResult.charactersLimit} characters used`)
    } else {
      updateResult('elevenlabs', 'error')
      addLog(`❌ ElevenLabs connection failed: ${elevenLabsResult.error}`)
    }

    // Test Tavus
    updateResult('tavus', 'pending')
    addLog('Testing Tavus connection...')
    const tavusResult = await testTavusConnection()
    setApiStatus(prev => ({ ...prev, tavus: tavusResult }))
    
    if (tavusResult.connected) {
      updateResult('tavus', 'success')
      addLog(`✅ Tavus connected - ${tavusResult.replicaCount} replicas available`)
    } else {
      updateResult('tavus', 'error')
      addLog(`❌ Tavus connection failed: ${tavusResult.error}`)
    }
  }

  const runDatabaseSetup = async () => {
    setIsSetupRunning(true)
    setSetupResults({})
    setSetupLogs([])
    
    try {
      addLog('🚀 Starting comprehensive system verification...')
      
      // Test basic Supabase connection
      updateResult('connection', 'pending')
      addLog('Testing Supabase connection...')
      
      const connectionSuccess = await testSupabaseConnection()
      
      if (!connectionSuccess) {
        updateResult('connection', 'error')
        addLog('❌ Failed to connect to Supabase. Check your configuration.')
        toast.error('Supabase connection failed. Check your configuration.')
        return
      }
      
      updateResult('connection', 'success')
      addLog('✅ Supabase connection successful')
      
      // Test users table
      updateResult('users_table', 'pending')
      addLog('Checking users table...')
      
      const tableStatus = await testUsersTable()
      
      if (!tableStatus.exists) {
        updateResult('users_table', 'error')
        addLog('❌ Users table does not exist. Please create it using the SQL script below.')
        toast.error('Users table not found. Please run the SQL script below.')
      } else if (!tableStatus.accessible) {
        updateResult('users_table', 'error')
        addLog(`❌ Users table exists but is not accessible: ${tableStatus.error}`)
        if (tableStatus.error?.includes('row-level security policy')) {
          addLog('💡 This is an RLS policy issue. Please run the RLS fix SQL script below.')
          toast.error('RLS policy error detected. Please run the SQL fix script below.')
        } else {
          toast.error('Users table access error. Check your RLS policies.')
        }
      } else {
        updateResult('users_table', 'success')
        addLog('✅ Users table is accessible')
      }

      // Test other required tables
      updateResult('other_tables', 'pending')
      addLog('Checking other required tables...')
      
      const requiredTables = ['user_profiles', 'memory_tokens', 'health_metrics', 'video_conversations', 'voice_sessions']
      let missingTables = []
      
      for (const tableName of requiredTables) {
        try {
          const { error } = await supabase.from(tableName).select('*').limit(1)
          if (error && error.code === '42P01') {
            missingTables.push(tableName)
          }
        } catch (err) {
          missingTables.push(tableName)
        }
      }
      
      if (missingTables.length > 0) {
        updateResult('other_tables', 'error')
        addLog(`❌ Missing tables: ${missingTables.join(', ')}`)
        addLog('💡 Please run the Complete Setup SQL script below to create all required tables.')
        toast.error(`Missing tables detected: ${missingTables.join(', ')}`)
      } else {
        updateResult('other_tables', 'success')
        addLog('✅ All required tables exist')
      }

      // Test optional emotion_logs table
      updateResult('emotion_logs', 'pending')
      addLog('Checking emotion_logs table...')
      
      try {
        const { error } = await supabase.from('emotion_logs').select('*').limit(1)
        if (error && error.code === '42P01') {
          updateResult('emotion_logs', 'error')
          addLog('❌ emotion_logs table missing (optional for emotion tracking)')
        } else {
          updateResult('emotion_logs', 'success')
          addLog('✅ emotion_logs table exists')
        }
      } catch (err) {
        updateResult('emotion_logs', 'error')
        addLog('❌ emotion_logs table missing (optional for emotion tracking)')
      }

      // Test API connections
      await testApiConnections()
      
      if (setupResults['connection'] === 'success' && 
          setupResults['users_table'] === 'success' && 
          setupResults['other_tables'] === 'success') {
        addLog('🎉 Database is ready for use!')
        toast.success('Database is ready! You can now use all features.')
      }
      
    } catch (error: any) {
      addLog(`💥 System verification failed: ${error.message}`)
      toast.error('System verification failed. Check the logs for details.')
    } finally {
      setIsSetupRunning(false)
    }
  }

  const getStatusIcon = (status: 'pending' | 'success' | 'error' | undefined) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />
    }
  }

  const createTableSQL = `-- Complete EchoCare Database Setup
-- This script creates all required tables and RLS policies

-- Create users table with proper structure
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles table (CRITICAL for sign-up process)
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

-- Create emotion_logs table (optional for emotion tracking)
CREATE TABLE IF NOT EXISTS emotion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emotion text NOT NULL,
  confidence numeric DEFAULT 0,
  source text DEFAULT 'unknown',
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create achievements table
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

-- Create user_achievements table
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

-- Create conversation_history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  session_type text NOT NULL,
  title text,
  messages jsonb DEFAULT '[]' NOT NULL,
  emotion_summary jsonb,
  health_insights jsonb,
  duration_seconds integer,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create health_integrations table
CREATE TABLE IF NOT EXISTS health_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  data_type text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text,
  title text NOT NULL,
  description text,
  event_type text DEFAULT 'general',
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  reminder_minutes integer DEFAULT 15,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- User profiles policies
CREATE POLICY "user_profiles_policy" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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

-- Emotion logs policies
CREATE POLICY "Users can manage own emotion logs" ON emotion_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Achievements policies (read-only for all authenticated users)
CREATE POLICY "achievements_read_policy" ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- User achievements policies
CREATE POLICY "user_achievements_policy" ON user_achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversation history policies
CREATE POLICY "conversation_history_policy" ON conversation_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Health integrations policies
CREATE POLICY "health_integrations_policy" ON health_integrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar events policies
CREATE POLICY "calendar_events_policy" ON calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_tokens_user_id ON memory_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_tokens_created_at ON memory_tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_id ON health_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_type ON health_metrics(type);
CREATE INDEX IF NOT EXISTS idx_video_conversations_user_id ON video_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id ON emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_created_at ON emotion_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_emotion ON emotion_logs(emotion);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_started_at ON conversation_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_history_session_type ON conversation_history(session_type);
CREATE INDEX IF NOT EXISTS idx_health_integrations_user_id ON health_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_health_integrations_data_type ON health_integrations(data_type);
CREATE INDEX IF NOT EXISTS idx_health_integrations_recorded_at ON health_integrations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);`

  const fixRLSSQL = `-- Fix RLS Policies - Run this if you're getting authentication errors
-- This will drop and recreate the policies with the correct syntax

-- Drop existing policies for users table
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can manage own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "allow_user_delete_own_data" ON users;
DROP POLICY IF EXISTS "allow_user_insert_own_profile" ON users;
DROP POLICY IF EXISTS "allow_user_select_own_data" ON users;
DROP POLICY IF EXISTS "allow_user_update_own_data" ON users;

-- Recreate policies with correct syntax
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Fix user_profiles policies if they exist
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
CREATE POLICY "user_profiles_policy" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="glass-card">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-red-500 mr-2" />
              <h1 className="text-2xl font-bold">EchoCare 2.0</h1>
            </div>
            <CardTitle>Complete System Setup & Verification</CardTitle>
            <CardDescription>
              Fix database errors and verify API connections for ElevenLabs and Tavus
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Critical Fix Alert */}
        <Card className="glass-card border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center text-red-800">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Database & API Issues Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-800 space-y-3">
              <p className="font-medium">Your application has missing database tables and API configuration issues:</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li>Missing database tables (user_profiles, memory_tokens, health_metrics, video_conversations, voice_sessions, emotion_logs)</li>
                <li>ElevenLabs API key issues (Free Tier disabled due to unusual activity)</li>
                <li>Tavus API configuration for video chat</li>
                <li>Voice chat features may not work properly</li>
                <li><strong>Sign-up process failing due to missing user_profiles table</strong></li>
              </ul>
              <p className="text-sm">Run the "Complete Setup SQL" script below to create all missing tables and check your API keys.</p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(createTableSQL)}
                  className="bg-white"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Complete Setup SQL
                </Button>
                <a 
                  href="https://supabase.com/dashboard" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-red-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Supabase Dashboard
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SQL Scripts */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Complete Setup Script */}
          <Card className="glass-card border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-blue-800">
                <span className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Complete Setup SQL (Run This!)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(createTableSQL)}
                  className="bg-white"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800 mb-3">
                Creates all required tables including user_profiles (fixes sign-up errors) and all other tables:
              </p>
              <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap">{createTableSQL}</pre>
              </div>
            </CardContent>
          </Card>

          {/* RLS Fix Script */}
          <Card className="glass-card border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-orange-800">
                <span className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  RLS Fix SQL (If Still Having Issues)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(fixRLSSQL)}
                  className="bg-white"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-800 mb-3">
                Run this if you still get RLS policy errors after the complete setup:
              </p>
              <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap">{fixRLSSQL}</pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Setup Controls */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                System Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={runDatabaseSetup}
                disabled={isSetupRunning}
                className="w-full"
                size="lg"
              >
                {isSetupRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking system...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Test Complete System
                  </>
                )}
              </Button>
              
              <div className="text-center">
                <a 
                  href="https://supabase.com/dashboard" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm inline-flex items-center"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Supabase Dashboard
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Connection Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Supabase Connection</span>
                  {getStatusIcon(setupResults['connection'])}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Users Table & RLS</span>
                  {getStatusIcon(setupResults['users_table'])}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Required Tables</span>
                  {getStatusIcon(setupResults['other_tables'])}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Emotion Logs Table</span>
                  {getStatusIcon(setupResults['emotion_logs'])}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium flex items-center">
                    <Mic className="w-3 h-3 mr-1" />
                    ElevenLabs TTS
                  </span>
                  {getStatusIcon(setupResults['elevenlabs'])}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium flex items-center">
                    <Video className="w-3 h-3 mr-1" />
                    Tavus Video AI
                  </span>
                  {getStatusIcon(setupResults['tavus'])}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Status Details */}
        {(apiStatus.elevenlabs || apiStatus.tavus) && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>API Connection Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {apiStatus.elevenlabs && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium flex items-center mb-2">
                      <Mic className="w-4 h-4 mr-2" />
                      ElevenLabs Status
                    </h4>
                    {apiStatus.elevenlabs.connected ? (
                      <div className="text-sm text-green-600">
                        <p>✅ Connected successfully</p>
                        <p>Characters: {apiStatus.elevenlabs.charactersUsed}/{apiStatus.elevenlabs.charactersLimit}</p>
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">
                        <p>❌ Connection failed</p>
                        <p className="break-words">{apiStatus.elevenlabs.error}</p>
                        {apiStatus.elevenlabs.error?.includes('detected_unusual_activity') && (
                          <div className="mt-2 p-2 bg-yellow-100 rounded text-yellow-800">
                            <p className="font-medium">Free Tier Disabled</p>
                            <p className="text-xs">Your ElevenLabs free tier has been disabled due to unusual activity. You'll need to:</p>
                            <ul className="text-xs list-disc list-inside mt-1">
                              <li>Get a new API key from a different account</li>
                              <li>Or upgrade to a paid ElevenLabs plan</li>
                              <li>Update your .env file with the new key</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {apiStatus.tavus && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium flex items-center mb-2">
                      <Video className="w-4 h-4 mr-2" />
                      Tavus Status
                    </h4>
                    {apiStatus.tavus.connected ? (
                      <div className="text-sm text-green-600">
                        <p>✅ Connected successfully</p>
                        <p>Replicas available: {apiStatus.tavus.replicaCount}</p>
                        <p className="text-xs mt-1">API Key: edc8029ea269468b853e4ca98e77daa8</p>
                        <p className="text-xs">Persona ID: p03cdd73a08a</p>
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">
                        <p>❌ Connection failed</p>
                        <p>{apiStatus.tavus.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Logs */}
        {setupLogs.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                {setupLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-800">
              <Database className="w-5 h-5 mr-2" />
              Step-by-Step Fix Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <h4 className="font-bold">Copy the Complete Setup SQL</h4>
                  <p className="text-sm text-gray-600">Click "Copy" on the blue Complete Setup SQL script above</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <h4 className="font-bold">Open Supabase SQL Editor</h4>
                  <p className="text-sm text-gray-600">Go to your Supabase Dashboard → SQL Editor</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <h4 className="font-bold">Run the SQL Script</h4>
                  <p className="text-sm text-gray-600">Paste the SQL and click "Run" to create all tables and policies</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <h4 className="font-bold">Fix ElevenLabs API Key</h4>
                  <p className="text-sm text-gray-600">Update your .env file with a new ElevenLabs API key or upgrade to a paid plan</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
                <div>
                  <h4 className="font-bold">Test the System</h4>
                  <p className="text-sm text-gray-600">Click "Test Complete System" to verify everything is working</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}