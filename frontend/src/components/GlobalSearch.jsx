import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Búsqueda global cross-view.
 * Busca en bloques, paquetes y conectores del proyecto cargado.
 * Ctrl+K / Cmd+K para abrir.
 */
export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Atajos de teclado
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]) }
  }, [open])

  // Buscar en el proyecto
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q || !window.eaProject) { setResults([]); return }

    const proj = window.eaProject
    const hits = []

    proj.blocks.forEach(b => {
      if (b.name?.toLowerCase().includes(q)) {
        hits.push({ kind: 'block', icon: '🧱', label: b.name, sub: proj.idMap[b.parentId]?.name || '', id: b.id, route: `/summary/${b.id}` })
      }
    })
    proj.packages.forEach(p => {
      if (p.name?.toLowerCase().includes(q)) {
        hits.push({ kind: 'package', icon: '📦', label: p.name, sub: 'Paquete', id: p.id, route: '/explorer' })
      }
    })
    proj.ports?.forEach(p => {
      if (p.name?.toLowerCase().includes(q)) {
        const parent = proj.idMap[p.parentId]
        hits.push({ kind: 'port', icon: '🔌', label: p.name, sub: parent?.name || 'Puerto', id: p.id, route: parent ? `/summary/${p.parentId}` : '/explorer' })
      }
    })
    proj.connectors?.forEach(c => {
      if (c.name?.toLowerCase().includes(q)) {
        hits.push({ kind: 'connector', icon: '🔗', label: c.name, sub: c.kind || 'Conector', id: c.id, route: '/explorer' })
      }
    })

    setResults(hits.slice(0, 12))
  }, [query])

  function goTo(route) {
    navigate(route)
    setOpen(false)
  }

  if (!open) return (
    <button
      className="global-search-trigger"
      onClick={() => setOpen(true)}
      title="Búsqueda global (Ctrl+K)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Buscar…</span>
      <kbd>Ctrl K</kbd>
    </button>
  )

  return (
    <div className="global-search-overlay" onClick={() => setOpen(false)}>
      <div className="global-search-modal" onClick={e => e.stopPropagation()}>
        <div className="global-search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar bloques, paquetes, puertos, conectores…"
            className="global-search-input"
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>✕</button>
          )}
        </div>

        <div className="global-search-results">
          {!window.eaProject && (
            <div className="global-search-empty">Carga un proyecto primero para buscar.</div>
          )}
          {window.eaProject && !query && (
            <div className="global-search-empty">Empieza a escribir para buscar en el proyecto.</div>
          )}
          {results.length === 0 && query && (
            <div className="global-search-empty">Sin resultados para «{query}».</div>
          )}
          {results.map((r, i) => (
            <button key={i} className="global-search-item" onClick={() => goTo(r.route)}>
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
