import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  MessageSquare, 
  Video, 
  Mic, 
  Clock, 
  Trash2,
  Eye,
  BarChart3,
  Heart,
  Brain
} from 'lucide-react'
import { useAuth } from './auth-provider'
import { 
  getConversationHistory, 
  getConversationStatistics, 
  deleteConversationSession,
  type ConversationSession 
} from '../lib/conversation-history'
import { toast } from 'sonner'

export default function HistoryTab() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationSession[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null)
  const [filter, setFilter] = useState<'all' | 'voice' | 'video' | 'text'>('all')

  useEffect(() => {
    if (user) {
      loadConversationHistory()
      loadStatistics()
    }
  }, [user, filter])

  const loadConversationHistory = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const history = await getConversationHistory(
        user.id, 
        50, 
        filter === 'all' ? undefined : filter
      )
      setConversations(history)
    } catch (error) {
      console.error('Error loading conversation history:', error)
      toast.error('Failed to load conversation history')
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    if (!user) return
    
    try {
      const stats = await getConversationStatistics(user.id)
      setStatistics(stats)
    } catch (error) {
      console.error('Error loading statistics:', error)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return
    }

    try {
      const success = await deleteConversationSession(sessionId)
      if (success) {
        setConversations(prev => prev.filter(c => c.session_id !== sessionId))
        setSelectedSession(null)
        toast.success('Conversation deleted successfully')
      } else {
        toast.error('Failed to delete conversation')
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'voice': return <Mic className="w-4 h-4" />
      case 'video': return <Video className="w-4 h-4" />
      default: return <MessageSquare className="w-4 h-4" />
    }
  }

  const getEmotionColor = (emotion: string) => {
    switch (emotion) {
      case 'happy': return 'bg-green-900/50 text-green-300 border-green-700'
      case 'sad': return 'bg-blue-900/50 text-blue-300 border-blue-700'
      case 'anxious': return 'bg-orange-900/50 text-orange-300 border-orange-700'
      case 'excited': return 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
      default: return 'bg-gray-900/50 text-gray-300 border-gray-700'
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading conversation history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      {statistics && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="glass-card bg-gray-800/50 border-gray-700 blue-glow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Sessions</p>
                  <p className="text-2xl font-bold text-white">{statistics.totalSessions || 0}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-gray-800/50 border-gray-700 teal-glow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Minutes</p>
                  <p className="text-2xl font-bold text-white">{statistics.totalMinutes || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-teal-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-gray-800/50 border-gray-700 green-glow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Voice Chats</p>
                  <p className="text-2xl font-bold text-white">{statistics.voiceSessions || 0}</p>
                </div>
                <Mic className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-gray-800/50 border-gray-700 blue-glow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Video Calls</p>
                  <p className="text-2xl font-bold text-white">{statistics.videoSessions || 0}</p>
                </div>
                <Video className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex space-x-2">
        {['all', 'voice', 'video', 'text'].map((filterType) => (
          <Button
            key={filterType}
            variant={filter === filterType ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(filterType as any)}
            className={`capitalize ${
              filter === filterType 
                ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white' 
                : 'border-gray-600 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {filterType === 'all' ? 'All Conversations' : `${filterType} Only`}
          </Button>
        ))}
      </div>

      {/* Conversation History Table - Dark Theme */}
      <Card className="glass-card bg-gray-800/50 border-gray-700 teal-glow">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <BarChart3 className="w-5 h-5 mr-2" />
            My Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No conversations found</p>
              <p className="text-sm">Start chatting with EchoCare AI to see your history here</p>
            </div>
          ) : (
            <div className="conversation-table">
              {/* Table Header */}
              <div className="conversation-header grid grid-cols-6 gap-4">
                <div>Name</div>
                <div>Persona ID</div>
                <div>Conversation ID</div>
                <div>Status</div>
                <div>Created</div>
                <div>Actions</div>
              </div>
              
              {/* Table Body */}
              <div className="max-h-96 overflow-y-auto">
                {conversations.map((session, index) => (
                  <motion.div
                    key={session.id}
                    className="conversation-row grid grid-cols-6 gap-4 items-center cursor-pointer"
                    whileHover={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="conversation-cell">
                      <div className="flex items-center space-x-2">
                        {getSessionIcon(session.session_type)}
                        <span className="text-white font-medium">
                          New Conversation {Date.now() - index * 1000}
                        </span>
                      </div>
                    </div>
                    
                    <div className="conversation-cell">
                      <span className="text-gray-400 font-mono text-sm">
                        p03cdd73a08a
                      </span>
                    </div>
                    
                    <div className="conversation-cell">
                      <span className="text-gray-400 font-mono text-sm">
                        {session.session_id.substring(0, 12)}...
                      </span>
                    </div>
                    
                    <div className="conversation-cell">
                      <span className="status-badge status-ended">
                        Ended
                      </span>
                    </div>
                    
                    <div className="conversation-cell">
                      <span className="text-gray-400 text-sm">
                        {new Date(session.started_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                    
                    <div className="conversation-cell">
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSession(session)
                          }}
                          className="text-gray-400 hover:text-white hover:bg-gray-700"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(session.session_id)
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Table Footer */}
              <div className="conversation-header text-sm">
                Showing 1 - {conversations.length} of {conversations.length} conversations
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details Sidebar */}
      {selectedSession && (
        <Card className="glass-card bg-gray-800/50 border-gray-700 blue-glow">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Eye className="w-5 h-5 mr-2" />
              Session Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-white">{selectedSession.title || 'Conversation'}</h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <Badge variant="secondary" className="bg-gray-600 text-gray-300">{selectedSession.session_type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Started:</span>
                    <span className="text-white">{new Date(selectedSession.started_at).toLocaleString()}</span>
                  </div>
                  {selectedSession.duration_seconds && (
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="text-white">{formatDuration(selectedSession.duration_seconds)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Messages:</span>
                    <span className="text-white">{Array.isArray(selectedSession.messages) ? selectedSession.messages.length : 0}</span>
                  </div>
                </div>
              </div>

              {selectedSession.emotion_summary && (
                <div>
                  <h5 className="font-medium mb-2 flex items-center text-white">
                    <Heart className="w-4 h-4 mr-1" />
                    Emotion Analysis
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dominant Emotion:</span>
                      <Badge className={getEmotionColor(selectedSession.emotion_summary.dominant_emotion)}>
                        {selectedSession.emotion_summary.dominant_emotion}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Positive Ratio:</span>
                      <span className="text-white">{Math.round(selectedSession.emotion_summary.positive_ratio * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Emotion Changes:</span>
                      <span className="text-white">{selectedSession.emotion_summary.emotion_changes}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedSession.health_insights && (
                <div>
                  <h5 className="font-medium mb-2 flex items-center text-white">
                    <Brain className="w-4 h-4 mr-1" />
                    Health Insights
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stress Level:</span>
                      <Badge variant={selectedSession.health_insights.stress_level === 'elevated' ? 'destructive' : 'secondary'} className="bg-gray-600 text-gray-300">
                        {selectedSession.health_insights.stress_level}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Engagement:</span>
                      <Badge variant="secondary" className="bg-gray-600 text-gray-300">
                        {selectedSession.health_insights.engagement_level}
                      </Badge>
                    </div>
                    {selectedSession.health_insights.concerns && selectedSession.health_insights.concerns.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-400">Concerns:</span>
                        <div className="mt-1 space-y-1">
                          {selectedSession.health_insights.concerns.map((concern: string, index: number) => (
                            <div key={index} className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded border border-yellow-700/50">
                              {concern}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Messages Preview */}
              <div>
                <h5 className="font-medium mb-2 text-white">Recent Messages</h5>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {Array.isArray(selectedSession.messages) && selectedSession.messages.slice(-3).map((message: any, index: number) => (
                    <div key={index} className="text-xs">
                      <div className="flex items-center space-x-1 mb-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-teal-500 flex items-center justify-center text-white text-xs">
                          {message.speaker === 'user' ? userInitial : 'AI'}
                        </div>
                        <Badge variant={message.speaker === 'user' ? 'default' : 'secondary'} className="text-xs bg-gray-600 text-gray-300">
                          {message.speaker === 'user' ? 'You' : 'AI'}
                        </Badge>
                        <span className="text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-300 bg-gray-700/50 p-2 rounded text-xs ml-5 border border-gray-600">
                        {message.message.length > 100 
                          ? message.message.substring(0, 100) + '...'
                          : message.message
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}