import os
from typing import Any, Dict

from fastapi import HTTPException, Request


def auth_required() -> bool:
    return os.getenv("AUTH_REQUIRED", "false").lower() == "true"


def _session_user(request: Request) -> Dict[str, Any] | None:
    user = request.session.get("user")
    return user if isinstance(user, dict) else None


def get_current_user(request: Request) -> Dict[str, Any] | None:
    return _session_user(request)


def get_role(user: Dict[str, Any] | None) -> str:
    return ((user or {}).get("role") or "analyst").lower()


def require_write_access(request: Request) -> Dict[str, Any] | None:
    user = _session_user(request)

    # Viewer is always read-only when logged in, even if auth is optional.
    if user and get_role(user) == "viewer":
        raise HTTPException(status_code=403, detail="Viewer role is read-only")

    if not auth_required():
        return user

    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    role = get_role(user)
    if role not in {"analyst", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient role for write access")

    return user


def require_admin_access(request: Request) -> Dict[str, Any]:
    user = _session_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    if get_role(user) != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    return user
