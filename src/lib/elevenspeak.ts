// src/lib/elevenspeak.ts

const ELEVENLABS_API_KEY = ""; // <-- Put your real API key here
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export async function speak(text: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB') {
  console.log('🗣️ Calling /api/tts with text:', text);
  const response = await fetch('http://localhost:5001/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  console.log('📡 TTS Response status:', response.status);

  if (!response.ok) {
    const errText = await response.text();
    console.error('❌ Failed to fetch audio:', response.status, errText);
    throw new Error('Failed to fetch audio');
  }

  const audioBlob = await response.blob();
  console.log('🔊 Audio blob size:', audioBlob.size);

  const audioUrl = URL.createObjectURL(audioBlob);
  console.log('🎧 Playing audio from URL:', audioUrl);

  const audio = new Audio(audioUrl);
  audio.play().then(() => {
    console.log('✅ Audio is playing');
  }).catch((err) => {
    console.error('❌ Audio play error:', err);
  });
}


export async function testElevenLabsConnection() {
  console.log('🧪 Testing ElevenLabs connection...');
  console.log('🔑 API Key:', ELEVENLABS_API_KEY?.substring(0, 20) + '...');

  if (!ELEVENLABS_API_KEY?.startsWith('sk_')) {
    return {
      connected: false,
      error: 'API key not set or invalid format',
      fallbackAvailable: 'speechSynthesis' in window,
      fallbackType: 'Web Speech API',
      apiKey: ELEVENLABS_API_KEY?.substring(0, 20) + '...'
    };
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });

    if (response.ok) {
      const userData = await response.json();
      console.log('✅ ElevenLabs connection successful:', userData);
      return {
        connected: true,
        user: userData,
        charactersUsed: userData.subscription?.character_count,
        charactersLimit: userData.subscription?.character_limit,
        fallbackAvailable: 'speechSynthesis' in window,
        fallbackType: 'Web Speech API',
        apiKey: ELEVENLABS_API_KEY.slice(0, 20) + '...'
      };
    } else {
      const errorText = await response.text();
      console.error(`❌ ElevenLabs connection failed: ${response.status} - ${errorText}`);
      return {
        connected: false,
        error: `HTTP ${response.status}: ${errorText}`,
        fallbackAvailable: 'speechSynthesis' in window,
        fallbackType: 'Web Speech API'
      };
    }
  } catch (error: any) {
    console.error('❌ ElevenLabs connection test error:', error);
    return {
      connected: false,
      error: error.message,
      fallbackAvailable: 'speechSynthesis' in window,
      fallbackType: 'Web Speech API'
    };
  }
}
