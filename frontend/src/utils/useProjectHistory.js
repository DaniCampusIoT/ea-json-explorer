import { useState, useEffect } from 'react'

const STORAGE_KEY = 'arcana-recent-projects'
const MAX_PROJECTS = 5

/**
 * Guarda y recupera los últimos MAX_PROJECTS proyectos en localStorage.
 * Cada entrada: { name, date (ISO), stats, data (window.eaProject serializable) }
 */
export function useProjectHistory() {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
    } catch { return [] }
  })

  function saveProject(name, stats) {
    // Serializa la parte ligera del proyecto (sin raw completo para no saturar localStorage)
    const snapshot = {
      name,
      date: new Date().toISOString(),
      stats,
      project: {
        packages:   window.eaProject?.packages   || [],
        blocks:     window.eaProject?.blocks     || [],
        connectors: window.eaProject?.connectors || [],
        ports:      window.eaProject?.ports      || [],
        idMap:      window.eaProject?.idMap      || {},
      },
    }
    setHistory(prev => {
      const filtered = prev.filter(p => p.name !== name)
      const next = [snapshot, ...filtered].slice(0, MAX_PROJECTS)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function loadProject(entry) {
    window.eaProject = entry.project
    return entry
  }

  function removeProject(name) {
    setHistory(prev => {
      const next = prev.filter(p => p.name !== name)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return { history, saveProject, loadProject, removeProject }
}
