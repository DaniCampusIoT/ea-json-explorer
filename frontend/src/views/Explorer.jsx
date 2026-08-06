import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAI } from '../context/AIContext'

// Construye el árbol: paquete -> sub-paquetes -> bloques
function buildTree(packages, blocks, hideUnnamed) {
  const namedBlocks = hideUnnamed ? blocks.filter(b => b.name?.trim()) : blocks

  // Índice de hijos de paquetes
  const childPkgs = {}   // pkgId -> [pkg]
  const pkgBlocks = {}   // pkgId -> [block]
  const rootPkgs  = []

  for (const pkg of packages) {
    const pid = pkg.parentId || pkg.parent_id || null
    if (pid) {
      if (!childPkgs[pid]) childPkgs[pid] = []
      childPkgs[pid].push(pkg)
    } else {
      rootPkgs.push(pkg)
    }
  }

  for (const b of namedBlocks) {
    const pid = b.parentId || b.parent_id || '__root__'
    if (!pkgBlocks[pid]) pkgBlocks[pid] = []
    pkgBlocks[pid].push(b)
  }

  return { rootPkgs, childPkgs, pkgBlocks, namedBlocks }
}

function PkgNode({ pkg, childPkgs, pkgBlocks, ports, depth, navigate, searchQ }) {
  const [open, setOpen] = useState(depth < 2)
  const subPkgs  = childPkgs[pkg.id]  || []
  const myBlocks = pkgBlocks[pkg.id]  || []
  const filteredBlocks = searchQ
    ? myBlocks.filter(b => b.name?.toLowerCase().includes(searchQ))
    : myBlocks
  const hasChildren = subPkgs.length > 0 || filteredBlocks.length > 0
  const indent = depth * 16

  return (
    <div>
      {/* Paquete row */}
      <div
        onClick={() => hasChildren && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.35rem 0.5rem',
          paddingLeft: `${indent + 8}px`,
          borderRadius: '0.4rem',
          cursor: hasChildren ? 'pointer' : 'default',
          userSelect: 'none',
          background: open && hasChildren ? 'var(--color-primary-highlight)' : 'transparent',
          color: open && hasChildren ? 'var(--color-primary)' : 'var(--color-text)',
          fontWeight: depth === 0 ? 600 : 500,
          fontSize: '0.85rem',
          transition: 'background 120ms',
        }}
      >
        <span style={{ fontSize: '0.65rem', opacity: 0.6, width: '12px', flexShrink: 0 }}>
          {hasChildren ? (open ? '▼' : '▶') : ' '}
        </span>
        <span style={{ fontSize: '0.9rem' }}>📦</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pkg.name?.trim() || <em style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>sin nombre</em>}
        </span>
        {hasChildren && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {filteredBlocks.length + subPkgs.length}
          </span>
        )}
      </div>

      {/* Hijos */}
      {open && hasChildren && (
        <div>
          {/* Sub-paquetes */}
          {subPkgs.map(sub => (
            <PkgNode key={sub.id} pkg={sub} childPkgs={childPkgs} pkgBlocks={pkgBlocks}
              ports={ports} depth={depth + 1} navigate={navigate} searchQ={searchQ} />
          ))}
          {/* Bloques */}
          {filteredBlocks.map(block => {
            const bports = ports.filter(p => (p.parentId || p.owner_id) === block.id)
            return (
              <div key={block.id}
                onClick={() => navigate(`/summary/${block.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.3rem 0.5rem',
                  paddingLeft: `${indent + 32}px`,
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  color: 'var(--color-text)',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: '0.85rem' }}>🧱</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.name?.trim() || <em style={{ color: 'var(--color-text-muted)' }}>sin nombre</em>}
                </span>
                {bports.length > 0 && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    🔌{bports.length}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Explorer() {
  const { project } = useAI()
  const navigate = useNavigate()
  const [hideUnnamed, setHideUnnamed] = useState(true)
  const [search, setSearch] = useState('')

  const { packages = [], blocks = [], ports = [] } = project || {}

  if (!packages.length && !blocks.length) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>💭</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )

  const searchQ = search.trim().toLowerCase()
  const { rootPkgs, childPkgs, pkgBlocks, namedBlocks } = useMemo(
    () => buildTree(packages, blocks, hideUnnamed),
    [packages, blocks, hideUnnamed]
  )

  const unnamedCount = blocks.length - blocks.filter(b => b.name?.trim()).length

  // Bloques sin paquete asignado
  const orphanBlocks = (hideUnnamed
    ? blocks.filter(b => b.name?.trim())
    : blocks
  ).filter(b => {
    const pid = b.parentId || b.parent_id
    return !pid
  }).filter(b => !searchQ || b.name?.toLowerCase().includes(searchQ))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {namedBlocks.length} bloques · {packages.length} paquetes
          {unnamedCount > 0 && ` · ${unnamedCount} sin nombre ${hideUnnamed ? '(ocultos)' : ''}`}
        </span>

        <input
          type="search" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Filtrar bloques…"
          style={{
            padding: '0.35rem 0.75rem', borderRadius: '0.4rem',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)',
            fontSize: '0.82rem', width: '200px',
          }}
        />

        {unnamedCount > 0 && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none',
            color: hideUnnamed ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}>
            <input type="checkbox" checked={hideUnnamed}
              onChange={e => setHideUnnamed(e.target.checked)}
              style={{ accentColor: 'var(--color-primary)', width: '14px', height: '14px' }}
            />
            Ocultar sin nombre
          </label>
        )}
      </div>

      {/* Árbol jerárquico */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '0.75rem 0.5rem',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 200px)',
      }}>
        {rootPkgs.map(pkg => (
          <PkgNode key={pkg.id} pkg={pkg} childPkgs={childPkgs} pkgBlocks={pkgBlocks}
            ports={ports} depth={0} navigate={navigate} searchQ={searchQ} />
        ))}

        {orphanBlocks.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{
              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--color-text-muted)',
              padding: '0.25rem 0.5rem', marginBottom: '0.25rem',
            }}>Sin paquete</div>
            {orphanBlocks.map(block => {
              const bports = ports.filter(p => (p.parentId || p.owner_id) === block.id)
              return (
                <div key={block.id}
                  onClick={() => navigate(`/summary/${block.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.3rem 0.5rem', paddingLeft: '24px',
                    borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.83rem',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-offset)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>🧱</span>
                  <span style={{ flex: 1 }}>{block.name?.trim()}</span>
                  {bports.length > 0 && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>🔌{bports.length}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
