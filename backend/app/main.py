import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import inspect, text
from starlette.middleware.sessions import SessionMiddleware

from app.database import Base, engine
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.requirements import router as requirements_router

Base.metadata.create_all(bind=engine)


def _cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8011",
        "http://127.0.0.1:8011",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]


def _session_same_site() -> str:
    configured = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower()
    if configured in {"lax", "strict", "none"}:
        return configured
    return "lax"


def _session_https_only() -> bool:
    configured = os.getenv("SESSION_COOKIE_SECURE", "false").strip().lower()
    return configured in {"1", "true", "yes", "on"}


def _ensure_sqlite_actor_columns() -> None:
    if not str(engine.url).startswith("sqlite"):
        return

    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "requirements" not in tables:
        return

    column_names = {col["name"] for col in inspector.get_columns("requirements")}
    statements = []
    if "created_by" not in column_names:
        statements.append("ALTER TABLE requirements ADD COLUMN created_by VARCHAR(255) DEFAULT 'system'")
    if "updated_by" not in column_names:
        statements.append("ALTER TABLE requirements ADD COLUMN updated_by VARCHAR(255) DEFAULT 'system'")

    if not statements:
        pass

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.execute(text("UPDATE requirements SET created_by = COALESCE(created_by, 'system')"))
        conn.execute(text("UPDATE requirements SET updated_by = COALESCE(updated_by, 'system')"))

        if "trace_links" in tables:
            trace_cols = {col["name"] for col in inspector.get_columns("trace_links")}
            if "created_by" not in trace_cols:
                conn.execute(text("ALTER TABLE trace_links ADD COLUMN created_by VARCHAR(255) DEFAULT 'system'"))
            conn.execute(text("UPDATE trace_links SET created_by = COALESCE(created_by, 'system')"))

        if "requirement_versions" in tables:
            version_cols = {col["name"] for col in inspector.get_columns("requirement_versions")}
            if "created_by" not in version_cols:
                conn.execute(text("ALTER TABLE requirement_versions ADD COLUMN created_by VARCHAR(255) DEFAULT 'system'"))
            conn.execute(text("UPDATE requirement_versions SET created_by = COALESCE(created_by, 'system')"))


_ensure_sqlite_actor_columns()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="TraceWise API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "tracewise-dev-session-secret-change-me"),
    same_site=_session_same_site(),
    https_only=_session_https_only(),
)

app.include_router(requirements_router)
app.include_router(dashboard_router)
app.include_router(auth_router)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "TraceWise API"}
