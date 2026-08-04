import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './auth/msalConfig'
import App from './App'
import './index.css'

// Instancia MSAL global — un único PCA para toda la app
const msalInstance = new PublicClientApplication(msalConfig)

// Si hay cuentas en caché, activa la primera automáticamente
msalInstance.initialize().then(() => {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0])
  }

  // Cuando se completa un login/redirect, activa la cuenta nueva
  msalInstance.addEventCallback((event) => {
    if (
      event.eventType === EventType.LOGIN_SUCCESS &&
      event.payload?.account
    ) {
      msalInstance.setActiveAccount(event.payload.account)
    }
  })

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  )
})
