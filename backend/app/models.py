from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    stakeholder: Mapped[str] = mapped_column(String(200), default="Unknown")
    title: Mapped[str] = mapped_column(String(255))
    raw_input: Mapped[str] = mapped_column(Text)
    business_requirement: Mapped[str] = mapped_column(Text)
    functional_requirement: Mapped[str] = mapped_column(Text)
    non_functional_requirement: Mapped[str] = mapped_column(Text)
    user_story: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(50), default="Medium")
    impact: Mapped[str] = mapped_column(String(50), default="Medium")
    status: Mapped[str] = mapped_column(String(50), default="Draft")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[str] = mapped_column(String(255), default="system")
    updated_by: Mapped[str] = mapped_column(String(255), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trace_links = relationship("TraceLink", back_populates="requirement", cascade="all, delete-orphan")
    versions = relationship("RequirementVersion", back_populates="requirement", cascade="all, delete-orphan")


class TraceLink(Base):
    __tablename__ = "trace_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"))
    user_story: Mapped[str] = mapped_column(Text)
    task: Mapped[str] = mapped_column(Text)
    test_case: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(255), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement", back_populates="trace_links")


class RequirementVersion(Base):
    __tablename__ = "requirement_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    change_note: Mapped[str] = mapped_column(String(255), default="Updated")
    snapshot_json: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(255), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement", back_populates="versions")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), default="system")
    user_name: Mapped[str] = mapped_column(String(255), default="System")
    user_role: Mapped[str] = mapped_column(String(50), default="system")
    action: Mapped[str] = mapped_column(String(120))
    target_type: Mapped[str] = mapped_column(String(80), default="entity")
    target_id: Mapped[str] = mapped_column(String(80), default="")
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
