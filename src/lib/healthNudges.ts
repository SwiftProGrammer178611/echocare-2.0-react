// utils/healthNudges.ts
export const healthNudges = [
    "Time for a glass of water! 💧",
    "Let's do a 3-minute memory game 🧠 — ready?",
    "Take a moment to stretch your arms and breathe deeply. 🌿"
  ];
  
  export function getRandomNudge() {
    return healthNudges[Math.floor(Math.random() * healthNudges.length)];
  }
  
  // Trigger nudge during check-in (e.g. in startConversation):
  import { getRandomNudge } from '@/utils/healthNudges';
  
  if (checkInTime) {
    const nudge = getRandomNudge();
    await handleAIResponse(nudge);
  }
  