import { useState } from 'react'

const STORAGE_KEY = 'arcana-recent-projects'
const MAX_PROJECTS = 5

/**
 * Historial de proyectos recientes en localStorage.
 * Cada entrada: { name, date (ISO), stats, project: { packages, blocks, connectors, ports, idMap } }
 *
 * IMPORTANTE: saveProject recibe el objeto project explicitamente en vez de
 * leerlo de window.eaProject para evitar condiciones de carrera asincronas.
 */
export function useProjectHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] }
    catch { return [] }
  })

  /**
   * @param {string} name
   * @param {object} stats   { packages, blocks, connectors, ports }
   * @param {object} project { packages[], blocks[], connectors[], ports[], idMap{} }
   */
  function saveProject(name, stats, project) {
    const snapshot = {
      name,
      date: new Date().toISOString(),
      stats,
      project: {
        packages:   project.packages   || [],
        blocks:     project.blocks     || [],
        connectors: project.connectors || [],
        ports:      project.ports      || [],
        idMap:      project.idMap      || {},
      },
    }
    setHistory(prev => {
      const next = [snapshot, ...prev.filter(p => p.name !== name)].slice(0, MAX_PROJECTS)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  /** Restaura window.eaProject y devuelve la entrada. */
  function loadProject(entry) {
    window.eaProject = { ...entry.project }
    return entry
  }

  function removeProject(name) {
    setHistory(prev => {
      const next = prev.filter(p => p.name !== name)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  return { history, saveProject, loadProject, removeProject }
}
