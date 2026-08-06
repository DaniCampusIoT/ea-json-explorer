import React, { createContext, useContext, useState, useCallback } from 'react'
import { BACKEND_URL } from '../config'

const AIContext = createContext(null)

const EMPTY_PROJECT = { packages: [], blocks: [], connectors: [], ports: [], idMap: {} }

export function AIProvider({ children }) {
  const [project, setProjectState] = useState(EMPTY_PROJECT)
  const [history, setHistory]      = useState([])
  const [answer,  setAnswer]       = useState(null)
  const [loading, setLoading]      = useState(false)
  const [error,   setError]        = useState(null)

  const setProject = useCallback((proj) => {
    const safe = proj || EMPTY_PROJECT
    window.eaProject = { ...safe }
    setProjectState(safe)
  }, [])

  async function ask(question) {
    if (!question.trim()) return
    setLoading(true); setAnswer(null); setError(null)
    const token = sessionStorage.getItem('ea_auth_token') || ''
    try {
      const res = await fetch(`${BACKEND_URL}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setAnswer(data.answer)
      setHistory(prev => [{ question, answer: data.answer }, ...prev.slice(0, 19)])
      return data.answer
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() { setHistory([]); setAnswer(null); setError(null) }

  return (
    <AIContext.Provider value={{
      project, setProject,
      history, answer, loading, error, ask, clearHistory,
    }}>
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('useAI must be used inside AIProvider')
  return ctx
}
