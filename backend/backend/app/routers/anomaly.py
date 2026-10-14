import uuid
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import anomaly_service

router = APIRouter(prefix="/api/anomaly", tags=["Anomaly Detection"])


class AnomalyRunRequest(BaseModel):
    algorithm_mode: Optional[str] = Field("ENSEMBLE", description="Algorithm mode: ENSEMBLE, IFOREST, ECOD, or EMBEDDING")
    selected_features: Optional[List[str]] = Field(None, description="List of feature keys to incorporate")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Hyperparameters: contamination, weights, etc.")


@router.get("/config-options")
async def get_anomaly_config_options(
    current_user: User = Depends(get_current_user),
):
    """
    Discovery endpoint returning all available anomaly detectors, parameter schemas,
    feature catalog, and presets for user-driven configuration.
    """
    options = anomaly_service.get_anomaly_config_options()
    return {"status": "success", "data": options}


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def run_anomaly_detection(
    payload: Optional[AnomalyRunRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    On-Demand Execution Trigger: Launch audit report anomaly detection with user-configured
    algorithm mode, selected features, and hyperparameters.
    """
    cfg = None
    if payload:
        cfg = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()

    run = await anomaly_service.trigger_anomaly_detection(
        db, user_id=current_user.user_id, config=cfg
    )
    return {
        "status": "success",
        "message": f"Anomaly detection job [{run.parameters.get('algorithm_mode', 'ENSEMBLE')}] queued.",
        "run_id": str(run.run_id),
        "job_status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat(),
        "parameters": run.parameters,
    }


@router.get("/status/{run_id}")
async def get_run_status(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Poll execution progress and current stage of an active or completed anomaly run.
    """
    status_data = await anomaly_service.get_run_status(db, run_id)
    if not status_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly run {run_id} not found."
        )
    return {"status": "success", "data": status_data}


@router.get("/latest")
async def get_latest_anomaly_run(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve results and telemetry from the most recently executed anomaly run.
    """
    latest = await anomaly_service.get_latest_completed_run(db)
    if not latest:
        return {"status": "empty", "message": "No anomaly detection runs have been executed yet.", "data": None}
    return {"status": "success", "data": latest}


@router.get("/runs")
async def list_runs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve paginated historical list of all anomaly detection runs.
    """
    history = await anomaly_service.list_anomaly_runs(db, limit=limit, offset=offset)
    return {"status": "success", "data": history}


@router.get("/runs/{run_id}")
async def get_run_details(
    run_id: uuid.UUID,
    tier_filter: Optional[str] = Query("ALL", description="Filter by tier: ALL, CRITICAL_OUTLIER, ELEVATED_OUTLIER, SEMANTIC_ANOMALY, METRIC_ANOMALY, NOMINAL_COMPLIANT"),
    search: Optional[str] = Query(None, description="Search by report title, agency name, or code"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve full details, summary, scatter projection points, and paginated records for a run.
    """
    data = await anomaly_service.get_anomaly_run_detail(
        run_id=run_id,
        db=db,
        tier_filter=tier_filter,
        search=search,
        page=page,
        page_size=page_size
    )
    return data


@router.get("/compare")
async def compare_runs(
    run_id_1: uuid.UUID = Query(..., description="First run UUID for comparison"),
    run_id_2: uuid.UUID = Query(..., description="Second run UUID for comparison"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Side-by-side comparison of two anomaly detection runs to benchmark detector agreement and parameter sensitivity.
    """
    comparison = await anomaly_service.compare_anomaly_runs(
        run_id_a=run_id_1, run_id_b=run_id_2, db=db
    )
    return comparison
