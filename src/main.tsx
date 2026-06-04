import React from 'react'
import ReactDOM from 'react-dom/client'
import { PoolProvider } from './context/PoolContext'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PoolProvider>
      <App />
    </PoolProvider>
  </React.StrictMode>
)
