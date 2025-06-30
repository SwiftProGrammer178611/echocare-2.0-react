import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://bwzinqapnjwjlvryrudv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3emlucWFwbmp3amx2cnlydWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MDc1OTcsImV4cCI6MjA2NjQ4MzU5N30.GusbZd_6OxHWeV4FGgApC3_xWUGpRGnmTOaslwYAqP4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);


export async function storeFact(userId: string, key: string, value: string) {
  await supabase.from('user_facts').upsert({ user_id: userId, key, value });
}

export async function getFacts(userId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('user_facts').select('*').eq('user_id', userId);
  return data?.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, string>) || {};
}
