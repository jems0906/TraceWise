from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Requirement, TraceLink
from app.schemas import DashboardSummary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)):
    total = db.query(func.count(Requirement.id)).scalar() or 0

    by_priority_rows = db.query(Requirement.priority, func.count(Requirement.id)).group_by(Requirement.priority).all()
    by_status_rows = db.query(Requirement.status, func.count(Requirement.id)).group_by(Requirement.status).all()

    covered = (
        db.query(func.count(func.distinct(TraceLink.requirement_id))).scalar() or 0
    )
    coverage = (covered / total * 100.0) if total else 0.0

    return DashboardSummary(
        total_requirements=total,
        by_priority={k: v for k, v in by_priority_rows},
        by_status={k: v for k, v in by_status_rows},
        trace_coverage_percent=round(coverage, 2),
    )
