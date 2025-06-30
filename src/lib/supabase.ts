import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = 'https://bwzinqapnjwjlvryrudv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3emlucWFwbmp3amx2cnlydWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MDc1OTcsImV4cCI6MjA2NjQ4MzU5N30.GusbZd_6OxHWeV4FGgApC3_xWUGpRGnmTOaslwYAqP4'

console.log('🔗 Supabase URL:', supabaseUrl)
console.log('🔑 Supabase Anon Key (first 20 chars):', supabaseAnonKey.substring(0, 20) + '...')

// Create Supabase client with proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'echocare-2.0-react'
    }
  }
})

// Test basic Supabase connection (without querying specific tables)
export async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing basic Supabase connection...')
    
    // Test basic connection by getting the current session
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Supabase auth connection test failed:', error)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    return true
  } catch (error: any) {
    console.error('❌ Supabase connection test error:', error)
    return false
  }
}

// Test if users table exists and is accessible
export async function testUsersTable() {
  try {
    console.log('🔍 Testing users table access...')
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      if (error.message.includes('relation "public.users" does not exist')) {
        console.log('ℹ️ Users table does not exist yet')
        return { exists: false, accessible: false, error: 'Table does not exist' }
      }
      console.error('❌ Users table access failed:', error)
      return { exists: true, accessible: false, error: error.message }
    }
    
    console.log('✅ Users table is accessible')
    return { exists: true, accessible: true, error: null }
  } catch (error: any) {
    console.error('❌ Users table test error:', error)
    return { exists: false, accessible: false, error: error.message }
  }
}

// Initialize database tables
export async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database tables...')
    
    // Create users table
    const { error: usersError } = await supabase.rpc('create_users_table')
    if (usersError && !usersError.message.includes('already exists')) {
      console.error('Users table creation error:', usersError)
    }

    // Create conversations table
    const { error: conversationsError } = await supabase.rpc('create_conversations_table')
    if (conversationsError && !conversationsError.message.includes('already exists')) {
      console.error('Conversations table creation error:', conversationsError)
    }

    // Create health_metrics table
    const { error: healthError } = await supabase.rpc('create_health_metrics_table')
    if (healthError && !healthError.message.includes('already exists')) {
      console.error('Health metrics table creation error:', healthError)
    }

    // Create emotion_logs table
    const { error: emotionError } = await supabase.rpc('create_emotion_logs_table')
    if (emotionError && !emotionError.message.includes('already exists')) {
      console.error('Emotion logs table creation error:', emotionError)
    }

    // Create memory_tokens table
    const { error: memoryError } = await supabase.rpc('create_memory_tokens_table')
    if (memoryError && !memoryError.message.includes('already exists')) {
      console.error('Memory tokens table creation error:', memoryError)
    }

    console.log('✅ Database initialization completed')
    return true
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    return false
  }
}

// Database types
export interface User {
  id: string
  email: string
  name: string
  date_of_birth?: string
  emergency_contact?: string
  medical_history?: any
  preferences?: any
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title?: string
  messages: any[]
  duration?: number
  emotion_summary?: any
  health_insights?: any
  created_at: string
}

export interface HealthMetric {
  id: string
  user_id: string
  type: string
  value: number
  unit?: string
  metadata?: any
  timestamp: string
}

export interface EmotionLog {
  id: string
  user_id: string
  emotion: string
  confidence: number
  source: string
  context?: any
  timestamp: string
}

export interface MemoryToken {
  id: string
  user_id: string
  token_id: string
  title: string
  description: string
  milestone_type: string
  metadata?: any
  created_at: string
}