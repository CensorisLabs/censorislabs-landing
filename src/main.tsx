import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts are self-hosted in /public/fonts and declared in index.css.
// No Google Fonts CDN request, no third-party IP logging.

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
