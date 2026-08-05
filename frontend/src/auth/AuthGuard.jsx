/**
 * AuthGuard — envuelve rutas protegidas.
 * Tras el callback de Google muestra un splash a pantalla completa
 * (2.2 s) antes de continuar o denegar el acceso.
 */
import React, { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import { isAuthenticated, handleCallbackToken, getUser } from './googleAuth'

// ─── Splash de resultado de login ──────────────────────────────────────
function AuthSplash({ type, title, subtitle, onDone }) {
  const [visible, setVisible]   = useState(false)
  const [progress, setProgress] = useState(100)
  const DURATION = 2200

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 40)
    const start = Date.now()
    const raf = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100))
    }, 30)
    const t2 = setTimeout(() => {
      clearInterval(raf)
      setVisible(false)
      setTimeout(onDone, 350)
    }, DURATION)
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(raf) }
  }, [])

  const isOk   = type === 'success'
  const accent = isOk ? '#16a34a' : '#dc2626'
  const bg     = isOk ? '#f0fdf4' : '#fff1f2'
  const ring   = isOk ? '#bbf7d0' : '#fecaca'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.40)',
      backdropFilter: 'blur(6px)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 320ms ease',
    }}>
      <div style={{
        background: bg,
        border: `2px solid ${ring}`,
        borderRadius: '1.25rem',
        padding: '2.5rem 3rem',
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        minWidth: '300px',
        transform: visible ? 'scale(1)' : 'scale(0.92)',
        transition: 'transform 320ms cubic-bezier(.22,1,.36,1)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Icono circular */}
        <div style={{
          width: '4rem', height: '4rem', borderRadius: '50%',
          background: isOk ? '#dcfce7' : '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: `0 0 0 8px ${ring}`,
        }}>
          {isOk
            ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
        </div>

        <div style={{ fontWeight: 700, fontSize: '1.15rem', color: accent, marginBottom: '0.4rem' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.5 }}>
          {subtitle}
        </div>

        {/* Barra de progreso inferior */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, height: '4px',
          background: accent,
          width: `${progress}%`,
          transition: 'width 30ms linear',
        }} />
      </div>
    </div>
  )
}

// ─── AuthGuard ───────────────────────────────────────────────────────
export default function AuthGuard({ children }) {
  const [authState, setAuthState] = useState('checking')
  const [splash, setSplash]       = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')

  useEffect(() => {
    const result = handleCallbackToken()

    if (result?.error) {
      const isDenied = result.error === 'acceso_denegado'
      const email    = result.email || ''
      setErrorMsg(
        isDenied
          ? `La cuenta ${email} no tiene permisos.`
          : `Error: ${result.error}`
      )
      setSplash({
        type:     'error',
        title:    'Acceso denegado',
        subtitle: isDenied ? `${email} no está autorizada.` : result.error,
        next:     'denied',
      })
      return
    }

    if (result?.token) {
      const user  = getUser()
      const first = user?.name ? user.name.split(' ')[0] : 'usuario'
      setSplash({
        type:     'success',
        title:    '¡Bienvenido!',
        subtitle: `Hola, ${first}. Acceso verificado correctamente.`,
        next:     'ok',
      })
      return
    }

    setAuthState(isAuthenticated() ? 'ok' : 'unauthenticated')
  }, [])

  // Splash activo — bloquea toda la UI hasta que termina
  if (splash) {
    return (
      <AuthSplash
        type={splash.type}
        title={splash.title}
        subtitle={splash.subtitle}
        onDone={() => {
          setSplash(null)
          setAuthState(splash.next)
        }}
      />
    )
  }

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
    )
  }

  if (authState === 'unauthenticated') return <LoginPage />

  return children
}
