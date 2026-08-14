import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/grandstander/500.css'
import '@fontsource/grandstander/700.css'
import '@fontsource/grandstander/800.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
