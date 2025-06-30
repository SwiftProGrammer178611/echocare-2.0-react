import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { 
  Trophy, 
  Star, 
  Target, 
  Award,
  MessageSquare,
  Heart,
  Users,
  Calendar,
  CheckCircle,
  TrendingUp
} from 'lucide-react'
import { useAuth } from './auth-provider'
import { 
  getAllAchievements, 
  getUserAchievements, 
  calculateAchievementStats,
  getAchievementLevel,
  type Achievement,
  type UserAchievement 
} from '../lib/achievements'
import { toast } from 'sonner'

export default function AchievementsTab() {
  const { user } = useAuth()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'conversation' | 'health' | 'social' | 'milestone'>('all')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (user) {
      loadAchievements()
    }
  }, [user])

  const loadAchievements = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const [allAchievements, userProgress] = await Promise.all([
        getAllAchievements(),
        getUserAchievements(user.id)
      ])
      
      setAchievements(allAchievements)
      setUserAchievements(userProgress)
      
      // Calculate statistics
      const achievementStats = calculateAchievementStats(userProgress)
      const levelInfo = getAchievementLevel(achievementStats.totalPoints)
      
      setStats({
        ...achievementStats,
        level: levelInfo
      })
    } catch (error) {
      console.error('Error loading achievements:', error)
      toast.error('Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'conversation': return <MessageSquare className="w-5 h-5" />
      case 'health': return <Heart className="w-5 h-5" />
      case 'social': return <Users className="w-5 h-5" />
      case 'milestone': return <Star className="w-5 h-5" />
      default: return <Trophy className="w-5 h-5" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'conversation': return 'text-blue-600'
      case 'health': return 'text-red-600'
      case 'social': return 'text-green-600'
      case 'milestone': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  const getProgressPercentage = (userAchievement: UserAchievement) => {
    if (userAchievement.completed) return 100
    const achievement = userAchievement.achievement
    return Math.min(100, (userAchievement.progress / achievement.requirement_value) * 100)
  }

  const filteredAchievements = achievements.filter(achievement => 
    filter === 'all' || achievement.category === filter
  )

  const getUserAchievementForId = (achievementId: string) => {
    return userAchievements.find(ua => ua.achievement_id === achievementId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading achievements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Achievement Level & Stats */}
      {stats && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700">Achievement Level</p>
                  <p className="text-2xl font-bold text-yellow-800">{stats.level.level}</p>
                  <p className="text-xs text-yellow-600">{stats.level.title}</p>
                </div>
                <Award className="w-8 h-8 text-yellow-600" />
              </div>
              {stats.level.nextLevelPoints > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-yellow-600 mb-1">
                    {stats.level.nextLevelPoints} points to next level
                  </p>
                  <Progress 
                    value={100 - (stats.level.nextLevelPoints / (stats.level.nextLevelPoints + 100)) * 100} 
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Points</p>
                  <p className="text-2xl font-bold">{stats.totalPoints}</p>
                </div>
                <Star className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}/{stats.total}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'conversation', 'health', 'social', 'milestone'].map((category) => (
          <Button
            key={category}
            variant={filter === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(category as any)}
            className="capitalize"
          >
            {category === 'all' ? 'All Achievements' : category}
          </Button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => {
          const userAchievement = getUserAchievementForId(achievement.id)
          const progress = userAchievement ? getProgressPercentage(userAchievement) : 0
          const isCompleted = userAchievement?.completed || false
          const currentProgress = userAchievement?.progress || 0

          return (
            <motion.div
              key={achievement.id}
              whileHover={{ scale: 1.02 }}
              className="relative"
            >
              <Card className={`glass-card transition-all duration-200 ${
                isCompleted 
                  ? 'border-green-300 bg-green-50/50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isCompleted ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <div className={`${getCategoryColor(achievement.category)} ${
                          isCompleted ? 'text-green-600' : ''
                        }`}>
                          {getCategoryIcon(achievement.category)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{achievement.name}</h4>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {achievement.category}
                        </Badge>
                      </div>
                    </div>
                    
                    {isCompleted && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">
                          +{achievement.points}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Progress</span>
                      <span className={isCompleted ? 'text-green-600 font-medium' : 'text-gray-700'}>
                        {currentProgress}/{achievement.requirement_value} {achievement.requirement_unit}
                      </span>
                    </div>
                    
                    <Progress 
                      value={progress} 
                      className={`h-2 ${isCompleted ? 'bg-green-100' : ''}`}
                    />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {Math.round(progress)}% complete
                      </span>
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-medium">{achievement.points} points</span>
                      </div>
                    </div>
                  </div>

                  {isCompleted && userAchievement?.completed_at && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex items-center text-xs text-green-600">
                        <Calendar className="w-3 h-3 mr-1" />
                        Completed {new Date(userAchievement.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Completion Celebration Effect */}
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-2 -right-2"
                  >
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No achievements found</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'Start using EchoCare to unlock your first achievements!'
              : `No ${filter} achievements available yet.`
            }
          </p>
        </div>
      )}

      {/* Category Progress Summary */}
      {stats && stats.categoryStats && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Category Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(stats.categoryStats).map(([category, data]: [string, any]) => (
                <div key={category} className="text-center">
                  <div className={`inline-flex p-3 rounded-full mb-2 ${getCategoryColor(category)} bg-opacity-10`}>
                    {getCategoryIcon(category)}
                  </div>
                  <h4 className="font-medium capitalize">{category}</h4>
                  <p className="text-sm text-gray-600">{data.completed}/{data.total} completed</p>
                  <Progress 
                    value={data.total > 0 ? (data.completed / data.total) * 100 : 0} 
                    className="h-2 mt-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}