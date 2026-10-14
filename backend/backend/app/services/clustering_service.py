import asyncio
import logging
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
import re

import numpy as np
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.decomposition import PCA
import hdbscan

# Lazy-loaded global SBERT model (loaded once, reused across runs)
_sbert_model: SentenceTransformer | None = None
_sbert_model_lock = asyncio.Lock()

SBERT_MODEL_NAME = "all-mpnet-base-v2"  # 768-dim, highest quality sentence embeddings


def _get_torch_device() -> str:
    """Return 'cuda' if GPU is available and initialized, else 'cpu'."""
    try:
        if torch.cuda.is_available():
            return "cuda"
    except Exception as e:
        logger.warning(f"Error checking torch.cuda availability: {e}")
    return "cpu"


def _get_device_metadata() -> Dict[str, Any]:
    """Retrieve structured compute device metadata for logging and client summaries."""
    device = _get_torch_device()
    is_gpu = (device == "cuda")
    gpu_name = None
    gpu_count = 0
    if is_gpu:
        try:
            gpu_name = torch.cuda.get_device_name(0)
            gpu_count = torch.cuda.device_count()
        except Exception:
            gpu_name = "NVIDIA CUDA GPU"
            gpu_count = 1
    return {
        "compute_device": device,
        "gpu_accelerated": is_gpu,
        "gpu_name": gpu_name,
        "gpu_count": gpu_count,
    }


async def _get_sbert_model() -> SentenceTransformer:
    """Lazily load and cache the Sentence-BERT model (thread-safe, GPU-accelerated)."""
    global _sbert_model
    if _sbert_model is None:
        async with _sbert_model_lock:
            if _sbert_model is None:  # double-check after acquiring lock
                target_device = _get_torch_device()
                meta = _get_device_metadata()
                logger.info(
                    f"Loading Sentence-BERT model: {SBERT_MODEL_NAME} onto {target_device} "
                    f"(GPU: {meta.get('gpu_name') or 'N/A'}, count: {meta.get('gpu_count')})..."
                )

                def _load():
                    model = SentenceTransformer(SBERT_MODEL_NAME, device=target_device)
                    if target_device == "cuda":
                        try:
                            model = model.to("cuda")
                        except Exception as err:
                            logger.warning(f"Could not explicitly move SBERT model to cuda: {err}")
                    return model

                _sbert_model = await asyncio.to_thread(_load)
                logger.info(
                    f"Sentence-BERT model loaded successfully. Active device: {getattr(_sbert_model, 'device', target_device)}"
                )
    return _sbert_model

from sqlalchemy import select, func, case, and_, desc, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.report import Report, ReportsData, DetailedObservation, ObservationSeverity, ObservationStatus
from app.models.clustering import (
    ClusteringRun,
    VulnerabilityClusterMember,
    ReportClusterMember,
    ClusteringType,
    RunStatus,
)

logger = logging.getLogger(__name__)

# Concurrency locks to prevent duplicate simultaneous executions
_active_jobs_lock = asyncio.Lock()
_active_jobs: set = set()


def get_clustering_config_options() -> Dict[str, Any]:
    """Return all available clustering algorithms, feature toggles, parameter schemas, and presets."""
    return {
        "algorithms": [
            {
                "id": "HDBSCAN",
                "name": "HDBSCAN",
                "tagline": "Hierarchical Density-Based Clustering",
                "description": "Discovers natural clusters of arbitrary shapes and isolates one-off noise/outliers. Best for unstructured vulnerability findings and semantic sentence embeddings.",
                "supports_noise": True,
                "parameters": [
                    {"key": "min_cluster_size", "label": "Min Cluster Size", "type": "int", "default": 5, "min": 2, "max": 50, "help": "Minimum items needed to form a valid cluster density core"},
                    {"key": "min_samples", "label": "Min Samples (Core Density)", "type": "int", "default": 3, "min": 1, "max": 20, "help": "Neighborhood density conservatism; higher values label more points as noise"},
                    {"key": "metric", "label": "Distance Metric", "type": "select", "default": "euclidean", "options": ["euclidean", "manhattan"], "help": "Distance measure in normalized embedding space"},
                    {"key": "cluster_selection_method", "label": "Selection Method", "type": "select", "default": "eom", "options": ["eom", "leaf"], "help": "EOM extracts large stable clusters; Leaf extracts finer-grained sub-clusters"}
                ]
            },
            {
                "id": "KMEANS",
                "name": "K-Means++",
                "tagline": "Centroid-Based Partitioning",
                "description": "Fast, balanced geometric partitioning into an exact number of cohorts (k). Computes centroids and cluster inertia (WCSS).",
                "supports_noise": False,
                "parameters": [
                    {"key": "n_clusters", "label": "Number of Clusters (k)", "type": "int", "default": 8, "min": 2, "max": 30, "help": "Exact number of clusters to partition data into"},
                    {"key": "init", "label": "Centroid Initialization", "type": "select", "default": "k-means++", "options": ["k-means++", "random"], "help": "k-means++ places initial centroids smartly to speed convergence"},
                    {"key": "max_iter", "label": "Max Iterations", "type": "int", "default": 300, "min": 100, "max": 1000, "help": "Maximum iterations for centroid refinement"},
                    {"key": "n_init", "label": "Random Restarts", "type": "int", "default": 10, "min": 1, "max": 20, "help": "Runs algorithm n_init times with different centroid seeds and picks best inertia"}
                ]
            },
            {
                "id": "AGGLOMERATIVE",
                "name": "Agglomerative Hierarchical",
                "tagline": "Connectivity & Tree-Based Clustering",
                "description": "Builds a bottom-up cluster hierarchy (dendrogram) and cuts it at your desired cluster count. Produces cohesive taxonomies.",
                "supports_noise": False,
                "parameters": [
                    {"key": "n_clusters", "label": "Target Clusters (k)", "type": "int", "default": 8, "min": 2, "max": 30, "help": "Number of clusters to extract from the hierarchical tree"},
                    {"key": "linkage", "label": "Linkage Criterion", "type": "select", "default": "ward", "options": ["ward", "complete", "average", "single"], "help": "Ward minimizes within-cluster variance; Complete checks maximum pairwise distance"},
                    {"key": "metric", "label": "Distance Metric", "type": "select", "default": "euclidean", "options": ["euclidean", "cosine", "manhattan"], "help": "Note: Ward linkage strictly requires euclidean metric"}
                ]
            }
        ],
        "vulnerability_features": [
            {"key": "title", "label": "Finding Title", "type": "text", "default": True, "required": True, "description": "Core semantic anchor of the vulnerability"},
            {"key": "observation_description", "label": "Detailed Description", "type": "text", "default": True, "required": False, "description": "Technical narrative and proof-of-concept explanation"},
            {"key": "cwe", "label": "CWE Taxonomies", "type": "categorical", "default": True, "required": False, "description": "CWE weakness categories (e.g. CWE-79, CWE-89)"},
            {"key": "impact", "label": "Threat Impact", "type": "text", "default": True, "required": False, "description": "Realized business and operational threat impact"},
            {"key": "cve_id", "label": "CVE Identifiers", "type": "categorical", "default": True, "required": False, "description": "CVE numbers and vulnerability tags"},
            {"key": "likely_root_cause", "label": "Likely Root Cause", "type": "text", "default": False, "required": False, "description": "Underlying architectural root cause"},
            {"key": "recommendation", "label": "Remediation Advice", "type": "text", "default": False, "required": False, "description": "Recommended developer fix"},
            {"key": "cvss_score", "label": "CVSS Score (Numeric Dimension)", "type": "numeric", "default": False, "required": False, "description": "Numeric CVSS severity (standardized & appended to vector space)"}
        ],
        "report_features": [
            {"key": "clean_name", "label": "Report Name / Title", "type": "text", "default": True, "required": True, "description": "Cleaned report title or filename"},
            {"key": "audit_type", "label": "Audit Classification", "type": "categorical", "default": True, "required": False, "description": "Security audit domain type (e.g., Web, Network, Cloud)"},
            {"key": "sample_findings", "label": "Finding Profiles", "type": "text", "default": True, "required": False, "description": "Sample high-severity finding titles"},
            {"key": "total_vulns", "label": "Vulnerability Volume", "type": "numeric", "default": True, "required": False, "description": "Total finding scope (numeric dimension)"},
            {"key": "avg_cvss", "label": "Average CVSS Severity", "type": "numeric", "default": True, "required": False, "description": "Overall risk average (numeric dimension)"},
            {"key": "crit_ratio", "label": "Critical Severity Ratio", "type": "numeric", "default": True, "required": False, "description": "Proportion of critical observations (numeric dimension)"},
            {"key": "open_ratio", "label": "Unresolved Findings Ratio", "type": "numeric", "default": False, "required": False, "description": "Proportion of open vulnerabilities (numeric dimension)"}
        ],
        "presets": {
            "vulnerabilities": [
                {
                    "id": "hdbscan_default",
                    "name": "HDBSCAN Semantic Discovery (Recommended)",
                    "description": "Density clustering with noise isolation over Title, Description, Impact, and CWE.",
                    "algorithm": "HDBSCAN",
                    "features": ["title", "observation_description", "cwe", "impact", "cve_id"],
                    "parameters": {"min_cluster_size": 5, "min_samples": 3, "metric": "euclidean", "cluster_selection_method": "eom"}
                },
                {
                    "id": "kmeans_balanced",
                    "name": "Balanced K-Means++ Partition (k=8)",
                    "description": "Partitions all findings into 8 cohorts using Title, CWE, and CVSS severity.",
                    "algorithm": "KMEANS",
                    "features": ["title", "cwe", "impact", "cvss_score"],
                    "parameters": {"n_clusters": 8, "init": "k-means++", "max_iter": 300, "n_init": 10}
                },
                {
                    "id": "agglomerative_taxonomy",
                    "name": "Hierarchical Ward Taxonomy (k=8)",
                    "description": "Builds a structured dendrogram and cuts 8 cohesive vulnerability taxonomies.",
                    "algorithm": "AGGLOMERATIVE",
                    "features": ["title", "observation_description", "cwe"],
                    "parameters": {"n_clusters": 8, "linkage": "ward", "metric": "euclidean"}
                }
            ],
            "reports": [
                {
                    "id": "report_hdbscan",
                    "name": "HDBSCAN Report Cohorts (Recommended)",
                    "description": "Density grouping over report scope and domain.",
                    "algorithm": "HDBSCAN",
                    "features": ["clean_name", "audit_type", "sample_findings", "total_vulns", "avg_cvss"],
                    "parameters": {"min_cluster_size": 3, "min_samples": 2, "metric": "euclidean"}
                },
                {
                    "id": "report_kmeans",
                    "name": "5-Tier Risk Partition (K-Means)",
                    "description": "Partitions audit reports into 5 risk cohorts based on findings volume and severity.",
                    "algorithm": "KMEANS",
                    "features": ["clean_name", "audit_type", "total_vulns", "avg_cvss", "crit_ratio"],
                    "parameters": {"n_clusters": 5, "init": "k-means++", "max_iter": 300, "n_init": 10}
                }
            ]
        }
    }


def _compute_quality_metrics(X: np.ndarray, labels: np.ndarray, extra_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Compute clustering quality metrics on non-noise points.
    
    Metrics computed:
      - Silhouette Score:        Range [-1, +1], higher is better.
      - Davies-Bouldin Index:    Range [0, ∞), lower is better.
      - Calinski-Harabasz Index: Range (0, ∞), higher is better.
      - Inertia (WCSS):          Sum of squared distances to cluster centroids (for K-Means).
    """
    non_noise_mask = labels != -1
    X_filtered = X[non_noise_mask]
    labels_filtered = labels[non_noise_mask]

    unique_clusters = set(labels_filtered)
    n_clusters = len(unique_clusters)
    n_clustered = len(labels_filtered)
    n_noise = int(np.sum(~non_noise_mask))

    metrics: Dict[str, Any] = {
        "n_clusters": n_clusters,
        "n_clustered_points": n_clustered,
        "n_noise_points": n_noise,
        "noise_ratio": round(n_noise / len(labels), 4) if len(labels) > 0 else 0,
    }

    if extra_info and "inertia" in extra_info:
        metrics["inertia"] = round(float(extra_info["inertia"]), 2)

    # Need at least 2 clusters and 2 points to compute meaningful metrics
    if n_clusters < 2 or n_clustered < 2:
        metrics["silhouette_score"] = None
        metrics["davies_bouldin_index"] = None
        metrics["calinski_harabasz_index"] = None
        metrics["note"] = "Insufficient clusters (need ≥ 2) to compute quality metrics."
        return metrics

    try:
        metrics["silhouette_score"] = round(float(silhouette_score(X_filtered, labels_filtered)), 4)
    except Exception:
        metrics["silhouette_score"] = None

    try:
        metrics["davies_bouldin_index"] = round(float(davies_bouldin_score(X_filtered, labels_filtered)), 4)
    except Exception:
        metrics["davies_bouldin_index"] = None

    try:
        metrics["calinski_harabasz_index"] = round(float(calinski_harabasz_score(X_filtered, labels_filtered)), 2)
    except Exception:
        metrics["calinski_harabasz_index"] = None

    return metrics


def _execute_clustering_algorithm(
    algorithm: str,
    embeddings: np.ndarray,
    user_params: Dict[str, Any],
    default_min_size: int = 5,
    default_min_samples: int = 3
) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    """
    Modular execution engine for HDBSCAN, K-Means++, and Agglomerative Hierarchical Clustering.
    Returns: (labels, probabilities_or_affinities, algorithm_extras)
    """
    algo = (algorithm or "HDBSCAN").upper()
    n_samples = len(embeddings)

    if algo == "KMEANS":
        requested_k = int(user_params.get("n_clusters") or user_params.get("k") or 8)
        k = max(2, min(requested_k, n_samples - 1 if n_samples > 2 else 2))
        init = str(user_params.get("init") or "k-means++")
        max_iter = int(user_params.get("max_iter") or 300)
        n_init = int(user_params.get("n_init") or 10)

        km = KMeans(n_clusters=k, init=init, max_iter=max_iter, n_init=n_init, random_state=42)
        labels = km.fit_predict(embeddings)

        # Compute softmax-based distance affinity from cluster centroids
        dists = km.transform(embeddings)
        neg_dists = -dists
        exp_d = np.exp(neg_dists - np.max(neg_dists, axis=1, keepdims=True))
        soft_affinities = exp_d / np.sum(exp_d, axis=1, keepdims=True)
        probs = np.array([float(round(soft_affinities[i, labels[i]], 4)) for i in range(len(labels))])

        return labels, probs, {"inertia": float(km.inertia_), "n_clusters": k}

    elif algo == "AGGLOMERATIVE":
        requested_k = int(user_params.get("n_clusters") or user_params.get("k") or 8)
        k = max(2, min(requested_k, n_samples - 1 if n_samples > 2 else 2))
        linkage = str(user_params.get("linkage") or "ward").lower()
        metric = str(user_params.get("metric") or "euclidean").lower()
        if linkage == "ward":
            metric = "euclidean"

        agg = AgglomerativeClustering(n_clusters=k, linkage=linkage, metric=metric)
        labels = agg.fit_predict(embeddings)

        # Compute distance-to-medoid normalized affinities
        probs = np.ones(len(labels))
        for cid in set(labels):
            c_indices = np.where(labels == cid)[0]
            if len(c_indices) > 0:
                c_embeds = embeddings[c_indices]
                c_mean = np.mean(c_embeds, axis=0, keepdims=True)
                dists = np.linalg.norm(c_embeds - c_mean, axis=1)
                max_d = np.max(dists) if np.max(dists) > 0 else 1.0
                c_probs = np.clip(1.0 - (dists / (max_d * 1.5)), 0.15, 1.0)
                for idx, p in zip(c_indices, c_probs):
                    probs[idx] = round(float(p), 4)

        return labels, probs, {"n_clusters": k, "linkage": linkage}

    else:  # Default to HDBSCAN
        min_cluster_size = int(user_params.get("min_cluster_size") or default_min_size)
        min_samples = int(user_params.get("min_samples") or default_min_samples)
        metric = str(user_params.get("metric") or "euclidean")
        cluster_selection_method = str(user_params.get("cluster_selection_method") or "eom")

        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            metric=metric,
            cluster_selection_method=cluster_selection_method
        )
        labels = clusterer.fit_predict(embeddings)
        probs = getattr(clusterer, "probabilities_", None)
        if probs is None:
            probs = np.ones(len(labels))
        else:
            probs = np.array([float(round(p, 4)) for p in probs])

        return labels, probs, {"cluster_selection_method": cluster_selection_method}


def _compute_2d_projection(
    embeddings: np.ndarray,
    records: List[Dict[str, Any]],
    id_key: str = "finding_id",
    title_key: str = "title"
) -> List[Dict[str, Any]]:
    """
    Project high-dimensional embeddings to 2D coordinates using PCA for visual cluster mapping.
    """
    if len(embeddings) < 2:
        return []
    try:
        pca = PCA(n_components=2, random_state=42)
        coords = pca.fit_transform(embeddings)
        projected = []
        for rec, xy in zip(records, coords):
            p = {
                "id": str(rec.get(id_key, "")),
                "title": str(rec.get(title_key, "Untitled")),
                "cluster_id": int(rec.get("cluster_id", -1)),
                "x": round(float(xy[0]), 3),
                "y": round(float(xy[1]), 3),
                "strength": float(rec.get("strength", 1.0)),
                "is_noise": int(rec.get("cluster_id", -1)) == -1,
            }
            if "severity" in rec:
                p["severity"] = rec["severity"]
            if "cvss_score" in rec:
                p["cvss_score"] = rec["cvss_score"]
            if "cwe" in rec:
                p["cwe"] = rec["cwe"]
            if "audit_type" in rec:
                p["audit_type"] = rec["audit_type"]
            if "total_vulns" in rec:
                p["total_vulns"] = rec["total_vulns"]
            if "avg_cvss" in rec:
                p["avg_cvss"] = rec["avg_cvss"]
            projected.append(p)
        return projected
    except Exception as e:
        logger.warning(f"Error computing 2D projection: {e}")
        return []


async def is_clustering_in_progress(db: AsyncSession, clustering_type: str) -> Optional[ClusteringRun]:
    """Check if a clustering run of given type is already queued or running in the database."""
    query = (
        select(ClusteringRun)
        .where(
            and_(
                ClusteringRun.clustering_type == clustering_type,
                ClusteringRun.status.in_([RunStatus.QUEUED.value, RunStatus.RUNNING.value])
            )
        )
        .order_by(ClusteringRun.created_at.desc())
        .limit(1)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def trigger_vulnerability_clustering(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    config: Optional[Dict[str, Any]] = None
) -> ClusteringRun:
    """
    Explicitly trigger vulnerability clustering on-demand with user-configured parameters.
    Enforces strict concurrency control.
    """
    async with _active_jobs_lock:
        if ClusteringType.VULNERABILITY.value in _active_jobs:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A Vulnerability Clustering run is already active in memory."
            )
        
        active_db_run = await is_clustering_in_progress(db, ClusteringType.VULNERABILITY.value)
        if active_db_run:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A Vulnerability Clustering run is already active in the database (Run ID: {active_db_run.run_id})."
            )

        cfg = config or {}
        algo = str(cfg.get("algorithm") or "HDBSCAN").upper()
        selected_features = cfg.get("selected_features") or [
            "title", "observation_description", "cwe", "impact", "cve_id"
        ]
        user_params = cfg.get("parameters") or {}
        include_numeric = bool(cfg.get("include_numeric_features", False) or "cvss_score" in selected_features)

        dev_meta = _get_device_metadata()
        algorithm_version = f"{algo}-SBERT-v2.0"

        stored_params = {
            "algorithm": algo,
            "selected_features": selected_features,
            "user_parameters": user_params,
            "include_numeric_features": include_numeric,
            "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim)" + (" + StandardScaler (Numeric)" if include_numeric else ""),
            "compute_device": dev_meta["compute_device"],
            "gpu_accelerated": dev_meta["gpu_accelerated"],
            "gpu_name": dev_meta["gpu_name"],
            **user_params
        }

        new_run = ClusteringRun(
            run_id=uuid.uuid4(),
            clustering_type=ClusteringType.VULNERABILITY.value,
            status=RunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            algorithm_version=algorithm_version,
            parameters=stored_params
        )
        db.add(new_run)
        await db.commit()
        await db.refresh(new_run)

        _active_jobs.add(ClusteringType.VULNERABILITY.value)

    # Spawn background worker task
    asyncio.create_task(_run_vulnerability_clustering_job(new_run.run_id))

    return new_run


async def trigger_report_clustering(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    config: Optional[Dict[str, Any]] = None
) -> ClusteringRun:
    """
    Explicitly trigger audit report clustering on-demand with user-configured parameters.
    Enforces strict concurrency control.
    """
    async with _active_jobs_lock:
        if ClusteringType.REPORT.value in _active_jobs:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A Report Clustering run is already active in memory."
            )
        
        active_db_run = await is_clustering_in_progress(db, ClusteringType.REPORT.value)
        if active_db_run:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A Report Clustering run is already active in the database (Run ID: {active_db_run.run_id})."
            )

        cfg = config or {}
        algo = str(cfg.get("algorithm") or "HDBSCAN").upper()
        selected_features = cfg.get("selected_features") or [
            "clean_name", "audit_type", "sample_findings", "total_vulns", "avg_cvss"
        ]
        user_params = cfg.get("parameters") or {}

        dev_meta = _get_device_metadata()
        algorithm_version = f"{algo}-SBERT-ReportCohorts-v2.0"

        stored_params = {
            "algorithm": algo,
            "selected_features": selected_features,
            "user_parameters": user_params,
            "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim) + Hybrid Profile",
            "compute_device": dev_meta["compute_device"],
            "gpu_accelerated": dev_meta["gpu_accelerated"],
            "gpu_name": dev_meta["gpu_name"],
            **user_params
        }

        new_run = ClusteringRun(
            run_id=uuid.uuid4(),
            clustering_type=ClusteringType.REPORT.value,
            status=RunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            algorithm_version=algorithm_version,
            parameters=stored_params
        )
        db.add(new_run)
        await db.commit()
        await db.refresh(new_run)

        _active_jobs.add(ClusteringType.REPORT.value)

    # Spawn background worker task
    asyncio.create_task(_run_report_clustering_job(new_run.run_id))

    return new_run


# ==============================================================================
# BACKGROUND WORKER IMPLEMENTATIONS
# ==============================================================================

async def _update_run_progress(run_id: uuid.UUID, stage: str, percent: int, status_str: str = RunStatus.RUNNING.value):
    async with AsyncSessionLocal() as session:
        run = await session.get(ClusteringRun, run_id)
        if run:
            run.status = status_str
            run.current_stage = stage
            run.progress_percent = percent
            if not run.started_at:
                run.started_at = datetime.now(timezone.utc)
            await session.commit()


async def _run_vulnerability_clustering_job(run_id: uuid.UUID):
    """Worker task that computes TF-IDF + HDBSCAN clustering on DetailedObservations."""
    logger.info(f"Starting Vulnerability Clustering Job for Run ID: {run_id}")
    try:
        await _update_run_progress(run_id, "Loading records from database", 15)

        async with AsyncSessionLocal() as session:
            # Join with Report to get source report filename
            query = (
                select(
                    DetailedObservation.finding_id,
                    DetailedObservation.report_id,
                    DetailedObservation.title,
                    DetailedObservation.observation_description,
                    DetailedObservation.severity,
                    DetailedObservation.status,
                    DetailedObservation.cvss_score,
                    DetailedObservation.reported_epss_score,
                    DetailedObservation.cwe,
                    DetailedObservation.cve_id,
                    DetailedObservation.affected_asset,
                    DetailedObservation.impact,
                    DetailedObservation.likely_root_cause,
                    DetailedObservation.recommendation,
                    Report.original_filename
                )
                .join(Report, DetailedObservation.report_id == Report.report_id)
            )
            result = await session.execute(query)
            rows = result.all()

        if not rows or len(rows) < 5:
            async with AsyncSessionLocal() as session:
                run = await session.get(ClusteringRun, run_id)
                if run:
                    run.status = RunStatus.COMPLETED.value
                    run.current_stage = "Completed (Insufficient data)"
                    run.progress_percent = 100
                    run.completed_at = datetime.now(timezone.utc)
                    run.input_record_count = len(rows)
                    run.discovered_cluster_count = 0
                    run.noise_record_count = len(rows)
                    run.summary = {
                        "clusters": [],
                        "noise_count": len(rows),
                        "message": "Fewer than 5 observations found; clustering could not form groups."
                    }
                    await session.commit()
            return

        await _update_run_progress(run_id, "Preparing feature matrices & text representations", 35)

        # Retrieve user-selected features and algorithm parameters
        async with AsyncSessionLocal() as session:
            current_run = await session.get(ClusteringRun, run_id)
            run_params = (current_run.parameters or {}) if current_run else {}

        algo = str(run_params.get("algorithm") or "HDBSCAN").upper()
        selected_features = run_params.get("selected_features") or [
            "title", "observation_description", "cwe", "impact", "cve_id"
        ]
        user_params = run_params.get("user_parameters") or {}
        include_cvss = bool("cvss_score" in selected_features or run_params.get("include_numeric_features"))

        # Build feature text and metadata dictionaries
        data_records = []
        texts = []
        numeric_vectors = []

        for r in rows:
            cwes = r.cwe or []
            cves = r.cve_id or []
            title = r.title or ""
            desc = r.observation_description or ""
            impact = r.impact or ""
            root_cause = r.likely_root_cause or ""
            rec_fix = r.recommendation or ""

            cwe_str = " ".join(cwes) if isinstance(cwes, list) else str(cwes)
            cve_str = " ".join(cves) if isinstance(cves, list) else str(cves)

            # Dynamically assemble text fields based on user selection
            text_parts = []
            if "title" in selected_features and title:
                text_parts.append(title)
            if "observation_description" in selected_features and desc:
                text_parts.append(desc)
            if "cwe" in selected_features and cwe_str:
                text_parts.append(cwe_str)
            if "cve_id" in selected_features and cve_str:
                text_parts.append(cve_str)
            if "impact" in selected_features and impact:
                text_parts.append(impact)
            if "likely_root_cause" in selected_features and root_cause:
                text_parts.append(root_cause)
            if "recommendation" in selected_features and rec_fix:
                text_parts.append(rec_fix)

            combined_text = ". ".join(p.strip() for p in text_parts if p.strip()).strip()
            if not combined_text:
                combined_text = title or "Unknown vulnerability"
            texts.append(combined_text)

            if include_cvss:
                numeric_vectors.append([float(r.cvss_score) if r.cvss_score is not None else 5.0])

            sev_val = r.severity.value if r.severity else (str(r.severity) if r.severity else "Unknown")
            stat_val = r.status.value if r.status else (str(r.status) if r.status else "Open")

            data_records.append({
                "finding_id": r.finding_id,
                "report_id": r.report_id,
                "report_filename": r.original_filename,
                "title": title or "Untitled Finding",
                "severity": sev_val,
                "status": stat_val,
                "cvss_score": float(r.cvss_score) if r.cvss_score is not None else None,
                "cwe": cwes if isinstance(cwes, list) else [cwes],
                "cve_id": cves if isinstance(cves, list) else [cves],
            })

        # Feature Extraction: Sentence-BERT semantic embeddings + optional numeric features
        sbert_model = await _get_sbert_model()
        target_device = _get_torch_device()

        def _compute_clustering_in_thread():
            if target_device == "cuda":
                try:
                    sbert_model.to("cuda")
                except Exception as e:
                    logger.warning(f"Could not transfer sbert_model to cuda: {e}")

            # Encode selected vulnerability texts into 768-dim semantic vectors
            embeddings = sbert_model.encode(
                texts,
                show_progress_bar=False,
                batch_size=64,
                normalize_embeddings=True,
                device=target_device,
                convert_to_numpy=True,
            )

            # If numeric features selected, horizontally stack scaled dimensions
            if numeric_vectors:
                scaler = StandardScaler()
                scaled_num = scaler.fit_transform(np.array(numeric_vectors))
                embeddings = np.hstack([embeddings, scaled_num])
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                embeddings = embeddings / norms

            default_min = min(5, max(2, len(texts) // 100))
            labels, probs, algo_extras = _execute_clustering_algorithm(
                algo, embeddings, user_params, default_min_size=default_min, default_min_samples=3
            )
            return labels, probs, embeddings, algo_extras

        await _update_run_progress(run_id, f"Running {algo} clustering & vectorization", 60)
        labels, probs, embeddings, algo_extras = await asyncio.to_thread(_compute_clustering_in_thread)

        await _update_run_progress(run_id, "Computing quality metrics & persisting results", 80)

        # Compute clustering quality metrics on non-noise points
        quality_metrics = _compute_quality_metrics(embeddings, labels, extra_info=algo_extras)

        # Organize into clusters
        clusters_map: Dict[int, List[Dict[str, Any]]] = {}
        for idx, (rec, label, prob) in enumerate(zip(data_records, labels, probs)):
            rec["cluster_id"] = int(label)
            rec["strength"] = float(round(prob, 4))
            clusters_map.setdefault(int(label), []).append(rec)

        discovered_cluster_ids = sorted([cid for cid in clusters_map.keys() if cid != -1])
        noise_findings = clusters_map.get(-1, [])

        # Build cluster summaries and labels
        cluster_summaries = []
        member_entities_to_insert = []

        overall_severities = Counter([r["severity"] for r in data_records])

        for c_id in discovered_cluster_ids:
            members = clusters_map[c_id]
            # Identify most common CWEs
            all_cwes = [c for m in members for c in m["cwe"] if c]
            top_cwes = [item[0] for item in Counter(all_cwes).most_common(3)]
            
            # Severity breakdown
            sev_counts = Counter([m["severity"] for m in members])
            
            # Avg CVSS
            cvss_vals = [m["cvss_score"] for m in members if m["cvss_score"] is not None]
            avg_cvss = round(sum(cvss_vals) / len(cvss_vals), 1) if cvss_vals else None

            # Generate descriptive title
            cwe_tag = f"[{', '.join(top_cwes)}]" if top_cwes else ""
            titles = [m["title"] for m in members]
            # Pick a representative title with good membership strength
            best_member = max(members, key=lambda x: (x["strength"], len(x["title"])))
            cluster_name = f"{cwe_tag} {best_member['title']}".strip()
            if len(cluster_name) > 80:
                cluster_name = cluster_name[:77] + "..."

            # Representative sample findings (top 4 by strength)
            rep_findings = sorted(members, key=lambda x: x["strength"], reverse=True)[:4]

            summary_item = {
                "cluster_id": c_id,
                "cluster_label": cluster_name,
                "size": len(members),
                "top_cwes": top_cwes,
                "avg_cvss": avg_cvss,
                "severity_counts": dict(sev_counts),
                "representative_findings": [
                    {
                        "finding_id": str(rf["finding_id"]),
                        "title": rf["title"],
                        "severity": rf["severity"],
                        "cvss_score": rf["cvss_score"],
                        "report_filename": rf["report_filename"],
                        "membership_strength": rf["strength"]
                    }
                    for rf in rep_findings
                ]
            }
            cluster_summaries.append(summary_item)

            for m in members:
                member_entities_to_insert.append(
                    VulnerabilityClusterMember(
                        member_id=uuid.uuid4(),
                        run_id=run_id,
                        cluster_id=c_id,
                        finding_id=m["finding_id"],
                        membership_strength=m["strength"],
                        cluster_label=cluster_name,
                        member_metadata={
                            "title": m["title"],
                            "severity": m["severity"],
                            "cvss_score": m["cvss_score"],
                            "report_filename": m["report_filename"],
                            "cwe": m["cwe"]
                        }
                    )
                )

        # Also store noise members
        for m in noise_findings:
            member_entities_to_insert.append(
                VulnerabilityClusterMember(
                    member_id=uuid.uuid4(),
                    run_id=run_id,
                    cluster_id=-1,
                    finding_id=m["finding_id"],
                    membership_strength=m["strength"],
                    cluster_label="Noise / Outlier",
                    member_metadata={
                        "title": m["title"],
                        "severity": m["severity"],
                        "cvss_score": m["cvss_score"],
                        "report_filename": m["report_filename"],
                        "cwe": m["cwe"]
                    }
                )
            )

        # Batch insert members & update run record
        async with AsyncSessionLocal() as session:
            # Batch insert in chunks of 500
            for i in range(0, len(member_entities_to_insert), 500):
                chunk = member_entities_to_insert[i:i + 500]
                session.add_all(chunk)
                await session.flush()

            run = await session.get(ClusteringRun, run_id)
            if run:
                run.status = RunStatus.COMPLETED.value
                run.current_stage = "Completed"
                run.progress_percent = 100
                run.completed_at = datetime.now(timezone.utc)
                run.input_record_count = len(data_records)
                run.discovered_cluster_count = len(discovered_cluster_ids)
                run.noise_record_count = len(noise_findings)
                dev_meta = _get_device_metadata()
                coords_2d = _compute_2d_projection(embeddings, data_records, id_key="finding_id", title_key="title")
                run.summary = {
                    "clusters": cluster_summaries,
                    "projection_2d": coords_2d,
                    "discovered_cluster_count": len(discovered_cluster_ids),
                    "noise_count": len(noise_findings),
                    "total_findings": len(data_records),
                    "severity_distribution": dict(overall_severities),
                    "algorithm": algo,
                    "algorithm_version": run.algorithm_version,
                    "selected_features": selected_features,
                    "parameters": user_params,
                    "compute_device": dev_meta["compute_device"],
                    "gpu_accelerated": dev_meta["gpu_accelerated"],
                    "gpu_name": dev_meta["gpu_name"],
                    "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim)" + (" + StandardScaler (Numeric)" if include_cvss else ""),
                    "quality_metrics": quality_metrics
                }
            await session.commit()

        logger.info(f"Vulnerability Clustering completed successfully for Run ID: {run_id}")

        # Automatically prune older runs for this algorithm to ensure only top 1 run per algorithm is kept
        try:
            async with AsyncSessionLocal() as session:
                await prune_older_runs_for_algorithm(
                    session, ClusteringType.VULNERABILITY.value, algo, keep_run_id=run_id
                )
        except Exception as prune_err:
            logger.warning(f"Failed to prune older runs for algorithm {algo}: {prune_err}")

    except Exception as e:
        logger.error(f"Vulnerability Clustering failed for Run ID {run_id}: {str(e)}", exc_info=True)
        async with AsyncSessionLocal() as session:
            run = await session.get(ClusteringRun, run_id)
            if run:
                run.status = RunStatus.FAILED.value
                run.current_stage = "Failed"
                run.error_message = str(e)
                run.completed_at = datetime.now(timezone.utc)
                await session.commit()
    finally:
        async with _active_jobs_lock:
            _active_jobs.discard(ClusteringType.VULNERABILITY.value)


async def _run_report_clustering_job(run_id: uuid.UUID):
    """Worker task that computes Risk-Profile + HDBSCAN clustering on Reports."""
    logger.info(f"Starting Report Clustering Job for Run ID: {run_id}")
    try:
        await _update_run_progress(run_id, "Loading report records & metrics", 15)

        async with AsyncSessionLocal() as session:
            query = text("""
                SELECT 
                    r.report_id,
                    r.original_filename,
                    r.upload_status,
                    r.created_at,
                    COUNT(d.finding_id) AS total_vulns,
                    COALESCE(AVG(d.cvss_score), 0) AS avg_cvss,
                    COALESCE(MAX(d.cvss_score), 0) AS max_cvss,
                    SUM(CASE WHEN d.severity = 'Critical' THEN 1 ELSE 0 END) AS crit_count,
                    SUM(CASE WHEN d.severity = 'High' THEN 1 ELSE 0 END) AS high_count,
                    SUM(CASE WHEN d.severity = 'Medium' THEN 1 ELSE 0 END) AS med_count,
                    SUM(CASE WHEN d.severity = 'Low' THEN 1 ELSE 0 END) AS low_count,
                    SUM(CASE WHEN d.status = 'Open' THEN 1 ELSE 0 END) AS open_count,
                    SUM(CASE WHEN d.status = 'Closed' THEN 1 ELSE 0 END) AS closed_count,
                    SUM(CASE WHEN d.new_or_repeat = 'Repeat' THEN 1 ELSE 0 END) AS repeat_count,
                    rd.data->'report_meta'->>'audit_type' AS audit_type,
                    rd.data->'report_meta'->>'report_title' AS report_title,
                    string_agg(DISTINCT d.title, '; ') AS sample_titles
                FROM reports r
                LEFT JOIN detailed_observations d ON r.report_id = d.report_id
                LEFT JOIN reports_data rd ON r.report_id = rd.report_id
                GROUP BY r.report_id, r.original_filename, r.upload_status, r.created_at, rd.data;
            """)
            result = await session.execute(query)
            rows = result.mappings().all()

        if not rows or len(rows) < 4:
            async with AsyncSessionLocal() as session:
                run = await session.get(ClusteringRun, run_id)
                if run:
                    run.status = RunStatus.COMPLETED.value
                    run.current_stage = "Completed (Insufficient data)"
                    run.progress_percent = 100
                    run.completed_at = datetime.now(timezone.utc)
                    run.input_record_count = len(rows)
                    run.discovered_cluster_count = 0
                    run.noise_record_count = len(rows)
                    run.summary = {
                        "clusters": [],
                        "noise_count": len(rows),
                        "message": "Fewer than 4 reports found; clustering could not form groups."
                    }
                    await session.commit()
            return

        await _update_run_progress(run_id, "Constructing semantic report profiles", 35)

        # Retrieve user-selected features and algorithm parameters
        async with AsyncSessionLocal() as session:
            current_run = await session.get(ClusteringRun, run_id)
            run_params = (current_run.parameters or {}) if current_run else {}

        algo = str(run_params.get("algorithm") or "HDBSCAN").upper()
        selected_features = run_params.get("selected_features") or [
            "clean_name", "audit_type", "sample_findings", "total_vulns", "avg_cvss"
        ]
        user_params = run_params.get("user_parameters") or {}

        data_records = []
        texts = []
        numeric_vectors = []

        for r in rows:
            tot = max(1, r["total_vulns"])
            crit_ratio = float(r["crit_count"]) / tot
            open_ratio = float(r["open_count"]) / tot
            avg_cvss = float(r["avg_cvss"])

            raw_name = (r["report_title"] or r["original_filename"] or "").replace("_", " ").replace(".pdf", "").replace(".docx", "").replace(".txt", "")
            clean_name = re.sub(r'(\b[vV]\d+(\.\d+)*\b|\.\w+$)', '', raw_name).strip()
            audit_type = r["audit_type"] or "Security Audit"
            vulns = int(r["total_vulns"])
            crit = int(r["crit_count"])
            high = int(r["high_count"])
            sample_findings = (r["sample_titles"] or "")[:150].replace(";", ",")

            # Dynamic text assembly based on selected features
            text_parts = []
            if "clean_name" in selected_features and clean_name:
                text_parts.append(clean_name)
            if "audit_type" in selected_features and audit_type:
                text_parts.append(f"({audit_type})")
            if "sample_findings" in selected_features and sample_findings:
                text_parts.append(f"Findings: {sample_findings}")

            text_desc = " ".join(text_parts).strip()
            if not text_desc:
                text_desc = clean_name or "Security Audit Report"
            texts.append(text_desc)

            # Check for numeric dimensions
            num_row = []
            if "total_vulns" in selected_features:
                num_row.append(float(vulns))
            if "avg_cvss" in selected_features:
                num_row.append(float(avg_cvss))
            if "crit_ratio" in selected_features:
                num_row.append(float(crit_ratio))
            if "open_ratio" in selected_features:
                num_row.append(float(open_ratio))

            if num_row:
                numeric_vectors.append(num_row)

            data_records.append({
                "report_id": r["report_id"],
                "original_filename": r["original_filename"],
                "audit_type": audit_type,
                "report_title": r["report_title"] or r["original_filename"],
                "clean_name": clean_name,
                "total_vulns": vulns,
                "avg_cvss": round(avg_cvss, 1),
                "crit_count": crit,
                "high_count": high,
                "open_count": int(r["open_count"]),
                "repeat_count": int(r["repeat_count"]),
                "crit_ratio": round(crit_ratio, 2),
                "open_ratio": round(open_ratio, 2),
            })

        # Feature Extraction: Sentence-BERT semantic embeddings on GPU
        sbert_model = await _get_sbert_model()
        target_device = _get_torch_device()
        dev_meta = _get_device_metadata()

        def _compute_report_clustering_in_thread():
            if target_device == "cuda":
                try:
                    sbert_model.to("cuda")
                except Exception as e:
                    logger.warning(f"Could not transfer sbert_model to cuda: {e}")

            embeddings = sbert_model.encode(
                texts,
                show_progress_bar=False,
                batch_size=64,
                normalize_embeddings=True,
                device=target_device,
                convert_to_numpy=True,
            )

            if numeric_vectors:
                scaler = StandardScaler()
                scaled_num = scaler.fit_transform(np.array(numeric_vectors))
                embeddings = np.hstack([embeddings, scaled_num])
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                embeddings = embeddings / norms

            default_min = min(4, max(3, len(rows) // 40))
            labels, probs, algo_extras = _execute_clustering_algorithm(
                algo, embeddings, user_params, default_min_size=default_min, default_min_samples=2
            )
            return labels, probs, embeddings, algo_extras

        await _update_run_progress(run_id, f"Running {algo} clustering & vectorization", 60)
        labels, probs, embeddings, algo_extras = await asyncio.to_thread(_compute_report_clustering_in_thread)

        await _update_run_progress(run_id, "Computing quality metrics & saving results", 80)

        # Compute clustering quality metrics on non-noise points
        quality_metrics = _compute_quality_metrics(embeddings, labels, extra_info=algo_extras)

        clusters_map: Dict[int, List[Dict[str, Any]]] = {}
        for rec, label, prob in zip(data_records, labels, probs):
            rec["cluster_id"] = int(label)
            rec["strength"] = float(round(prob, 4))
            clusters_map.setdefault(int(label), []).append(rec)

        discovered_cluster_ids = sorted([cid for cid in clusters_map.keys() if cid != -1])
        noise_reports = clusters_map.get(-1, [])

        cluster_summaries = []
        member_entities_to_insert = []

        for c_id in discovered_cluster_ids:
            members = clusters_map[c_id]
            avg_c_cvss = round(sum(m["avg_cvss"] for m in members) / len(members), 1)
            avg_c_vulns = round(sum(m["total_vulns"] for m in members) / len(members), 1)
            avg_crit_ratio = round(sum(m["crit_ratio"] for m in members) / len(members), 2)
            avg_open_ratio = round(sum(m["open_ratio"] for m in members) / len(members), 2)

            rep_reports = sorted(members, key=lambda x: x["strength"], reverse=True)
            lead_report = rep_reports[0]
            lead_title = lead_report.get("clean_name") or lead_report["report_title"]
            clean_lead = re.sub(r'(\b[vV]\d+(\.\d+)*\b|\.\w+$)', '', lead_title.replace('_', ' ')).strip()

            profile_type = f"{clean_lead} Cohort"
            cluster_label = f"Cluster #{c_id}: {clean_lead} ({len(members)} Reports)"

            cluster_summaries.append({
                "cluster_id": c_id,
                "cluster_label": cluster_label,
                "profile_type": profile_type,
                "report_count": len(members),
                "avg_cvss": avg_c_cvss,
                "avg_vulns": avg_c_vulns,
                "avg_critical_ratio": avg_crit_ratio,
                "avg_open_ratio": avg_open_ratio,
                "representative_reports": [
                    {
                        "report_id": str(rr["report_id"]),
                        "filename": rr["original_filename"],
                        "audit_type": rr["audit_type"],
                        "total_vulns": rr["total_vulns"],
                        "avg_cvss": rr["avg_cvss"],
                        "crit_count": rr["crit_count"],
                        "membership_strength": rr["strength"]
                    }
                    for rr in rep_reports[:4]
                ]
            })

            for m in members:
                member_entities_to_insert.append(
                    ReportClusterMember(
                        member_id=uuid.uuid4(),
                        run_id=run_id,
                        cluster_id=c_id,
                        report_id=m["report_id"],
                        membership_strength=m["strength"],
                        cluster_label=cluster_label,
                        member_metadata={
                            "filename": m["original_filename"],
                            "audit_type": m["audit_type"],
                            "total_vulns": m["total_vulns"],
                            "avg_cvss": m["avg_cvss"],
                            "crit_count": m["crit_count"],
                            "open_count": m["open_count"],
                        }
                    )
                )

        # Store noise reports
        for m in noise_reports:
            member_entities_to_insert.append(
                ReportClusterMember(
                    member_id=uuid.uuid4(),
                    run_id=run_id,
                    cluster_id=-1,
                    report_id=m["report_id"],
                    membership_strength=m["strength"],
                    cluster_label="Noise / Unique Report",
                    member_metadata={
                        "filename": m["original_filename"],
                        "audit_type": m["audit_type"],
                        "total_vulns": m["total_vulns"],
                        "avg_cvss": m["avg_cvss"],
                        "crit_count": m["crit_count"],
                        "open_count": m["open_count"],
                    }
                )
            )

        async with AsyncSessionLocal() as session:
            for i in range(0, len(member_entities_to_insert), 500):
                chunk = member_entities_to_insert[i:i + 500]
                session.add_all(chunk)
                await session.flush()

            run = await session.get(ClusteringRun, run_id)
            if run:
                run.status = RunStatus.COMPLETED.value
                run.current_stage = "Completed"
                run.progress_percent = 100
                run.completed_at = datetime.now(timezone.utc)
                run.input_record_count = len(data_records)
                run.discovered_cluster_count = len(discovered_cluster_ids)
                run.noise_record_count = len(noise_reports)
                dev_meta = _get_device_metadata()
                coords_2d = _compute_2d_projection(embeddings, data_records, id_key="report_id", title_key="report_title")
                run.summary = {
                    "clusters": cluster_summaries,
                    "projection_2d": coords_2d,
                    "discovered_cluster_count": len(discovered_cluster_ids),
                    "noise_count": len(noise_reports),
                    "total_reports": len(data_records),
                    "algorithm": algo,
                    "algorithm_version": run.algorithm_version,
                    "selected_features": selected_features,
                    "parameters": user_params,
                    "compute_device": dev_meta["compute_device"],
                    "gpu_accelerated": dev_meta["gpu_accelerated"],
                    "gpu_name": dev_meta["gpu_name"],
                    "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim) + Hybrid Profile",
                    "quality_metrics": quality_metrics
                }
            await session.commit()

        logger.info(f"Report Clustering completed successfully for Run ID: {run_id}")

        # Automatically prune older runs for this algorithm to ensure only top 1 run per algorithm is kept
        try:
            async with AsyncSessionLocal() as session:
                await prune_older_runs_for_algorithm(
                    session, ClusteringType.REPORT.value, algo, keep_run_id=run_id
                )
        except Exception as prune_err:
            logger.warning(f"Failed to prune older runs for algorithm {algo}: {prune_err}")

    except Exception as e:
        logger.error(f"Report Clustering failed for Run ID {run_id}: {str(e)}", exc_info=True)
        async with AsyncSessionLocal() as session:
            run = await session.get(ClusteringRun, run_id)
            if run:
                run.status = RunStatus.FAILED.value
                run.current_stage = "Failed"
                run.error_message = str(e)
                run.completed_at = datetime.now(timezone.utc)
                await session.commit()
    finally:
        async with _active_jobs_lock:
            _active_jobs.discard(ClusteringType.REPORT.value)


# ==============================================================================
# READ-ONLY DATA RETRIEVAL & RETENTION QUERIES
# ==============================================================================

def _extract_algorithm_from_run(run: ClusteringRun) -> str:
    """Extract standard algorithm name (HDBSCAN, KMEANS, AGGLOMERATIVE) from run metadata."""
    params = run.parameters or {}
    summary = run.summary or {}
    algo = params.get("algorithm") or summary.get("algorithm") or ""
    if not algo and run.algorithm_version:
        v_upper = run.algorithm_version.upper()
        if "HDBSCAN" in v_upper:
            algo = "HDBSCAN"
        elif "KMEANS" in v_upper:
            algo = "KMEANS"
        elif "AGGLOMERATIVE" in v_upper:
            algo = "AGGLOMERATIVE"
    algo_str = str(algo).strip().upper()
    if "KMEANS" in algo_str or "K-MEANS" in algo_str:
        return "KMEANS"
    if "AGGLOMERATIVE" in algo_str:
        return "AGGLOMERATIVE"
    return "HDBSCAN" if "HDBSCAN" in algo_str else (algo_str or "HDBSCAN")


async def prune_older_runs_for_algorithm(
    session: AsyncSession,
    clustering_type: str,
    algorithm: str,
    keep_run_id: uuid.UUID
) -> int:
    """
    Ensure history keeps strictly 1 run per algorithm (maximum 3 history runs total).
    When a new run completes for an algorithm (e.g. K-Means), all older runs for that same
    algorithm are deleted completely along with cascaded cluster members to prevent DB bloat.
    """
    target_algo = str(algorithm).strip().upper()
    if "KMEANS" in target_algo or "K-MEANS" in target_algo:
        target_algo = "KMEANS"
    elif "AGGLOMERATIVE" in target_algo:
        target_algo = "AGGLOMERATIVE"
    elif "HDBSCAN" in target_algo:
        target_algo = "HDBSCAN"

    query = (
        select(ClusteringRun)
        .where(
            ClusteringRun.clustering_type == clustering_type,
            ClusteringRun.run_id != keep_run_id
        )
    )
    res = await session.execute(query)
    other_runs = res.scalars().all()

    deleted_count = 0
    for r in other_runs:
        run_algo = _extract_algorithm_from_run(r)
        if run_algo == target_algo:
            logger.info(f"Pruning older run {r.run_id} ({run_algo}) to keep only latest run for {target_algo}")
            await session.delete(r)
            deleted_count += 1

    if deleted_count > 0:
        await session.commit()
        logger.info(f"Pruned {deleted_count} older {target_algo} runs from {clustering_type} history.")

    return deleted_count


async def enforce_max_algorithm_history(session: AsyncSession, clustering_type: Optional[str] = None) -> int:
    """
    Scans the database and prunes any duplicate historical runs per algorithm,
    guaranteeing only the single latest run per algorithm is retained (at most 3 runs total).
    """
    query = select(ClusteringRun)
    if clustering_type:
        query = query.where(ClusteringRun.clustering_type == clustering_type)

    res = await session.execute(query)
    all_runs = res.scalars().all()

    grouped: Dict[Tuple[str, str], List[ClusteringRun]] = {}
    for r in all_runs:
        algo = _extract_algorithm_from_run(r)
        key = (r.clustering_type, algo)
        grouped.setdefault(key, []).append(r)

    deleted_total = 0
    for (ctype, algo), runs in grouped.items():
        if len(runs) > 1:
            runs_sorted = sorted(
                runs,
                key=lambda x: x.completed_at or x.created_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True
            )
            for old_run in runs_sorted[1:]:
                logger.info(f"Enforce history: Deleting older run {old_run.run_id} for ({ctype}, {algo})")
                await session.delete(old_run)
                deleted_total += 1

    if deleted_total > 0:
        await session.commit()
        logger.info(f"Enforce history cleanup complete: Deleted {deleted_total} redundant historical runs.")

    return deleted_total


async def get_run_status(db: AsyncSession, run_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """Retrieve lightweight run progress and state."""
    run = await db.get(ClusteringRun, run_id)
    if not run:
        return None
    return {
        "run_id": str(run.run_id),
        "clustering_type": run.clustering_type,
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "input_record_count": run.input_record_count,
        "discovered_cluster_count": run.discovered_cluster_count,
        "noise_record_count": run.noise_record_count,
        "algorithm_version": run.algorithm_version,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
    }


async def get_latest_run_info(db: AsyncSession, clustering_type: str) -> Dict[str, Any]:
    """
    Retrieve the latest completed run for display, plus active run state if one is running.
    Never executes a computation.
    """
    # 1. Latest completed run
    completed_query = (
        select(ClusteringRun)
        .where(
            and_(
                ClusteringRun.clustering_type == clustering_type,
                ClusteringRun.status == RunStatus.COMPLETED.value
            )
        )
        .order_by(ClusteringRun.completed_at.desc())
        .limit(1)
    )
    res_completed = await db.execute(completed_query)
    completed_run = res_completed.scalar_one_or_none()

    # 2. Check for active run
    active_query = (
        select(ClusteringRun)
        .where(
            and_(
                ClusteringRun.clustering_type == clustering_type,
                ClusteringRun.status.in_([RunStatus.QUEUED.value, RunStatus.RUNNING.value])
            )
        )
        .order_by(ClusteringRun.created_at.desc())
        .limit(1)
    )
    res_active = await db.execute(active_query)
    active_run = res_active.scalar_one_or_none()

    return {
        "clustering_type": clustering_type,
        "active_run": {
            "run_id": str(active_run.run_id),
            "status": active_run.status,
            "current_stage": active_run.current_stage,
            "progress_percent": active_run.progress_percent,
            "started_at": active_run.started_at.isoformat() if active_run.started_at else None,
        } if active_run else None,
        "latest_completed_run": {
            "run_id": str(completed_run.run_id),
            "status": completed_run.status,
            "current_stage": completed_run.current_stage,
            "algorithm_version": completed_run.algorithm_version,
            "input_record_count": completed_run.input_record_count,
            "discovered_cluster_count": completed_run.discovered_cluster_count,
            "noise_record_count": completed_run.noise_record_count,
            "created_at": completed_run.created_at.isoformat() if completed_run.created_at else None,
            "completed_at": completed_run.completed_at.isoformat() if completed_run.completed_at else None,
            "summary": completed_run.summary,
            "parameters": completed_run.parameters,
        } if completed_run else None
    }


async def get_run_details(db: AsyncSession, run_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """Retrieve full details of any specific run."""
    run = await db.get(ClusteringRun, run_id)
    if not run:
        return None
    return {
        "run_id": str(run.run_id),
        "clustering_type": run.clustering_type,
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "algorithm_version": run.algorithm_version,
        "input_record_count": run.input_record_count,
        "discovered_cluster_count": run.discovered_cluster_count,
        "noise_record_count": run.noise_record_count,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message,
        "parameters": run.parameters,
        "summary": run.summary,
    }


async def get_cluster_members_paginated(
    db: AsyncSession,
    run_id: uuid.UUID,
    cluster_id: int,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve paginated members of a specific cluster within a run."""
    run = await db.get(ClusteringRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Clustering run not found")

    offset = (page - 1) * page_size

    if run.clustering_type == ClusteringType.VULNERABILITY.value:
        query = (
            select(VulnerabilityClusterMember)
            .where(
                and_(
                    VulnerabilityClusterMember.run_id == run_id,
                    VulnerabilityClusterMember.cluster_id == cluster_id
                )
            )
        )
        if search:
            query = query.where(
                or_(
                    VulnerabilityClusterMember.cluster_label.ilike(f"%{search}%"),
                    VulnerabilityClusterMember.member_metadata["title"].astext.ilike(f"%{search}%")
                )
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        items_query = query.order_by(VulnerabilityClusterMember.membership_strength.desc()).limit(page_size).offset(offset)
        result = await db.execute(items_query)
        members = result.scalars().all()

        return {
            "run_id": str(run_id),
            "cluster_id": cluster_id,
            "page": page,
            "page_size": page_size,
            "total": total,
            "items": [
                {
                    "member_id": str(m.member_id),
                    "finding_id": str(m.finding_id),
                    "cluster_id": m.cluster_id,
                    "membership_strength": float(m.membership_strength) if m.membership_strength is not None else None,
                    "cluster_label": m.cluster_label,
                    "metadata": m.member_metadata
                }
                for m in members
            ]
        }
    else:
        query = (
            select(ReportClusterMember)
            .where(
                and_(
                    ReportClusterMember.run_id == run_id,
                    ReportClusterMember.cluster_id == cluster_id
                )
            )
        )
        if search:
            query = query.where(
                or_(
                    ReportClusterMember.cluster_label.ilike(f"%{search}%"),
                    ReportClusterMember.member_metadata["filename"].astext.ilike(f"%{search}%")
                )
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        items_query = query.order_by(ReportClusterMember.membership_strength.desc()).limit(page_size).offset(offset)
        result = await db.execute(items_query)
        members = result.scalars().all()

        return {
            "run_id": str(run_id),
            "cluster_id": cluster_id,
            "page": page,
            "page_size": page_size,
            "total": total,
            "items": [
                {
                    "member_id": str(m.member_id),
                    "report_id": str(m.report_id),
                    "cluster_id": m.cluster_id,
                    "membership_strength": float(m.membership_strength) if m.membership_strength is not None else None,
                    "cluster_label": m.cluster_label,
                    "metadata": m.member_metadata
                }
                for m in members
            ]
        }


async def get_clustering_history(
    db: AsyncSession,
    clustering_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> Dict[str, Any]:
    """Retrieve history of past clustering runs (maintaining at most 1 run per algorithm, max 3 runs)."""
    # Enforce history retention to clean up any redundant older runs
    try:
        await enforce_max_algorithm_history(db, clustering_type=clustering_type)
    except Exception as cleanup_err:
        logger.warning(f"Error enforcing algorithm history retention: {cleanup_err}")

    query = select(ClusteringRun)
    if clustering_type:
        query = query.where(ClusteringRun.clustering_type == clustering_type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(ClusteringRun.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    runs = result.scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "run_id": str(r.run_id),
                "clustering_type": r.clustering_type,
                "status": r.status,
                "current_stage": r.current_stage,
                "progress_percent": r.progress_percent,
                "algorithm_version": r.algorithm_version,
                "input_record_count": r.input_record_count,
                "discovered_cluster_count": r.discovered_cluster_count,
                "noise_record_count": r.noise_record_count,
                "requested_by": str(r.requested_by) if r.requested_by else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "error_message": r.error_message,
            }
            for r in runs
        ]
    }


async def get_run_projection_2d(db: AsyncSession, run_id: uuid.UUID) -> List[Dict[str, Any]]:
    """Retrieve or dynamically compute 2D coordinates for visual cluster scatter plot."""
    run = await db.get(ClusteringRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Clustering run {run_id} not found.")

    summary = run.summary or {}
    if "projection_2d" in summary and summary["projection_2d"]:
        return summary["projection_2d"]

    # Dynamic calculation fallback for runs missing cached projection
    is_vuln = (run.clustering_type == ClusteringType.VULNERABILITY.value)
    if is_vuln:
        query = (
            select(VulnerabilityClusterMember)
            .where(VulnerabilityClusterMember.run_id == run_id)
            .limit(300)
        )
        members = (await db.execute(query)).scalars().all()
        if not members:
            return []
        texts = [m.member_metadata.get("title", "") if m.member_metadata else "" for m in members]
        sbert = await _get_sbert_model()
        target_device = _get_torch_device()
        embeds = await asyncio.to_thread(sbert.encode, texts, False, 64, True, target_device, True)
        recs = [
            {
                "finding_id": str(m.finding_id),
                "title": m.member_metadata.get("title", "Untitled") if m.member_metadata else "Untitled",
                "severity": m.member_metadata.get("severity", "Unknown") if m.member_metadata else "Unknown",
                "cvss_score": m.member_metadata.get("cvss_score") if m.member_metadata else None,
                "cluster_id": m.cluster_id,
                "strength": float(m.membership_strength or 1.0),
                "cwe": m.member_metadata.get("cwe") if m.member_metadata else None,
            }
            for m in members
        ]
        return _compute_2d_projection(embeds, recs, id_key="finding_id", title_key="title")
    else:
        query = (
            select(ReportClusterMember)
            .where(ReportClusterMember.run_id == run_id)
            .limit(300)
        )
        members = (await db.execute(query)).scalars().all()
        if not members:
            return []
        texts = [m.member_metadata.get("filename", "") if m.member_metadata else "" for m in members]
        sbert = await _get_sbert_model()
        target_device = _get_torch_device()
        embeds = await asyncio.to_thread(sbert.encode, texts, False, 64, True, target_device, True)
        recs = [
            {
                "report_id": str(m.report_id),
                "report_title": m.member_metadata.get("filename", "Untitled") if m.member_metadata else "Untitled",
                "audit_type": m.member_metadata.get("audit_type", "General") if m.member_metadata else "General",
                "cluster_id": m.cluster_id,
                "strength": float(m.membership_strength or 1.0),
                "total_vulns": m.member_metadata.get("total_vulns") if m.member_metadata else 0,
                "avg_cvss": m.member_metadata.get("avg_cvss") if m.member_metadata else None,
            }
            for m in members
        ]
        return _compute_2d_projection(embeds, recs, id_key="report_id", title_key="report_title")


async def compute_optimal_k_sweep(
    db: AsyncSession,
    clustering_type: str = "VULNERABILITY",
    selected_features: Optional[List[str]] = None,
    include_numeric_features: bool = False,
    k_min: int = 2,
    k_max: int = 12,
    algorithm: str = "KMEANS"
) -> Dict[str, Any]:
    """
    Auto-Optimizer: Executes multi-k parameter sweep (Inertia & Silhouette)
    to discover mathematically optimal k.
    """
    is_vuln = (clustering_type.upper() == "VULNERABILITY")
    feats = selected_features or (["title", "cwe", "impact"] if is_vuln else ["clean_name", "audit_type"])

    texts = []
    num_vecs = []

    if is_vuln:
        query = (
            select(
                DetailedObservation.finding_id,
                DetailedObservation.title,
                DetailedObservation.observation_description,
                DetailedObservation.cwe,
                DetailedObservation.cve_id,
                DetailedObservation.impact,
                DetailedObservation.cvss_score
            )
            .limit(300)
        )
        obs_rows = (await db.execute(query)).all()
        if len(obs_rows) < 4:
            raise HTTPException(status_code=400, detail="Insufficient observation records (< 4) for k sweep.")

        for r in obs_rows:
            cwes = " ".join(r.cwe) if isinstance(r.cwe, list) else str(r.cwe or "")
            cves = " ".join(r.cve_id) if isinstance(r.cve_id, list) else str(r.cve_id or "")
            parts = []
            if "title" in feats and r.title: parts.append(r.title)
            if "observation_description" in feats and r.observation_description: parts.append(r.observation_description)
            if "cwe" in feats and cwes: parts.append(cwes)
            if "cve_id" in feats and cves: parts.append(cves)
            if "impact" in feats and r.impact: parts.append(r.impact)
            txt = ". ".join(p.strip() for p in parts if p.strip()) or (r.title or "Vulnerability")
            texts.append(txt)
            if include_numeric_features:
                num_vecs.append([float(r.cvss_score) if r.cvss_score is not None else 5.0])
    else:
        query = select(Report).limit(100)
        rep_rows = (await db.execute(query)).scalars().all()
        if len(rep_rows) < 4:
            raise HTTPException(status_code=400, detail="Insufficient report records (< 4) for k sweep.")
        for r in rep_rows:
            txt = f"{r.title or r.original_filename or 'Audit Report'} {r.audit_type or ''}"
            texts.append(txt)

    sbert = await _get_sbert_model()
    target_device = _get_torch_device()

    def _sweep_in_thread():
        embeds = sbert.encode(
            texts, show_progress_bar=False, batch_size=64,
            normalize_embeddings=True, device=target_device, convert_to_numpy=True
        )
        if num_vecs:
            scaler = StandardScaler()
            s_num = scaler.fit_transform(np.array(num_vecs))
            embeds = np.hstack([embeds, s_num])
            norms = np.linalg.norm(embeds, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            embeds = embeds / norms

        n_samples = len(embeds)
        eff_k_max = min(k_max, n_samples - 1, 15)
        eff_k_min = max(2, min(k_min, eff_k_max - 1))

        sweep_results = []
        best_k = eff_k_min
        best_score = -2.0

        for k in range(eff_k_min, eff_k_max + 1):
            km = KMeans(n_clusters=k, init="k-means++", max_iter=150, n_init=3, random_state=42)
            lbls = km.fit_predict(embeds)
            inertia = float(km.inertia_)
            sil = float(round(silhouette_score(embeds, lbls), 4))
            ch = float(round(calinski_harabasz_score(embeds, lbls), 2))
            dbi = float(round(davies_bouldin_score(embeds, lbls), 4))

            sweep_results.append({
                "k": k,
                "inertia": round(inertia, 2),
                "silhouette_score": sil,
                "calinski_harabasz": ch,
                "davies_bouldin": dbi
            })

            composite_score = sil - (dbi * 0.1)
            if composite_score > best_score:
                best_score = composite_score
                best_k = k

        return sweep_results, best_k, round(best_score, 4)

    results, best_k, best_score = await asyncio.to_thread(_sweep_in_thread)
    best_item = next((r for r in results if r["k"] == best_k), results[0])

    return {
        "status": "success",
        "clustering_type": clustering_type.upper(),
        "total_records_analyzed": len(texts),
        "optimal_k": best_k,
        "best_metrics": best_item,
        "recommendation_reason": (
            f"Mathematical sweet-spot identified at k={best_k}: "
            f"Maximized Silhouette separation ({best_item['silhouette_score']}) "
            f"with compact inter-cluster DBI ({best_item['davies_bouldin']})."
        ),
        "sweep_results": results
    }


async def compare_clustering_runs(
    db: AsyncSession,
    run_id_1: uuid.UUID,
    run_id_2: uuid.UUID
) -> Dict[str, Any]:
    """
    Cross-Run Comparison & Benchmark Matrix:
    Evaluates two historical or active runs side-by-side with delta metrics.
    """
    run1 = await db.get(ClusteringRun, run_id_1)
    run2 = await db.get(ClusteringRun, run_id_2)

    if not run1 or not run2:
        raise HTTPException(
            status_code=404,
            detail="One or both of the specified clustering runs could not be found."
        )

    if run1.clustering_type != run2.clustering_type:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Clustering comparison is strictly restricted to runs of the same clustering type. "
                f"Cannot compare a {run1.clustering_type} run with a {run2.clustering_type} run. "
                f"Vulnerability runs can only be compared against Vulnerability runs, and Report runs against Report runs."
            )
        )

    s1 = run1.summary or {}
    s2 = run2.summary or {}
    m1 = s1.get("quality_metrics") or {}
    m2 = s2.get("quality_metrics") or {}

    sil_1 = m1.get("silhouette_score")
    sil_2 = m2.get("silhouette_score")
    delta_sil = round(float(sil_2 - sil_1), 4) if sil_1 is not None and sil_2 is not None else None

    dbi_1 = m1.get("davies_bouldin_index")
    dbi_2 = m2.get("davies_bouldin_index")
    delta_dbi = round(float(dbi_2 - dbi_1), 4) if dbi_1 is not None and dbi_2 is not None else None

    ch_1 = m1.get("calinski_harabasz_index")
    ch_2 = m2.get("calinski_harabasz_index")
    delta_ch = round(float(ch_2 - ch_1), 2) if ch_1 is not None and ch_2 is not None else None

    noise_ratio_1 = m1.get("noise_ratio") or 0.0
    noise_ratio_2 = m2.get("noise_ratio") or 0.0
    delta_noise = round(float(noise_ratio_2 - noise_ratio_1), 4)

    delta_clusters = run2.discovered_cluster_count - run1.discovered_cluster_count

    # Cluster sizes comparison
    c_list_1 = s1.get("clusters") or []
    c_list_2 = s2.get("clusters") or []
    max_c = max(len(c_list_1), len(c_list_2))
    distribution_comparison = []
    for i in range(max_c):
        c1_item = c_list_1[i] if i < len(c_list_1) else None
        c2_item = c_list_2[i] if i < len(c_list_2) else None
        distribution_comparison.append({
            "index": i + 1,
            "run_1_cluster": c1_item.get("cluster_label", f"Cluster {i+1}") if c1_item else "—",
            "run_1_size": c1_item.get("size") or c1_item.get("report_count") or 0 if c1_item else 0,
            "run_2_cluster": c2_item.get("cluster_label", f"Cluster {i+1}") if c2_item else "—",
            "run_2_size": c2_item.get("size") or c2_item.get("report_count") or 0 if c2_item else 0,
        })

    # Executive recommendation
    if delta_sil is not None and delta_sil > 0.05:
        verdict = f"Run #{str(run2.run_id)[:8]} ({run2.algorithm_version}) is mathematically superior with +{round(delta_sil * 100, 1)}% stronger cluster separation."
        winner = "RUN_2"
    elif delta_sil is not None and delta_sil < -0.05:
        verdict = f"Run #{str(run1.run_id)[:8]} ({run1.algorithm_version}) is mathematically superior with +{round(abs(delta_sil) * 100, 1)}% stronger cluster separation."
        winner = "RUN_1"
    else:
        verdict = "Both model partitions achieve balanced boundary separation and comparable quality."
        winner = "TIE"

    return {
        "status": "success",
        "clustering_type": run1.clustering_type,
        "winner": winner,
        "executive_verdict": verdict,
        "run_1": {
            "run_id": str(run1.run_id),
            "clustering_type": run1.clustering_type,
            "status": run1.status,
            "algorithm": s1.get("algorithm") or run1.algorithm_version,
            "created_at": run1.created_at.isoformat() if run1.created_at else None,
            "input_records": run1.input_record_count,
            "clusters_count": run1.discovered_cluster_count,
            "noise_count": run1.noise_record_count,
            "selected_features": s1.get("selected_features") or [],
            "metrics": m1,
        },
        "run_2": {
            "run_id": str(run2.run_id),
            "clustering_type": run2.clustering_type,
            "status": run2.status,
            "algorithm": s2.get("algorithm") or run2.algorithm_version,
            "created_at": run2.created_at.isoformat() if run2.created_at else None,
            "input_records": run2.input_record_count,
            "clusters_count": run2.discovered_cluster_count,
            "noise_count": run2.noise_record_count,
            "selected_features": s2.get("selected_features") or [],
            "metrics": m2,
        },
        "deltas": {
            "delta_silhouette": delta_sil,
            "delta_davies_bouldin": delta_dbi,
            "delta_calinski_harabasz": delta_ch,
            "delta_noise_ratio": delta_noise,
            "delta_clusters": delta_clusters,
        },
        "distribution_comparison": distribution_comparison
    }

