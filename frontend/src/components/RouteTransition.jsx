import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Envuelve el contenido de las rutas y aplica un fade-in
 * de 150ms cada vez que cambia la ruta.
 */
export default function RouteTransition({ children }) {
  const location = useLocation()
  const [visible, setVisible] = useState(true)
  const prev = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname === prev.current) return
    prev.current = location.pathname
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transition: 'opacity 150ms ease',
    }}>
      {children}
    </div>
  )
}
