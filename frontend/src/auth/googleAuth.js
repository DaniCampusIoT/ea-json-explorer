/**
 * Google OAuth2 helpers — frontend.
 * Guarda el JWT interno en sessionStorage.
 */

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
const TOKEN_KEY = 'ea_auth_token'

export function loginWithGoogle() {
  window.location.href = `${BACKEND}/auth/google/login`
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY)
  window.location.href = '/'
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function isAuthenticated() {
  const token = getToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function getUser() {
  const token = getToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

/**
 * Lee ?token= o ?auth_error= de la URL tras el callback de Google.
 * Limpia los parámetros de la URL en ambos casos.
 * Devuelve { token } | { error, email } | null
 */
export function handleCallbackToken() {
  const params = new URLSearchParams(window.location.search)
  const token  = params.get('token')
  const error  = params.get('auth_error')
  const email  = params.get('email') || ''

  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token)
    // Limpia la URL sin recargar
    window.history.replaceState({}, '', window.location.pathname)
    return { token }
  }

  if (error) {
    window.history.replaceState({}, '', window.location.pathname)
    return { error, email }
  }

  return null
}
