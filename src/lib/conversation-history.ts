// Conversation History Management for EchoCare
import { supabase } from './supabase'

export interface ConversationSession {
  id: string
  user_id: string
  session_id: string
  session_type: 'voice' | 'video' | 'text'
  title: string
  messages: Array<{
    id: number
    speaker: 'user' | 'ai'
    message: string
    timestamp: string
    emotion?: string
  }>
  emotion_summary?: {
    dominant_emotion: string
    emotion_changes: number
    positive_ratio: number
  }
  health_insights?: {
    stress_level: string
    engagement_level: string
    concerns: string[]
  }
  duration_seconds?: number
  started_at: string
  ended_at?: string
  created_at: string
}

// Save conversation session
export async function saveConversationSession(
  userId: string,
  sessionType: 'voice' | 'video' | 'text',
  messages: any[],
  durationSeconds?: number
): Promise<string | null> {
  try {
    const sessionId = `${sessionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Generate title based on conversation content
    const title = generateConversationTitle(messages, sessionType)
    
    // Analyze emotions in the conversation
    const emotionSummary = analyzeConversationEmotions(messages)
    
    // Generate health insights
    const healthInsights = generateHealthInsights(messages, emotionSummary)
    
    const { data, error } = await supabase
      .from('conversation_history')
      .insert([
        {
          user_id: userId,
          session_id: sessionId,
          session_type: sessionType,
          title,
          messages: JSON.stringify(messages),
          emotion_summary: emotionSummary,
          health_insights: healthInsights,
          duration_seconds: durationSeconds,
          started_at: messages[0]?.timestamp || new Date().toISOString(),
          ended_at: messages[messages.length - 1]?.timestamp || new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error saving conversation session:', error)
      return null
    }

    console.log('✅ Conversation session saved:', sessionId)
    return sessionId
  } catch (error) {
    console.error('Error saving conversation session:', error)
    return null
  }
}

// Get conversation history for a user
export async function getConversationHistory(
  userId: string,
  limit: number = 20,
  sessionType?: 'voice' | 'video' | 'text'
): Promise<ConversationSession[]> {
  try {
    let query = supabase
      .from('conversation_history')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (sessionType) {
      query = query.eq('session_type', sessionType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching conversation history:', error)
      return []
    }

    return (data || []).map(session => ({
      ...session,
      messages: typeof session.messages === 'string' 
        ? JSON.parse(session.messages) 
        : session.messages
    }))
  } catch (error) {
    console.error('Error fetching conversation history:', error)
    return []
  }
}

// Get a specific conversation session
export async function getConversationSession(sessionId: string): Promise<ConversationSession | null> {
  try {
    const { data, error } = await supabase
      .from('conversation_history')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error) {
      console.error('Error fetching conversation session:', error)
      return null
    }

    return {
      ...data,
      messages: typeof data.messages === 'string' 
        ? JSON.parse(data.messages) 
        : data.messages
    }
  } catch (error) {
    console.error('Error fetching conversation session:', error)
    return null
  }
}

// Delete conversation session
export async function deleteConversationSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversation_history')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      console.error('Error deleting conversation session:', error)
      return false
    }

    console.log('✅ Conversation session deleted:', sessionId)
    return true
  } catch (error) {
    console.error('Error deleting conversation session:', error)
    return false
  }
}

// Generate conversation title based on content
function generateConversationTitle(messages: any[], sessionType: string): string {
  if (!messages || messages.length === 0) {
    return `${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Chat`
  }

  // Get the first user message
  const firstUserMessage = messages.find(m => m.speaker === 'user')?.message || ''
  
  // Extract key topics or use first few words
  const topics = extractTopics(firstUserMessage)
  
  if (topics.length > 0) {
    return `Chat about ${topics[0]}`
  }
  
  // Fallback to first few words
  const words = firstUserMessage.split(' ').slice(0, 4).join(' ')
  if (words.length > 0) {
    return `"${words}${words.length < firstUserMessage.length ? '...' : ''}"`
  }
  
  // Final fallback with timestamp
  const date = new Date()
  return `${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Chat - ${date.toLocaleDateString()}`
}

// Extract topics from conversation
function extractTopics(text: string): string[] {
  const topicKeywords = {
    'family': ['family', 'children', 'grandchildren', 'spouse', 'husband', 'wife', 'son', 'daughter'],
    'health': ['health', 'doctor', 'medicine', 'pain', 'feeling', 'tired', 'sick', 'appointment'],
    'activities': ['reading', 'walking', 'cooking', 'gardening', 'watching', 'hobby', 'exercise'],
    'emotions': ['happy', 'sad', 'worried', 'excited', 'angry', 'lonely', 'content'],
    'weather': ['weather', 'sunny', 'rain', 'cold', 'hot', 'snow', 'wind'],
    'food': ['food', 'eat', 'meal', 'cooking', 'dinner', 'lunch', 'breakfast'],
    'memories': ['remember', 'memory', 'past', 'years ago', 'childhood', 'young']
  }
  
  const lowerText = text.toLowerCase()
  const foundTopics: string[] = []
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      foundTopics.push(topic)
    }
  })
  
  return foundTopics
}

// Analyze emotions in conversation
function analyzeConversationEmotions(messages: any[]) {
  const emotions = messages
    .filter(m => m.emotion)
    .map(m => m.emotion)
  
  if (emotions.length === 0) {
    return {
      dominant_emotion: 'neutral',
      emotion_changes: 0,
      positive_ratio: 0.5
    }
  }
  
  // Count emotion frequencies
  const emotionCounts = emotions.reduce((counts, emotion) => {
    counts[emotion] = (counts[emotion] || 0) + 1
    return counts
  }, {} as Record<string, number>)
  
  // Find dominant emotion
  const dominantEmotion = Object.entries(emotionCounts)
    .sort(([,a], [,b]) => b - a)[0][0]
  
  // Count emotion changes
  let emotionChanges = 0
  for (let i = 1; i < emotions.length; i++) {
    if (emotions[i] !== emotions[i - 1]) {
      emotionChanges++
    }
  }
  
  // Calculate positive ratio
  const positiveEmotions = ['happy', 'excited', 'content', 'cheerful', 'joyful']
  const positiveCount = emotions.filter(e => positiveEmotions.includes(e)).length
  const positiveRatio = positiveCount / emotions.length
  
  return {
    dominant_emotion: dominantEmotion,
    emotion_changes: emotionChanges,
    positive_ratio: Math.round(positiveRatio * 100) / 100
  }
}

// Generate health insights from conversation
function generateHealthInsights(messages: any[], emotionSummary: any) {
  const userMessages = messages.filter(m => m.speaker === 'user')
  const allText = userMessages.map(m => m.message).join(' ').toLowerCase()
  
  // Analyze stress indicators
  const stressKeywords = ['stressed', 'worried', 'anxious', 'overwhelmed', 'tired', 'exhausted']
  const stressLevel = stressKeywords.some(keyword => allText.includes(keyword)) ? 'elevated' : 'normal'
  
  // Analyze engagement
  const messageCount = userMessages.length
  const avgMessageLength = userMessages.reduce((sum, m) => sum + m.message.length, 0) / messageCount
  const engagementLevel = messageCount > 5 && avgMessageLength > 20 ? 'high' : 
                         messageCount > 2 && avgMessageLength > 10 ? 'medium' : 'low'
  
  // Identify concerns
  const concerns: string[] = []
  if (allText.includes('pain')) concerns.push('Physical discomfort mentioned')
  if (allText.includes('lonely')) concerns.push('Social isolation indicators')
  if (allText.includes('forget') || allText.includes('memory')) concerns.push('Memory concerns')
  if (emotionSummary.positive_ratio < 0.3) concerns.push('Predominantly negative mood')
  
  return {
    stress_level: stressLevel,
    engagement_level: engagementLevel,
    concerns
  }
}

// Get conversation statistics
export async function getConversationStatistics(userId: string) {
  try {
    const { data, error } = await supabase
      .from('conversation_history')
      .select('session_type, duration_seconds, emotion_summary, started_at')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (error) {
      console.error('Error fetching conversation statistics:', error)
      return null
    }

    const sessions = data || []
    
    return {
      totalSessions: sessions.length,
      voiceSessions: sessions.filter(s => s.session_type === 'voice').length,
      videoSessions: sessions.filter(s => s.session_type === 'video').length,
      totalMinutes: Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60),
      averageSessionLength: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length / 60)
        : 0,
      dominantEmotions: sessions
        .map(s => s.emotion_summary?.dominant_emotion)
        .filter(Boolean)
        .reduce((counts, emotion) => {
          counts[emotion] = (counts[emotion] || 0) + 1
          return counts
        }, {} as Record<string, number>)
    }
  } catch (error) {
    console.error('Error calculating conversation statistics:', error)
    return null
  }
}