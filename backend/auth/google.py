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
JWT_SECRET           = os.getenv("JWT_SECRET", "cambia-este-secreto-en-produccion")
JWT_EXPIRE_HOURS     = 8


@router.get("/google/login")
def google_login():
    params = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=select_account"
    )
    return RedirectResponse(params)


@router.get("/google/callback")
async def google_callback(code: str):
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
        error_desc = token_data.get('error_description', token_data['error'])
        return RedirectResponse(f"{FRONTEND_URL}?auth_error={error_desc}")

    id_token_raw = token_data.get("id_token", "")
    try:
        user_info = jwt.decode(
            id_token_raw,
            key="",
            algorithms=["RS256"],
            options={
                "verify_signature": False,
                "verify_aud":       False,
                "verify_at_hash":   False,
            },
        )
    except Exception as e:
        raise HTTPException(400, detail=f"id_token inválido: {e}")

    email   = user_info.get("email", "")
    name    = user_info.get("name", email)
    picture = user_info.get("picture", "")

    payload = {
        "sub":     email,
        "name":    name,
        "picture": picture,
        "exp":     datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    internal_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return RedirectResponse(f"{FRONTEND_URL}?token={internal_token}")


@router.get("/me")
def get_me(authorization: str = ""):
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(401, "Token requerido")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return {"email": data["sub"], "name": data.get("name"), "picture": data.get("picture")}
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")
