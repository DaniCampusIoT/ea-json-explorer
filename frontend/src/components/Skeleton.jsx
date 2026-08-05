import React from 'react'

/**
 * Skeleton loader reutilizable.
 * Uso:
 *   <Skeleton width="100%" height="1.2rem" />
 *   <Skeleton variant="block" />   → cuadrado 80x80
 *   <Skeleton variant="card" />    → tarjeta completa
 */
export function Skeleton({ width = '100%', height = '1rem', borderRadius = '0.375rem', style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius, ...style }} />
  )
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <Skeleton width="60%" height="0.9rem" />
      <Skeleton width="40%" height="0.75rem" />
    </div>
  )
}

export function SkeletonAIAnswer() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'var(--color-primary-highlight)' }}>
      <Skeleton width="30%" height="0.8rem" />
      <Skeleton width="100%" height="0.85rem" />
      <Skeleton width="90%"  height="0.85rem" />
      <Skeleton width="75%"  height="0.85rem" />
      <Skeleton width="85%"  height="0.85rem" />
      <Skeleton width="50%"  height="0.85rem" />
    </div>
  )
}

export function SkeletonExplorer() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="2rem" borderRadius="0.5rem" />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}
