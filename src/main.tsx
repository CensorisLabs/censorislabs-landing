import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts are self-hosted in /public/fonts and declared in index.css.
// No Google Fonts CDN request, no third-party IP logging.

import './index.css'
import './site-polish.css'
import './motion.css'
// Loaded last: re-points the tokens above at a paper-and-ink palette.
import './monochrome.css'
import App from './App.tsx'

document.documentElement.dataset.performance = localStorage.getItem('censorislabs-site-performance') === 'low' ? 'low' : 'full'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
