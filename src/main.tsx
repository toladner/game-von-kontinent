import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@app/App'
import { useGame } from '@app/store'
import { keepUpToDate } from '@app/updates'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Kein Wurzelelement gefunden.')

// Registered here rather than by the PWA plugin's injected snippet, which
// registers once and never asks again — see the module for why that matters.
keepUpToDate()

/*
 * Back to the table before the first frame is drawn.
 *
 * Deliberately here rather than in an effect inside App: an effect runs after
 * the first paint, so the player would see the title page flash past on the
 * way back into their own game. Reconnecting is a start-up step, not a render.
 *
 * An invitation in the address bar outranks it. Somebody who has just been
 * sent a link to a new table is asking for that table, not for the one they
 * were sitting at yesterday — and the join screen is where they say so.
 */
if (!/partie=[A-Za-z0-9]{3,8}/.test(location.hash)) useGame.getState().restore()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
