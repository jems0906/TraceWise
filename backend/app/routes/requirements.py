import csv
from datetime import datetime
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditEvent, Requirement, RequirementVersion, TraceLink
from app.schemas import (
    AuditEventResponse,
    ClarificationResponse,
    DuplicateCheckResponse,
    IntakeRequest,
    MatrixRow,
    RequirementResponse,
    RequirementUpdate,
    TraceLinkCreate,
    TraceLinkResponse,
    VersionResponse,
)
from app.security import require_admin_access, require_write_access
from app.services.ai_service import ai_service
from app.utils.audit import log_audit_event
from app.utils.exporter import export_brd, export_frd

router = APIRouter(prefix="/api", tags=["requirements"])


def _apply_audit_filters(
    query,
    actor: str | None,
    action: str | None,
    from_date: str | None,
    to_date: str | None,
    q: str | None,
):
    if actor:
        like = f"%{actor.lower()}%"
        query = query.filter(
            or_(
                func.lower(AuditEvent.user_email).like(like),
                func.lower(AuditEvent.user_name).like(like),
            )
        )

    if action:
        query = query.filter(func.lower(AuditEvent.action).like(f"%{action.lower()}%"))

    if from_date:
        try:
            start = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            query = query.filter(AuditEvent.created_at >= start)
        except ValueError:
            pass

    if to_date:
        try:
            end = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            query = query.filter(AuditEvent.created_at <= end)
        except ValueError:
            pass

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(AuditEvent.details_json).like(like),
                func.lower(AuditEvent.target_type).like(like),
                func.lower(AuditEvent.target_id).like(like),
            )
        )

    return query


@router.post("/requirements/intake", response_model=RequirementResponse)
def intake_requirement(payload: IntakeRequest, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    parsed = ai_service.parse_requirement(payload.raw_input)
    actor_email = (_user or {}).get("email", "system")
    req = Requirement(
        stakeholder=payload.stakeholder,
        raw_input=payload.raw_input,
        title=parsed["title"],
        business_requirement=parsed["business_requirement"],
        functional_requirement=parsed["functional_requirement"],
        non_functional_requirement=parsed["non_functional_requirement"],
        user_story=parsed["user_story"],
        priority=payload.priority,
        impact=parsed["impact"],
        created_by=actor_email,
        updated_by=actor_email,
    )
    db.add(req)
    db.flush()

    version = RequirementVersion(
        requirement_id=req.id,
        version=req.version,
        change_note="Initial creation",
        created_by=actor_email,
        snapshot_json=json.dumps({
            "title": req.title,
            "business_requirement": req.business_requirement,
            "functional_requirement": req.functional_requirement,
            "non_functional_requirement": req.non_functional_requirement,
            "user_story": req.user_story,
            "priority": req.priority,
            "impact": req.impact,
            "status": req.status,
        }),
    )
    db.add(version)
    log_audit_event(
        db,
        action="requirement.created",
        target_type="requirement",
        target_id=str(req.id),
        details={"title": req.title, "priority": req.priority},
        user=_user,
    )
    db.commit()
    db.refresh(req)
    return req


@router.get("/requirements", response_model=list[RequirementResponse])
def list_requirements(db: Session = Depends(get_db)):
    return db.query(Requirement).order_by(Requirement.updated_at.desc()).all()


@router.get("/requirements/{requirement_id}", response_model=RequirementResponse)
def get_requirement(requirement_id: int, db: Session = Depends(get_db)):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return req


@router.put("/requirements/{requirement_id}", response_model=RequirementResponse)
def update_requirement(requirement_id: int, payload: RequirementUpdate, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        if field != "change_note":
            setattr(req, field, value)

    req.version += 1
    req.updated_by = (_user or {}).get("email", "system")

    version = RequirementVersion(
        requirement_id=req.id,
        version=req.version,
        change_note=payload.change_note,
        created_by=(_user or {}).get("email", "system"),
        snapshot_json=json.dumps({
            "title": req.title,
            "business_requirement": req.business_requirement,
            "functional_requirement": req.functional_requirement,
            "non_functional_requirement": req.non_functional_requirement,
            "user_story": req.user_story,
            "priority": req.priority,
            "impact": req.impact,
            "status": req.status,
        }),
    )
    db.add(version)
    log_audit_event(
        db,
        action="requirement.updated",
        target_type="requirement",
        target_id=str(req.id),
        details={"version": req.version, "change_note": payload.change_note},
        user=_user,
    )
    db.commit()
    db.refresh(req)
    return req


@router.get("/requirements/{requirement_id}/versions", response_model=list[VersionResponse])
def get_versions(requirement_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(RequirementVersion)
        .filter(RequirementVersion.requirement_id == requirement_id)
        .order_by(RequirementVersion.version.desc())
        .all()
    )
    return rows


@router.post("/requirements/{requirement_id}/clarify", response_model=ClarificationResponse)
def clarify_requirement(requirement_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    result = ai_service.clarify_requirement(req.raw_input)
    log_audit_event(
        db,
        action="requirement.clarified",
        target_type="requirement",
        target_id=str(req.id),
        details={"questions": len(result.get("clarification_questions", []))},
        user=_user,
    )
    db.commit()
    return result


@router.post("/requirements/{requirement_id}/trace-links", response_model=TraceLinkResponse)
def add_trace_link(requirement_id: int, payload: TraceLinkCreate, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    link = TraceLink(
        requirement_id=requirement_id,
        user_story=payload.user_story,
        task=payload.task,
        test_case=payload.test_case,
        created_by=(_user or {}).get("email", "system"),
    )
    db.add(link)
    db.flush()
    log_audit_event(
        db,
        action="trace_link.created",
        target_type="trace_link",
        target_id=str(link.id),
        details={"requirement_id": requirement_id},
        user=_user,
    )
    db.commit()
    db.refresh(link)
    return link


@router.get("/requirements/{requirement_id}/traceability", response_model=list[TraceLinkResponse])
def get_trace_links(requirement_id: int, db: Session = Depends(get_db)):
    return db.query(TraceLink).filter(TraceLink.requirement_id == requirement_id).all()


@router.get("/traceability/matrix", response_model=list[MatrixRow])
def matrix(db: Session = Depends(get_db)):
    rows = (
        db.query(Requirement.id, Requirement.title, TraceLink.user_story, TraceLink.task, TraceLink.test_case)
        .join(TraceLink, TraceLink.requirement_id == Requirement.id)
        .all()
    )
    return [
        MatrixRow(
            requirement_id=row[0],
            requirement_title=row[1],
            user_story=row[2],
            task=row[3],
            test_case=row[4],
        )
        for row in rows
    ]


@router.get("/requirements/{requirement_id}/duplicates", response_model=DuplicateCheckResponse)
def duplicate_check(requirement_id: int, db: Session = Depends(get_db)):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    candidates = (
        db.query(Requirement.id)
        .filter(Requirement.id != requirement_id)
        .filter(
            or_(
                func.lower(Requirement.title) == req.title.lower(),
                Requirement.raw_input.ilike(f"%{req.title[:20]}%"),
            )
        )
        .all()
    )
    return DuplicateCheckResponse(possible_duplicates=[c[0] for c in candidates])


@router.get("/export/brd")
def export_brd_doc(db: Session = Depends(get_db)):
    doc = export_brd(db.query(Requirement).all())
    return Response(content=doc, media_type="text/plain", headers={"Content-Disposition": "attachment; filename=tracewise_brd.txt"})


@router.get("/export/frd")
def export_frd_doc(db: Session = Depends(get_db)):
    doc = export_frd(db.query(Requirement).all())
    return Response(content=doc, media_type="text/plain", headers={"Content-Disposition": "attachment; filename=tracewise_frd.txt"})


@router.get("/audit/events", response_model=list[AuditEventResponse])
def list_audit_events(
    limit: int = 30,
    actor: str | None = None,
    action: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 200))
    query = _apply_audit_filters(db.query(AuditEvent), actor, action, from_date, to_date, q)
    return query.order_by(AuditEvent.created_at.desc()).limit(safe_limit).all()


@router.get("/requirements/{requirement_id}/activity", response_model=list[AuditEventResponse])
def requirement_activity(requirement_id: int, limit: int = 30, db: Session = Depends(get_db)):
    safe_limit = max(1, min(limit, 200))
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.target_type == "requirement")
        .filter(AuditEvent.target_id == str(requirement_id))
        .order_by(AuditEvent.created_at.desc())
        .limit(safe_limit)
        .all()
    )


@router.get("/audit/events/export.csv")
def export_audit_csv(
    limit: int = 500,
    actor: str | None = None,
    action: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_access),
):
    safe_limit = max(1, min(limit, 5000))
    rows = (
        _apply_audit_filters(db.query(AuditEvent), actor, action, from_date, to_date, q)
        .order_by(AuditEvent.created_at.desc())
        .limit(safe_limit)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "created_at", "user_email", "user_name", "user_role", "action", "target_type", "target_id", "details_json"])
    for row in rows:
        writer.writerow([
            row.id,
            row.created_at.isoformat(),
            row.user_email,
            row.user_name,
            row.user_role,
            row.action,
            row.target_type,
            row.target_id,
            row.details_json,
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tracewise_audit_events.csv"},
    )
