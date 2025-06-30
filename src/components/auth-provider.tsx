import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, testSupabaseConnection } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Error refreshing user:', error)
        setUser(null)
      } else {
        setUser(user)
      }
    } catch (error) {
      console.error('Unexpected error refreshing user:', error)
      setUser(null)
    }
  }

  useEffect(() => {
    let mounted = true

    // Test Supabase connection on mount
    testSupabaseConnection().then((connected) => {
      if (!connected) {
        console.error('Supabase connection failed')
      } else {
        console.log('✅ Supabase connection established')
      }
    })

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting initial session:', error)
        } else {
          if (mounted) {
            setUser(session?.user ?? null)
            console.log('Initial session loaded:', session?.user?.email || 'No user')
          }
        }
      } catch (error) {
        console.error('Unexpected error getting initial session:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'No user')
        
        if (!mounted) return

        setUser(session?.user ?? null)
        setLoading(false)

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          setUser(null)
          console.log('User signed out')
        }

        // Handle sign in - simplified without profile creation
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in successfully:', session.user.email)
          // Don't try to create profiles here - just set the user
          // Profile creation can be handled separately if needed
        }

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed for user:', session?.user?.email)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        throw error
      }
      setUser(null)
      console.log('Sign out successful')
    } catch (error) {
      console.error('Unexpected sign out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}