// types/settings.ts
export interface UserSettings {
    shareMood: boolean;
    logVoiceNotes: boolean;
    voiceSpeed: number; // for accessibility
    fontSize: 'small' | 'medium' | 'large';
  }
  
  // lib/settings.ts
  import { createClient } from '@supabase/supabase-js';
  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_KEY!);
  
  export async function getUserSettings(userId: string): Promise<UserSettings> {
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
    return data || { shareMood: false, logVoiceNotes: false, voiceSpeed: 1.0, fontSize: 'medium' };
  }
  
  export async function updateUserSettings(userId: string, settings: Partial<UserSettings>) {
    await supabase.from('user_settings').upsert({ user_id: userId, ...settings });
  }
  
  // UI: Add toggles in settings page (Settings.tsx)