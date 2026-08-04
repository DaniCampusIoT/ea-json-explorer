/**
 * AuthGuard — envuelve rutas protegidas.
 * Redirige a LoginPage si no hay sesión activa.
 */
import React, { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import { isAuthenticated, handleCallbackToken } from './googleAuth'

export default function AuthGuard({ children }) {
  const [authState, setAuthState] = useState('checking')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const result = handleCallbackToken()
    if (result?.error) {
      setErrorMsg(`No se pudo iniciar sesión: ${result.error}`)
      setAuthState('denied')
      return
    }
    setAuthState(isAuthenticated() ? 'ok' : 'unauthenticated')
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
          <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }}
            onClick={() => { sessionStorage.clear(); window.location.href = '/' }}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  if (authState === 'unauthenticated') return <LoginPage />

  return children
}
