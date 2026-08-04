/**
 * Pantalla de login — botón "Entrar con Microsoft".
 * Usa loginRedirect para mejor compatibilidad con Safari/iOS.
 */
import React, { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest, ALLOWED_DOMAIN } from './msalConfig'

export default function LoginPage() {
  const { instance } = useMsal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      await instance.loginRedirect(loginRequest)
    } catch (e) {
      setError('No se pudo iniciar sesión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-label="EA Explorer logo">
            <rect x="3" y="3" width="8" height="8" rx="1.5" fill="#01696f"/>
            <rect x="13" y="3" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.5"/>
            <rect x="3" y="13" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.5"/>
            <rect x="13" y="13" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.3"/>
          </svg>
        </div>

        <h1 className="login-title">EA JSON Explorer</h1>
        <p className="login-subtitle">Quandum Aerospaces — acceso restringido</p>
        <p className="login-domain-hint">Necesitas una cuenta <strong>@{ALLOWED_DOMAIN}</strong></p>

        {error && (
          <div className="login-error" role="alert">{error}</div>
        )}

        <button
          className="btn-microsoft"
          onClick={handleLogin}
          disabled={loading}
          aria-busy={loading}
        >
          {/* Logo Microsoft SVG */}
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          {loading ? 'Redirigiendo…' : 'Entrar con Microsoft'}
        </button>

        <p className="login-footer">
          Al iniciar sesión aceptas las políticas internas de Quandum Aerospaces.
        </p>
      </div>
    </div>
  )
}
