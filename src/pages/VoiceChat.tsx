import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Brain, 
  Heart,
  ArrowLeft,
  Settings,
  Phone,
  PhoneOff,
  MessageSquare,
  User,
  Video,
  RotateCcw
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth-provider'
import { generateAIResponse, detectEmotionFromText, resetConversationHistory } from '../lib/ai-models'
import { getFacts, storeFact } from '../lib/memory'
import { Switch } from '../components/ui/switch'

import { speak as generateSpeech } from '../lib/elevenspeak'
import { saveConversationSession } from '../lib/conversation-history'
import { triggerAchievementEvent } from '../lib/achievements'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { getRandomNudge } from '../lib/nudgeScheduler'


export default function VoiceChat() {
  const { user } = useAuth()
  const userId = user?.id

  const [audioMessages, setAudioMessages] = useState<any[]>([])
  const [shareMoodUpdates, setShareMoodUpdates] = useState(true);
  const [logVoiceNotes, setLogVoiceNotes] = useState(true);
  
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [currentEmotion, setCurrentEmotion] = useState('happy')
  const [viewMode, setViewMode] = useState<'chat' | 'call'>('chat')
  const [conversation, setConversation] = useState([
    { 
      id: 1, 
      speaker: 'ai', 
      message: "Hello! I'm so glad to see you today. How are you feeling this morning?", 
      timestamp: new Date(Date.now() - 30000),
      emotion: 'happy'
    },
  ])
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [callDuration, setCallDuration] = useState(0)
  const [ttsAvailable, setTtsAvailable] = useState(true)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const [conversationActive, setConversationActive] = useState(false)
  const [autoListenEnabled, setAutoListenEnabled] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const recognitionRef = useRef<any>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const autoListenTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const manuallyStoppedRef = useRef(false) // Track if recognition was manually stopped
  const [largeText, setLargeText] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])
  useEffect(() => {
    const enableAudio = () => {
      const audio = document.createElement('audio')
      audio.src = ''
      document.body.appendChild(audio)
      audio.play().catch(() => {})
      document.body.removeEventListener('click', enableAudio)
    }
    document.body.addEventListener('click', enableAudio, { once: true })
  }, [])
  
  useEffect(() => {
    // Call duration timer
    let interval: NodeJS.Timeout
    if (viewMode === 'call' && conversationActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else if (viewMode === 'chat') {
      setCallDuration(0)
    }
    return () => clearInterval(interval)
  }, [viewMode, conversationActive])
  

  const maybeSendNudge = () => {
    const nudges = [
      "Have you had a glass of water recently?",
      "Let’s do a quick 3-minute breathing exercise.",
      "How about a gentle stretch?",
      "Want to play a memory game together?",
    ]
    if (Math.random() < 0.4) {
      const rawNudge = nudges[Math.floor(Math.random() * nudges.length)]
      const nudge =
        typeof rawNudge === 'string'
          ? rawNudge
          : rawNudge.message || JSON.stringify(rawNudge)

      speak(nudge, voiceId)
      addMessage({ speaker: 'ai', message: nudge })

    }
  }
  
  useEffect(() => {
    if (conversation.length === 0) {
      const now = new Date();
      const hours = now.getHours();
      const greeting = hours < 12 ? "Good morning!" : hours < 18 ? "Good afternoon!" : "Good evening!";
  
      // ONLY add a message to conversation, don't trigger full TTS/AI response
      addMessage({
        speaker: 'ai',
        message: `${greeting} I'm so glad to see you today. How are you feeling?`,
        timestamp: new Date().toString(),
        emotion: 'neutral',
        id: `ai-${Date.now()}`
      })
    }
  }, [])
  
  useEffect(() => {
    if (!user) return;
  
    const fetchAudioMessages = async () => {
      const { data, error } = await supabase
        .from('audio_messages')
        .select('*')
        .eq('user_id', user.id);
  
      if (error) {
        console.error('Error fetching audio messages:', error);
        return;
      }
  
      if (data) {
        setAudioMessages(data);
      }
    };
  
    fetchAudioMessages();
  }, [user]);
  

  useEffect(() => {
    // Initialize speech recognition with enhanced settings
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event: any) => {
        // Only process if we're not currently speaking (prevent feedback loop)
        if (isSpeaking || isProcessingAudio) {
          console.log('🔇 Ignoring speech recognition while AI is speaking')
          return
        }

        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        // Show interim results
        if (interimTranscript) {
          setTranscript(interimTranscript)
        }
        
        if (finalTranscript && finalTranscript.trim().length > 2) {
          console.log('🎤 Final transcript received:', finalTranscript)
          setTranscript(finalTranscript)
          handleUserMessage(finalTranscript)
        }
      }
      
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        
        // Only show error toast for serious errors, not transient ones
        if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'network') {
          toast.error('Speech recognition error. Please try again.')
        } else {
          console.log('Transient speech recognition error (will auto-retry):', event.error)
        }
      }

      recognitionRef.current.onend = () => {
        console.log('🎤 Speech recognition ended, manually stopped:', manuallyStoppedRef.current)
        setIsListening(false)
        
        // Only auto-restart if it wasn't manually stopped and conversation is active
        if (!manuallyStoppedRef.current && conversationActive && autoListenEnabled && !isSpeaking && !isProcessingAudio) {
          console.log('🔄 Auto-restarting speech recognition...')
          autoListenTimeoutRef.current = setTimeout(() => {
            if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
              startListening()
            }
          }, 2000) // Wait 2 seconds before auto-restarting
        }
        
        // Reset the manual stop flag after handling
        manuallyStoppedRef.current = false
      }

      recognitionRef.current.onstart = () => {
        console.log('🎤 Speech recognition started')
        setIsListening(true)
        manuallyStoppedRef.current = false // Reset flag when starting
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          manuallyStoppedRef.current = true
          recognitionRef.current.stop()
        } catch (error) {
          console.log('Error stopping recognition on cleanup:', error)
        }
      }
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current)
      }
    }
  }, [isSpeaking, isProcessingAudio, conversationActive, autoListenEnabled])

  useEffect(() => {
    // Smooth audio level animation when listening
    let interval: NodeJS.Timeout
    if (isListening && !isSpeaking) {
      interval = setInterval(() => {
        // More natural audio level simulation
        const baseLevel = 20 + Math.random() * 30
        const spike = Math.random() > 0.7 ? Math.random() * 40 : 0
        setAudioLevel(Math.min(100, baseLevel + spike))
      }, 150)
    } else {
      setAudioLevel(0)
    }
    return () => clearInterval(interval)
  }, [isListening, isSpeaking])

  // Audio feedback prevention: Stop listening when AI starts speaking
  useEffect(() => {
    if (isSpeaking && isListening) {
      console.log('🔇 Stopping speech recognition - AI is speaking')
      stopListening()
    }
  }, [isSpeaking, isListening])
  // Helper to add messages to conversation
const addMessage = (msg) => {
  setConversation(prev => [...prev, {
    ...msg,
    id: prev.length + 1,
    timestamp: new Date(),
    emotion: msg.emotion || 'neutral'
  }])
}

// Default ElevenLabs voice ID fallback
const voiceId = 'pNInz6obpgDQGcFmaJgB'

// Wrapper for TTS call
const speak = async (text: string, voice: string = voiceId) => {
  console.log("🗣️ Speaking:", text)
  try {
    await generateSpeech(text, voice, speechRate)

  } catch (err) {
    console.error("TTS failed:", err)
  }
}


  const startListening = async () => {
    if (isSpeaking || isProcessingAudio) {
      return
    }

    if (recognitionRef.current) {
      try {
        console.log('🎤 Starting speech recognition')
        
        // Request microphone access with echo cancellation
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100
            }
          })
          microphoneStreamRef.current = stream
          console.log('🎤 Microphone access granted with echo cancellation')
        } catch (micError) {
          console.warn('Could not get enhanced microphone access:', micError)
        }

        // Always attempt to start - let the browser handle any 'already started' states
        recognitionRef.current.start()
        setTranscript('')
      } catch (error) {
        console.error('Failed to start speech recognition:', error)
        setIsListening(false)
        
        // Only show error for non-transient issues
        if (error instanceof Error && !error.message.includes('already started')) {
          toast.error('Failed to start listening. Please try again.')
        }
      }
    } else {
      toast.error('Speech recognition not supported in this browser')
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && (isListening || recognitionRef.current.recognizing)) {
      console.log('🛑 Manually stopping speech recognition')
      manuallyStoppedRef.current = true // Set flag before stopping
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.log('Error stopping recognition:', error)
      }
      setIsListening(false)
    }
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current)
    }
  }

  const toggleListening = async () => {
    // Prevent listening while AI is speaking
    if (isSpeaking || isProcessingAudio) {
      toast.info('Please wait for AI to finish speaking')
      return
    }

    if (isListening || (recognitionRef.current && recognitionRef.current.recognizing)) {
      stopListening()
    } else {
      await startListening()
    }
  }

  const startConversation = async () => {
    setConversationActive(true)
    setCallDuration(0)
    manuallyStoppedRef.current = false // Reset flag when starting conversation
    toast.success('Conversation started! I\'m listening...')
    
    // Start listening immediately
    if (!isListening && !isSpeaking && !isProcessingAudio) {
      await startListening()
    }
  }

  const endConversation = async () => {
    setConversationActive(false)
    manuallyStoppedRef.current = true // Set flag to prevent auto-restart
    stopListening()
    
    // Save conversation to database
    if (user && conversation.length > 1) {
      try {
        await saveConversationSession(
          user.id,
          'voice',
          conversation.map(msg => ({
            id: msg.id,
            speaker: msg.speaker,
            message: msg.message,
            timestamp: msg.timestamp.toISOString(),
            emotion: msg.emotion
          })),
          callDuration
        )
        
        // Trigger achievement
        await triggerAchievementEvent(user.id, 'conversation_completed')
        
        console.log('✅ Conversation saved to history')
      } catch (error) {
        console.error('Error saving conversation:', error)
      }
    }
    
    setCallDuration(0)
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current)
    }
    toast.success('Conversation ended and saved to history')
  }

  const resetChat = () => {
    setConversation([
      { 
        id: 1, 
        speaker: 'ai', 
        message: "Hello! I'm so glad to see you today. How are you feeling this morning?", 
        timestamp: new Date(),
        emotion: 'happy'
      },
    ])
    resetConversationHistory()
    setCurrentEmotion('happy')
    manuallyStoppedRef.current = false // Reset flag when resetting chat
    toast.success('Conversation reset')
  }
  
  const handleUserMessage = async (message: string) => {
    if (!message.trim() || isSpeaking || isProcessingAudio) return

    console.log('Processing user message:', message)
    maybeSendNudge()
    
    setIsProcessingAudio(true)
    const preEmotion = await detectEmotionFromText(message)
    if (preEmotion.emotion === 'sad' || preEmotion.emotion === 'anxious') {
      setTimeout(() => {
        handleUserMessage("Would you like to do a quick memory game or talk to someone?")
      }, 2000)
    }

    // ✅ Memory Lane Mode
    if (message.toLowerCase().includes("memory lane")) {
      const prompt = "Tell me about your wedding day."
      await speak(prompt, voiceId)
      addMessage({ speaker: 'ai', message: prompt })
      await supabase.from('memory_lane').insert({
        user_id: user.id,
        prompt,
        response: '', // we'll update this after the user replies
        timestamp: new Date()
      })
    }
    // 🆘 Emergency command detection
    if (/call for help|i don’t feel well/i.test(message.toLowerCase())) {
      await supabase.from('alerts').insert({
        user_id: user.id,
        message,  
        timestamp: new Date()
      })
      await speak("I’ve alerted your emergency contact. Help is on the way.", voiceId)
      addMessage({ speaker: 'ai', message: "I’ve alerted your emergency contact. Help is on the way." })
      return
    }

    // Stop listening immediately to prevent feedback
    stopListening()
    if (message.toLowerCase().includes("my name is")) {
      const name = message.toLowerCase().split("my name is")[1]?.trim().split(" ")[0]
      if (name) await storeFact(user.id, 'name', name)
    }
    
    // Reset transcript for next message
    const facts = await getFacts(userId);
    const systemPrompt = `Respond kindly. Their name is ${facts.name || 'friend'}. They take ${facts.meds || 'no known medications'}.`;
    
    // Add user message to conversation
    const userMessage = {
      id: conversation.length + 1,
      speaker: 'user' as const,
      message: message.trim(),
      timestamp: new Date(),
      emotion: 'neutral'
    }
    setConversation(prev => [...prev, userMessage])
    // Emergency command detection
  if (/call for help|i don’t feel well/i.test(message.toLowerCase())) {
    await supabase.from('alerts').insert({
      user_id: user.id,
      message,  
      timestamp: new Date()
    })
    await speak("I’ve alerted your emergency contact. Help is on the way.", voiceId)
    addMessage({ speaker: 'ai', message: "I’ve alerted your emergency contact. Help is on the way." })
    return
  }



    try {
      // Detect emotion from text
      const emotionResult = await detectEmotionFromText(message)
      setCurrentEmotion(emotionResult.emotion)
      // 🧠 Mood Logging
      await supabase.from('mood_logs').insert([{
        user_id: user.id,
        emotion: emotionResult.emotion || 'neutral',
        confidence: emotionResult.confidence || 0.5,
        transcript: message,
        timestamp: new Date().toISOString()
      }])
      

      console.log('Detected emotion:', emotionResult)

      // Generate AI response with conversation context
      console.log('Generating AI response...')
      const aiResponse = await generateAIResponse([{ role: 'user', content: message }], emotionResult.emotion)
      console.log('AI response generated:', aiResponse)

      // Add AI response to conversation
      const aiMessage = {
        id: conversation.length + 2,
        speaker: 'ai' as const,
        message: aiResponse,
        timestamp: new Date(),
        emotion: 'caring'
      }
      setConversation(prev => [...prev, aiMessage])

      // Generate speech if audio is enabled and TTS is available
      if (isAudioEnabled && ttsAvailable) {
        console.log('🔊 Generating speech for:', aiResponse.substring(0, 50) + '...')
        setIsSpeaking(true)
        
        try {
          if (isSpeaking) {
            console.warn("TTS in progress, skipping new request");
            return;
          }
          setIsSpeaking(true)
          
          const audioBlob = await generateSpeech(aiResponse)
          
          if (audioBlob && audioBlob !== 'web-speech-api' && audioRef.current) {
            console.log('🔊 Playing ElevenLabs generated speech')
            const audioUrl = URL.createObjectURL(audioBlob)
            audioRef.current.src = audioUrl
            audioRef.current.volume = 0.7 // Reduce volume to prevent feedback
            
            audioRef.current.onended = () => {
              setTimeout(() => setIsSpeaking(false), 2000)

              maybeSendNudge()

              setIsProcessingAudio(false)
              console.log('🔊 Speech playback ended')
              URL.revokeObjectURL(audioUrl)
              
              // Auto-restart listening if conversation is active
              if (conversationActive && autoListenEnabled) {
                setTimeout(() => {
                  if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
                    startListening()
                  }
                }, 1500) // Wait 1.5 seconds before restarting
              }
            }
            
            audioRef.current.onerror = (error) => {
              console.error('Audio playback error:', error)
              setTimeout(() => setIsSpeaking(false), 2000)

              setIsProcessingAudio(false)
              toast.error('Audio playback failed')
            }
            
            await audioRef.current.play()
          } else if (audioBlob === 'web-speech-api') {
            console.log('🔊 Using Web Speech API (browser TTS)')
            // Web Speech API handles its own timing
            setTimeout(() => {
              setTimeout(() => setIsSpeaking(false), 2000)

              setIsProcessingAudio(false)
              
              // Auto-restart listening if conversation is active
              if (conversationActive && autoListenEnabled) {
                setTimeout(() => {
                  if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
                    startListening()
                  }
                }, 1500)
              }
            }, aiResponse.length * 50) // Estimate speech duration
          } else {
            console.log('❌ No audio generated, TTS not available')
            setTtsAvailable(false)
            setTimeout(() => setIsSpeaking(false), 2000)

            setIsProcessingAudio(false)
            
            // Auto-restart listening even without TTS
            if (conversationActive && autoListenEnabled) {
              setTimeout(() => {
                if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
                  startListening()
                }
              }, 1000)
            }
          }
        } catch (error) {
          console.error('TTS error:', error)
          setTtsAvailable(false)
          setTimeout(() => setIsSpeaking(false), 2000)

          setIsProcessingAudio(false)
          
          // Auto-restart listening even after TTS error
          if (conversationActive && autoListenEnabled) {
            setTimeout(() => {
              if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
                startListening()
              }
            }, 1000)
          }
        }
      } else {
        setIsProcessingAudio(false)
        
        // Auto-restart listening even without audio
        if (conversationActive && autoListenEnabled) {
          setTimeout(() => {
            if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
              startListening()
            }
          }, 1000)
        }
      }

      // Save conversation data to Supabase (with error handling)
      if (user) {
        try {
          // Save voice session
          const { error: sessionError } = await supabase.from('voice_sessions').insert([
            {
              user_id: user.id,
              session_id: `voice_${Date.now()}`,
              transcript: JSON.stringify([userMessage, aiMessage]),
              status: 'active'
            }
          ])

          if (sessionError) {
            console.log('Could not save voice session:', sessionError.message)
          }

          // Try to save emotion data if the table exists
          try {
            const { error: emotionError } = await supabase.from('emotion_logs').insert([
              {
                user_id: user.id,
                emotion: emotionResult.emotion,
                confidence: emotionResult.confidence,
                source: 'voice',
                context: { message },
              }
            ])

            if (emotionError) {
              console.log('Could not save emotion log:', emotionError.message)
            }
          } catch (emotionSaveError: any) {
            console.log('Emotion logs save error (table may not exist):', emotionSaveError)
          }

        } catch (error) {
          console.log('Database save error:', error)
        }
      }
    } catch (error) {
      console.error('Error processing message:', error)
      toast.error('Failed to process your message. Please try again.')
      setTimeout(() => setIsSpeaking(false), 2000)

      setIsProcessingAudio(false)
      
      // Auto-restart listening even after error
      if (conversationActive && autoListenEnabled) {
        setTimeout(() => {
          if (!isSpeaking && !isProcessingAudio && conversationActive && !manuallyStoppedRef.current) {
            startListening()
          }
        }, 2000)
      }
    }
  }
  

  
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  if (viewMode === 'call') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
        {/* Call Header */}
        <div className="text-center text-white pt-16 pb-8">
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl"
          >
            <Heart className="w-16 h-16 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold mb-2">EchoCare AI</h1>
          <p className="text-lg opacity-80 mb-2">Voice Companion</p>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${
              currentEmotion === 'happy' ? 'bg-green-400' :
              currentEmotion === 'sad' ? 'bg-blue-400' :
              currentEmotion === 'anxious' ? 'bg-orange-400' :
              'bg-gray-400'
            } animate-pulse`} />
            <span className="text-sm capitalize">{currentEmotion}</span>
          </div>
          <p className="text-2xl font-mono">{formatCallDuration(callDuration)}</p>
          {conversationActive && (
            <Badge className="bg-green-600 text-white mt-2">
              Conversation Active
            </Badge>
          )}
          {isSpeaking && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-blue-300 mt-2"
            >
              AI is speaking...
            </motion.p>
          )}
          {isListening && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-green-300 mt-2"
            >
              Listening...
            </motion.p>
          )}
          {!ttsAvailable && (
            <p className="text-yellow-300 text-sm mt-2">
              Text-to-speech unavailable
            </p>
          )}
        </div>

        {/* Audio Visualization */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 bg-white rounded-full"
                animate={{
                  height: isListening || isSpeaking ? [20, 40 + (audioLevel / 5), 20] : 20,
                  opacity: isListening || isSpeaking ? [0.4, 0.9, 0.4] : 0.3
                }}
                transition={{
                  duration: 0.8,
                  repeat: isListening || isSpeaking ? Infinity : 0,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>

        {/* Call Controls */}
        <div className="pb-16">
          <div className="flex items-center justify-center space-x-8 mb-8">
            <Button
              size="lg"
              variant={isAudioEnabled ? "default" : "secondary"}
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 transition-all duration-200"
              title={ttsAvailable ? (isAudioEnabled ? "Disable audio" : "Enable audio") : "Audio unavailable"}
            >
              {isAudioEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </Button>

            <motion.div className="relative">
              <motion.button
                onClick={conversationActive ? endConversation : startConversation}
                className={`w-20 h-20 rounded-full transition-all duration-200 shadow-lg ${
                  conversationActive 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } text-white flex items-center justify-center`}
                whileTap={{ scale: 0.95 }}
              >
                {conversationActive ? <PhoneOff className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
              </motion.button>
              
              {/* Audio level indicator for active conversation */}
              {isListening && conversationActive && (
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-green-400"
                  animate={{ 
                    scale: [1, 1 + (audioLevel / 300), 1],
                    opacity: [0.6, 0.9, 0.6]
                  }}
                  transition={{ 
                    duration: 0.8,
                    ease: "easeInOut",
                    repeat: Infinity
                  }}
                />
              )}
            </motion.div>

            <Button
              size="lg"
              onClick={() => setViewMode('chat')}
              className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 transition-all duration-200"
            >
              <MessageSquare className="w-6 h-6" />
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-4">
            <Button
              size="lg"
              onClick={resetChat}
              className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700 transition-all duration-200"
            >
              <RotateCcw className="w-6 h-6" />
            </Button>
            
            <Link to="/dashboard">
              <Button
                size="lg"
                variant="outline"
                className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 border-gray-500 text-white transition-all duration-200"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
          </div>

          {transcript && (
            <div className="text-center mt-4 px-6">
              <p className="text-white text-sm opacity-80">
                "{transcript}"
              </p>
            </div>
          )}
          
          <div className="text-center mt-4 px-6">
            <p className="text-white text-xs opacity-60">
              {conversationActive 
                ? 'Continuous conversation mode - I\'ll keep listening after each response'
                : 'Tap the green button to start a continuous conversation'
              }
            </p>
          </div>
        </div>

        {/* Hidden audio element for TTS */}
        <audio ref={audioRef} className="hidden" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${largeText ? 'text-lg' : 'text-base'}`}>

      {/* Header - Fixed positioning with higher z-index */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b border-gray-700/50 px-6 py-4 mb-6 bg-gray-900/95 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">EchoCare AI Companion</h1>
              <p className="text-sm text-gray-400">
                {conversationActive ? 'Continuous conversation active' : 'Voice conversation ready'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                currentEmotion === 'happy' ? 'bg-green-400' :
                currentEmotion === 'sad' ? 'bg-blue-400' :
                currentEmotion === 'anxious' ? 'bg-orange-400' :
                'bg-gray-400'
              } animate-pulse`} />
              <span className="text-sm capitalize text-gray-300">{currentEmotion}</span>
            </div>
            {conversationActive && (
              <Badge variant="default" className="bg-green-900/50 text-green-300 border-green-700">
                <Brain className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
            
            {isListening && (
              <Badge variant="default" className="bg-blue-900/50 text-blue-300 border-blue-700">
                Listening
              </Badge>
            )}
            {!ttsAvailable && (
              <Badge variant="secondary" className="bg-yellow-900/50 text-yellow-300 border-yellow-700">
                TTS Unavailable
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setViewMode('call')}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetChat}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <Settings className="w-4 h-4" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Large Text Mode</span>
                <Switch 
                  checked={largeText}
                  onCheckedChange={setLargeText}
                />
              </div>

            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Container - Fixed height and proper containment */}
      <div className="px-6 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
            {/* Chat Area - Fixed width and height with proper overflow */}
            <div className="flex-1 lg:max-w-4xl">
            <Card className="glass-card shadow-lg border border-gray-700 bg-gray-800/50">
            
          </Card>

              <Card className="glass-card h-full flex flex-col shadow-lg border border-gray-700 overflow-hidden bg-gray-800/50">
                <CardHeader className="border-b border-gray-700 bg-gray-800/50 rounded-t-lg flex-shrink-0">
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">Conversation</span>
                    <div className="flex items-center space-x-2">
                      {isSpeaking && (
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                          className="flex items-center text-blue-400"
                        >
                          <Volume2 className="w-4 h-4 mr-1" />
                          <span className="text-sm">AI Speaking...</span>
                        </motion.div>
                      )}
                      {conversationActive && (
                        <Badge variant="default" className="bg-green-900/50 text-green-300 border-green-700 text-xs">
                          Continuous Mode
                        </Badge>
                      )}
                      {!ttsAvailable && (
                        <Badge variant="secondary" className="bg-yellow-900/50 text-yellow-300 border-yellow-700 text-xs">
                          Text-only mode
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  {/* Messages Container - Proper scrolling with fixed height */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/30 min-h-0">
                    <AnimatePresence>
                      {conversation.map((message, messageIndex) => (

                        <motion.div
                          key={`${message.speaker}-${message.timestamp}-${messageIndex}`}

                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex w-full ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] flex items-start space-x-3 ${
                            message.speaker === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                          }`}>
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                              {message.speaker === 'ai' ? (
                                <Heart className="w-4 h-4 text-white" />
                              ) : (
                                <span className="text-white text-xs font-bold">{userInitial}</span>
                              )}
                            </div>
                            {/* Message Bubble - Constrained width and proper word wrapping */}
                            <div className={`rounded-2xl px-4 py-3 shadow-sm break-words ${
                              message.speaker === 'user' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-700 border border-gray-600 text-white'
                            }`}>
                              <p className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                                {typeof message.message === 'string'
                                  ? message.message
                                  : JSON.stringify(message.message)}
                              </p>

                              <div className="flex items-center mt-2 space-x-2">
                                <span className={`text-xs ${
                                  message.speaker === 'user' ? 'text-blue-100' : 'text-gray-400'
                                }`}>
                                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${
                                  message.emotion === 'happy' ? 'bg-green-400' :
                                  message.emotion === 'sad' ? 'bg-blue-400' :
                                  message.emotion === 'caring' ? 'bg-purple-400' :
                                  'bg-gray-400'
                                }`} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                  </div>

                  {/* Voice Controls - Fixed at bottom */}
                  <div className="border-t border-gray-700 bg-gray-800/80 p-4 rounded-b-lg flex-shrink-0">
                    <div className="flex items-center justify-center space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                        disabled={!ttsAvailable}
                        title={ttsAvailable ? (isAudioEnabled ? "Disable audio" : "Enable audio") : "Audio unavailable"}
                        className="w-12 h-12 rounded-full border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </Button>
                      
                      <motion.div className="relative">
                        <motion.button
                          onClick={conversationActive ? endConversation : startConversation}
                          className={`w-16 h-16 rounded-full transition-all duration-200 shadow-lg ${
                            conversationActive 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          } text-white flex items-center justify-center`}
                          whileTap={{ scale: 0.95 }}
                        >
                          {conversationActive ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                        </motion.button>
                        
                        {/* Audio level indicator for active conversation */}
                        {isListening && conversationActive && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-4 border-green-400"
                            animate={{ 
                              scale: [1, 1 + (audioLevel / 300), 1],
                              opacity: [0.6, 0.9, 0.6]
                            }}
                            transition={{ 
                              duration: 0.8,
                              ease: "easeInOut",
                              repeat: Infinity
                            }}
                          />
                        )}
                      </motion.div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleListening}
                        disabled={!conversationActive || isSpeaking || isProcessingAudio}
                        title="Manual listen toggle (only works when conversation is active)"
                        className="w-12 h-12 rounded-full border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode('call')}
                        className="w-12 h-12 rounded-full border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="text-center mt-3">
                      <p className="text-sm text-gray-400">
                        {conversationActive
                          ? isSpeaking || isProcessingAudio
                            ? 'AI is responding... please wait'
                            : isListening 
                            ? 'Listening... Speak naturally' 
                            : 'Continuous conversation active - I\'ll restart listening automatically'
                          : 'Tap the green phone button to start a continuous conversation'
                        }
                      </p>
                      {transcript && (
                        <p className="text-xs text-blue-400 mt-1">
                          {isListening ? `Hearing: "${transcript}"` : `Last heard: "${transcript}"`}
                        </p>
                      )}
                      {!ttsAvailable && (
                        <p className="text-xs text-yellow-400 mt-1">
                          Text-to-speech unavailable. Visit <Link to="/setup-database" className="underline">Setup Database</Link> to check API configuration.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {audioMessages.length > 0 && (
              <div className="mt-4 p-4 bg-gray-800 border border-gray-600 rounded-lg text-white">
                <h3 className="text-lg font-semibold mb-2">Messages from Loved Ones</h3>
                {audioMessages.map(msg => (
                  <div key={msg.id} className="mb-3">
                    <p className="text-sm">{msg.from} sent a message:</p>
                    <audio controls className="mt-1 w-full">
                      <source src={`https://your-supabase-url.supabase.co/storage/v1/object/public/audio-messages/${msg.audio_url}`} />
                    </audio>
                  </div>
                ))}
              </div>
            )}

            {/* Sidebar - Fixed width and proper containment */}
            <div className="w-full lg:w-80 lg:flex-shrink-0 space-y-6 overflow-y-auto">
              {/* Conversation Insights */}
              <Card className="glass-card shadow-lg border border-gray-700 bg-gray-800/50">
                <CardHeader className="border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
                  <CardTitle className="flex items-center text-lg text-white">
                    <Brain className="w-5 h-5 mr-2 text-purple-400" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Emotional State</span>
                    <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
                      {currentEmotion}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Conversation Mode</span>
                    <span className="text-sm font-medium text-white">
                      {conversationActive ? 'Continuous' : 'Manual'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Messages</span>
                    <span className="text-sm font-medium text-white">{conversation.length}</span>
                  </div>
                  <div className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                    <p>
                      {conversationActive 
                        ? 'Continuous conversation mode is active. The AI will keep listening after each response for natural flow.'
                        : 'Start a conversation to enable continuous chat mode for natural back-and-forth dialogue.'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Health Monitoring */}
              <Card className="glass-card shadow-lg border border-gray-700 bg-gray-800/50">
                <CardHeader className="border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
                  <CardTitle className="flex items-center text-lg text-white">
                    <Heart className="w-5 h-5 mr-2 text-red-400" />
                    Health Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Heart Rate</span>
                    <span className="text-sm font-medium text-green-400">Normal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Stress Level</span>
                    <span className="text-sm font-medium text-green-400">Low</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Voice Pattern</span>
                    <span className="text-sm font-medium text-blue-400">Stable</span>
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                    All vitals within normal range during conversation
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="glass-card shadow-lg border border-gray-700 bg-gray-800/50">
                <CardHeader className="border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
                  <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-gray-600 text-gray-300 hover:bg-gray-700"
                    onClick={resetChat}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset Conversation
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-gray-600 text-gray-300 hover:bg-gray-700"
                    onClick={() => {
                      const rawNudge = getRandomNudge()
                      const nudge =
                        typeof rawNudge === 'string'
                          ? rawNudge
                          : rawNudge.message || JSON.stringify(rawNudge)

                      speak(nudge, voiceId)
                      addMessage({ speaker: 'ai', message: nudge })

                    }}
                  >
                    💡 Send Nudge
                  </Button>
                  <div>
                  <span className="text-sm text-gray-300">Speech Speed</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speechRate}
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
                <CardHeader className="border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
              <CardTitle className="text-lg text-white">Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Share Mood Updates with Family</span>
                <Switch 
                  checked={shareMoodUpdates}
                  onCheckedChange={(value) => setShareMoodUpdates(value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Log Voice Notes</span>
                <Switch 
                  checked={logVoiceNotes}
                  onCheckedChange={(value) => setLogVoiceNotes(value)}
                />
              </div>
            </CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-gray-600 text-gray-300 hover:bg-gray-700"
                    onClick={() => setAutoListenEnabled(!autoListenEnabled)}
                  >
                    {autoListenEnabled ? 'Disable' : 'Enable'} Auto-Listen
                  </Button>
                  <Link to="/video-chat">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      <Video className="w-4 h-4 mr-2" />
                      Switch to Video Call
                    </Button>
                  </Link>
                  {!ttsAvailable && (
                    <Link to="/setup-database">
                      <Button variant="outline" className="w-full text-yellow-300 border-yellow-700 hover:bg-yellow-900/20">
                        Fix TTS Issues
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element for TTS */}
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}