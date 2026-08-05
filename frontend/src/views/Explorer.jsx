import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SkeletonExplorer } from '../components/Skeleton'

export default function Explorer() {
  const [packages, setPackages] = useState([])
  const [blocks,   setBlocks]   = useState([])
  const [source,   setSource]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Leer paquete activo desde la URL
  const selectedPkg = searchParams.get('pkg') || null

  function setSelected(pkgId) {
    if (pkgId) setSearchParams({ pkg: pkgId }, { replace: true })
    else       setSearchParams({},             { replace: true })
  }

  useEffect(() => {
    fetch('/api/packages')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setPackages(Array.isArray(data) ? data : []); setSource('backend') })
      .catch(() => {
        const proj = window.eaProject
        if (proj) { setPackages(proj.packages || []); setBlocks(proj.blocks || []); setSource('local') }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (source !== 'backend') return
    fetch('/api/blocks')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setBlocks(Array.isArray(data) ? data : []))
      .catch(() => { const proj = window.eaProject; if (proj) setBlocks(proj.blocks || []) })
  }, [source])

  if (loading) return <SkeletonExplorer />

  const noProject = !packages.length && !blocks.length
  if (noProject) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>💭</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )

  const visibleBlocks = selectedPkg
    ? blocks.filter(b => b.parentId === selectedPkg || b.parent_id === selectedPkg)
    : blocks
  const activePackage = packages.find(p => p.id === selectedPkg)

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
          background: !selectedPkg ? 'var(--color-primary-highlight)' : 'transparent',
          color:      !selectedPkg ? 'var(--color-primary)' : 'var(--color-text)',
          fontWeight: !selectedPkg ? 700 : 400,
        }}>
          🗂 Todos ({blocks.length})
        </button>
        {packages.map(pkg => {
          const pkgId     = pkg.id
          const childCount = blocks.filter(b => b.parentId === pkgId || b.parent_id === pkgId).length
          const isActive  = selectedPkg === pkgId
          return (
            <button key={pkgId} onClick={() => setSelected(isActive ? null : pkgId)} style={{
              width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              marginBottom: '0.25rem', fontSize: '0.85rem', border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--color-primary-highlight)' : 'transparent',
              color:      isActive ? 'var(--color-primary)' : 'var(--color-text)',
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
          {activePackage
            ? `Bloques en «${activePackage.name || activePackage.id}» (${visibleBlocks.length})`
            : `Todos los bloques (${visibleBlocks.length})`}
        </div>
        {visibleBlocks.length === 0 && (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <span style={{ fontSize: '2rem' }}>📦</span>
            <p style={{ fontSize: '0.85rem' }}>Este paquete no tiene bloques directos.</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {visibleBlocks.map(block => {
            const bid    = block.id
            const bports = (window.eaProject?.ports || []).filter(p => p.parentId === bid)
            return (
              <div key={bid} className="card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/summary/${bid}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1rem' }}>🧱</span>
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
