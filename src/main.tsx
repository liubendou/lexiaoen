import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { injectSerifFont } from './font-loader'
import './styles/index.css'

injectSerifFont()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
