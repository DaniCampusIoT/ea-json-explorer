import { useState } from 'react'

const STORAGE_KEY = 'arcana-recent-v3'
const MAX_PROJECTS = 5

export function useProjectHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] }
    catch { return [] }
  })

  function _persist(next) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

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
      _persist(next)
      return next
    })
  }

  function removeProject(name) {
    setHistory(prev => {
      const next = prev.filter(p => p.name !== name)
      _persist(next); return next
    })
  }

  function clearHistory() {
    setHistory([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return { history, saveProject, removeProject, clearHistory }
}
