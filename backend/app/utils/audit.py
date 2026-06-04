import json
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditEvent


def log_audit_event(
    db: Session,
    action: str,
    target_type: str,
    target_id: str,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
    user: dict[str, Any] | None = None,
) -> AuditEvent:
    actor = user or (request.session.get("user") if request and hasattr(request, "session") else None) or {}

    row = AuditEvent(
        user_email=actor.get("email", "system"),
        user_name=actor.get("name", "System"),
        user_role=actor.get("role", "system"),
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details_json=json.dumps(details or {}),
    )
    db.add(row)
    db.flush()
    return row
