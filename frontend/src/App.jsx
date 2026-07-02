import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Ingest from './views/Ingest'
import Explorer from './views/Explorer'
import Summary from './views/Summary'
import AIPanel from './views/AIPanel'

export default function App() {
  const [projectStats, setProjectStats] = useState(null)

  return (
    <BrowserRouter>
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              <span>📦 {projectStats.packages} paquetes</span>
              <span>🧱 {projectStats.blocks} bloques</span>
              <span>🔌 {projectStats.connectors} conectores</span>
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
    </BrowserRouter>
  )
}
