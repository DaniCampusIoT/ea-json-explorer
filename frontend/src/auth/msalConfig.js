/**
 * Configuración MSAL para Microsoft Entra ID (Azure AD).
 * Reemplaza los valores VITE_* en tu .env.local con los datos
 * de tu registro de aplicación en Azure Portal.
 *
 * ALLOWED_DOMAIN restringe el acceso a cuentas @quandum.com.
 */
export const ALLOWED_DOMAIN = 'quandum.com'

export const msalConfig = {
  auth: {
    // ID de la aplicación registrada en Azure Portal
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    // 'common' acepta cualquier tenant; usa el tenant ID de Quandum para mayor restricción
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID ?? 'common'}`,
    // Debe coincidir exactamente con la URI de redirección registrada en Azure Portal
    redirectUri: import.meta.env.VITE_REDIRECT_URI ?? window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // sessionStorage: se limpia al cerrar el navegador
    storeAuthStateInCookie: false,
  },
}

// Scopes mínimos: openid + profile para leer email y nombre
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
  // Fuerza que el email del usuario sea del dominio correcto antes de completar el login
  domainHint: ALLOWED_DOMAIN,
}
