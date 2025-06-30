
// src/lib/elevenlabs.ts
export { speak as generateSpeech, testElevenLabsConnection } from './elevenspeak';

// client/elevenspeak.js
export async function speak(text, voiceId) {

  const response = await fetch('http://localhost:5001/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  new Audio(audioUrl).play();
}
