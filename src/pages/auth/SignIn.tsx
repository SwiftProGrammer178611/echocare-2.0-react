import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Heart, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { signIn } from '../../lib/auth'
import { toast } from 'sonner'

export default function SignIn() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors below')
      return
    }

    setIsLoading(true)

    try {
      console.log('🔐 Attempting to sign in with:', formData.email)
      const { user, error } = await signIn(formData.email, formData.password)

      if (error) {
        console.error('❌ Sign in error:', error)
        
        // Handle specific error types
        if (error.message?.includes('Invalid login credentials') || 
            error.message?.includes('invalid_credentials') ||
            error.message?.includes('Invalid email or password')) {
          toast.error('Invalid email or password. Please check your credentials and try again.')
        } else if (error.message?.includes('email')) {
          toast.error('Please enter a valid email address')
        } else if (error.message?.includes('too_many_requests')) {
          toast.error('Too many login attempts. Please wait a moment and try again.')
        } else if (error.message?.includes('Email not confirmed')) {
          toast.error('Please check your email and confirm your account before signing in.')
        } else {
          toast.error(`Sign in failed: ${error.message || 'Please try again.'}`)
        }
      } else if (user) {
        console.log('✅ Sign in successful for user:', user.email)
        toast.success('Welcome back to EchoCare!')
        
        // Navigate immediately after successful authentication
        navigate('/dashboard')
      } else {
        toast.error('Sign in failed. Please try again.')
      }
    } catch (error) {
      console.error('❌ Unexpected sign in error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-calm-gradient flex items-center justify-center p-4">
      <Card className="glass-card w-full max-w-md bg-gray-800/50 border-gray-700 blue-glow">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-red-400 mr-2" />
            <h1 className="text-2xl font-bold text-white">EchoCare 2.0</h1>
          </div>
          <CardTitle className="text-white">Welcome Back</CardTitle>
          <CardDescription className="text-gray-400">
            Sign in to your EchoCare companion account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Welcome Back Message */}
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Ready to continue your journey?</p>
                <p>Sign in to access your personalized AI companion and health insights.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 text-lg p-3 ${errors.email ? 'border-red-500' : ''}`}
                disabled={isLoading}
                autoComplete="email"
              />
              {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 text-lg p-3 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full text-lg py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link to="/auth/forgot-password" className="text-sm text-blue-400 hover:underline block">
              Forgot your password?
            </Link>
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link to="/auth/signup" className="text-blue-400 hover:underline font-medium">
                Create one here
              </Link>
            </p>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500">
                Need help? Visit{' '}
                <Link to="/setup-database" className="text-blue-400 hover:underline">
                  Database Setup
                </Link>
                {' '}or{' '}
                <Link to="/test-auth" className="text-blue-400 hover:underline">
                  Test Authentication
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}