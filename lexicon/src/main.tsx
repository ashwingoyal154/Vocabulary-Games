import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/layout.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { track } from './lib/analytics'

track('app_open')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
