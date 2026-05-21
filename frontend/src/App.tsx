import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SetNew from './pages/SetNew'
import SetDetail from './pages/SetDetail'
import SetEdit from './pages/SetEdit'
import Flashcards from './pages/Flashcards'
import Test from './pages/Test'
import Quiz from './pages/Quiz'
import TestAll from './pages/TestAll'
import QuizAll from './pages/QuizAll'
import Today from './pages/Today'
import Explore from './pages/Explore'
import Plan from './pages/Plan'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <LangProvider>
        <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/sets/new" element={<ProtectedRoute><SetNew /></ProtectedRoute>} />
            <Route path="/sets/:id" element={<ProtectedRoute><SetDetail /></ProtectedRoute>} />
            <Route path="/sets/:id/edit" element={<ProtectedRoute><SetEdit /></ProtectedRoute>} />
            <Route path="/sets/:id/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
            <Route path="/sets/:id/test" element={<ProtectedRoute><Test /></ProtectedRoute>} />
            <Route path="/sets/:id/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/test" element={<ProtectedRoute><TestAll /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><QuizAll /></ProtectedRoute>} />
            <Route path="/today" element={<ProtectedRoute><Today /></ProtectedRoute>} />
            <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
        </ToastProvider>
        </LangProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  )
}
