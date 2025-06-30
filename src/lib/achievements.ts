// Achievements System for EchoCare
import { supabase } from './supabase'

export interface Achievement {
  id: string
  name: string
  description: string
  category: 'conversation' | 'health' | 'social' | 'milestone'
  icon: string
  points: number
  requirement_type: 'count' | 'streak' | 'threshold' | 'time_based'
  requirement_value: number
  requirement_unit: string
  is_active: boolean
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  progress: number
  completed: boolean
  completed_at?: string
  achievement: Achievement
}

// Get all achievements
export async function getAllAchievements(): Promise<Achievement[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('points', { ascending: true })

    if (error) {
      console.error('Error fetching achievements:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return []
  }
}

// Get user achievements with progress
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq('user_id', userId)
      .order('completed', { ascending: true })
      .order('progress', { ascending: false })

    if (error) {
      console.error('Error fetching user achievements:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user achievements:', error)
    return []
  }
}

// Update achievement progress
export async function updateAchievementProgress(
  userId: string, 
  category: string, 
  increment: number = 1
): Promise<boolean> {
  try {
    const { error } = await supabase
      .rpc('update_achievement_progress', {
        p_user_id: userId,
        p_achievement_category: category,
        p_increment: increment
      })

    if (error) {
      console.error('Error updating achievement progress:', error)
      return false
    }

    console.log(`✅ Achievement progress updated for category: ${category}`)
    return true
  } catch (error) {
    console.error('Error updating achievement progress:', error)
    return false
  }
}

// Get achievement progress for a specific category
export async function getAchievementProgress(userId: string, category: string) {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq('user_id', userId)
      .eq('achievement.category', category)

    if (error) {
      console.error('Error fetching achievement progress:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching achievement progress:', error)
    return []
  }
}

// Check for newly completed achievements
export async function checkCompletedAchievements(userId: string): Promise<UserAchievement[]> {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) {
      console.error('Error checking completed achievements:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error checking completed achievements:', error)
    return []
  }
}

// Calculate achievement statistics
export function calculateAchievementStats(userAchievements: UserAchievement[]) {
  const total = userAchievements.length
  const completed = userAchievements.filter(ua => ua.completed).length
  const totalPoints = userAchievements
    .filter(ua => ua.completed)
    .reduce((sum, ua) => sum + (ua.achievement?.points || 0), 0)
  
  const categoryStats = userAchievements.reduce((stats, ua) => {
    const category = ua.achievement?.category || 'unknown'
    if (!stats[category]) {
      stats[category] = { total: 0, completed: 0 }
    }
    stats[category].total++
    if (ua.completed) {
      stats[category].completed++
    }
    return stats
  }, {} as Record<string, { total: number; completed: number }>)

  return {
    total,
    completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalPoints,
    categoryStats
  }
}

// Get achievement level based on points
export function getAchievementLevel(points: number): { level: number; title: string; nextLevelPoints: number } {
  const levels = [
    { level: 1, title: 'Newcomer', minPoints: 0 },
    { level: 2, title: 'Friend', minPoints: 100 },
    { level: 3, title: 'Companion', minPoints: 300 },
    { level: 4, title: 'Confidant', minPoints: 600 },
    { level: 5, title: 'Wellness Champion', minPoints: 1000 },
    { level: 6, title: 'Health Guardian', minPoints: 1500 },
    { level: 7, title: 'Life Master', minPoints: 2500 },
  ]

  let currentLevel = levels[0]
  let nextLevel = levels[1]

  for (let i = 0; i < levels.length; i++) {
    if (points >= levels[i].minPoints) {
      currentLevel = levels[i]
      nextLevel = levels[i + 1] || levels[i]
    } else {
      break
    }
  }

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    nextLevelPoints: nextLevel.minPoints - points
  }
}

// Trigger achievement events
export async function triggerAchievementEvent(userId: string, eventType: string, data?: any) {
  console.log(`🏆 Achievement event triggered: ${eventType}`, data)

  switch (eventType) {
    case 'conversation_completed':
      await updateAchievementProgress(userId, 'conversation', 1)
      break
    case 'video_call_completed':
      await updateAchievementProgress(userId, 'conversation', 1)
      break
    case 'health_data_logged':
      await updateAchievementProgress(userId, 'health', 1)
      break
    case 'memory_token_created':
      await updateAchievementProgress(userId, 'social', 1)
      break
    case 'emergency_contact_set':
      await updateAchievementProgress(userId, 'social', 1)
      break
    case 'setup_completed':
      await updateAchievementProgress(userId, 'milestone', 1)
      break
    case 'health_integration_connected':
      await updateAchievementProgress(userId, 'milestone', 1)
      break
    case 'calendar_connected':
      await updateAchievementProgress(userId, 'milestone', 1)
      break
    default:
      console.log(`Unknown achievement event: ${eventType}`)
  }
}