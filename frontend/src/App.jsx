import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import AuthGuard from './auth/AuthGuard'
import Ingest from './views/Ingest'
import Explorer from './views/Explorer'
import Summary from './views/Summary'
import AIPanel from './views/AIPanel'

export default function App() {
  const [projectStats, setProjectStats] = useState(null)
  const isAuthenticated = useIsAuthenticated()
  const { accounts, instance } = useMsal()

  const account = accounts[0]
  const displayName = account?.name ?? account?.username ?? ''

  function handleLogout() {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }

  return (
    <BrowserRouter>
      <AuthGuard>
        <div className="app-shell">
          {/* Header */}
          <header className="app-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="EA Explorer logo">
              <rect x="3" y="3" width="8" height="8" rx="1.5" fill="#01696f"/>
              <rect x="13" y="3" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.5"/>
              <rect x="3" y="13" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.5"/>
              <rect x="13" y="13" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.3"/>
            </svg>
            <h1>EA JSON Explorer</h1>

            {projectStats && (
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <span>📦 {projectStats.packages} paquetes</span>
                <span>🧱 {projectStats.blocks} bloques</span>
                <span>🔌 {projectStats.connectors} conectores</span>
              </div>
            )}

            {/* Usuario autenticado */}
            {isAuthenticated && (
              <div className="header-user">
                <span className="header-user-name">{displayName}</span>
                <button
                  className="btn-logout"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            )}
          </header>

          {/* Sidebar */}
          <nav className="app-sidebar">
            <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>Navegación</div>
            <NavLink to="/" className="nav-link">⬆️ Cargar proyecto</NavLink>
            <NavLink to="/explorer" className="nav-link">🗂 Explorador</NavLink>
            <NavLink to="/summary" className="nav-link">📋 Resúmenes</NavLink>
            <NavLink to="/ai" className="nav-link">🤖 Panel IA</NavLink>
          </nav>

          {/* Contenido */}
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Ingest onLoaded={setProjectStats} />} />
              <Route path="/explorer" element={<Explorer />} />
              <Route path="/summary/:blockId?" element={<Summary />} />
              <Route path="/ai" element={<AIPanel />} />
            </Routes>
          </main>
        </div>
      </AuthGuard>
    </BrowserRouter>
  )
}
