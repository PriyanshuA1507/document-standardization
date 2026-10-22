from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import AsyncSessionLocal
from app.routers import auth, users, reports, audit_logs, agencies, pipeline, analytics, ml_analytics, clustering, trend_analysis, report_images, anomaly, batches
from app.services.auth_service import seed_roles_and_admin
from app.services.batch_service import resume_interrupted_batches

# Import all models so Alembic can discover them
from app.models import user, report, audit, trend_analysis as trend_analysis_model, anomaly as anomaly_model, batch as batch_model  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: seed admin user and roles on startup, cleanup orphan jobs."""
    logger.info("Starting application...")
    try:
        async with AsyncSessionLocal() as session:
            await seed_roles_and_admin(session)
            logger.info("Database seeded successfully")

            # Clean up any orphaned RUNNING or QUEUED jobs from previous server instances
            from app.models.clustering import ClusteringRun, RunStatus
            from app.models.anomaly import AnomalyRun, AnomalyRunStatus
            from app.models.trend_analysis import TrendAnalysisRun, TrendRunStatus
            from sqlalchemy import update
            from datetime import datetime, timezone

            now = datetime.now(timezone.utc)
            await session.execute(
                update(ClusteringRun)
                .where(ClusteringRun.status.in_([RunStatus.RUNNING.value, RunStatus.QUEUED.value]))
                .values(status=RunStatus.FAILED.value, error_message="Interrupted by server restart", completed_at=now)
            )
            await session.execute(
                update(AnomalyRun)
                .where(AnomalyRun.status.in_([AnomalyRunStatus.RUNNING.value, AnomalyRunStatus.QUEUED.value]))
                .values(status=AnomalyRunStatus.FAILED.value, error_message="Interrupted by server restart", completed_at=now)
            )
            await session.execute(
                update(TrendAnalysisRun)
                .where(TrendAnalysisRun.status.in_([TrendRunStatus.RUNNING.value, TrendRunStatus.QUEUED.value]))
                .values(status=TrendRunStatus.FAILED.value, error_message="Interrupted by server restart", completed_at=now)
            )
            await session.commit()
            logger.info("Orphaned runs cleaned up on startup successfully")

            # Resume any in-progress batch processing jobs
            await resume_interrupted_batches()
    except Exception as e:
        logger.error(f"Failed during startup initialization: {e}")
    yield
    logger.info("Shutting down application...")


app = FastAPI(
    title="Cybersecurity Audit Report Management System",
    description="Phase 1 - Report management with RBAC, file upload, and audit logging",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "https://localhost:3000", "http://localhost:5173", "https://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(audit_logs.router)
app.include_router(agencies.router)
app.include_router(pipeline.router)
app.include_router(analytics.router)
app.include_router(ml_analytics.router)
app.include_router(clustering.router)
app.include_router(trend_analysis.router)
app.include_router(report_images.router)
app.include_router(anomaly.router)
app.include_router(batches.router)



@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "cyber-audit-backend"}
