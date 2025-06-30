// AI Models integration for EchoCare - ENHANCED CONVERSATIONAL AI
const HF_MODEL = 'microsoft/DialoGPT-large'

// In your fetch:
await fetch(
  `https://api-inference.huggingface.co/models/${HF_MODEL}`,
  { /* headers, body */ }
);

const HUGGINGFACE_TOKEN = (import.meta as any).env.VITE_HUGGING_FACE;

// Enhanced conversation context and memory
let conversationHistory: Array<{role: string, content: string, timestamp: Date, emotion?: string}> = []
let userPersonality: {
  name?: string,
  preferences?: string[],
  topics?: string[],
  mood?: string,
  recentTopics?: string[]
} = {}

export async function generateAIResponse(messages: any[], userEmotion?: string, userContext?: any) {
  try {
    // Get the latest user message
    const latestMessage = messages[messages.length - 1]?.content || ''
    
    // Update conversation history
    conversationHistory.push({
      role: 'user',
      content: latestMessage,
      timestamp: new Date(),
      emotion: userEmotion
    })

    // Keep only last 10 exchanges to maintain context without overwhelming the AI
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20)
    }

    // Build contextual system prompt based on user emotion and conversation history
    const systemPrompt = buildAdvancedContextualPrompt(userEmotion, latestMessage)
    
    // Generate response using multiple strategies
    let aiResponse = await tryMultipleAIStrategies(systemPrompt, latestMessage, userEmotion)
    
    // Add response to conversation history
    conversationHistory.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    })

    return aiResponse
  } catch (error) {
    console.error('AI API error:', error)
    return generateAdvancedFallbackResponse(userEmotion, messages[messages.length - 1]?.content)
  }
}

function buildAdvancedContextualPrompt(userEmotion?: string, userMessage?: string) {
  const emotionContext = userEmotion ? `The user's current emotional state is: ${userEmotion}. Respond with empathy and understanding.` : ''
  
  const conversationContext = conversationHistory.length > 2 
    ? `Recent conversation:\n${conversationHistory.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'You'}: ${h.content}`).join('\n')}`
    : ''

  const recentTopics = extractRecentTopics(conversationHistory)
  const topicContext = recentTopics.length > 0 ? `Recent topics discussed: ${recentTopics.join(', ')}` : ''

  return `You are EchoCare AI, a warm, empathetic companion for elderly users. You are having a natural, flowing conversation like a caring friend or family member.

CRITICAL CONVERSATION RULES:
- ALWAYS listen carefully to what the user ACTUALLY said: "${userMessage}"
- If they say they DON'T like something, acknowledge that they DON'T like it
- If they give a short response like "absolute" or "okay", ask a follow-up question about what they just mentioned
- NEVER repeat the same response twice - each response must be unique and relevant
- Keep responses conversational and natural (1-2 sentences)
- Ask engaging follow-up questions to keep the conversation flowing
- Remember and reference what was discussed earlier
- Show genuine interest and curiosity about their life
- Be supportive, warm, and encouraging
- Avoid generic responses - make each response personal and specific

${emotionContext}
${conversationContext}
${topicContext}

Current user message: "${userMessage}"

Respond as a caring companion who is genuinely listening and interested in continuing this specific conversation. Make your response unique, relevant, and engaging.`
}

async function tryMultipleAIStrategies(systemPrompt: string, userMessage: string, userEmotion?: string) {
  // Strategy 1: Try Hugging Face API with authentication
  try {
    if (HUGGINGFACE_TOKEN && HUGGINGFACE_TOKEN.startsWith('hf_')) {
      console.log('🤖 Using Hugging Face API with authentication')
      console.log('🔑 HF Token available:', !!HUGGINGFACE_TOKEN)
      
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `${systemPrompt}\n\nUser: ${userMessage}\n\nEchoCare AI:`,
            parameters: { max_length: 200, temperature: 0.8, /* ... */ },
          }),
        }
      );


      if (response.ok) {
        const result = await response.json()
        const aiResponse = result[0]?.generated_text?.split('EchoCare AI:')[1]?.trim()
        if (aiResponse && aiResponse.length > 10 && !isGenericResponse(aiResponse)) {
          console.log('✅ Hugging Face API response:', aiResponse)
          return aiResponse
        }
      } else {
        const errorText = await response.text()
        console.log('❌ Hugging Face API error:', response.status, errorText)
      }
    } else {
      console.log('⚠️ Hugging Face token not configured or invalid format')
      console.log('🔧 Expected format: hf_... but got:', HUGGINGFACE_TOKEN?.substring(0, 10) + '...')
    }
  } catch (apiError) {
    console.log('❌ Hugging Face API error:', apiError)
  }

  // Strategy 2: Advanced rule-based conversational AI
  console.log('🧠 Using advanced rule-based AI fallback')
  return generateIntelligentConversationalResponse(userMessage, userEmotion)
}

function isGenericResponse(response: string): boolean {
  const genericPhrases = [
    'I\'m here and ready to chat',
    'How has your day been so far',
    'I\'m doing well',
    'How are you feeling',
    'That\'s interesting',
    'That sounds like a wonderful activity'
  ]
  
  return genericPhrases.some(phrase => response.toLowerCase().includes(phrase.toLowerCase()))
}

function generateIntelligentConversationalResponse(userMessage: string, userEmotion?: string) {
  const message = userMessage.toLowerCase().trim()
  
  // Analyze message for specific content and respond contextually
  
  // Handle negative responses about activities
  if ((message.includes('do not') || message.includes('don\'t')) && message.includes('like')) {
    if (message.includes('cooking')) {
      return getRandomResponse([
        "I understand - cooking isn't for everyone! Do you prefer ordering takeout or having someone else cook for you?",
        "That's totally fine! What do you usually do for meals then? Do you have a favorite restaurant or delivery place?",
        "No worries about cooking! Many people feel the same way. What's your go-to when you're hungry?",
        "I get that - cooking can be a lot of work. Do you have family or friends who cook for you sometimes?"
      ])
    }
    return getRandomResponse([
      "I hear you - that's not your thing. What do you prefer to do instead?",
      "That's perfectly fine! Everyone has different interests. What activities do you actually enjoy?",
      "I understand completely. What would you rather spend your time on?",
      "No problem at all! What kinds of things do bring you joy?"
    ])
  }

  // Handle very short responses
  if (message.length <= 10 && (message.includes('absolute') || message.includes('okay') || message.includes('yes') || message.includes('sure'))) {
    const recentTopics = extractRecentTopics(conversationHistory)
    if (recentTopics.length > 0) {
      const lastTopic = recentTopics[0]
      return getRandomResponse([
        `I'd love to hear more about your thoughts on ${lastTopic}. What's your experience been like with that?`,
        `Tell me more about ${lastTopic} - what's most important to you about it?`,
        `That's interesting! What got you thinking about ${lastTopic} in the first place?`,
        `I'm curious to learn more about your perspective on ${lastTopic}. What stands out to you?`
      ])
    }
    return getRandomResponse([
      "I'd love to hear more about what you're thinking. Can you tell me a bit more?",
      "That's intriguing! What's on your mind about that?",
      "I'm curious to know more about your thoughts. What would you like to share?",
      "Tell me more about what you're feeling or thinking right now."
    ])
  }

  // Handle "I will think about it" type responses
  if (message.includes('think about it') || message.includes('let you know')) {
    return getRandomResponse([
      "That sounds like a good plan! Take your time. Is there anything else you'd like to chat about in the meantime?",
      "Of course, no rush at all! While you're thinking, what else has been on your mind lately?",
      "Absolutely! Whenever you're ready. In the meantime, how has your day been going?",
      "That's perfectly fine! What else would you like to talk about while you're thinking it over?"
    ])
  }

  // Greetings and check-ins
  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return getRandomResponse([
      "Hello there! It's wonderful to hear from you. What's been on your mind today?",
      "Hi! I'm so glad you're here. Tell me, what's new in your world?",
      "Hey! It's always a pleasure to chat with you. How are you feeling right now?",
      "Hello! Your voice always brightens my day. What would you like to talk about?"
    ])
  }

  // Responses about feelings and emotions
  if (message.includes('good') || message.includes('great') || message.includes('wonderful') || message.includes('fine')) {
    return getRandomResponse([
      "That's fantastic to hear! What's been the highlight that's made you feel so good?",
      "I'm really happy you're feeling great! Tell me more about what's bringing you joy.",
      "Wonderful! Your positive energy is contagious. What's been going well for you?",
      "That's music to my ears! I'd love to hear what's been making your day so good."
    ])
  }

  if (message.includes('tired') || message.includes('exhausted') || message.includes('sleepy')) {
    return getRandomResponse([
      "I can hear that you're feeling tired. Have you been keeping busy lately? What's been on your plate?",
      "It sounds like you might need some rest. Tell me, what's been keeping you up or wearing you out?",
      "Feeling tired can be tough. Would you like to share what's been on your mind or what you've been up to?",
      "I understand that tiredness. Sometimes our bodies tell us we need to slow down. What's been happening in your life?"
    ])
  }

  if (message.includes('sad') || message.includes('down') || message.includes('upset') || message.includes('lonely')) {
    return getRandomResponse([
      "I'm sorry you're feeling this way. I'm here to listen. What's been weighing on your heart?",
      "It sounds like you're going through a difficult time. Would you like to share what's troubling you?",
      "I can hear the sadness in your words. Sometimes talking helps. What's been on your mind?",
      "I'm here for you during tough times. What's been making you feel down lately?"
    ])
  }

  // Family and relationships
  if (message.includes('family') || message.includes('children') || message.includes('grandchildren') || message.includes('kids')) {
    return getRandomResponse([
      "Family is so precious! Tell me about your family - I love hearing family stories.",
      "I can tell family means a lot to you. What's your favorite memory with them?",
      "Family connections are wonderful. How often do you get to see them? What do you enjoy doing together?",
      "That's lovely! Family relationships are so important. Tell me more about what makes them special to you."
    ])
  }

  // Food and meals - SPECIFIC responses for food topics
  if (message.includes('pizza')) {
    return getRandomResponse([
      "Pizza is such a classic! What's your favorite type of pizza? Do you like thin crust or thick crust?",
      "Mmm, pizza! That's always a good choice. What toppings do you usually go for?",
      "Pizza is one of those foods that just makes people happy! Do you have a favorite pizza place?",
      "I love that you brought up pizza! What's your go-to pizza order? Are you more of a pepperoni person or do you like to get creative?"
    ])
  }

  if (message.includes('eat') || message.includes('food') || message.includes('meal') || message.includes('lunch') || message.includes('dinner')) {
    return getRandomResponse([
      "Food is one of life's pleasures! What's your favorite thing to eat? Do you enjoy cooking?",
      "Meals can be such a social time. Do you have any favorite dishes or family recipes?",
      "I love hearing about food! What's been your favorite meal lately? Do you cook for yourself?",
      "Food brings people together, doesn't it? Tell me about your favorite foods or cooking experiences."
    ])
  }

  // Health and medical topics
  if (message.includes('doctor') || message.includes('appointment') || message.includes('medicine') || message.includes('health')) {
    return getRandomResponse([
      "Taking care of your health is so important. How did everything go? Are you feeling okay about it?",
      "Health appointments can sometimes be stressful. How are you feeling about everything?",
      "I hope everything went well with your health matters. Is there anything you'd like to talk about?",
      "Your health and wellbeing matter to me. How are you managing everything?"
    ])
  }

  // Activities and hobbies
  if (message.includes('reading') || message.includes('book') || message.includes('garden') || message.includes('cooking') || message.includes('walking')) {
    return getRandomResponse([
      "That sounds like a wonderful activity! What do you enjoy most about it?",
      "I love that you're staying active and engaged. Tell me more about what you've been doing.",
      "That's fantastic! How long have you been enjoying this? What drew you to it?",
      "It's wonderful to hear about your interests. What's your favorite part about it?"
    ])
  }

  // Express gratitude or thanks
  if (message.includes('thank') || message.includes('appreciate') || message.includes('grateful')) {
    return getRandomResponse([
      "You're so very welcome! It truly makes me happy to chat with you. What else is on your mind?",
      "It's my absolute pleasure! I genuinely enjoy our conversations. What would you like to talk about next?",
      "You don't need to thank me - I love spending time talking with you! Tell me, what's been interesting in your day?",
      "Your kindness means a lot to me! I'm always here for a good conversation. What's been on your thoughts lately?"
    ])
  }

  // Questions about the AI
  if (message.includes('how are you') || message.includes('how do you feel') || message.includes('what do you think')) {
    return getRandomResponse([
      "I'm doing wonderfully, especially when I get to chat with interesting people like you! What's been the best part of your day?",
      "I feel great when I'm having good conversations! Speaking of which, what's been on your mind lately?",
      "I'm feeling quite content, thank you for asking! I'm curious though - what's been making you happy recently?",
      "I'm doing well, and I love getting to know people better. Tell me, what's something that always makes you smile?"
    ])
  }

  // Default responses based on emotion and conversation flow
  const emotionResponses = {
    happy: [
      "I can hear the joy in your voice! What's been bringing you such happiness?",
      "Your positive energy is wonderful! Tell me more about what's making you feel so good.",
      "It's fantastic to hear you sounding so upbeat! What's been the source of your good mood?",
      "I love hearing when you're happy! What's been the highlight of your day?"
    ],
    sad: [
      "I can sense you might be feeling a bit down. I'm here to listen. What's been on your heart?",
      "It sounds like you're going through something difficult. Would you like to share what's troubling you?",
      "I'm here for you during tough times. Sometimes talking about what's bothering us can help.",
      "I notice you might be feeling sad. I care about how you're doing. What's been weighing on your mind?"
    ],
    anxious: [
      "I can hear some concern in your voice. What's been worrying you lately?",
      "It sounds like you might have something on your mind. I'm here to listen if you'd like to share.",
      "I sense you might be feeling anxious. Take a deep breath with me. What's been causing you stress?",
      "I'm here to support you through any worries. What's been making you feel uneasy?"
    ],
    excited: [
      "Your excitement is contagious! I love hearing when you're enthusiastic about something. Tell me more!",
      "I can feel your positive energy! What has you so excited? I'd love to hear about it.",
      "Your enthusiasm is wonderful! What's got you feeling so energetic and happy?",
      "It's amazing to hear such excitement in your voice! What's been making you feel this way?"
    ]
  }

  // Use emotion-specific responses if available
  if (userEmotion && emotionResponses[userEmotion as keyof typeof emotionResponses]) {
    return getRandomResponse(emotionResponses[userEmotion as keyof typeof emotionResponses])
  }

  // Contextual responses based on conversation history
  const recentTopics = extractRecentTopics(conversationHistory)
  if (recentTopics.length > 0) {
    const topic = recentTopics[0]
    return getRandomResponse([
      `That's really interesting! Building on what we were discussing about ${topic}, what are your thoughts on that?`,
      `I've been thinking about what you said regarding ${topic}. How do you feel about it now?`,
      `You mentioned ${topic} earlier, and I'm curious to hear more of your perspective on it.`,
      `That connects to what we were talking about with ${topic}. What's your experience been like with that?`
    ])
  }

  // General engaging responses that encourage conversation
  const generalResponses = [
    "That's really fascinating! I'd love to hear more about your thoughts on that. What's your perspective?",
    "I appreciate you sharing that with me. There's clearly more to this story - would you like to continue?",
    "That sounds important to you. How do you feel about everything that's happening? I'm genuinely curious.",
    "I can tell this matters to you. What do you think the next step might be? I value your insights.",
    "That's a thoughtful point you've made. How long have you been thinking about this? I find your views interesting.",
    "I'm really glad you brought that up. What's been your experience with this? I'd love to understand better.",
    "That's quite interesting! What drew you to think about this? I'm curious about your perspective.",
    "I can see this is meaningful to you. What aspects of this situation stand out most to you?",
    "That's a great point! I'm wondering what your gut feeling tells you about this. What do you think?",
    "I find that really intriguing. What's been your experience with something like this before?"
  ]
  
  return getRandomResponse(generalResponses)
}

function getRandomResponse(responses: string[]) {
  // Avoid repeating the last few responses
  const lastResponses = conversationHistory
    .filter(h => h.role === 'assistant')
    .slice(-3)
    .map(h => h.content)
  
  const availableResponses = responses.filter(response => 
    !lastResponses.some(lastResponse => 
      response.substring(0, 20) === lastResponse.substring(0, 20)
    )
  )
  
  const responsesToUse = availableResponses.length > 0 ? availableResponses : responses
  return responsesToUse[Math.floor(Math.random() * responsesToUse.length)]
}

function generateAdvancedFallbackResponse(userEmotion?: string, userMessage?: string) {
  const message = userMessage?.toLowerCase() || ''
  
  // Try to respond to specific content in the user's message
  if (message.includes('good') || message.includes('great') || message.includes('wonderful')) {
    return "That's wonderful to hear! I'm so glad things are going well for you. What's been the best part of your day?"
  }
  
  if (message.includes('not') && (message.includes('good') || message.includes('well'))) {
    return "I'm sorry to hear you're not feeling your best. Would you like to talk about what's been bothering you? I'm here to listen."
  }
  
  const responses = {
    happy: "I love hearing the joy in your voice! What's been making you feel so happy today? I'd love to hear more about it.",
    sad: "I can sense you might be feeling a bit down. I'm here for you. Would you like to share what's on your mind?",
    anxious: "I notice you might be feeling anxious. Take a moment to breathe. What's been worrying you lately? Sometimes talking helps.",
    excited: "Your excitement is wonderful! I can feel your positive energy. Tell me more about what has you so enthusiastic!",
    neutral: "I'm really glad we're having this conversation. What's been on your mind today? I'd love to hear your thoughts.",
  }

  return responses[userEmotion as keyof typeof responses] || 
         "That's really interesting. I'd love to hear more about your thoughts on that. What do you think about the situation?"
}

export async function detectEmotionFromText(text: string) {
  try {
    // Try Hugging Face emotion detection with authentication
    if (HUGGINGFACE_TOKEN && HUGGINGFACE_TOKEN.startsWith('hf_')) {
      console.log('🎭 Using Hugging Face emotion detection')
      
      const response = await fetch(`${HUGGINGFACE_API_URL}/j-hartmann/emotion-english-distilroberta-base`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const topEmotion = result[0]?.[0]
        
        return {
          emotion: topEmotion?.label?.toLowerCase() || 'neutral',
          confidence: topEmotion?.score || 0.5,
        }
      } else {
        console.log('Emotion detection API error:', response.status)
      }
    } else {
      console.log('🔧 Hugging Face token not configured for emotion detection')
    }
  } catch (error) {
    console.log('Emotion detection API not available, using enhanced fallback')
  }

  // Enhanced fallback emotion detection
  return detectEmotionFallback(text)
}

function detectEmotionFallback(text: string) {
  const lowerText = text.toLowerCase()
  
  const emotionPatterns = {
    happy: {
      keywords: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'fantastic', 'excellent', 'good', 'pleased', 'delighted', 'cheerful', 'glad'],
      weight: 0.8
    },
    sad: {
      keywords: ['sad', 'down', 'depressed', 'upset', 'crying', 'lonely', 'hurt', 'disappointed', 'miserable', 'blue', 'heartbroken', 'grief'],
      weight: 0.8
    },
    anxious: {
      keywords: ['worried', 'nervous', 'anxious', 'scared', 'afraid', 'stress', 'concerned', 'uneasy', 'tense', 'overwhelmed', 'panic', 'fear'],
      weight: 0.8
    },
    angry: {
      keywords: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'irritated', 'outraged', 'livid', 'rage', 'upset'],
      weight: 0.8
    },
    excited: {
      keywords: ['excited', 'thrilled', 'enthusiastic', 'eager', 'pumped', 'energetic', 'elated', 'ecstatic', 'overjoyed'],
      weight: 0.8
    }
  }

  let bestMatch = { emotion: 'neutral', confidence: 0.5 }
  
  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    const matches = pattern.keywords.filter(keyword => lowerText.includes(keyword))
    if (matches.length > 0) {
      const confidence = Math.min(0.9, 0.6 + (matches.length * 0.1))
      if (confidence > bestMatch.confidence) {
        bestMatch = { emotion, confidence }
      }
    }
  }

  return bestMatch
}

function extractRecentTopics(history: Array<{role: string, content: string}>) {
  const topics = new Set<string>()
  const topicKeywords = {
    family: ['family', 'children', 'grandchildren', 'spouse', 'husband', 'wife', 'son', 'daughter'],
    health: ['health', 'doctor', 'medicine', 'pain', 'feeling', 'tired', 'sick', 'appointment'],
    activities: ['reading', 'walking', 'cooking', 'gardening', 'watching', 'hobby', 'exercise'],
    emotions: ['happy', 'sad', 'worried', 'excited', 'angry', 'lonely', 'content'],
    weather: ['weather', 'sunny', 'rain', 'cold', 'hot', 'snow', 'wind'],
    food: ['food', 'eat', 'meal', 'cooking', 'dinner', 'lunch', 'breakfast', 'pizza'],
    memories: ['remember', 'memory', 'past', 'years ago', 'childhood', 'young']
  }
  
  // Look at recent user messages
  const recentMessages = history.filter(msg => msg.role === 'user').slice(-5)
  
  recentMessages.forEach(msg => {
    const text = msg.content.toLowerCase()
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        topics.add(topic)
      }
    })
  })
  
  return Array.from(topics)
}

// Reset conversation history (useful for new sessions)
export function resetConversationHistory() {
  conversationHistory = []
  userPersonality = {}
}

// Get conversation summary
export function getConversationSummary() {
  return {
    messageCount: conversationHistory.length,
    topics: extractRecentTopics(conversationHistory),
    mood: extractOverallMood(conversationHistory)
  }
}

function extractOverallMood(history: Array<{role: string, content: string, emotion?: string}>) {
  // Analyze recent user messages for overall mood
  const userMessages = history.filter(msg => msg.role === 'user').slice(-5)
  if (userMessages.length === 0) return 'neutral'
  
  const moodScores = { positive: 0, negative: 0, neutral: 0 }
  
  userMessages.forEach(msg => {
    const emotion = msg.emotion || detectEmotionFallback(msg.content).emotion
    if (['happy', 'excited'].includes(emotion)) {
      moodScores.positive += 1
    } else if (['sad', 'angry', 'anxious'].includes(emotion)) {
      moodScores.negative += 1
    } else {
      moodScores.neutral += 1
    }
  })
  
  const maxScore = Math.max(moodScores.positive, moodScores.negative, moodScores.neutral)
  if (maxScore === moodScores.positive) return 'positive'
  if (maxScore === moodScores.negative) return 'negative'
  return 'neutral'
}