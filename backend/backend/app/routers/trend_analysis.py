import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.trend_analysis import (
    TrendRunTriggerRequest,
    TrendRunTriggerResponse,
    TrendRunStatusResponse,
    TrendRunResultsResponse,
    TrendSummaryResponse,
    DrilldownResponse,
)
from app.services.trend_analysis import (
    trigger_trend_analysis_run,
    get_run_status,
    get_run_results,
    list_runs_history,
    get_precomputed_summary,
    get_drilldown_findings,
)

router = APIRouter(prefix="/api/trend-analysis", tags=["Trend Analysis & Forecasting"])


@router.post("/runs", response_model=TrendRunTriggerResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_trend_analysis_run(
    req: TrendRunTriggerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    On-Demand Trigger: Execute Historical Trend Analysis & Time-Series Forecasting.
    CRITICAL: This endpoint executes ONLY when an authorized user explicitly clicks
    'Run Trend Analysis & Forecast' in the UI.
    Never triggered by page visits, polling, or navigation.
    """
    params = req.model_dump()
    agency_id = getattr(current_user, "agency_id", None)

    run = await trigger_trend_analysis_run(
        db, user_id=current_user.user_id, parameters=params
    )

    return TrendRunTriggerResponse(
        status="success",
        message="Trend analysis & forecasting job queued successfully.",
        run_id=str(run.run_id),
        job_status=run.status,
        current_stage=run.current_stage,
        progress_percent=run.progress_percent,
        created_at=run.created_at.isoformat(),
    )


@router.get("/runs/{run_id}", response_model=TrendRunStatusResponse)
async def read_run_status(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to poll progress and stage of an active or completed trend job.
    Never triggers computation or model training.
    """
    info = await get_run_status(db, run_id)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trend analysis run {run_id} not found."
        )
    return TrendRunStatusResponse(status="success", data=info)


@router.get("/runs/{run_id}/results", response_model=TrendRunResultsResponse)
async def read_run_results(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to retrieve complete stored aggregates, forecasting metrics,
    uncertainty bounds, and backtesting comparison for a run.
    Never triggers computation.
    """
    results = await get_run_results(db, run_id)
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trend analysis run {run_id} not found."
        )
    return TrendRunResultsResponse(status="success", data=results)


@router.get("/history")
async def read_runs_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    agency_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only list of past trend analysis runs.
    """
    effective_agency = getattr(current_user, "agency_id", None) or agency_id
    items, total = await list_runs_history(db, limit=limit, offset=offset, agency_id=effective_agency)
    return {
        "status": "success",
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": items,
    }


@router.get("/summary", response_model=TrendSummaryResponse)
async def read_trend_summary(
    agency_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only retrieval of existing precomputed or stored historical aggregates,
    data readiness indicators, and the latest completed run results.
    Never triggers a forecast or retrains models.
    """
    effective_agency = getattr(current_user, "agency_id", None) or agency_id
    summary_data = await get_precomputed_summary(db, agency_id=effective_agency)
    return TrendSummaryResponse(status="success", data=summary_data)


@router.get("/drilldown", response_model=DrilldownResponse)
async def read_drilldown_findings(
    period: Optional[str] = Query(None, description="Period bucket key (e.g., '2026-08' or '2026-W32')"),
    severity: Optional[str] = Query(None, description="Severity filter"),
    status_filter: Optional[str] = Query(None, alias="status", description="Status filter"),
    cwe: Optional[str] = Query(None, description="CWE ID filter"),
    date_basis: str = Query("effective", description="'strict' or 'effective'"),
    frequency: str = Query("M", description="'M' or 'W'"),
    agency_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only drill-down endpoint returning specific finding records matching chart clicks.
    """
    effective_agency = getattr(current_user, "agency_id", None) or agency_id
    items, total = await get_drilldown_findings(
        db=db,
        period=period,
        severity=severity,
        status_filter=status_filter,
        cwe=cwe,
        date_basis=date_basis,
        frequency=frequency,
        limit=limit,
        offset=offset,
        agency_id=effective_agency,
    )

    return DrilldownResponse(
        status="success",
        total=total,
        limit=limit,
        offset=offset,
        data=items,
    )
