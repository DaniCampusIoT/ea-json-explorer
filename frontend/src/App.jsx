import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import AuthGuard from './auth/AuthGuard'
import { getUser, logout, isAuthenticated } from './auth/googleAuth'
import Ingest from './views/Ingest'
import Explorer from './views/Explorer'
import Summary from './views/Summary'
import AIPanel from './views/AIPanel'

export default function App() {
  const [projectStats, setProjectStats] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (isAuthenticated()) setUser(getUser())
  }, [])

  return (
    <BrowserRouter>
      <AuthGuard>
        <div className="app-shell">
          {/* Header */}
          <header className="app-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Arcana logo">
              <rect x="3" y="3" width="8" height="8" rx="1.5" fill="#01696f"/>
              <rect x="13" y="3" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.5"/>
              <rect x="3" y="13" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.5"/>
              <rect x="13" y="13" width="8" height="8" rx="1.5" fill="#01696f" opacity="0.3"/>
            </svg>
            <h1>Arcana</h1>

            {projectStats && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {projectStats.projectName && (
                  <span style={{
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    background: 'var(--color-primary-highlight)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }} title={projectStats.projectName}>
                    📁 {projectStats.projectName}
                  </span>
                )}
                <span>📦 {projectStats.packages} paquetes</span>
                <span>🧱 {projectStats.blocks} bloques</span>
                <span>🔌 {projectStats.connectors} conectores</span>
              </div>
            )}

            {/* Usuario autenticado */}
            {user && (
              <div className="header-user">
                {user.picture && (
                  <img src={user.picture} alt="avatar" width="28" height="28"
                    style={{ borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <span className="header-user-name">{user.name || user.sub}</span>
                <button
                  className="btn-logout"
                  onClick={logout}
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
