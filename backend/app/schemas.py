from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class IntakeRequest(BaseModel):
    stakeholder: str = "Unknown"
    raw_input: str = Field(min_length=10)
    priority: str = "Medium"


class RequirementBase(BaseModel):
    stakeholder: str
    title: str
    raw_input: str
    business_requirement: str
    functional_requirement: str
    non_functional_requirement: str
    user_story: str
    priority: str
    impact: str
    status: str
    version: int
    created_by: str
    updated_by: str


class RequirementUpdate(BaseModel):
    title: Optional[str] = None
    business_requirement: Optional[str] = None
    functional_requirement: Optional[str] = None
    non_functional_requirement: Optional[str] = None
    user_story: Optional[str] = None
    priority: Optional[str] = None
    impact: Optional[str] = None
    status: Optional[str] = None
    change_note: str = "Updated requirement"


class RequirementResponse(RequirementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TraceLinkCreate(BaseModel):
    user_story: str
    task: str
    test_case: str


class TraceLinkResponse(TraceLinkCreate):
    id: int
    requirement_id: int
    created_by: str

    class Config:
        from_attributes = True


class VersionResponse(BaseModel):
    version: int
    change_note: str
    created_by: str
    created_at: datetime
    snapshot_json: str

    class Config:
        from_attributes = True


class ClarificationResponse(BaseModel):
    missing_information: List[str]
    clarification_questions: List[str]
    ambiguity_flags: List[str]
    potential_risks: List[str]


class DuplicateCheckResponse(BaseModel):
    possible_duplicates: List[int]


class DashboardSummary(BaseModel):
    total_requirements: int
    by_priority: dict
    by_status: dict
    trace_coverage_percent: float


class MatrixRow(BaseModel):
    requirement_id: int
    requirement_title: str
    user_story: str
    task: str
    test_case: str


class AuditEventResponse(BaseModel):
    id: int
    user_email: str
    user_name: str
    user_role: str
    action: str
    target_type: str
    target_id: str
    details_json: str
    created_at: datetime

    class Config:
        from_attributes = True
