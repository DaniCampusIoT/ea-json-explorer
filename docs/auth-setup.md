# Configuración de autenticación Microsoft Entra ID

Esta aplicación usa **OAuth 2.0 + OIDC** a través de Microsoft Entra ID (Azure AD).
Solo los usuarios con email `@quandum.com` pueden acceder.

---

## 1. Registrar la aplicación en Azure Portal

1. Ve a [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name**: `EA JSON Explorer`
3. **Supported account types**: *Accounts in this organizational directory only (Quandum Aerospaces only — Single tenant)*
4. **Redirect URI**: `Single-page application (SPA)` → `http://localhost:5173` para desarrollo.
   - Añade también la URL de producción cuando la tengas.
5. Clic en **Register**.

---

## 2. Obtener los IDs necesarios

En la página de la aplicación recién registrada:

| Variable | Dónde encontrarla |
|---|---|
| `VITE_AZURE_CLIENT_ID` | Overview → **Application (client) ID** |
| `VITE_AZURE_TENANT_ID` | Overview → **Directory (tenant) ID** |

---

## 3. Configurar permisos

En **API permissions** → **Add a permission** → **Microsoft Graph**:
- `openid` (delegated)
- `profile` (delegated)
- `email` (delegated)
- `User.Read` (delegated)

Haz clic en **Grant admin consent** si tienes permisos de administrador.

---

## 4. Configurar el frontend

```bash
cd frontend
cp .env.example .env.local
# Edita .env.local con los valores del paso 2
```

Instala las dependencias nuevas:

```bash
npm install
```

Arrancar en desarrollo:

```bash
npm run dev
```

---

## 5. Cómo funciona el flujo

```
Usuario abre la app
       │
       ▼
  AuthGuard comprueba si hay sesión activa
       │
   NO ─┤─ YES
       │        │
       ▼        ▼
  LoginPage   Valida email @quandum.com
  (botón      │
  Microsoft)  ├── OK  → App normal
       │      │
       │      └── KO  → Pantalla "Acceso denegado"
       │
       ▼
  loginRedirect → Microsoft login → redirect back
       │
       ▼
  MSAL captura el token → setActiveAccount
       │
       ▼
  AuthGuard re-evalúa → acceso concedido
```

---

## 6. Seguridad adicional (recomendado)

- **Restringir al tenant**: Cambia `authority` a `https://login.microsoftonline.com/{TENANT_ID}` (ya configurado si defines `VITE_AZURE_TENANT_ID`).
- **Conditional Access**: En Azure Portal, crea una política de acceso condicional que limite la app a dispositivos compliance o ubicaciones de red de Quandum.
- **Backend guard**: Añade validación del JWT de Microsoft en FastAPI si los endpoints deben ser también seguros por sí solos (ver `backend/auth/` — pendiente de implementar).
