import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Explorer() {
  const [packages, setPackages] = useState([])
  const [blocks, setBlocks] = useState([])
  const [selected, setSelected] = useState(null) // selected package id
  const navigate = useNavigate()

  useEffect(() => {
    const proj = window.eaProject
    if (proj) {
      setPackages(proj.packages || [])
      setBlocks(proj.blocks || [])
    }
  }, [])

  if (!window.eaProject) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>💭</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )

  if (!packages.length && !blocks.length) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>💭</span>
      <p>El archivo se cargó pero no se encontraron paquetes ni bloques. Revisa el formato del export.</p>
    </div>
  )

  const visibleBlocks = selected
    ? blocks.filter(b => b.parentId === selected)
    : blocks

  const activePackage = packages.find(p => p.id === selected)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left: package tree */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Paquetes ({packages.length})
        </div>
        <button
          onClick={() => setSelected(null)}
          style={{
            width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem',
            background: !selected ? 'var(--color-primary-highlight)' : 'transparent',
            color: !selected ? 'var(--color-primary)' : 'var(--color-text)',
            fontWeight: !selected ? 700 : 400,
            border: 'none', cursor: 'pointer',
          }}
        >
          🗂 Todos los bloques ({blocks.length})
        </button>
        {packages.map(pkg => {
          const childBlocks = blocks.filter(b => b.parentId === pkg.id)
          const isActive = selected === pkg.id
          return (
            <button
              key={pkg.id}
              onClick={() => setSelected(isActive ? null : pkg.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem',
                background: isActive ? 'var(--color-primary-highlight)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: isActive ? 700 : 400,
                border: 'none', cursor: 'pointer',
              }}
            >
              📦 {pkg.name}
              {childBlocks.length > 0 && (
                <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {childBlocks.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Right: block grid */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {activePackage ? `Bloques en «${activePackage.name}» (${visibleBlocks.length})` : `Todos los bloques (${visibleBlocks.length})`}
        </div>

        {visibleBlocks.length === 0 && (
          <div className="empty-state">
            <span style={{ fontSize: '2rem' }}>📦</span>
            <p>Este paquete no tiene bloques directos. Prueba a seleccionar uno de sus subpaquetes.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {visibleBlocks.map(block => {
            const blockPorts = (window.eaProject?.ports || []).filter(p => p.parentId === block.id)
            return (
              <div
                key={block.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/summary/${block.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>🧻</span>
                  <span className="card-title" style={{ margin: 0, fontSize: '0.9rem' }}>{block.name}</span>
                </div>
                {blockPorts.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    🔌 {blockPorts.length} puerto{blockPorts.length !== 1 ? 's' : ''}
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
