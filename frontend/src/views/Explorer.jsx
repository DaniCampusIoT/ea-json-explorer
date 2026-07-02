import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Explorer() {
  const [packages, setPackages] = useState([])
  const [blocks,   setBlocks]   = useState([])
  const [selected, setSelected] = useState(null)
  const [source,   setSource]   = useState('') // 'backend' | 'local'
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/packages')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const pkgs = Array.isArray(data) ? data : []
        setPackages(pkgs)
        setSource('backend')
        // Build blocks list from package block_count metadata
        // Full block list comes from /api/packages response (each pkg has children)
      })
      .catch(() => {
        // Fallback to client-side parsed data
        const proj = window.eaProject
        if (proj) {
          setPackages(proj.packages || [])
          setBlocks(proj.blocks || [])
          setSource('local')
        }
      })
  }, [])

  // If backend responded, fetch all blocks separately
  useEffect(() => {
    if (source !== 'backend') return
    fetch('/api/blocks')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setBlocks(Array.isArray(data) ? data : []))
      .catch(() => {
        // Backend has no /api/blocks list endpoint yet — use local
        const proj = window.eaProject
        if (proj) setBlocks(proj.blocks || [])
      })
  }, [source])

  const noProject = !packages.length && !blocks.length

  if (noProject) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>💭</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )

  const visibleBlocks = selected
    ? blocks.filter(b => b.parentId === selected || b.parent_id === selected)
    : blocks

  const activePackage = packages.find(p => p.id === selected)
  const idMap = window.eaProject?.idMap || {}

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Package tree */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Paquetes ({packages.length})
        </div>
        <button onClick={() => setSelected(null)} style={{
          width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
          marginBottom: '0.25rem', fontSize: '0.85rem', border: 'none', cursor: 'pointer',
          background: !selected ? 'var(--color-primary-highlight)' : 'transparent',
          color: !selected ? 'var(--color-primary)' : 'var(--color-text)',
          fontWeight: !selected ? 700 : 400,
        }}>
          🗂 Todos ({blocks.length})
        </button>
        {packages.map(pkg => {
          const pkgId = pkg.id
          const childCount = blocks.filter(b => b.parentId === pkgId || b.parent_id === pkgId).length
          const isActive = selected === pkgId
          return (
            <button key={pkgId} onClick={() => setSelected(isActive ? null : pkgId)} style={{
              width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              marginBottom: '0.25rem', fontSize: '0.85rem', border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--color-primary-highlight)' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              fontWeight: isActive ? 700 : 400,
            }}>
              📦 {pkg.name || pkg.id}
              {childCount > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{childCount}</span>}
            </button>
          )
        })}
      </div>

      {/* Block grid */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {activePackage ? `Bloques en «${activePackage.name || activePackage.id}» (${visibleBlocks.length})` : `Todos los bloques (${visibleBlocks.length})`}
        </div>

        {visibleBlocks.length === 0 && (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <span style={{ fontSize: '2rem' }}>📦</span>
            <p style={{ fontSize: '0.85rem' }}>Este paquete no tiene bloques directos.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {visibleBlocks.map(block => {
            const bid = block.id
            const bports = (window.eaProject?.ports || []).filter(p => p.parentId === bid)
            return (
              <div key={bid} className="card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/summary/${bid}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1rem' }}>🧻</span>
                  <span className="card-title" style={{ margin: 0, fontSize: '0.88rem' }}>{block.name}</span>
                </div>
                {bports.length > 0 && (
                  <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
                    🔌 {bports.length} puerto{bports.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
