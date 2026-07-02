import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Explorer() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/packages')
      .then(r => r.json())
      .then(data => { setPackages(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="empty-state"><p>Cargando paquetes...</p></div>

  if (!packages.length) return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem' }}>📭</span>
      <p>No hay proyecto cargado. Ve a Cargar proyecto primero.</p>
    </div>
  )

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Explorador de paquetes</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {packages.map(pkg => (
          <div key={pkg.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/summary/${pkg.id}`)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📦</span>
              <span className="card-title" style={{ margin: 0 }}>{pkg.name}</span>
            </div>
            {pkg.documentation && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                {pkg.documentation.slice(0, 120)}{pkg.documentation.length > 120 ? '…' : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="tag">🧱 {pkg.block_count} bloques</span>
              <span className="tag">📂 {pkg.children_count} subpaquetes</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
