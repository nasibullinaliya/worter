import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SetNew from './pages/SetNew'
import SetDetail from './pages/SetDetail'
import SetEdit from './pages/SetEdit'
import Flashcards from './pages/Flashcards'
import Test from './pages/Test'
import TestAll from './pages/TestAll'
import Explore from './pages/Explore'

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/sets/new" element={<ProtectedRoute><SetNew /></ProtectedRoute>} />
          <Route path="/sets/:id" element={<ProtectedRoute><SetDetail /></ProtectedRoute>} />
          <Route path="/sets/:id/edit" element={<ProtectedRoute><SetEdit /></ProtectedRoute>} />
          <Route path="/sets/:id/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
          <Route path="/sets/:id/test" element={<ProtectedRoute><Test /></ProtectedRoute>} />
          <Route path="/test" element={<ProtectedRoute><TestAll /></ProtectedRoute>} />
          <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
      </ToastProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
