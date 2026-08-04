/**
 * googleAuth.js — gestión de sesión con Google OAuth (JWT interno).
 * Sustituye a msalConfig.js / MSAL.
 */

export const ALLOWED_DOMAIN = 'quandum.com'
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'ea_jwt'

/** Inicia el flujo OAuth redirigiendo al backend */
export function loginWithGoogle() {
  window.location.href = `${API_URL}/auth/google/login`
}

/** Guarda el token que devuelve el callback */
export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

/** Lee el token de sesión */
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

/** Elimina el token (logout) */
export function logout() {
  sessionStorage.removeItem(TOKEN_KEY)
  window.location.href = '/'
}

/** Devuelve true si hay token activo y no ha expirado */
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

/** Parsea el payload del JWT sin verificar firma (solo frontend) */
export function getUser() {
  const token = getToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

/** Captura el token de la URL tras el callback y lo persiste */
export function handleCallbackToken() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const authError = params.get('auth_error')
  if (token) {
    saveToken(token)
    // Limpia la URL
    window.history.replaceState({}, '', '/')
    return { ok: true }
  }
  if (authError) {
    window.history.replaceState({}, '', '/')
    return { ok: false, error: authError }
  }
  return null
}
