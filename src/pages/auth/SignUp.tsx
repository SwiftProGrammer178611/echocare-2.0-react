import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Heart, Eye, EyeOff, Loader2, CheckCircle, User, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { signUp } from '../../lib/auth'
import { toast } from 'sonner'

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters long'
    }

    // Email validation - Enhanced
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email) || formData.email.length > 254) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long'
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
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
      console.log('🔐 Starting enhanced sign up for:', formData.email)
      
      // Step 1: Create auth user
      const { user, error } = await signUp(formData.email, formData.password, formData.name)

      if (error) {
        console.error('❌ Sign up error:', error)
        
        // Handle specific error types with user-friendly messages
        if (error.message?.includes('User already registered')) {
          toast.error('An account with this email already exists. Please sign in instead.')
        } else if (error.message?.includes('Password should be at least')) {
          toast.error('Password is too weak. Please choose a stronger password.')
        } else if (error.message?.includes('Database setup incomplete')) {
          toast.error('Database setup incomplete. Please run the database migration first.')
        } else if (error.message?.includes('email')) {
          toast.error('Please enter a valid email address')
        } else if (error.message?.includes('too_many_requests')) {
          toast.error('Too many requests. Please wait a moment and try again.')
        } else {
          toast.error(`Sign up failed: ${error.message || 'Please try again.'}`)
        }
        return
      }

      if (!user) {
        toast.error('Sign up failed. Please try again.')
        return
      }

      console.log('✅ Auth user created successfully:', user.email)

      // Success!
      toast.success('🎉 Welcome to EchoCare! Your account has been created successfully.')
      
      // Navigate to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard')
      }, 1500)

    } catch (error) {
      console.error('❌ Unexpected sign up error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-calm-gradient flex items-center justify-center p-4">
      <Card className="glass-card w-full max-w-lg bg-gray-800/50 border-gray-700 blue-glow">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-red-400 mr-2" />
            <h1 className="text-2xl font-bold text-white">EchoCare 2.0</h1>
          </div>
          <CardTitle className="text-white">Create Your Account</CardTitle>
          
          <CardDescription className="text-gray-400">
            Join EchoCare and start your wellness journey with AI-powered care
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Welcome Message */}
          <div className="mb-6 p-4 bg-teal-900/30 border border-teal-700/50 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-teal-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-teal-300">
                <p className="font-medium mb-1">Quick & Easy Setup!</p>
                <p>Create your account in seconds to access your personalized AI companion.</p>
              </div>
            </div>
          </div>

          {/* Database Warning */}
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Important Information</p>
                <p>If sign-up fails, please visit <Link to="/setup-database" className="underline font-medium">Setup Database</Link> to run the required database migration.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-white flex items-center">
                <User className="w-4 h-4 mr-2" />
                Personal Information
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 ${errors.name ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                  autoComplete="name"
                />
                {errors.name && <p className="text-sm text-red-400">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 ${errors.email ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                  autoComplete="email"
                />
                {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-300">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password (min. 6 characters)"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                      disabled={isLoading}
                      autoComplete="new-password"
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full text-lg py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating your account...
                </>
              ) : (
                'Create Account & Get Started'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/auth/signin" className="text-blue-400 hover:underline font-medium">
                Sign in here
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