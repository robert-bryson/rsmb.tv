import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeUmamiAnalytics } from './utils/analytics.ts'

document.querySelectorAll('[data-prerendered]').forEach(element => element.remove());
initializeUmamiAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
