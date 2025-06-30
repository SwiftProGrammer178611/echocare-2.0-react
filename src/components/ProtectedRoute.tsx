import { useAuth } from './auth-provider'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Add detailed logging to help debug the authentication flow
  useEffect(() => {
    console.log('🛡️ ProtectedRoute - Current state:', {
      loading,
      user: user ? {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at
      } : null,
      pathname: location.pathname
    })
  }, [user, loading, location.pathname])

  if (loading) {
    console.log('🔄 ProtectedRoute - Still loading, showing spinner')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('❌ ProtectedRoute - No user found, redirecting to sign-in')
    return <Navigate to="/auth/signin" replace />
  }

  console.log('✅ ProtectedRoute - User authenticated, rendering protected content')
  return <>{children}</>
}