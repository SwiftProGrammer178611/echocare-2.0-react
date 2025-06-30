import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../components/ui/button'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  ArrowLeft,
  MoreHorizontal,
  Maximize,
  Minimize,
  Settings,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth-provider'
import { createTavusConversation, endTavusConversation } from '../lib/tavus'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { getFacts, storeFact } from '../lib/memory'
import { analyzeSentiment } from '../lib/sentiment'
import { createSpeech } from '../lib/tavus'  

export default function VideoChat() {
  const { user } = useAuth()
  /** Settings & Preferences **/
  const [userSettings, setUserSettings] = useState({
    shareMood: true,
    logVoiceNotes: true,
    receiveFamilyMessages: true,
    memoryLaneMode: true
  })
  /** Video Call State **/
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [conversationUrl, setConversationUrl] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [lastSpokenTime, setLastSpokenTime] = useState(Date.now())

  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  // New state for loved ones audio message input and messages list
  const [familyMessages, setFamilyMessages] = useState<{ id: string; message_url: string; summary: string }[]>([])
  const [newAudioMessageUrl, setNewAudioMessageUrl] = useState('')
  const [newAudioSummary, setNewAudioSummary] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  /** Memory & Facts **/
  const [userVideoExpanded, setUserVideoExpanded] = useState(false)

  const [userFacts, setUserFacts] = useState<Record<string,string>>({})

  // Format call duration mm:ss
  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const transcriptRef = useRef<string>("")

  /** Initialize camera **/
  useEffect(() => {
    async function initCamera() {
      if (!videoRef.current) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: isAudioEnabled
        })
        streamRef.current = stream
        videoRef.current.srcObject = stream
      } catch (e) {
        console.error('Camera init failed', e)
        toast.error('Cannot access camera/audio')
        setIsVideoEnabled(false)
      }
    }
    initCamera()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [isVideoEnabled, isAudioEnabled])

  /** Call duration timer **/
  useEffect(() => {
    if (!isConnected) return
    const id = setInterval(() => setCallDuration(d => d + 1), 1000)
    return () => clearInterval(id)
  }, [isConnected])

  /** Load user facts on mount **/
  useEffect(() => {
    if (!user) return
    getFacts(user.id).then(facts => setUserFacts(facts))
  }, [user])

  /** Utility: speak via Tavus **/
  const speakMessage = (msg: string) => {
    if (!iframeRef.current?.contentWindow) {
      console.warn('No iframe window available to send message')
      return
    }
    
    const messagePayload = {
      type: 'conversation.respond',
      text: msg
    }
    
    console.log('🔊 Sending conversation.respond to Tavus iframe:', messagePayload)
    iframeRef.current.contentWindow.postMessage(messagePayload, '*')
    setLastSpokenTime(Date.now())
  }
  
  
  


  /** Save personal fact **/
  const handleSaveFact = async (label: string, value: string) => {
    await storeFact(user!.id, label, value)
    setUserFacts(prev => ({ ...prev, [label]: value }))
    const confirm = `Saved ${label}`
    await speakMessage(confirm)

    speakMessage(confirm)
  }

  /** Emergency detection **/
  const emergencyCheck = async (text: string) => {
    const t = text.toLowerCase()
    if (['call for help','i don\'t feel well','help me'].some(kw => t.includes(kw))) {
      const alertMsg = 'Emergency detected. Notifying contact.'
      await speakMessage(alertMsg)

      speakMessage(alertMsg)
      await supabase.from('alerts').insert({ user_id: user!.id, reason: text, timestamp: new Date().toISOString() })
    }
    if (text.includes("tired") || text.includes("don't feel good")) {
      await speakMessage("You sound unwell. Should I call someone for help?")
    }
    
  }

  /** Handle transcript **/
  const handleTranscript = async (text: string) => {
    transcriptRef.current = text
    let sentiment: string | null = null
  
    if (userSettings.shareMood) {
      sentiment = await analyzeSentiment(text)
      await supabase.from('mood_logs').insert({
        user_id: user!.id,
        sentiment,
        transcript: text,
        timestamp: new Date().toISOString()
      })
    }
  
    if (sentiment === 'sad') {
      await speakMessage("Would you like to hear a message from a loved one?")
    }
  
    emergencyCheck(text)
  }
  

  /** Fetch family audio messages **/
  const fetchFamilyMessages = async () => {
    if (!userSettings.receiveFamilyMessages) return
    const { data } = await supabase
      .from('audio_messages')
      .select('id,message_url,summary')
      .eq('recipient_id', user!.id)
      .order('timestamp', { ascending: false })
      .limit(5)  // Fetch last 5 messages
    if (data?.length) {
      setFamilyMessages(data)
      // Speak the latest message only
      const latestMsg = data[0].summary
      speakMessage(`New message from loved ones: ${latestMsg}`)
    }
  }
  const sendFamilyAudioMessage = async () => {
    if (!newAudioMessageUrl || !newAudioSummary) {
      toast.error('Please provide audio URL and summary')
      return
    }
    setIsSendingMessage(true)
    try {
      await supabase.from('audio_messages').insert({
        sender_id: user!.id,
        recipient_id: user!.id,  // Replace with actual recipient ID or family group ID
        message_url: newAudioMessageUrl,
        summary: newAudioSummary,
        timestamp: new Date().toISOString(),
      })
      toast.success('Message sent to loved ones')
      setNewAudioMessageUrl('')
      setNewAudioSummary('')
      fetchFamilyMessages()
    } catch (e) {
      toast.error('Failed to send message')
    } finally {
      setIsSendingMessage(false)
    }
  }
  

  /** Memory Lane prompt **/
  const promptMemoryLane = async () => {
    if (!userSettings.memoryLaneMode) return
    const memoryPrompts = [
      "What’s your favorite memory with your children?",
      "Can you tell me about your wedding day?",
      "Who was your best friend growing up?"
    ]
    const prompt = memoryPrompts[Math.floor(Math.random() * memoryPrompts.length)]
    
    await speakMessage(prompt)

    speakMessage(prompt)
    await supabase.from('memory_lane').insert({ user_id: user!.id, prompt, response: '', timestamp: new Date().toISOString() })
  }

  /** Health nudges **/
  const healthNudge = async () => {
    const opts = [
      "You’ve been sitting a while—want to do a gentle stretch?",
      "Let’s get a glass of water together.",
      "Can I tempt you with a brain game for a few minutes?"
    ]
    const msg = opts[Math.floor(Math.random() * opts.length)]
    await speakMessage(msg)
    await supabase.from('nudges').insert({ user_id: user!.id, message: msg, timestamp: new Date().toISOString() })
  }
  

  /** On iframe load **/
  const onIframeLoad = () => {
    setIframeLoaded(true)
    // auto mood logging
    handleTranscript('[Auto check-in]')
    // initial nudge and memory
    setTimeout(healthNudge,10000)
    setTimeout(promptMemoryLane,20000)
    fetchFamilyMessages()
  }

  /** Periodic tasks while connected **/
  useEffect(() => {
    if (!isConnected) return
  
    const loopId = setInterval(async () => {
      const secondsSinceLastSpeak = (Date.now() - lastSpokenTime) / 1000
  
      if (secondsSinceLastSpeak > 45) {
        // Randomly alternate between nudge/memory/proactive
        const mode = Math.random()
        if (mode < 0.33) await healthNudge()
        else if (mode < 0.66) await promptMemoryLane()
        else {
          const greetings = [
            "How are you feeling now?",
            "Still feeling okay? I’m right here.",
            "Just checking in, do you need anything?"
          ]
          await speakMessage(greetings[Math.floor(Math.random() * greetings.length)])
        }
      }
    }, 15000) // check every 15s
  
    return () => clearInterval(loopId)
  }, [isConnected])
  

  /** Start video call **/
  const startVideoCall = async () => {
    if (!user) return toast.error('Sign in required')
    setIsConnecting(true); setConnectionError(null)
    try {
      const conv = await createTavusConversation(user.id)
      if (!conv.conversation_url || !conv.conversation_id) throw new Error('Invalid')
      setConversationUrl(conv.conversation_url)
      setConversationId(conv.conversation_id)
      setIsConnected(true)
      const greet = new Date().getHours()<12?'Good morning':new Date().getHours()<18?'Good afternoon':'Good evening'
      toast.info(`${greet} ${userFacts.name||''}`)
      await supabase.from('video_conversations').insert({ user_id:user.id,tavus_conversation_id:conv.conversation_id,conversation_url:conv.conversation_url,status:'active',started_at:new Date().toISOString() })
    } catch (e:any) {
      setConnectionError(e.message)
      toast.error('Connect failed')
    } finally { setIsConnecting(false) }
  }
  // After your startVideoCall() function
async function startTextChat() {
  if (!user) return toast.error('Please sign in first')
  setIsConnecting(true)
  try {
    const conv = await createReplicaConversation({
      replica_id: 'rf4703150052',
      user_id: user.id,
      initial_message: "Hello dear, it's Echo! How are you feeling today?"
    })
    // Display or process conv.messages here...
    for (const msg of conv.messages) {
      if (msg.role === 'replica') {
        // Speak each reply
        const { speech_file_url } = await createSpeech(msg.text)
        new Audio(speech_file_url).play()
      }
    }
  } catch (e: any) {
    toast.error('Chat failed: ' + e.message)
  } finally {
    setIsConnecting(false)
  }
}


  /** Retry logic **/
  const retryConnection = () => {
    if (retryCount<3) { setRetryCount(c=>c+1); startVideoCall() }
  }

  /** End call **/
  const endCall = async () => {
    if (conversationId) {
      await endTavusConversation(conversationId)
      await supabase.from('video_conversations').update({ status:'ended',ended_at:new Date().toISOString(),duration_seconds:callDuration }).eq('tavus_conversation_id',conversationId)
    }
    setIsConnected(false)
    setConversationUrl(null)
    setConversationId(null)
    setCallDuration(0)
    toast.success('Call ended')
  }

  if (!user) return <><p>Please sign in</p></>

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Main Video Container - Full Screen */}
      <div className="relative w-full h-screen">
        {isConnected && conversationUrl ? (
          /* Connected State - Show Tavus AI with enhanced iframe */
          <div className="relative w-full h-full">
            <iframe
              ref={iframeRef}
              src={conversationUrl}
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen; autoplay; display-capture; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="EchoCare AI Video Chat - Tavus Connection"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-presentation"
              style={{ 
                border: 'none',
                borderRadius: '0px',
                overflow: 'hidden'
              }}
              onLoad={async () => {
                console.log('✅ Tavus iframe loaded successfully')
                setIframeLoaded(true)
                const welcome = "Hello dear, how are you today?"
                const { speech_file_url } = await createSpeech(welcome)
                new Audio(speech_file_url).play()

                const logMood = async () => {
                  const randomMood = ['happy', 'sad', 'anxious', 'calm'][Math.floor(Math.random() * 4)]
                  await supabase.from('mood_logs').insert({
                    user_id: user.id,
                    emotion: randomMood,
                    confidence: 0.8,
                    transcript: '[VideoChat Auto Check-In]',
                    timestamp: new Date().toISOString()
                  })
                  console.log('🧠 Logged mood:', randomMood)
                }
                
                logMood()
                
                console.log('🧠 Logged mood:', randomMood)

                setTimeout(async() => {
                  const nudges = [
                    "💧 Time for a sip of water?",
                    "🧠 Want to play a quick brain game?",
                    "🧘 How about a gentle stretch?"
                  ]
                  const randomNudge = nudges[Math.floor(Math.random() * nudges.length)]
                  const speech = await createSpeech(randomNudge)
                  new Audio(speech.speech_file_url).play()

                }, 10000)
                useEffect(() => {
                  const loadFacts = async () => {
                    console.log('🧠 Loading long-term memory facts...')
                    const facts = await getFacts(user.id)
                    console.log('🧠 Loaded facts:', facts)
                    setUserFacts(facts)
                
                    if (facts.name) {
                      await speakMessage(`Hey ${facts.name}, I remembered your name! ❤️`)
                    }
                    if (facts.grandkids) {
                      await speakMessage(`Have you talked to your grandkids lately?`)
                    }
                  }
                
                  loadFacts()
                  speakMessage('Hello, this is a test nudge')

                }, [user.id])
                
                setTimeout(async () => {
                  const facts = await getFacts(user.id)
                  console.log('🧠 Loaded long-term memory facts:', facts)
                  setUserFacts(facts)
                
                  if (facts.name) {
                    await speakMessage(`Hey ${facts.name}, I remembered your name! ❤️`)
                  }
                  if (facts.grandkids) {
                    await speakMessage(`Have you talked to your grandkids lately?`)
                  }
                }, 2000)
                

                
                
                toast.success('Tavus AI loaded - you can now start talking!')
                setTimeout(async() => {
                  const speech = await createSpeech("Tell me about your wedding day.")
                  new Audio(speech.speech_file_url).play()


                  await supabase.from('memory_lane').insert({
                    user_id: user.id,
                    prompt: "Tell me about your wedding day.",
                    response: '',
                    timestamp: new Date()
                  })
                }, 15000)
                
              }}
              onError={(e) => {
                console.error('❌ Tavus iframe error:', e)
                toast.error('Error loading Tavus AI interface')
                setConnectionError('Failed to load video interface. This may be due to browser security settings.')
              }}
            />
            
            {/* Loading overlay for iframe */}
            {!iframeLoaded && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                <div className="text-white text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"
                  />
                  <p className="text-lg mb-2">Loading Tavus AI...</p>
                  <p className="text-sm opacity-70">This may take a few moments</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Pre-call State */
          <div className="w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
            <div className="text-center text-white max-w-md mx-auto px-6">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center mx-auto mb-8 shadow-2xl"
              >
                <Video className="w-16 h-16" />
              </motion.div>
              <h2 className="text-4xl font-bold mb-4">EchoCare AI</h2>
              <p className="text-xl mb-2 opacity-80">
                Ready for video conversation
              </p>
              <p className="text-sm mb-8 opacity-60">
                Powered by Tavus AI • $150 Credit Available
              </p>
              
              {connectionError && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
                  <div className="flex items-center text-red-300 mb-2">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <span className="font-medium">Connection Error</span>
                  </div>
                  <p className="text-sm text-red-200 mb-3">{connectionError}</p>
                  <div className="flex gap-2 justify-center">
                    {retryCount < 3 && (
                      <Button
                        onClick={retryConnection}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry ({retryCount}/3)
                      </Button>
                    )}
                    <Button
                      onClick={() => window.open('https://docs.tavus.io/troubleshooting', '_blank')}
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-300 hover:bg-red-900/20"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Help
                    </Button>
                  </div>
                </div>
              )}
              
              <Button
                onClick={startVideoCall}
                disabled={isConnecting}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg rounded-full shadow-2xl disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-2"
                    />
                    Connecting to Tavus...
                  </>
                ) : (
                  'Start Video Call'
                )}
              </Button>
              
              <div className="mt-6 text-xs text-gray-400 space-y-1">
                <p>✅ $150 Tavus credit available</p>
                <p>🔑 API Key: 1b61edf8515c40c4a9c428ea43c88975</p>
                <p>🎭 Persona ID: p4c1653bd778</p>
                <p>🤖 Replica ID: rf4703150052</p>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    If connection fails, try disabling ad blockers or opening in a new tab
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Header Overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 z-20">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-white/20 rounded-full w-10 h-10 p-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">EchoCare AI</h1>
                <p className="text-sm opacity-80">
                  {isConnected ? `LIVE • ${formatCallDuration(callDuration)}` : 'Ready to connect'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-black/40 rounded-full px-3 py-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm">Happy</span>
              </div>
              {isConnected && conversationUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  
                  className="text-white hover:bg-white/20 rounded-full w-10 h-10 p-0"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 rounded-full w-10 h-10 p-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* User Video (Picture-in-Picture) */}
        {isConnected && (
          <motion.div
            drag={!userVideoExpanded}
            dragConstraints={{ 
              left: 20, 
              right: window.innerWidth - (userVideoExpanded ? 400 : 240), 
              top: 100, 
              bottom: window.innerHeight - (userVideoExpanded ? 320 : 180) 
            }}
            className={`absolute ${
              userVideoExpanded 
                ? 'bottom-32 right-8 w-96 h-72' 
                : 'bottom-32 left-8 w-56 h-40'
            } bg-gray-900 rounded-2xl overflow-hidden shadow-2xl ${
              !userVideoExpanded ? 'cursor-move' : ''
            } border-2 border-white/30 z-30`}
            whileHover={{ scale: userVideoExpanded ? 1 : 1.02 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {isVideoEnabled ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* User label */}
                <div className="absolute bottom-3 left-3 bg-black/70 rounded-lg px-2 py-1">
                  <span className="text-white text-sm font-medium">You</span>
                </div>
                {/* Controls overlay */}
                <div className="absolute top-3 right-3 flex space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20 w-8 h-8 p-0 rounded-full bg-black/40"
                    onClick={() => setUserVideoExpanded(!userVideoExpanded)}
                  >
                    {userVideoExpanded ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20 w-8 h-8 p-0 rounded-full bg-black/40"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <VideoOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <span className="text-gray-400 text-sm">Camera Off</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-8 z-20">
          <div className="flex items-center justify-center space-x-6">
            {/* Microphone Control */}
            <motion.div whileTap={{ scale: 0.95 }} className="relative">
              <Button
                size="lg"
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`w-16 h-16 rounded-full border-0 shadow-2xl ${
                  isAudioEnabled 
                    ? 'bg-gray-700/80 hover:bg-gray-600/80 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </Button>
              {/* Dropdown indicator */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-white/60" />
              </div>
            </motion.div>

            {/* Video Control */}
            <motion.div whileTap={{ scale: 0.95 }} className="relative">
              <Button
                size="lg"
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`w-16 h-16 rounded-full border-0 shadow-2xl ${
                  isVideoEnabled 
                    ? 'bg-gray-700/80 hover:bg-gray-600/80 text-white' 
                    : 'bg-gray-700/80 hover:bg-gray-600/80 text-white'
                }`}
              >
                {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </Button>
              {/* Dropdown indicator */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-white/60" />
              </div>
            </motion.div>

            {/* End Call Button */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                onClick={endCall}
                className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 border-0 shadow-2xl text-white"
              >
                <PhoneOff className="w-8 h-8" />
              </Button>
            </motion.div>
          </div>

          {/* Call Status */}
          {isConnected && (
            <div className="text-center mt-6 text-white">
              <p className="text-sm opacity-80">
                Tavus AI • HD Quality • Secure Connection • Health Monitoring Active
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-32 left-8 w-96 bg-gray-900/90 rounded-xl p-4 shadow-lg z-40 text-white">
  <h3 className="text-lg font-semibold mb-2">Loved Ones Circle</h3>

    {/* List of received messages */}
    <div className="max-h-40 overflow-y-auto mb-4">
      {familyMessages.length === 0 && <p className="text-sm opacity-70">No messages yet</p>}
      {familyMessages.map(msg => (
        <div key={msg.id} className="mb-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
          onClick={() => window.open(msg.message_url, '_blank')}>
          <p className="text-sm">{msg.summary}</p>
        </div>
      ))}
    </div>

    {/* Send new message form */}
    <input
      type="text"
      placeholder="Audio message URL"
      value={newAudioMessageUrl}
      onChange={e => setNewAudioMessageUrl(e.target.value)}
      className="w-full mb-2 p-2 rounded bg-gray-700 text-white"
    />
    <input
      type="text"
      placeholder="Summary of your message"
      value={newAudioSummary}
      onChange={e => setNewAudioSummary(e.target.value)}
      className="w-full mb-2 p-2 rounded bg-gray-700 text-white"
    />
    <Button
      size="sm"
      disabled={isSendingMessage}
      onClick={sendFamilyAudioMessage}
      className="w-full bg-green-600 hover:bg-green-700"
    >
      {isSendingMessage ? 'Sending...' : 'Send to Loved Ones'}
    </Button>
  </div>

    </div>
  )
}
