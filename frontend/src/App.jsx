import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import AuthGuard from './auth/AuthGuard'
import { getUser, logout, isAuthenticated } from './auth/googleAuth'
import { AIProvider } from './context/AIContext'
import RouteTransition from './components/RouteTransition'
import ThemeToggle from './components/ThemeToggle'
import GlobalSearch from './components/GlobalSearch'
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
        <AIProvider>
          <div className="app-shell">
            {/* Header */}
            <header className="app-header">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-label="Arcana logo">
                <rect width="48" height="48" rx="12" fill="#0d1117"/>
                <rect x="8" y="8" width="14" height="14" rx="3" fill="#01a0a8"/>
                <rect x="26" y="8" width="14" height="14" rx="3" fill="#01a0a8" opacity="0.6"/>
                <rect x="8" y="26" width="14" height="14" rx="3" fill="#01a0a8" opacity="0.6"/>
                <rect x="26" y="26" width="14" height="14" rx="3" fill="#01a0a8" opacity="0.3"/>
                <line x1="22" y1="15" x2="26" y2="15" stroke="#01a0a8" strokeWidth="1.5" opacity="0.8"/>
                <line x1="15" y1="22" x2="15" y2="26" stroke="#01a0a8" strokeWidth="1.5" opacity="0.8"/>
              </svg>
              <h1>Arcana</h1>

              <GlobalSearch />

              {projectStats && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {projectStats.projectName && (
                    <span style={{
                      fontWeight: 600, color: 'var(--color-primary)',
                      background: 'var(--color-primary-highlight)',
                      padding: '0.2rem 0.6rem', borderRadius: '999px',
                      fontSize: '0.78rem', maxWidth: '200px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={projectStats.projectName}>
                      📁 {projectStats.projectName}
                    </span>
                  )}
                  <span>📦 {projectStats.packages}</span>
                  <span>🧱 {projectStats.blocks}</span>
                  <span>🔌 {projectStats.connectors}</span>
                </div>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ThemeToggle />
                {user && (
                  <div className="header-user">
                    {user.picture && (
                      <img src={user.picture} alt="avatar" width="28" height="28"
                        style={{ borderRadius: '50%', objectFit: 'cover' }} />
                    )}
                    <span className="header-user-name">{user.name || user.sub}</span>
                    <button className="btn-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Sidebar */}
            <nav className="app-sidebar">
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>Navegación</div>
              <NavLink to="/"         className="nav-link">⬆️ Cargar proyecto</NavLink>
              <NavLink to="/explorer" className="nav-link">🗂 Explorador</NavLink>
              <NavLink to="/summary"  className="nav-link">📋 Resúmenes</NavLink>
              <NavLink to="/ai"       className="nav-link">🤖 Panel IA</NavLink>
            </nav>

            <main className="app-main">
              <RouteTransition>
                <Routes>
                  <Route path="/"                  element={<Ingest onLoaded={setProjectStats} />} />
                  <Route path="/explorer"          element={<Explorer />} />
                  <Route path="/summary/:blockId?" element={<Summary />} />
                  <Route path="/ai"                element={<AIPanel />} />
                </Routes>
              </RouteTransition>
            </main>
          </div>
        </AIProvider>
      </AuthGuard>
    </BrowserRouter>
  )
}
