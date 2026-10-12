import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.clustering import ClusteringType
from app.services import clustering_service

router = APIRouter(prefix="/api/clustering", tags=["Clustering"])


@router.post("/vulnerabilities/run", status_code=status.HTTP_202_ACCEPTED)
async def run_vulnerability_clustering(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    On-Demand Trigger: Execute Vulnerability Findings Clustering.
    Only runs when an authorized user explicitly clicks the trigger button.
    """
    run = await clustering_service.trigger_vulnerability_clustering(
        db, user_id=current_user.user_id
    )
    return {
        "status": "success",
        "message": "Vulnerability clustering job has been queued.",
        "run_id": str(run.run_id),
        "clustering_type": run.clustering_type,
        "job_status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat(),
    }


@router.post("/reports/run", status_code=status.HTTP_202_ACCEPTED)
async def run_report_clustering(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    On-Demand Trigger: Execute Audit Report Clustering.
    Only runs when an authorized user explicitly clicks the trigger button.
    """
    run = await clustering_service.trigger_report_clustering(
        db, user_id=current_user.user_id
    )
    return {
        "status": "success",
        "message": "Report clustering job has been queued.",
        "run_id": str(run.run_id),
        "clustering_type": run.clustering_type,
        "job_status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat(),
    }


@router.get("/status/{run_id}")
async def get_run_status(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to poll progress and stage of an active or completed clustering job.
    Never executes a computation.
    """
    status_data = await clustering_service.get_run_status(db, run_id)
    if not status_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clustering run {run_id} not found."
        )
    return {"status": "success", "data": status_data}


@router.get("/latest/{clustering_type}")
async def get_latest_clustering_results(
    clustering_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to retrieve the latest completed clustering results and active job status.
    Never executes a computation.
    """
    norm_type = clustering_type.upper()
    if norm_type not in (ClusteringType.VULNERABILITY.value, ClusteringType.REPORT.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid clustering_type. Must be VULNERABILITY or REPORT."
        )

    info = await clustering_service.get_latest_run_info(db, norm_type)
    return {"status": "success", "data": info}


@router.get("/runs/{run_id}")
async def get_run_details(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to retrieve complete details and summary of any past clustering run.
    """
    details = await clustering_service.get_run_details(db, run_id)
    if not details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clustering run {run_id} not found."
        )
    return {"status": "success", "data": details}


@router.get("/runs/{run_id}/clusters/{cluster_id}/members")
async def get_cluster_members(
    run_id: uuid.UUID,
    cluster_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to retrieve paginated members for a specific cluster.
    """
    result = await clustering_service.get_cluster_members_paginated(
        db, run_id, cluster_id, page=page, page_size=page_size, search=search
    )
    return {"status": "success", "data": result}


@router.get("/history")
async def get_clustering_history(
    clustering_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only endpoint to retrieve history of all past clustering runs.
    """
    norm_type = clustering_type.upper() if clustering_type else None
    result = await clustering_service.get_clustering_history(
        db, clustering_type=norm_type, limit=limit, offset=offset
    )
    return {"status": "success", "data": result}

