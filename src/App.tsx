import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './components/auth-provider'
import { ThemeProvider } from './components/theme-provider'
import LandingPage from './pages/LandingPage'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import EmailConfirmation from './pages/auth/EmailConfirmation'
import Dashboard from './pages/Dashboard'
import VoiceChat from './pages/VoiceChat'
import VideoChat from './pages/VideoChat'
import SetupDatabase from './pages/SetupDatabase'
import TestAuth from './pages/TestAuth'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="echocare-ui-theme">
      <AuthProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/signup" element={<SignUp />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/confirm" element={<EmailConfirmation />} />
            
            {/* Development/Admin routes */}
            <Route path="/setup-database" element={<SetupDatabase />} />
            <Route path="/test-auth" element={<TestAuth />} />
            
            {/* Protected application routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/voice-chat" 
              element={
                <ProtectedRoute>
                  <VoiceChat />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/video-chat" 
              element={
                <ProtectedRoute>
                  <VideoChat />
                </ProtectedRoute>
              } 
            />
          </Routes>
          <Toaster richColors position="top-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App