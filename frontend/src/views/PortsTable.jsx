import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAI } from '../context/AIContext'

export default function PortsTable() {
  const { project } = useAI()
  const navigate    = useNavigate()
  const [filter,    setFilter]    = useState('')
  const [sortBy,    setSortBy]    = useState('port')
  const [sortDir,   setSortDir]   = useState('asc')
  const [pkgFilter, setPkgFilter] = useState('')

  const ports      = project?.ports      || []
  const connectors = project?.connectors || []
  const blocks     = project?.blocks     || []
  const packages   = project?.packages   || []
  const idMap      = project?.idMap      || {}

  // Resolver puerto o bloque -> bloque padre (por si source/target es un puerto)
  function resolveBlock(id) {
    const entry = idMap[id]
    if (!entry) return null
    if (entry.type === 'uml:Port') {
      const parent = idMap[entry.parentId]
      return (parent?.type === 'uml:Class' || parent?.type === 'uml:Component') ? parent : null
    }
    return (entry.type === 'uml:Class' || entry.type === 'uml:Component') ? entry : null
  }

  const rows = useMemo(() => {
    return ports
      .filter(p => p.name)
      .map(p => {
        const parentBlock = blocks.find(b => b.id === p.parentId)
        const parentPkg   = idMap[parentBlock?.parentId]?.name || ''

        // Conectores que usan este puerto como source o target (_role)
        const linkedConns = connectors.filter(c =>
          c.source === p.id || c.target === p.id
        )
        const peers = linkedConns.map(c => {
          const peerId     = c.source === p.id ? c.target : c.source
          const peerEntry  = idMap[peerId]
          const peerPort   = peerEntry?.type === 'uml:Port' ? peerEntry : null
          const peerBlock  = peerPort
            ? blocks.find(b => b.id === peerPort.parentId)
            : resolveBlock(peerId)
          return {
            portName:  peerPort?.name || '',
            blockName: peerBlock?.name || idMap[peerId]?.name || '',
            blockId:   peerBlock?.id  || '',
            connKind:  c.kind?.replace('uml:', '') || '',
            connName:  c.name || '',
          }
        })

        return {
          portId:    p.id,
          portName:  p.name,
          blockName: parentBlock?.name || '',
          blockId:   parentBlock?.id   || '',
          pkg:       parentPkg,
          peers,
          connected: peers.length > 0,
        }
      })
  }, [ports, connectors, blocks, idMap])

  const q        = filter.trim().toLowerCase()
  const filtered = rows.filter(r => {
    if (pkgFilter && r.pkg !== pkgFilter) return false
    if (!q) return true
    return r.portName.toLowerCase().includes(q) ||
           r.blockName.toLowerCase().includes(q) ||
           r.peers.some(p => p.blockName.toLowerCase().includes(q))
  })

  const sorted = [...filtered].sort((a, b) => {
    const va = sortBy === 'port'  ? a.portName
             : sortBy === 'block' ? a.blockName
             : (a.peers[0]?.blockName || '')
    const vb = sortBy === 'port'  ? b.portName
             : sortBy === 'block' ? b.blockName
             : (b.peers[0]?.blockName || '')
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }
  const arrow = col => sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  const uniquePkgs = [...new Set(rows.map(r => r.pkg).filter(Boolean))].sort()
  const connected  = rows.filter(r => r.connected).length

  // Guards
  if (!project || (!ports.length && !blocks.length)) return (
    <div className="empty-state">
      <span style={{fontSize:'3rem'}}>🔌</span>
      <p>No hay proyecto cargado. Ve a <strong>Cargar proyecto</strong> primero.</p>
    </div>
  )
  if (!ports.length) return (
    <div className="empty-state">
      <span style={{fontSize:'3rem'}}>🔌</span>
      <p>El proyecto no contiene puertos.</p>
    </div>
  )

  return (
    <div style={{maxWidth:'1100px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.5rem'}}>
        <h2 style={{fontSize:'1.25rem',fontWeight:700,flex:1}}>🔌 Trazabilidad de puertos</h2>
        <span style={{fontSize:'0.8rem',color:'var(--color-text-muted)'}}>
          {connected} / {rows.length} conectados
        </span>
      </div>
      <p style={{color:'var(--color-text-muted)',fontSize:'0.875rem',marginBottom:'1.25rem'}}>
        Relación completa de puertos, sus bloques y las conexiones entre ellos.
      </p>

      {/* Filtros */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar por puerto, bloque o par…"
          style={{flex:1,minWidth:'200px',padding:'0.5rem 0.75rem',
            border:'1px solid var(--color-border)',borderRadius:'0.5rem',
            fontSize:'0.85rem',background:'var(--color-surface)',color:'var(--color-text)'}} />
        <select value={pkgFilter} onChange={e => setPkgFilter(e.target.value)}
          style={{padding:'0.5rem 0.75rem',border:'1px solid var(--color-border)',
            borderRadius:'0.5rem',fontSize:'0.85rem',
            background:'var(--color-surface)',color:'var(--color-text)'}}>
          <option value="">Todos los paquetes</option>
          {uniquePkgs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(filter || pkgFilter) && (
          <button className="btn btn-ghost" style={{fontSize:'0.8rem'}}
            onClick={() => { setFilter(''); setPkgFilter('') }}>✕ Limpiar</button>
        )}
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.5rem',marginBottom:'1.25rem'}}>
        {[
          { label:'Puertos totales', val:rows.length,           icon:'🔌' },
          { label:'Conectados',      val:connected,             icon:'🟢' },
          { label:'Sin conexión',    val:rows.length-connected, icon:'⚪' },
        ].map(s => (
          <div key={s.label} style={{padding:'0.6rem 0.75rem',background:'var(--color-surface)',
            borderRadius:'0.5rem',textAlign:'center',border:'1px solid var(--color-border)'}}>
            <div style={{fontSize:'1.4rem',fontWeight:700,color:'var(--color-primary)'}}>{s.icon} {s.val}</div>
            <div style={{fontSize:'0.72rem',color:'var(--color-text-muted)',marginTop:'0.1rem'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="empty-state" style={{padding:'2rem'}}>
          <span style={{fontSize:'2rem'}}>🔍</span>
          <p>Sin resultados para «{filter}».</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.82rem'}}>
            <thead>
              <tr style={{borderBottom:'2px solid var(--color-border)',
                textAlign:'left',color:'var(--color-text-muted)'}}>
                {[
                  ['port',  '🔌 Puerto'],
                  ['block', '🧱 Bloque'],
                  [null,    '📦 Paquete'],
                  ['peer',  '🔗 Conecta con'],
                  [null,    'Tipo'],
                ].map(([col, label], i) => (
                  <th key={i} onClick={col ? () => toggleSort(col) : undefined}
                    style={{padding:'0.5rem 0.75rem',fontWeight:600,whiteSpace:'nowrap',
                      cursor:col?'pointer':'default',userSelect:'none'}}>
                    {label}{col ? arrow(col) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, ri) => {
                const bg = ri%2===0 ? 'transparent' : 'var(--color-surface)'
                const rowspan = Math.max(row.peers.length, 1)
                return row.peers.length === 0
                  ? (
                    <tr key={row.portId} style={{borderBottom:'1px solid var(--color-border)',background:bg}}>
                      <td style={{padding:'0.45rem 0.75rem',fontFamily:'monospace',color:'var(--color-primary)'}}>{row.portName}</td>
                      <td style={{padding:'0.45rem 0.75rem'}}>
                        {row.blockId
                          ? <button className="btn btn-ghost" style={{fontSize:'0.78rem',padding:'0.15rem 0.4rem'}}
                              onClick={() => navigate(`/summary/${row.blockId}`)}>{row.blockName}</button>
                          : row.blockName}
                      </td>
                      <td style={{padding:'0.45rem 0.75rem',color:'var(--color-text-muted)',fontSize:'0.75rem'}}>{row.pkg}</td>
                      <td colSpan={2} style={{padding:'0.45rem 0.75rem'}}>
                        <span style={{color:'var(--color-text-muted)',fontSize:'0.75rem'}}>— sin conexión</span>
                      </td>
                    </tr>
                  )
                  : row.peers.map((peer, pi) => (
                    <tr key={`${row.portId}-${pi}`} style={{
                      borderBottom: pi===row.peers.length-1?'1px solid var(--color-border)':'none',
                      background:bg}}>
                      {pi === 0 && (
                        <>
                          <td rowSpan={rowspan} style={{padding:'0.45rem 0.75rem',
                            fontFamily:'monospace',color:'var(--color-primary)',
                            verticalAlign:'top',borderRight:'1px solid var(--color-border)'}}>
                            {row.portName}
                          </td>
                          <td rowSpan={rowspan} style={{padding:'0.45rem 0.75rem',verticalAlign:'top'}}>
                            {row.blockId
                              ? <button className="btn btn-ghost" style={{fontSize:'0.78rem',padding:'0.15rem 0.4rem'}}
                                  onClick={() => navigate(`/summary/${row.blockId}`)}>{row.blockName}</button>
                              : row.blockName}
                          </td>
                          <td rowSpan={rowspan} style={{padding:'0.45rem 0.75rem',
                            color:'var(--color-text-muted)',fontSize:'0.75rem',verticalAlign:'top'}}>
                            {row.pkg}
                          </td>
                        </>
                      )}
                      <td style={{padding:'0.45rem 0.75rem'}}>
                        <div style={{display:'flex',flexDirection:'column',gap:'0.15rem'}}>
                          {peer.blockId
                            ? <button className="btn btn-ghost" style={{fontSize:'0.78rem',padding:'0.15rem 0.4rem',textAlign:'left'}}
                                onClick={() => navigate(`/summary/${peer.blockId}`)}>{peer.blockName}</button>
                            : <span>{peer.blockName || '—'}</span>}
                          {peer.portName && (
                            <span style={{fontSize:'0.71rem',fontFamily:'monospace',
                              color:'var(--color-text-muted)',paddingLeft:'0.4rem'}}>
                              .{peer.portName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{padding:'0.45rem 0.75rem'}}>
                        <span style={{fontSize:'0.72rem',background:'var(--color-surface-offset)',
                          padding:'0.1rem 0.4rem',borderRadius:'0.25rem',
                          color:'var(--color-text-muted)',whiteSpace:'nowrap'}}>
                          {peer.connKind || peer.connName || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
