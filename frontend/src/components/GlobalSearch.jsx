import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAI } from '../context/AIContext'

/**
 * Búsqueda global cross-view.
 * Lee el proyecto desde AIContext (no window.eaProject).
 * Ctrl+K / Cmd+K para abrir.
 */
export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [cursor,  setCursor]  = useState(-1)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { project } = useAI()

  const hasProject = (project?.blocks?.length || 0) > 0

  // Atajos de teclado globales
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]); setCursor(-1) }
  }, [open])

  // Buscar en el proyecto del contexto
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q || !hasProject) { setResults([]); setCursor(-1); return }

    const hits = []
    project.blocks.forEach(b => {
      if (b.name?.toLowerCase().includes(q))
        hits.push({ kind: 'block', icon: '🧱', label: b.name,
          sub: project.idMap?.[b.parentId]?.name || '', route: `/summary/${b.id}` })
    })
    project.packages.forEach(p => {
      if (p.name?.toLowerCase().includes(q))
        hits.push({ kind: 'paquete', icon: '📦', label: p.name,
          sub: 'Paquete', route: `/explorer?pkg=${p.id}` })
    })
    project.ports?.forEach(p => {
      if (p.name?.toLowerCase().includes(q)) {
        const parent = project.idMap?.[p.parentId]
        hits.push({ kind: 'puerto', icon: '🔌', label: p.name,
          sub: parent?.name || 'Puerto', route: parent ? `/summary/${p.parentId}` : '/explorer' })
      }
    })
    project.connectors?.forEach(c => {
      if (c.name?.toLowerCase().includes(q))
        hits.push({ kind: 'conector', icon: '🔗', label: c.name,
          sub: c.kind || 'Conector', route: '/explorer' })
    })
    setResults(hits.slice(0, 12))
    setCursor(-1)
  }, [query, project])

  // Navegación con teclado dentro del modal
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    if (e.key === 'Enter' && cursor >= 0 && results[cursor]) goTo(results[cursor].route)
  }

  function goTo(route) { navigate(route); setOpen(false) }

  if (!open) return (
    <button className="global-search-trigger" onClick={() => setOpen(true)} title="Búsqueda global (Ctrl+K)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Buscar…</span>
      <kbd>Ctrl K</kbd>
    </button>
  )

  return (
    <div className="global-search-overlay" onClick={() => setOpen(false)}>
      <div className="global-search-modal" onClick={e => e.stopPropagation()}>
        <div className="global-search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ flexShrink:0, color:'var(--color-text-muted)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar bloques, paquetes, puertos, conectores…"
            className="global-search-input" />
          {query && (
            <button onClick={() => setQuery('')} style={{ color:'var(--color-text-muted)', fontSize:'0.8rem' }}>✕</button>
          )}
        </div>

        <div className="global-search-results">
          {!hasProject && (
            <div className="global-search-empty">Carga un proyecto primero para buscar.</div>
          )}
          {hasProject && !query && (
            <div className="global-search-empty">Empieza a escribir para buscar en el proyecto.</div>
          )}
          {hasProject && query && results.length === 0 && (
            <div className="global-search-empty">Sin resultados para «{query}».</div>
          )}
          {results.map((r, i) => (
            <button key={i} className={`global-search-item${cursor===i?' global-search-item--active':''}`}
              onClick={() => goTo(r.route)}
              onMouseEnter={() => setCursor(i)}>
              <span className="global-search-icon">{r.icon}</span>
              <span className="global-search-label">{r.label}</span>
              <span className="global-search-sub">{r.sub}</span>
              <span className="global-search-kind">{r.kind}</span>
            </button>
          ))}
        </div>

        <div className="global-search-footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
