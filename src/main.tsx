import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@app/App'
import { keepUpToDate } from '@app/updates'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Kein Wurzelelement gefunden.')

// Registered here rather than by the PWA plugin's injected snippet, which
// registers once and never asks again — see the module for why that matters.
keepUpToDate()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
