import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Ingest({ onLoaded }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al procesar el archivo')
      }
      const data = await res.json()
      setResult(data)
      onLoaded(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cargar proyecto</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Sube el archivo JSON exportado desde Enterprise Architect.
      </p>

      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '1rem', padding: '2rem', border: '2px dashed var(--color-border)',
        borderRadius: '0.75rem', cursor: 'pointer', background: 'var(--color-surface)',
        transition: 'border-color 180ms'
      }}>
        <span style={{ fontSize: '2.5rem' }}>📂</span>
        <span style={{ fontWeight: 500 }}>{loading ? 'Procesando...' : 'Selecciona o arrastra el JSON'}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Formato: .json exportado de EA</span>
        <input type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} disabled={loading} />
      </label>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fdf0f0', border: '1px solid #f5c6c6', borderRadius: '0.5rem', color: '#c0392b', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem' }} className="card">
          <div className="card-title">✅ Proyecto cargado</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
            {Object.entries(result).map(([k, v]) => (
              <div key={k} style={{ padding: '0.5rem', background: 'var(--color-bg)', borderRadius: '0.375rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{v}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{k}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/explorer')}>
            Explorar proyecto →
          </button>
        </div>
      )}
    </div>
  )
}
