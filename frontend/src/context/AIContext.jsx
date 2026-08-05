import React, { createContext, useContext, useState, useCallback } from 'react'

/**
 * Contexto global compartido.
 * - historial de conversación IA (persistente entre rutas)
 * - projectVersion: incrementar fuerza re-render de Explorer/Summary
 */
const AIContext = createContext(null)

export function AIProvider({ children }) {
  const [history,        setHistory]        = useState([])
  const [answer,         setAnswer]         = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState(null)
  const [projectVersion, setProjectVersion] = useState(0)

  /** Llama a esto siempre que se cambie window.eaProject (carga nueva o reciente). */
  const bumpProject = useCallback(() => {
    setProjectVersion(v => v + 1)
  }, [])

  async function ask(question) {
    if (!question.trim()) return
    setLoading(true); setAnswer(null); setError(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  function clearHistory() {
    setHistory([]); setAnswer(null); setError(null)
  }

  return (
    <AIContext.Provider value={{
      history, answer, loading, error, ask, clearHistory,
      projectVersion, bumpProject,
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
