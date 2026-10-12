import asyncio
import logging
import uuid
import traceback
from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.trend_analysis import TrendAnalysisRun, TrendRunStatus
from app.services.trend_analysis.data_service import TrendDataService
from app.services.trend_analysis.forecasting_engine import ForecastingEngine

logger = logging.getLogger(__name__)

# Concurrency locks to guarantee single execution per scope
_active_trend_jobs_lock = asyncio.Lock()
_active_trend_jobs: set = set()


async def is_trend_run_in_progress(db: AsyncSession) -> Optional[TrendAnalysisRun]:
    """Check if an active trend run is already executing in the database."""
    query = (
        select(TrendAnalysisRun)
        .where(TrendAnalysisRun.status.in_([TrendRunStatus.QUEUED.value, TrendRunStatus.RUNNING.value]))
        .order_by(TrendAnalysisRun.created_at.desc())
        .limit(1)
    )
    result = await db.execute(query)
    run = result.scalar_one_or_none()
    if run:
        # Resolve stale jobs if created more than 5 minutes ago
        age_seconds = (datetime.now(timezone.utc) - run.created_at).total_seconds()
        if age_seconds > 300:
            run.status = TrendRunStatus.FAILED.value
            run.error_message = "Execution timed out or aborted."
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
            return None
    return run



async def trigger_trend_analysis_run(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    parameters: Optional[Dict[str, Any]] = None,
) -> TrendAnalysisRun:
    """
    Explicitly trigger trend analysis and forecasting run on-demand.
    Enforces strict concurrency control.
    """
    params = parameters or {}
    date_basis = params.get("date_basis", "effective")
    frequency = params.get("frequency", "M")
    horizon = int(params.get("horizon", 6))
    
    # Cap horizon to reasonable boundaries
    if frequency == "W":
        horizon = max(2, min(26, horizon))
    else:
        horizon = max(1, min(12, horizon))
    params["horizon"] = horizon

    async with _active_trend_jobs_lock:
        if "TREND_RUN_ACTIVE" in _active_trend_jobs:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A Trend Analysis & Forecasting run is already active in memory."
            )

        active_db = await is_trend_run_in_progress(db)
        if active_db:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A Trend Analysis run is already active in the database (Run ID: {active_db.run_id})."
            )

        new_run = TrendAnalysisRun(
            run_id=uuid.uuid4(),
            status=TrendRunStatus.QUEUED.value,
            current_stage="Queued for processing",
            progress_percent=0,
            requested_by=user_id,
            parameters=params,
        )
        db.add(new_run)
        await db.commit()
        await db.refresh(new_run)

        _active_trend_jobs.add("TREND_RUN_ACTIVE")

    # Launch background worker
    asyncio.create_task(_execute_trend_analysis_job(new_run.run_id, params))

    return new_run


async def _execute_trend_analysis_job(run_id: uuid.UUID, params: Dict[str, Any]):
    """
    Background worker executing data extraction, time-series aggregation,
    staged forecasting, and run persistence.
    """
    logger.info(f"Starting Trend Analysis Run {run_id}")
    try:
        # Step 1: Update to Running (20%)
        async with AsyncSessionLocal() as session:
            run = await session.get(TrendAnalysisRun, run_id)
            if run:
                run.status = TrendRunStatus.RUNNING.value
                run.started_at = datetime.now(timezone.utc)
                run.current_stage = "Extracting and normalizing historical audit records"
                run.progress_percent = 20
                await session.commit()

        # Step 2: Data Extraction & Data Readiness
        agency_id_str = params.get("agency_id")
        agency_uuid = uuid.UUID(agency_id_str) if agency_id_str else None

        start_d = TrendDataService._parse_date(params.get("start_date"))
        end_d = TrendDataService._parse_date(params.get("end_date"))
        date_basis = params.get("date_basis", "effective")
        frequency = params.get("frequency", "M")
        horizon = int(params.get("horizon", 6))
        severities = params.get("severities")
        statuses = params.get("statuses")
        audit_types = params.get("audit_types")
        criticalities = params.get("asset_criticalities")

        async with AsyncSessionLocal() as session:
            readiness = await TrendDataService.get_data_readiness(session, agency_id=agency_uuid)
            findings, reports_map, retest_closures = await TrendDataService.extract_raw_records(
                db=session,
                date_basis=date_basis,
                start_date=start_d,
                end_date=end_d,
                severities=severities,
                statuses=statuses,
                audit_types=audit_types,
                asset_criticalities=criticalities,
                agency_id=agency_uuid,
            )

        # Step 3: Update Progress (50%)
        async with AsyncSessionLocal() as session:
            run = await session.get(TrendAnalysisRun, run_id)
            if run:
                run.current_stage = "Aggregating historical metrics, asset linkage, and retests"
                run.progress_percent = 50
                await session.commit()

        # Step 4: Time Series Aggregation
        aggregated = TrendDataService.aggregate_time_series(
            findings=findings,
            reports_map=reports_map,
            retest_closures=retest_closures,
            frequency=frequency,
            start_date=start_d,
            end_date=end_d,
        )

        # Step 5: Update Progress (75%)
        async with AsyncSessionLocal() as session:
            run = await session.get(TrendAnalysisRun, run_id)
            if run:
                run.current_stage = "Evaluating statistical models and rolling-origin backtesting"
                run.progress_percent = 75
                await session.commit()

        # Step 6: Multi-target Forecasting Engine
        forecast_output = ForecastingEngine.run_multi_target_forecast(
            aggregated_data=aggregated,
            horizon=horizon,
            frequency=frequency,
        )

        # Step 7: Persist Run Results (100% Completed)
        async with AsyncSessionLocal() as session:
            run = await session.get(TrendAnalysisRun, run_id)
            if run:
                run.status = TrendRunStatus.COMPLETED.value
                run.current_stage = "Analysis and forecasting completed successfully"
                run.progress_percent = 100
                run.completed_at = datetime.now(timezone.utc)
                run.summary = {
                    "overview": aggregated.get("overview", {}),
                    "recurring_weakness": aggregated.get("recurring_weakness", {}),
                    "remediation_performance": aggregated.get("remediation_performance", {}),
                    "metrics": aggregated.get("metrics", {}),
                    "periods": aggregated.get("periods", []),
                }
                run.forecast_results = forecast_output
                run.data_readiness = readiness
                run.warnings = forecast_output.get("global_warnings", [])
                await session.commit()

        logger.info(f"Trend Analysis Run {run_id} completed successfully.")

    except Exception as ex:
        err_msg = f"{str(ex)}\n{traceback.format_exc()}"
        logger.error(f"Trend Analysis Run {run_id} failed: {err_msg}")
        async with AsyncSessionLocal() as session:
            run = await session.get(TrendAnalysisRun, run_id)
            if run:
                run.status = TrendRunStatus.FAILED.value
                run.current_stage = "Failed during processing"
                run.error_message = str(ex)
                run.completed_at = datetime.now(timezone.utc)
                await session.commit()

    finally:
        async with _active_trend_jobs_lock:
            _active_trend_jobs.discard("TREND_RUN_ACTIVE")


async def get_run_status(db: AsyncSession, run_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """
    Read-only progress status for polling.
    Guaranteed zero computational overhead.
    """
    run = await db.get(TrendAnalysisRun, run_id)
    if not run:
        return None

    return {
        "run_id": str(run.run_id),
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat(),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "parameters": run.parameters or {},
        "error_message": run.error_message,
    }


async def get_run_results(db: AsyncSession, run_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """
    Read-only retrieval of complete stored results from a past run.
    Guaranteed zero computation.
    """
    run = await db.get(TrendAnalysisRun, run_id)
    if not run:
        return None

    return {
        "run_id": str(run.run_id),
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat(),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "parameters": run.parameters or {},
        "summary": run.summary or {},
        "forecast_results": run.forecast_results or {},
        "data_readiness": run.data_readiness or {},
        "warnings": run.warnings or [],
        "error_message": run.error_message,
    }


async def list_runs_history(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    agency_id: Optional[uuid.UUID] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Retrieve paginated list of past trend analysis runs."""
    query = select(TrendAnalysisRun).order_by(desc(TrendAnalysisRun.created_at))
    count_query = select(func.count(TrendAnalysisRun.run_id))

    count_res = await db.execute(count_query)
    total = count_res.scalar() or 0

    runs_res = await db.execute(query.offset(offset).limit(limit))
    runs = runs_res.scalars().all()

    items = []
    for r in runs:
        items.append({
            "run_id": str(r.run_id),
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "frequency": (r.parameters or {}).get("frequency", "M"),
            "horizon": (r.parameters or {}).get("horizon", 6),
            "date_basis": (r.parameters or {}).get("date_basis", "effective"),
            "total_findings": (r.summary or {}).get("overview", {}).get("total_findings", {}).get("value", 0),
        })

    return items, total


async def get_precomputed_summary(
    db: AsyncSession,
    agency_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """
    Read-only retrieval of current dataset readiness and latest completed run summary.
    Never executes model training or forecasting.
    """
    readiness = await TrendDataService.get_data_readiness(db, agency_id=agency_id)

    # Check for latest completed run
    query = (
        select(TrendAnalysisRun)
        .where(TrendAnalysisRun.status == TrendRunStatus.COMPLETED.value)
        .order_by(desc(TrendAnalysisRun.completed_at))
        .limit(1)
    )
    res = await db.execute(query)
    latest_run = res.scalar_one_or_none()

    latest_info = None
    if latest_run:
        latest_info = {
            "run_id": str(latest_run.run_id),
            "completed_at": latest_run.completed_at.isoformat() if latest_run.completed_at else None,
            "parameters": latest_run.parameters or {},
            "summary": latest_run.summary or {},
            "forecast_results": latest_run.forecast_results or {},
            "warnings": latest_run.warnings or [],
        }

    # Check active run
    active_run = await is_trend_run_in_progress(db)
    active_info = None
    if active_run:
        active_info = {
            "run_id": str(active_run.run_id),
            "status": active_run.status,
            "current_stage": active_run.current_stage,
            "progress_percent": active_run.progress_percent,
        }

    return {
        "data_readiness": readiness,
        "latest_completed_run": latest_info,
        "active_job": active_info,
    }


async def get_drilldown_findings(
    db: AsyncSession,
    period: Optional[str] = None,
    severity: Optional[str] = None,
    status_filter: Optional[str] = None,
    cwe: Optional[str] = None,
    date_basis: str = "effective",
    frequency: str = "M",
    limit: int = 50,
    offset: int = 0,
    agency_id: Optional[uuid.UUID] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Drill down from charts into underlying findings and parent reports.
    """
    severities = [severity] if severity and severity != "ALL" else None
    statuses = [status_filter] if status_filter and status_filter != "ALL" else None

    findings, reports_map, _ = await TrendDataService.extract_raw_records(
        db=db,
        date_basis=date_basis,
        severities=severities,
        statuses=statuses,
        agency_id=agency_id,
    )

    # Filter by period bucket
    filtered = []
    for f in findings:
        d = f["observation_date"]
        if frequency == "W":
            monday = d - timedelta(days=d.weekday())
            b = monday.isoformat()
        else:
            b = f"{d.year:04d}-{d.month:02d}"

        if period and b != period:
            continue

        if cwe and cwe not in f.get("cwe", []):
            continue

        filtered.append(f)

    total_count = len(filtered)
    paged = filtered[offset : offset + limit]

    for item in paged:
        item["observation_date"] = item["observation_date"].isoformat() if isinstance(item["observation_date"], (date, datetime)) else str(item["observation_date"])

    return paged, total_count
