import uuid
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.clustering import ClusteringType
from app.services import clustering_service, audit_service

router = APIRouter(prefix="/api/clustering", tags=["Clustering"])


class DynamicClusteringRunRequest(BaseModel):
    algorithm: Optional[str] = Field("HDBSCAN", description="Clustering algorithm: HDBSCAN, KMEANS, or AGGLOMERATIVE")
    selected_features: Optional[List[str]] = Field(None, description="List of feature keys to incorporate")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Algorithm-specific hyperparameters")
    include_numeric_features: Optional[bool] = Field(False, description="Whether to append numeric dimensions to vector space")


class OptimizeKRequest(BaseModel):
    clustering_type: Optional[str] = Field("VULNERABILITY", description="VULNERABILITY or REPORT")
    algorithm: Optional[str] = Field("KMEANS", description="KMEANS or AGGLOMERATIVE")
    selected_features: Optional[List[str]] = Field(None, description="Feature keys to test")
    include_numeric_features: Optional[bool] = Field(False, description="Whether to include numeric features")
    k_min: Optional[int] = Field(2, ge=2, le=15)
    k_max: Optional[int] = Field(12, ge=3, le=20)


@router.get("/config-options")
async def get_clustering_config_options(
    current_user: User = Depends(get_current_user),
):
    """
    Discovery endpoint returning all available algorithms, parameters schemas,
    feature toggles, and preset profiles for dynamic user configuration.
    """
    options = clustering_service.get_clustering_config_options()
    return {"status": "success", "data": options}


@router.post("/vulnerabilities/run", status_code=status.HTTP_202_ACCEPTED)
async def run_vulnerability_clustering(
    payload: Optional[DynamicClusteringRunRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    On-Demand Trigger: Execute Vulnerability Findings Clustering with user-defined algorithm,
    features, and parameters.
    """
    cfg = None
    if payload:
        cfg = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()

    run = await clustering_service.trigger_vulnerability_clustering(
        db, user_id=current_user.user_id, config=cfg
    )
    await audit_service.create_audit_log(
        db,
        action="CLUSTERING_RUN",
        status="SUCCESS",
        user_id=current_user.user_id,
        details={"run_id": str(run.run_id), "type": "VULNERABILITY", "algorithm": run.algorithm_version},
    )
    await db.commit()
    return {
        "status": "success",
        "message": f"{run.algorithm_version} clustering job has been queued.",
        "run_id": str(run.run_id),
        "clustering_type": run.clustering_type,
        "algorithm_version": run.algorithm_version,
        "job_status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat(),
        "parameters": run.parameters,
    }


@router.post("/reports/run", status_code=status.HTTP_202_ACCEPTED)
async def run_report_clustering(
    payload: Optional[DynamicClusteringRunRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    On-Demand Trigger: Execute Audit Report Clustering with user-defined algorithm,
    features, and parameters.
    """
    cfg = None
    if payload:
        cfg = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()

    run = await clustering_service.trigger_report_clustering(
        db, user_id=current_user.user_id, config=cfg
    )
    await audit_service.create_audit_log(
        db,
        action="CLUSTERING_RUN",
        status="SUCCESS",
        user_id=current_user.user_id,
        details={"run_id": str(run.run_id), "type": "REPORT", "algorithm": run.algorithm_version},
    )
    await db.commit()
    return {
        "status": "success",
        "message": f"{run.algorithm_version} report clustering job has been queued.",
        "run_id": str(run.run_id),
        "clustering_type": run.clustering_type,
        "algorithm_version": run.algorithm_version,
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


@router.get("/runs/{run_id}/projection")
async def get_run_projection(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve 2D PCA projection coordinates for interactive cluster scatter plot.
    """
    coords = await clustering_service.get_run_projection_2d(db, run_id)
    return {"status": "success", "data": coords}


@router.post("/optimize-k")
async def optimize_k(
    payload: OptimizeKRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Auto-Optimizer: Executes multi-k parameter sweep (Inertia & Silhouette)
    to discover mathematically optimal k.
    """
    result = await clustering_service.compute_optimal_k_sweep(
        db,
        clustering_type=payload.clustering_type or "VULNERABILITY",
        selected_features=payload.selected_features,
        include_numeric_features=payload.include_numeric_features or False,
        k_min=payload.k_min or 2,
        k_max=payload.k_max or 12,
        algorithm=payload.algorithm or "KMEANS",
    )
    return {"status": "success", "data": result}


@router.get("/compare")
async def compare_runs(
    run_id_1: uuid.UUID = Query(..., description="First run UUID for comparison"),
    run_id_2: uuid.UUID = Query(..., description="Second run UUID for comparison"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-Run Comparison & Benchmark Matrix:
    Evaluates two historical or active runs side-by-side with delta metrics.
    """
    comparison = await clustering_service.compare_clustering_runs(
        db, run_id_1=run_id_1, run_id_2=run_id_2
    )
    return {"status": "success", "data": comparison}


