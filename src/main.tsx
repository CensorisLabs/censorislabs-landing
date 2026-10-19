import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts are self-hosted in /public/fonts and declared in index.css.
// No Google Fonts CDN request, no third-party IP logging.

import './index.css'
import './site-polish.css'
import App from './App.tsx'

const savedSiteTheme = localStorage.getItem('censorislabs-site-theme')
document.documentElement.dataset.theme = savedSiteTheme === 'imperial' ? 'obsidian' : savedSiteTheme === 'violet' ? 'amethyst' : savedSiteTheme || 'obsidian'
document.documentElement.dataset.performance = localStorage.getItem('censorislabs-site-performance') === 'low' ? 'low' : 'full'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
