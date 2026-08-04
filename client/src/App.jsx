import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import EnablePasskeyPrompt from './components/EnablePasskeyPrompt'
import Dashboard from './components/Dashboard'
import './App.css'

function AppContent() {
  const { user, initializing } = useAuth()
  const [justRegistered, setJustRegistered] = useState(false)

  if (initializing) return null

  if (!user) {
    return <LoginPage onRegistered={() => setJustRegistered(true)} />
  }

  if (justRegistered) {
    return <EnablePasskeyPrompt onDone={() => setJustRegistered(false)} />
  }

  return <Dashboard />
}

function App() {
  return (
    <AuthProvider>
      <section id="center">
        <AppContent />
      </section>
    </AuthProvider>
  )
}

export default App
