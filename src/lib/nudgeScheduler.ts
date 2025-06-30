// src/lib/nudgeScheduler.ts
const nudges = [
    { type: 'hydration', message: "Have you had a glass of water recently?" },
    { type: 'stretch', message: "Let's do a 3-minute stretch together." },
    { type: 'brainGame', message: "Ready for a quick memory game?" }
  ]
  
  export function getRandomNudge() {
    const index = Math.floor(Math.random() * nudges.length)
    return nudges[index]
  }
  