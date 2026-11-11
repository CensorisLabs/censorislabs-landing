import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './finance-polish.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
