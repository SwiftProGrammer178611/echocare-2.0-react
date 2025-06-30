// src/lib/lovedOnes.ts
export async function uploadAudioMessage(userId: string, from: string, file: File) {
    const { data, error } = await supabase.storage.from('audio-messages').upload(`messages/${Date.now()}.webm`, file)
    if (error) throw error
    await supabase.from('audio_messages').insert({ user_id: userId, from, audio_url: data.path, timestamp: new Date() })
  }
  
  export async function fetchAudioMessages(userId: string) {
    const { data } = await supabase.from('audio_messages').select('*').eq('user_id', userId).order('timestamp', { ascending: false })
    return data
  }
  