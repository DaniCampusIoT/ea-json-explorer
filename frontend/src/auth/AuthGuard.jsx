/**
 * AuthGuard — envuelve rutas protegidas.
 * Redirige a LoginPage si no hay sesión activa.
 * Muestra toast de bienvenida o acceso denegado tras el callback de Google.
 */
import React, { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import { isAuthenticated, handleCallbackToken, getUser } from './googleAuth'

// ─── Toast ───────────────────────────────────────────────────────────────
function AuthToast({ type, message, onDone }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pequeño delay para que el CSS transition arranque
    const t1 = setTimeout(() => setVisible(true), 30)
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 350)
    }, 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const isOk = type === 'success'

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1.1rem',
      background: isOk ? '#f0faf4' : '#fff1f2',
      border: `1.5px solid ${isOk ? '#22c55e' : '#f87171'}`,
      borderRadius: '0.75rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      minWidth: '260px', maxWidth: '360px',
      transform: visible ? 'translateY(0)' : 'translateY(2rem)',
      opacity: visible ? 1 : 0,
      transition: 'transform 320ms cubic-bezier(.22,1,.36,1), opacity 320ms ease',
      pointerEvents: 'none',
    }}>
      {/* Icono */}
      <div style={{
        flexShrink: 0, width: '2rem', height: '2rem',
        borderRadius: '50%',
        background: isOk ? '#dcfce7' : '#fee2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isOk
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        }
      </div>
      {/* Texto */}
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: isOk ? '#15803d' : '#b91c1c' }}>
          {isOk ? 'Acceso correcto' : 'Acceso denegado'}
        </div>
        <div style={{ fontSize: '0.75rem', color: isOk ? '#166534' : '#991b1b', marginTop: '0.1rem', lineHeight: 1.3 }}>
          {message}
        </div>
      </div>
      {/* Barra de progreso */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '3px', borderRadius: '0 0 0.75rem 0.75rem',
        background: isOk ? '#22c55e' : '#f87171',
        width: visible ? '0%' : '100%',
        transition: visible ? 'width 3500ms linear' : 'none',
      }} />
    </div>
  )
}

// ─── AuthGuard ──────────────────────────────────────────────────────────
export default function AuthGuard({ children }) {
  const [authState, setAuthState] = useState('checking')
  const [errorMsg, setErrorMsg]   = useState('')
  const [toast, setToast]         = useState(null) // { type, message }

  useEffect(() => {
    const result = handleCallbackToken()

    if (result?.error) {
      const isAccessDenied = result.error === 'acceso_denegado'
      const email = result.email || ''
      setErrorMsg(
        isAccessDenied
          ? `La cuenta ${email} no tiene permisos para acceder.`
          : `No se pudo iniciar sesión: ${result.error}`
      )
      setToast({
        type: 'error',
        message: isAccessDenied
          ? `${email} no está autorizada`
          : result.error,
      })
      setAuthState('denied')
      return
    }

    if (result?.token) {
      // Login recién completado — mostramos toast de bienvenida
      const user = getUser()
      setToast({
        type: 'success',
        message: user?.name ? `Bienvenido, ${user.name.split(' ')[0]}` : 'Sesión iniciada',
      })
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
      <>
        {toast && (
          <AuthToast type={toast.type} message={toast.message} onDone={() => setToast(null)} />
        )}
        <div className="auth-denied">
          <div className="auth-denied-card">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <h2>Acceso denegado</h2>
            <p>{errorMsg}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              Contacta con el administrador para solicitar acceso.
            </p>
            <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }}
              onClick={() => { sessionStorage.clear(); window.location.href = '/' }}>
              Volver al inicio
            </button>
          </div>
        </div>
      </>
    )
  }

  if (authState === 'unauthenticated') return <LoginPage />

  return (
    <>
      {toast && (
        <AuthToast type={toast.type} message={toast.message} onDone={() => setToast(null)} />
      )}
      {children}
    </>
  )
}
