"""Google OAuth2 — router de autenticación."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
import httpx
import os
from jose import jwt
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI         = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_DOMAIN       = os.getenv("ALLOWED_DOMAIN", "quandum.com")
JWT_SECRET           = os.getenv("JWT_SECRET", "cambia-este-secreto-en-produccion")
JWT_ALGORITHM        = "HS256"
JWT_EXPIRE_HOURS     = 8


@router.get("/google/login")
def google_login():
    """Redirige al consentimiento de Google."""
    params = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=select_account"
        f"&hd={ALLOWED_DOMAIN}"
    )
    return RedirectResponse(params)


@router.get("/google/callback")
async def google_callback(code: str):
    """Recibe el code de Google, verifica dominio y devuelve JWT interno."""
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
    token_data = token_resp.json()

    if "error" in token_data:
        raise HTTPException(400, detail=f"Error de Google: {token_data['error_description']}")

    # Decodifica el id_token sin verificar firma (ya lo valida Google al emitirlo)
    id_token_raw = token_data.get("id_token", "")
    try:
        user_info = jwt.decode(id_token_raw, options={"verify_signature": False})
    except Exception as e:
        raise HTTPException(400, detail=f"id_token inválido: {e}")

    email = user_info.get("email", "")
    if not email.lower().endswith(f"@{ALLOWED_DOMAIN}"):
        # Redirige al frontend con error
        return RedirectResponse(f"{FRONTEND_URL}?auth_error=domain_not_allowed")

    # Genera JWT interno
    payload = {
        "sub": email,
        "name": user_info.get("name", ""),
        "picture": user_info.get("picture", ""),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    internal_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Redirige al frontend con el token en query param
    return RedirectResponse(f"{FRONTEND_URL}?token={internal_token}")


@router.get("/me")
def get_me(authorization: str = ""):
    """Devuelve info del usuario autenticado a partir del JWT Bearer."""
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(401, "Token requerido")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"email": data["sub"], "name": data.get("name"), "picture": data.get("picture")}
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")
