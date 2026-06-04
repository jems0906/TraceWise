import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse

from app.database import get_db
from app.security import auth_required, get_role
from app.utils.audit import log_audit_event

try:
    from authlib.integrations.starlette_client import OAuth
except Exception:
    OAuth = None


router = APIRouter(prefix="/auth", tags=["auth"])


class DemoLoginPayload(BaseModel):
    email: str
    name: str = "Business Analyst"
    role: str = "analyst"


def _build_oauth_client() -> Any:
    if OAuth is None:
        return None

    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None

    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url=os.getenv(
            "GOOGLE_DISCOVERY_URL",
            "https://accounts.google.com/.well-known/openid-configuration",
        ),
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth


@router.get("/me")
async def me(request: Request):
    user = request.session.get("user")
    oauth_ready = _build_oauth_client() is not None
    role = get_role(user) if user else "guest"
    can_write = role in {"analyst", "admin"}
    can_export_audit = role == "admin"
    return {
        "auth_required": auth_required(),
        "oauth_ready": oauth_ready,
        "demo_login_enabled": os.getenv("DEMO_LOGIN_ENABLED", "true").lower() == "true",
        "user": user,
        "permissions": {
            "can_write": can_write,
            "can_export_audit": can_export_audit,
        },
    }


@router.get("/login")
async def login(request: Request):
    oauth = _build_oauth_client()
    if oauth is None:
        raise HTTPException(status_code=503, detail="OAuth is not configured")

    redirect_uri = request.url_for("auth_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="auth_callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    oauth = _build_oauth_client()
    if oauth is None:
        raise HTTPException(status_code=503, detail="OAuth is not configured")

    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        user_info = await oauth.google.userinfo(token=token)

    request.session["user"] = {
        "email": user_info.get("email", ""),
        "name": user_info.get("name", "User"),
        "role": "analyst",
    }
    log_audit_event(
        db,
        action="auth.oauth_login",
        target_type="session",
        target_id=request.session["user"].get("email", ""),
        details={"provider": "google"},
        request=request,
    )
    db.commit()

    return RedirectResponse(url="/", status_code=302)


@router.post("/demo-login")
async def demo_login(payload: DemoLoginPayload, request: Request, db: Session = Depends(get_db)):
    if os.getenv("DEMO_LOGIN_ENABLED", "true").lower() != "true":
        raise HTTPException(status_code=403, detail="Demo login is disabled")

    request.session["user"] = {
        "email": payload.email,
        "name": payload.name,
        "role": payload.role.lower(),
    }
    log_audit_event(
        db,
        action="auth.demo_login",
        target_type="session",
        target_id=request.session["user"].get("email", ""),
        details={"role": request.session["user"].get("role", "analyst")},
        request=request,
    )
    db.commit()
    return {"ok": True, "user": request.session["user"]}


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    current_user = request.session.get("user") or {}
    log_audit_event(
        db,
        action="auth.logout",
        target_type="session",
        target_id=current_user.get("email", "unknown"),
        details={},
        request=request,
    )
    db.commit()
    request.session.clear()
    return {"ok": True}
