import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Heart, CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export default function EmailConfirmation() {
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token = searchParams.get('token')
        const type = searchParams.get('type')
        
        if (!token || type !== 'signup') {
          setError('Invalid confirmation link')
          setIsLoading(false)
          return
        }

        // Verify the email confirmation token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        })

        if (error) {
          console.error('Email confirmation error:', error)
          setError(error.message || 'Failed to confirm email')
        } else if (data.user) {
          setIsConfirmed(true)
          toast.success('Email confirmed successfully!')
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            navigate('/dashboard')
          }, 2000)
        } else {
          setError('Email confirmation failed')
        }
      } catch (error: any) {
        console.error('Unexpected confirmation error:', error)
        setError('An unexpected error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    confirmEmail()
  }, [searchParams, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="glass-card w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-red-500 mr-2" />
              <h1 className="text-2xl font-bold">EchoCare 2.0</h1>
            </div>
            <CardTitle>Confirming Email</CardTitle>
            <CardDescription>
              Please wait while we confirm your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="glass-card w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-red-500 mr-2" />
              <h1 className="text-2xl font-bold">EchoCare 2.0</h1>
            </div>
            <CardTitle className="text-green-600">Email Confirmed!</CardTitle>
            <CardDescription>
              Your email has been successfully confirmed
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <p className="text-gray-600">
              Welcome to EchoCare! You'll be redirected to your dashboard shortly.
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="glass-card w-full max-w-md border-red-200 bg-red-50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-red-500 mr-2" />
            <h1 className="text-2xl font-bold">EchoCare 2.0</h1>
          </div>
          <CardTitle className="text-red-600">Confirmation Failed</CardTitle>
          <CardDescription>
            There was an issue confirming your email
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <p className="text-red-800">{error}</p>
          <div className="space-y-2">
            <Link to="/auth/signin">
              <Button className="w-full">
                Try Signing In
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button variant="outline" className="w-full">
                Create New Account
              </Button>
            </Link>
          </div>
          <div className="mt-6 text-center">
            <Link to="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}