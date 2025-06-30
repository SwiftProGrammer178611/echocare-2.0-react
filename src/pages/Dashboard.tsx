import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  Heart, 
  Mic, 
  Video, 
  Brain, 
  Shield, 
  Calendar,
  Bell,
  Settings,
  LogOut,
  Trophy,
  Loader2,
  User,
  Activity,
  History,
  Award,
  Plus,
  MessageSquare,
  Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth-provider'
import { useNavigate } from 'react-router-dom'
import { createMemoryToken } from '../lib/algorand'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { ThemeToggle } from '../components/theme-toggle'
import { 
  getUserAchievements, 
  calculateAchievementStats, 
  getAchievementLevel,
  triggerAchievementEvent 
} from '../lib/achievements'
import { getConversationHistory, getConversationStatistics } from '../lib/conversation-history'
import HistoryTab from '../components/HistoryTab'
import AchievementsTab from '../components/AchievementsTab'

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [currentEmotion, setCurrentEmotion] = useState('happy')
  const [memoryTokens, setMemoryTokens] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'achievements'>('overview')
  const [achievementStats, setAchievementStats] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [conversationStats, setConversationStats] = useState<any>(null)
  const [recentConversations, setRecentConversations] = useState<any[]>([])

  useEffect(() => {
    if (!loading && !user) {
      console.log('No user found, redirecting to signin')
      navigate('/auth/signin')
    }
  }, [user, loading, navigate])

  // Load user data
  useEffect(() => {
    if (user) {
      loadUserData()
      loadAchievementStats()
      loadConversationData()
    }
  }, [user])

  const loadUserData = async () => {
    if (!user) return

    try {
      // Load user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      setUserProfile(profile)

      // Load memory tokens if table exists
      try {
        const { data: tokens } = await supabase
          .from('memory_tokens')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (tokens) {
          setMemoryTokens(tokens)
        }
      } catch (error) {
        console.log('Memory tokens table not available')
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const loadAchievementStats = async () => {
    if (!user) return

    try {
      const userAchievements = await getUserAchievements(user.id)
      const stats = calculateAchievementStats(userAchievements)
      const levelInfo = getAchievementLevel(stats.totalPoints)
      
      setAchievementStats({
        ...stats,
        level: levelInfo,
        recentAchievements: userAchievements.filter(ua => ua.completed).slice(0, 3)
      })
    } catch (error) {
      console.error('Failed to load achievement stats:', error)
    }
  }

  const loadConversationData = async () => {
    if (!user) return

    try {
      // Load conversation statistics
      const stats = await getConversationStatistics(user.id)
      setConversationStats(stats)

      // Load recent conversations
      const conversations = await getConversationHistory(user.id, 5)
      setRecentConversations(conversations)
    } catch (error) {
      console.error('Failed to load conversation data:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      navigate('/')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  const createWelcomeToken = async () => {
    if (!user) return

    try {
      const tokenResult = await createMemoryToken(
        user.id,
        'Welcome to EchoCare',
        'Your journey with EchoCare AI companion begins!',
        'milestone'
      )

      // Try to save to database if table exists
      try {
        const { data, error } = await supabase
          .from('memory_tokens')
          .insert([
            {
              user_id: user.id,
              token_id: tokenResult.tokenId,
              title: 'Welcome to EchoCare',
              description: 'Your journey with EchoCare AI companion begins!',
              milestone_type: 'milestone',
              metadata: {
                txId: tokenResult.txId,
                address: tokenResult.address,
              },
            }
          ])
          .select()
          .single()

        if (!error && data) {
          setMemoryTokens(prev => [data, ...prev])
          toast.success('Welcome memory token created!')
          
          // Trigger achievement
          await triggerAchievementEvent(user.id, 'memory_token_created')
          loadAchievementStats()
        }
      } catch (dbError) {
        console.log('Could not save to database, but token created on blockchain')
        toast.success('Welcome memory token created on blockchain!')
      }
    } catch (error) {
      console.error('Failed to create memory token:', error)
      toast.error('Failed to create memory token')
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-gradient flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
          <p className="text-lg text-gray-300">Loading your EchoCare dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-calm-gradient flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-lg mb-4 text-gray-300">Please sign in to access your dashboard</p>
          <Link to="/auth/signin">
            <Button className="bg-blue-600 hover:bg-blue-700">Sign In</Button>
          </Link>
        </div>
      </div>
    )
  }

  const userName = userProfile?.full_name || user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-calm-gradient">
      {/* Header */}
      <header className="glass-card border-0 border-b border-gray-700/50 px-6 py-4 mb-6 bg-gray-900/80 blue-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {userInitial}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Good morning, {userName}!</h1>
              <p className="text-gray-400">How are you feeling today?</p>
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
            <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
              <Shield className="w-3 h-3 mr-1" />
              Secure
            </Badge>
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <Bell className="w-4 h-4" />
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-6 pb-6">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-800/50 rounded-lg p-1 shadow-sm border border-gray-700">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('overview')}
            className={`flex-1 ${activeTab === 'overview' ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
          >
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('history')}
            className={`flex-1 ${activeTab === 'history' ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
          >
            <History className="w-4 h-4 mr-2" />
            Chat History
          </Button>
          <Button
            variant={activeTab === 'achievements' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 ${activeTab === 'achievements' ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
          >
            <Award className="w-4 h-4 mr-2" />
            Achievements
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Actions */}
              <Card className="glass-card bg-gray-800/50 border-gray-700 teal-glow">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                  <CardDescription className="text-gray-400">
                    Start a conversation with your AI companion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Link to="/voice-chat">
                      <Button 
                        className="w-full h-20 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-lg text-white"
                      >
                        <Mic className="w-6 h-6 mr-3" />
                        Voice Chat
                      </Button>
                    </Link>
                    <Link to="/video-chat">
                      <Button 
                        variant="outline" 
                        className="w-full h-20 text-lg border-2 border-teal-600 text-teal-400 hover:bg-teal-900/20"
                      >
                        <Video className="w-6 h-6 mr-3" />
                        Video Call with AI
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Conversation Statistics */}
              {conversationStats && (
                <Card className="glass-card bg-gray-800/50 border-gray-700 blue-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <MessageSquare className="w-5 h-5 mr-2 text-blue-400" />
                      Your Conversation Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-900/30 rounded-lg border border-blue-700/50">
                        <MessageSquare className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-blue-300">{conversationStats.totalSessions || 0}</div>
                        <div className="text-sm text-gray-400">Total Chats</div>
                      </div>
                      <div className="text-center p-4 bg-teal-900/30 rounded-lg border border-teal-700/50">
                        <Mic className="w-8 h-8 text-teal-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-teal-300">{conversationStats.voiceSessions || 0}</div>
                        <div className="text-sm text-gray-400">Voice Calls</div>
                      </div>
                      <div className="text-center p-4 bg-cyan-900/30 rounded-lg border border-cyan-700/50">
                        <Video className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-cyan-300">{conversationStats.videoSessions || 0}</div>
                        <div className="text-sm text-gray-400">Video Calls</div>
                      </div>
                      <div className="text-center p-4 bg-emerald-900/30 rounded-lg border border-emerald-700/50">
                        <Clock className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-emerald-300">{conversationStats.totalMinutes || 0}</div>
                        <div className="text-sm text-gray-400">Total Minutes</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Conversations */}
              {recentConversations.length > 0 && (
                <Card className="glass-card bg-gray-800/50 border-gray-700 green-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-white">
                      <span className="flex items-center">
                        <History className="w-5 h-5 mr-2 text-teal-400" />
                        Recent Conversations
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('history')}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentConversations.slice(0, 3).map((conversation) => (
                        <div key={conversation.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600/50">
                          <div className="flex items-center space-x-3">
                            {conversation.session_type === 'voice' ? (
                              <Mic className="w-4 h-4 text-blue-400" />
                            ) : conversation.session_type === 'video' ? (
                              <Video className="w-4 h-4 text-teal-400" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-emerald-400" />
                            )}
                            <div>
                              <h4 className="font-medium text-sm text-white">{conversation.title || 'Conversation'}</h4>
                              <p className="text-xs text-gray-400">
                                {new Date(conversation.started_at).toLocaleDateString()} • 
                                {Array.isArray(conversation.messages) ? conversation.messages.length : 0} messages
                                {conversation.duration_seconds && ` • ${formatDuration(conversation.duration_seconds)}`}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-gray-600 text-gray-300">
                            {conversation.session_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Memory Tokens & Achievements */}
              <Card className="glass-card bg-gray-800/50 border-gray-700 teal-glow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center">
                      <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                      Memory Tokens & Achievements
                    </span>
                    {achievementStats && (
                      <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700">
                        Level {achievementStats.level.level} • {achievementStats.totalPoints} points
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Your digital keepsakes and milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Recent Achievements */}
                  {achievementStats?.recentAchievements?.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-3 text-white">Recent Achievements</h4>
                      <div className="grid md:grid-cols-3 gap-3">
                        {achievementStats.recentAchievements.map((achievement: any) => (
                          <div key={achievement.id} className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <Trophy className="w-4 h-4 text-green-400" />
                              <span className="text-xs text-green-300">+{achievement.achievement.points}</span>
                            </div>
                            <h5 className="font-medium text-sm text-white">{achievement.achievement.name}</h5>
                            <p className="text-xs text-gray-400">{achievement.achievement.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Memory Tokens */}
                  {memoryTokens.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      {memoryTokens.slice(0, 4).map((token: any) => (
                        <motion.div
                          key={token.id}
                          className="p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-700/50"
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Trophy className="w-5 h-5 text-yellow-400" />
                            <Badge variant="secondary" className="text-xs bg-gray-600 text-gray-300">
                              {token.milestone_type}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-sm text-white">{token.title}</h4>
                          <p className="text-xs text-gray-400 mt-1">{token.description}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(token.created_at).toLocaleDateString()}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400 mb-4">
                      <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No memory tokens yet. Start chatting to earn your first milestone!</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={createWelcomeToken}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Welcome Token
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab('achievements')}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      View All Achievements
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Emotion Monitor */}
              <Card className="glass-card bg-gray-800/50 border-gray-700 blue-glow">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Brain className="w-5 h-5 mr-2 text-purple-400" />
                    Emotion Detection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <div className="w-full h-48 bg-gray-700/50 rounded-lg flex items-center justify-center border border-gray-600">
                      <User className="w-12 h-12 text-gray-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-white">Happy</span>
                      <span className="text-sm text-gray-400">85% confident</span>
                    </div>
                    
                    <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      Start
                    </Button>
                  </div>

                  <div className="text-xs text-gray-400">
                    <p>Current emotion: <span className="font-medium capitalize text-white">Happy</span></p>
                    <p>Detection status: <span className="font-medium text-white">Inactive</span></p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'achievements' && <AchievementsTab />}
      </div>
    </div>
  )
}