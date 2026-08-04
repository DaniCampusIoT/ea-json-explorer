/**
 * AuthGuard — envuelve rutas protegidas.
 * Redirige a LoginPage si no hay sesión activa.
 * Rechaza cuentas cuyo email no sea @quandum.com.
 */
import React from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import LoginPage from './LoginPage'
import { ALLOWED_DOMAIN } from './msalConfig'

export default function AuthGuard({ children }) {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress, accounts } = useMsal()

  // Mientras MSAL inicializa o procesa el redirect, muestra spinner
  if (inProgress !== InteractionStatus.None) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
        <p>Verificando sesión…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Validación de dominio: rechaza cuentas que no sean @quandum.com
  const account = accounts[0]
  const email = account?.username ?? ''
  if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
    return (
      <div className="auth-denied">
        <div className="auth-denied-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a12c7b" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
          <h2>Acceso denegado</h2>
          <p>Tu cuenta <strong>{email}</strong> no pertenece al dominio
            <strong> @{ALLOWED_DOMAIN}</strong>.</p>
          <p>Solo empleados de Quandum Aerospaces pueden usar esta aplicación.</p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  return children
}

function LogoutButton() {
  const { instance } = useMsal()
  return (
    <button
      className="btn btn-secondary"
      style={{ marginTop: '1.5rem' }}
      onClick={() => instance.logoutPopup()}
    >
      Cerrar sesión
    </button>
  )
}
