import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider as JotaiProvider } from 'jotai'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from './components/ui/sonner'
import { PlaygroundApp } from './playground/PlaygroundApp'
import { ensureMockElectronAPI } from './playground/mock-utils'
import { EscapeInterruptProvider } from './context/EscapeInterruptContext'
import './index.css'

// Inject mock electronAPI before rendering
ensureMockElectronAPI()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <JotaiProvider>
      <ThemeProvider>
        <EscapeInterruptProvider>
          <PlaygroundApp />
          <Toaster />
        </EscapeInterruptProvider>
      </ThemeProvider>
    </JotaiProvider>
  </React.StrictMode>
)
