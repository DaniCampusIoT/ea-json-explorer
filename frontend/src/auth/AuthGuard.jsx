/**
 * AuthGuard — envuelve rutas protegidas.
 * Redirige a LoginPage si no hay sesión activa.
 * Rechaza cuentas cuyo email no sea @quandum.com.
 */
import React, { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import { isAuthenticated, getUser, handleCallbackToken, ALLOWED_DOMAIN } from './googleAuth'

export default function AuthGuard({ children }) {
  const [authState, setAuthState] = useState('checking') // 'checking' | 'ok' | 'denied' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Captura token del callback de Google
    const result = handleCallbackToken()
    if (result?.error === 'domain_not_allowed') {
      setErrorMsg(`Tu cuenta no pertenece al dominio @${ALLOWED_DOMAIN}.`)
      setAuthState('denied')
      return
    }

    if (isAuthenticated()) {
      const user = getUser()
      const email = user?.sub ?? ''
      if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
        setErrorMsg(`La cuenta ${email} no pertenece al dominio @${ALLOWED_DOMAIN}.`)
        setAuthState('denied')
      } else {
        setAuthState('ok')
      }
    } else {
      setAuthState('unauthenticated')
    }
  }, [])

  if (authState === 'checking') {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
        <p>Verificando sesión…</p>
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div className="auth-denied">
        <div className="auth-denied-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a12c7b" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
          <h2>Acceso denegado</h2>
          <p>{errorMsg}</p>
          <p>Solo empleados de Quandum Aerospaces pueden usar esta aplicación.</p>
          <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }}
            onClick={() => { sessionStorage.clear(); window.location.href = '/' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginPage />
  }

  return children
}
