// src/lib/privacySettings.ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_KEY!)

export async function getSettings(userId: string) {
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).single()
  return data || { share_mood: false, log_voice: false }
}

export async function updateSettings(userId: string, settings: Record<string, boolean>) {
  await supabase.from('user_settings').upsert({ user_id: userId, ...settings })
}
