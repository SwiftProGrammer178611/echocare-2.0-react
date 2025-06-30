import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Heart, User, Mail, Key, CheckCircle, XCircle, Loader2, AlertTriangle, Copy, ExternalLink, Database } from 'lucide-react'
import { useAuth } from '../components/auth-provider'
import { signUp, signIn, signOut, getCurrentUser, getUserProfile, manuallyConfirmUser } from '../lib/auth'
import { supabase, testUsersTable } from '../lib/supabase'
import { toast } from 'sonner'

export default function TestAuth() {
  const { user, loading } = useAuth()
  const [testResults, setTestResults] = useState<Record<string, 'pending' | 'success' | 'error'>>({})
  const [testData, setTestData] = useState({
    email: 'test@echocare.com',
    password: 'TestPass123',
    name: 'Test User',
  })
  const [emailConfirmationNeeded, setEmailConfirmationNeeded] = useState(false)
  const [skipAuthTests, setSkipAuthTests] = useState(false)

  const updateTestResult = (test: string, result: 'pending' | 'success' | 'error') => {
    setTestResults(prev => ({ ...prev, [test]: result }))
  }

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    updateTestResult(testName, 'pending')
    try {
      await testFn()
      updateTestResult(testName, 'success')
      toast.success(`${testName} test passed`)
    } catch (error: any) {
      updateTestResult(testName, 'error')
      toast.error(`${testName} test failed: ${error.message}`)
      console.error(`${testName} test error:`, error)
    }
  }

  const testDatabaseAccess = async () => {
    const tableStatus = await testUsersTable()
    if (!tableStatus.exists) {
      throw new Error('Users table does not exist')
    }
    if (!tableStatus.accessible) {
      throw new Error(`Users table not accessible: ${tableStatus.error}`)
    }
  }

  const testSignUp = async () => {
    const { user, error } = await signUp(testData.email, testData.password, testData.name)
    
    if (error) {
      if (error.code === 'email_confirmation_required') {
        setEmailConfirmationNeeded(true)
        console.log('📧 Email confirmation required - this is expected behavior')
        // Don't throw error for email confirmation requirement
        return
      }
      throw error
    }
    
    if (!user) throw new Error('No user returned from signup')
    
    // Check if user needs email confirmation
    if (!user.email_confirmed_at) {
      setEmailConfirmationNeeded(true)
      console.log('📧 User created but email confirmation required')
    }
  }

  const testSignIn = async () => {
    const { user, error } = await signIn(testData.email, testData.password)
    
    if (error) {
      if (error.code === 'email_not_confirmed') {
        setEmailConfirmationNeeded(true)
        throw new Error('Email confirmation required. Please confirm the email before signing in.')
      }
      throw error
    }
    
    if (!user) throw new Error('No user returned from signin')
    setEmailConfirmationNeeded(false)
  }

  const testGetCurrentUser = async () => {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error('No current user found')
  }

  const testGetUserProfile = async () => {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error('No current user found')
    
    const { data: profile, error } = await getUserProfile(currentUser.id)
    if (error) throw error
    if (!profile) throw new Error('No user profile found')
  }

  const testSignOut = async () => {
    const { error } = await signOut()
    if (error) throw error
  }

  const testDirectInsert = async () => {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error('No authenticated user')
    
    // Try to insert directly into users table
    const { error } = await supabase
      .from('users')
      .insert([
        {
          id: currentUser.id,
          email: 'direct-test@example.com',
          name: 'Direct Test User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
    
    if (error) throw error
  }

  const runAllTests = async () => {
    try {
      setEmailConfirmationNeeded(false)
      setSkipAuthTests(false)
      
      // Test database access first
      await runTest('Database Access', testDatabaseAccess)
      
      // Test signup
      await runTest('Sign Up', testSignUp)
      
      // If email confirmation is needed, skip auth-dependent tests
      if (emailConfirmationNeeded) {
        setSkipAuthTests(true)
        toast.error('Email confirmation required. Please follow the instructions below.')
        
        // Mark remaining tests as skipped
        const authDependentTests = ['Get Current User', 'Get User Profile', 'Direct Insert Test', 'Sign Out', 'Sign In']
        authDependentTests.forEach(test => {
          setTestResults(prev => ({ ...prev, [test]: 'error' }))
        })
        
        return
      }
      
      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Test get current user
      await runTest('Get Current User', testGetCurrentUser)
      
      // Test get user profile
      await runTest('Get User Profile', testGetUserProfile)
      
      // Test direct insert (to verify RLS)
      await runTest('Direct Insert Test', testDirectInsert)
      
      // Test sign out
      await runTest('Sign Out', testSignOut)
      
      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Test sign in
      await runTest('Sign In', testSignIn)
      
      toast.success('All authentication tests completed!')
    } catch (error) {
      toast.error('Test suite failed')
      console.error('Test suite error:', error)
    }
  }

  const copyManualConfirmSQL = () => {
    const sql = `-- Run this in Supabase SQL Editor to manually confirm the test user
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = '${testData.email}';`
    
    navigator.clipboard.writeText(sql)
    toast.success('Manual confirmation SQL copied to clipboard!')
  }

  const copyRLSFix = () => {
    const rlsFixSQL = `-- Fix RLS Policies for Users Table
DROP POLICY IF EXISTS "Users can delete own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "enable_insert_for_authenticated_users" ON users;
DROP POLICY IF EXISTS "enable_select_for_users_based_on_user_id" ON users;
DROP POLICY IF EXISTS "enable_update_for_users_based_on_user_id" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new policies with correct syntax
CREATE POLICY "users_insert_own_profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_select_own_data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete_own_data" ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);`

    navigator.clipboard.writeText(rlsFixSQL)
    toast.success('RLS Fix SQL copied to clipboard!')
  }

  const getStatusIcon = (status: 'pending' | 'success' | 'error' | undefined) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="glass-card">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-red-500 mr-2" />
              <h1 className="text-2xl font-bold">EchoCare 2.0</h1>
            </div>
            <CardTitle>Authentication Testing & Email Confirmation Fix</CardTitle>
            <CardDescription>
              Test authentication and resolve email confirmation issues
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Email Confirmation Fix Alert */}
        <Card className="glass-card border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <Mail className="w-5 h-5 mr-2" />
              Email Confirmation Required - Quick Fix Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-orange-800 space-y-4">
              <p className="font-medium">
                Your Supabase project requires email confirmation. Here are two ways to fix this:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <h4 className="font-semibold mb-2 text-green-700">Option 1: Manual Confirmation (Quick)</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Copy the SQL script below</li>
                    <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase Dashboard</a> → SQL Editor</li>
                    <li>Paste and run the script</li>
                    <li>Run tests again</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyManualConfirmSQL}
                    className="mt-2 bg-green-50 border-green-300"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Manual Confirm SQL
                  </Button>
                </div>

                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <h4 className="font-semibold mb-2 text-blue-700">Option 2: Disable Email Confirmation</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to Supabase Dashboard</li>
                    <li>Look for Authentication settings</li>
                    <li>Find "Email Confirmations" setting</li>
                    <li>Toggle it OFF</li>
                  </ol>
                  <p className="text-xs mt-2 text-gray-600">
                    Note: The exact location varies by Supabase version
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RLS Fix Alert */}
        <Card className="glass-card border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center text-red-800">
              <Database className="w-5 h-5 mr-2" />
              RLS Policy Fix (If Needed)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-800 space-y-3">
              <p className="font-medium">If you see RLS policy errors after fixing email confirmation:</p>
              <Button
                variant="outline"
                size="sm"
                onClick={copyRLSFix}
                className="bg-white"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy RLS Fix SQL
              </Button>
              <p className="text-sm">Go to Supabase Dashboard → SQL Editor → Paste and Run</p>
            </div>
          </CardContent>
        </Card>

        {/* Email Confirmation Alert */}
        {emailConfirmationNeeded && (
          <Card className="glass-card border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center text-red-800">
                <XCircle className="w-5 h-5 mr-2" />
                Tests Blocked by Email Confirmation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-red-800 space-y-2">
                <p className="font-medium">Authentication tests cannot proceed because email confirmation is required.</p>
                <p className="text-sm">Use the "Manual Confirm SQL" script above to quickly resolve this issue.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Auth Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Current Auth Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Loading State:</span>
                <Badge variant={loading ? "secondary" : "default"}>
                  {loading ? 'Loading' : 'Ready'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>User Status:</span>
                <Badge variant={user ? "default" : "secondary"}>
                  {user ? 'Authenticated' : 'Not Authenticated'}
                </Badge>
              </div>
              {user && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Email:</span>
                    <span className="text-sm">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Email Confirmed:</span>
                    <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
                      {user.email_confirmed_at ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>User ID:</span>
                    <span className="text-xs font-mono">{user.id.slice(0, 8)}...</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Test Configuration */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="w-5 h-5 mr-2" />
                Test Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testEmail">Test Email</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testData.email}
                  onChange={(e) => setTestData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testPassword">Test Password</Label>
                <Input
                  id="testPassword"
                  type="password"
                  value={testData.password}
                  onChange={(e) => setTestData(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testName">Test Name</Label>
                <Input
                  id="testName"
                  type="text"
                  value={testData.name}
                  onChange={(e) => setTestData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Test Results
              </span>
              <Button onClick={runAllTests}>
                Run All Tests
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { key: 'Database Access', icon: Database },
                { key: 'Sign Up', icon: User },
                { key: 'Get Current User', icon: User },
                { key: 'Get User Profile', icon: Mail },
                { key: 'Direct Insert Test', icon: Key },
                { key: 'Sign Out', icon: XCircle },
                { key: 'Sign In', icon: Key },
              ].map(({ key, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Icon className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-sm font-medium">{key}</span>
                    {skipAuthTests && ['Get Current User', 'Get User Profile', 'Direct Insert Test', 'Sign Out', 'Sign In'].includes(key) && (
                      <span className="text-xs text-orange-600 ml-2">(Skipped)</span>
                    )}
                  </div>
                  {getStatusIcon(testResults[key])}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Individual Test Buttons */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Individual Tests</CardTitle>
            <CardDescription>
              Run individual tests to debug specific functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                onClick={() => runTest('Database Access', testDatabaseAccess)}
                disabled={Object.values(testResults).includes('pending')}
              >
                Test Database
              </Button>
              <Button 
                variant="outline" 
                onClick={() => runTest('Sign Up', testSignUp)}
                disabled={Object.values(testResults).includes('pending')}
              >
                Test Sign Up
              </Button>
              <Button 
                variant="outline" 
                onClick={() => runTest('Sign In', testSignIn)}
                disabled={Object.values(testResults).includes('pending')}
              >
                Test Sign In
              </Button>
              <Button 
                variant="outline" 
                onClick={() => runTest('Sign Out', testSignOut)}
                disabled={Object.values(testResults).includes('pending')}
              >
                Test Sign Out
              </Button>
              <Button 
                variant="outline" 
                onClick={() => runTest('Get Current User', testGetCurrentUser)}
                disabled={Object.values(testResults).includes('pending')}
              >
                Test Get User
              </Button>
              <Button 
                variant="outline" 
                onClick={() => runTest('Direct Insert Test', testDirectInsert)}
                disabled={Object.values(testResults).includes('pending')}
              >
                Test RLS Insert
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Resolution Steps */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Quick Resolution Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <span className="font-bold text-green-600">1.</span>
                <span><strong>Quick Fix:</strong> Copy and run the "Manual Confirm SQL" script above to immediately confirm the test user</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-blue-600">2.</span>
                <span><strong>Test Again:</strong> Run the authentication tests after confirming the user</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-orange-600">3.</span>
                <span><strong>RLS Fix (If Needed):</strong> If you still see errors, run the RLS Fix SQL script</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-bold text-purple-600">4.</span>
                <span><strong>Success:</strong> All tests should pass once the user is confirmed and RLS is fixed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}