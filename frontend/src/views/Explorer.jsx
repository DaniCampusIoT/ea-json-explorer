import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAI } from '../context/AIContext'

export default function Explorer() {
  const { project } = useAI()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hideUnnamed, setHideUnnamed] = useState(true)  // ocultar sin nombre por defecto

  const selectedPkg = searchParams.get('pkg') || null
  function setSelected(pkgId) {
    if (pkgId) setSearchParams({ pkg: pkgId }, { replace: true })
    else       setSearchParams({},             { replace: true })
  }

  const { packages = [], blocks = [], ports = [] } = project || {}

  if (!packages.length && !blocks.length) return (
    <div className="empty-state">
      <span style={{fontSize:'3rem'}}>💭</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )

  // Filtro de nombre
  const namedBlocks = hideUnnamed ? blocks.filter(b => b.name?.trim()) : blocks

  const visibleBlocks = selectedPkg
    ? namedBlocks.filter(b => b.parentId === selectedPkg || b.parent_id === selectedPkg)
    : namedBlocks

  const activePackage = packages.find(p => p.id === selectedPkg)

  // Contar bloques (con nombre) por paquete para el árbol lateral
  const countByPkg = {}
  for (const b of namedBlocks) {
    const pid = b.parentId || b.parent_id
    if (pid) countByPkg[pid] = (countByPkg[pid] || 0) + 1
  }

  // Paquetes con al menos 1 bloque nombrado (o todos si hideUnnamed está off)
  const visiblePkgs = hideUnnamed
    ? packages.filter(p => (countByPkg[p.id] || 0) > 0 || p.name?.trim())
    : packages

  const unnamedCount = blocks.length - blocks.filter(b => b.name?.trim()).length

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>

      {/* Barra de controles */}
      <div style={{display:'flex',alignItems:'center',gap:'1rem',flexWrap:'wrap'}}>
        <span style={{fontSize:'0.8rem',color:'var(--color-text-muted)',flex:1}}>
          {namedBlocks.length} bloques
          {unnamedCount > 0 && (
            <span style={{marginLeft:'0.4rem',color:'var(--color-text-muted)'}}>
              · {unnamedCount} sin nombre {hideUnnamed ? '(ocultos)' : '(visibles)'}
            </span>
          )}
        </span>
        {unnamedCount > 0 && (
          <label style={{
            display:'flex',alignItems:'center',gap:'0.4rem',
            fontSize:'0.8rem',cursor:'pointer',userSelect:'none',
            color: hideUnnamed ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}>
            <input
              type="checkbox"
              checked={hideUnnamed}
              onChange={e => setHideUnnamed(e.target.checked)}
              style={{accentColor:'var(--color-primary)',width:'14px',height:'14px'}}
            />
            Ocultar bloques sin nombre
          </label>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:'1.5rem',alignItems:'start'}}>

        {/* Package tree */}
        <div>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',
            letterSpacing:'0.08em',color:'var(--color-text-muted)',marginBottom:'0.75rem'}}>
            Paquetes ({visiblePkgs.length})
          </div>
          <button onClick={() => setSelected(null)} style={{
            width:'100%',textAlign:'left',padding:'0.5rem 0.75rem',borderRadius:'0.5rem',
            marginBottom:'0.25rem',fontSize:'0.85rem',border:'none',cursor:'pointer',
            background: !selectedPkg?'var(--color-primary-highlight)':'transparent',
            color:      !selectedPkg?'var(--color-primary)':'var(--color-text)',
            fontWeight: !selectedPkg?700:400,
          }}>
            🗂 Todos ({namedBlocks.length})
          </button>
          {visiblePkgs.map(pkg => {
            const isActive   = selectedPkg === pkg.id
            const childCount = countByPkg[pkg.id] || 0
            return (
              <button key={pkg.id} onClick={() => setSelected(isActive ? null : pkg.id)} style={{
                width:'100%',textAlign:'left',padding:'0.5rem 0.75rem',borderRadius:'0.5rem',
                marginBottom:'0.25rem',fontSize:'0.85rem',border:'none',cursor:'pointer',
                background: isActive?'var(--color-primary-highlight)':'transparent',
                color:      isActive?'var(--color-primary)':'var(--color-text)',
                fontWeight: isActive?700:400,
                opacity: childCount === 0 ? 0.45 : 1,
              }}>
                📦 {pkg.name || <em style={{color:'var(--color-text-muted)'}}>sin nombre</em>}
                {childCount > 0 && (
                  <span style={{marginLeft:'0.4rem',fontSize:'0.7rem',color:'var(--color-text-muted)'}}>
                    {childCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Block grid */}
        <div>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',
            letterSpacing:'0.08em',color:'var(--color-text-muted)',marginBottom:'0.75rem'}}>
            {activePackage
              ? `Bloques en «${activePackage.name || activePackage.id}» (${visibleBlocks.length})`
              : `Todos los bloques (${visibleBlocks.length})`}
          </div>

          {visibleBlocks.length === 0 && (
            <div className="empty-state" style={{padding:'2rem'}}>
              <span style={{fontSize:'2rem'}}>📦</span>
              <p style={{fontSize:'0.85rem'}}>
                {selectedPkg
                  ? 'Este paquete no tiene bloques directos.'
                  : hideUnnamed
                    ? 'Todos los bloques están sin nombre. Desactiva el filtro para verlos.'
                    : 'No hay bloques.'}
              </p>
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'0.75rem'}}>
            {visibleBlocks.map(block => {
              const bports = ports.filter(p =>
                (p.parentId || p.owner_id) === block.id
              )
              const displayName = block.name?.trim()
                ? block.name
                : <em style={{color:'var(--color-text-muted)',fontSize:'0.82rem'}}>sin nombre</em>
              return (
                <div key={block.id} className="card" style={{cursor:'pointer'}}
                  onClick={() => navigate(`/summary/${block.id}`)}>
                  <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.35rem'}}>
                    <span style={{fontSize:'1rem'}}>🧱</span>
                    <span className="card-title" style={{margin:0,fontSize:'0.88rem'}}>
                      {displayName}
                    </span>
                  </div>
                  {bports.length > 0 && (
                    <div style={{fontSize:'0.73rem',color:'var(--color-text-muted)'}}>
                      🔌 {bports.length} puerto{bports.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
