from datetime import datetime
from typing import Iterable

from app.models import Requirement


def export_brd(requirements: Iterable[Requirement]) -> str:
    lines = ["Business Requirements Document", f"Generated: {datetime.utcnow().isoformat()} UTC", ""]
    for req in requirements:
        lines.extend(
            [
                f"BR-{req.id}: {req.title}",
                f"Stakeholder: {req.stakeholder}",
                f"Priority: {req.priority} | Impact: {req.impact}",
                f"Business Requirement: {req.business_requirement}",
                "",
            ]
        )
    return "\n".join(lines)


def export_frd(requirements: Iterable[Requirement]) -> str:
    lines = ["Functional Requirements Document", f"Generated: {datetime.utcnow().isoformat()} UTC", ""]
    for req in requirements:
        lines.extend(
            [
                f"FR-{req.id}: {req.title}",
                f"Functional Requirement: {req.functional_requirement}",
                f"Non-Functional Requirement: {req.non_functional_requirement}",
                f"User Story: {req.user_story}",
                "",
            ]
        )
    return "\n".join(lines)
