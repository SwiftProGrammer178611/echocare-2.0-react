import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export interface AuthResponse {
  user: User | null
  error: any
}

// Enhanced email validation
function isValidEmail(email: string): boolean {
  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email) && email.length <= 254
}

export async function signUp(email: string, password: string, name: string): Promise<AuthResponse> {
  try {
    console.log('🚀 Starting enhanced signup process for:', email)
    
    // Validate email format
    if (!isValidEmail(email)) {
      console.error('❌ Invalid email format:', email)
      return { 
        user: null, 
        error: { 
          message: 'Please enter a valid email address',
          code: 'invalid_email'
        } 
      }
    }
    
    // Validate password
    if (password.length < 6) {
      return { 
        user: null, 
        error: { 
          message: 'Password must be at least 6 characters long',
          code: 'invalid_password'
        } 
      }
    }
    
    // Step 1: Create auth user with email confirmation redirect
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          full_name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`
      },
    })

    if (error) {
      console.error('❌ Supabase auth signup error:', error)
      
      // Handle specific error cases with user-friendly messages
      if (error.message?.includes('User already registered')) {
        return { 
          user: null, 
          error: { 
            message: 'An account with this email already exists. Please sign in instead.',
            code: 'user_exists'
          } 
        }
      } else if (error.message?.includes('Password should be at least')) {
        return { 
          user: null, 
          error: { 
            message: 'Password is too weak. Please choose a stronger password.',
            code: 'weak_password'
          } 
        }
      } else if (error.message?.includes('invalid') && error.message?.includes('email')) {
        return { 
          user: null, 
          error: { 
            message: 'Please enter a valid email address',
            code: 'invalid_email'
          } 
        }
      } else if (error.message?.includes('Database error saving new user')) {
        return { 
          user: null, 
          error: { 
            message: 'Database setup incomplete. Please run the database migration first.',
            code: 'database_error'
          } 
        }
      } else {
        return { user: null, error }
      }
    }

    if (!data.user) {
      return { 
        user: null, 
        error: { 
          message: 'No user returned from signup',
          code: 'unknown_error'
        } 
      }
    }

    console.log('✅ Auth signup successful, user ID:', data.user.id)

    // Check if email confirmation is required
    if (!data.user.email_confirmed_at) {
      console.log('📧 Email confirmation required')
      return { 
        user: data.user, 
        error: { 
          message: 'Please check your email and click the confirmation link to complete your registration.',
          code: 'email_confirmation_required'
        } 
      }
    }

    return { user: data.user, error: null }
  } catch (error: any) {
    console.error('❌ Sign up error:', error)
    return { 
      user: null, 
      error: { 
        message: 'An unexpected error occurred during signup',
        code: 'unexpected_error',
        originalError: error
      } 
    }
  }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    console.log('🚀 Starting signin process for:', email)
    
    // Validate email format
    if (!isValidEmail(email)) {
      console.error('❌ Invalid email format:', email)
      return { 
        user: null, 
        error: { 
          message: 'Please enter a valid email address',
          code: 'invalid_email'
        } 
      }
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })

    if (error) {
      console.error('❌ Supabase auth signin error:', error)
      
      // Handle email confirmation error specifically
      if (error.message?.includes('Email not confirmed')) {
        console.log('📧 Email confirmation required for:', email)
        return { 
          user: null, 
          error: { 
            ...error,
            message: 'Email confirmation required. Please check your email or disable email confirmation in Supabase settings.',
            code: 'email_not_confirmed'
          }
        }
      }
      
      return { user: null, error }
    }

    if (!data.user) {
      return { 
        user: null, 
        error: { 
          message: 'No user returned from signin',
          code: 'unknown_error'
        } 
      }
    }

    console.log('✅ Auth signin successful, user ID:', data.user.id)
    
    // After successful sign-in, ensure user profile exists
    await ensureUserProfile(data.user)
    
    return { user: data.user, error: null }
  } catch (error: any) {
    console.error('❌ Sign in error:', error)
    return { 
      user: null, 
      error: { 
        message: 'An unexpected error occurred during signin',
        code: 'unexpected_error',
        originalError: error
      } 
    }
  }
}

// Helper function to ensure user profile exists
async function ensureUserProfile(user: User) {
  try {
    console.log('🔍 Checking if user profile exists for:', user.id)
    
    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking user profile:', checkError)
      return
    }

    if (!existingProfile) {
      console.log('📝 Creating user profile for:', user.id)
      
      // Create profile if it doesn't exist
      const { error: createError } = await supabase
        .from('user_profiles')
        .insert([
          {
            user_id: user.id,
            full_name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
            date_of_birth: new Date().toISOString().split('T')[0] // Current date as default
          }
        ])

      if (createError) {
        console.error('⚠️ Could not create user profile:', createError)
      } else {
        console.log('✅ User profile created successfully')
      }
    } else {
      console.log('✅ User profile already exists')
    }
  } catch (error) {
    console.error('Error in ensureUserProfile:', error)
    // Don't throw - this is not critical for authentication
  }
}

export async function signOut() {
  try {
    console.log('🚀 Starting signout process')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('❌ Signout error:', error)
      throw error
    }
    console.log('✅ Signout successful')
    return { error: null }
  } catch (error) {
    console.error('❌ Sign out error:', error)
    return { error }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('❌ Get current user error:', error)
      throw error
    }
    
    if (!user) {
      throw new Error('Auth session missing!')
    }
    
    return user
  } catch (error: any) {
    console.error('❌ Get current user error:', error)
    return null
  }
}

export async function getUserProfile(userId: string) {
  try {
    console.log('🚀 Getting user profile for:', userId)
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('❌ Get user profile error:', error)
      throw error
    }

    console.log('✅ User profile retrieved successfully')
    return { data, error: null }
  } catch (error) {
    console.error('❌ Get user profile error:', error)
    return { data: null, error }
  }
}

export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('❌ Reset password error:', error)
    return { error }
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('❌ Update password error:', error)
    return { error }
  }
}

// Helper function to manually confirm a user via Supabase Admin API
export async function manuallyConfirmUser(email: string) {
  try {
    console.log('🔄 Attempting to manually confirm user:', email)
    
    // This requires the service role key and admin privileges
    // For now, we'll just log instructions
    console.log('💡 To manually confirm this user:')
    console.log('1. Go to Supabase Dashboard → Authentication → Users')
    console.log('2. Find the user with email:', email)
    console.log('3. Click on the user and look for "Confirm Email" button')
    console.log('4. Or run this SQL in your Supabase SQL Editor:')
    console.log(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '${email}';`)
    
    return { error: null }
  } catch (error) {
    console.error('❌ Manual confirmation error:', error)
    return { error }
  }
}