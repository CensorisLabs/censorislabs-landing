import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './finance-polish.css'
import './checkout.css'
import App from './App.tsx'
import { LicenseProvider } from './features/license/useLicense.tsx'

createRoot(document.getElementById('root')!).render(<StrictMode><LicenseProvider><App /></LicenseProvider></StrictMode>)
