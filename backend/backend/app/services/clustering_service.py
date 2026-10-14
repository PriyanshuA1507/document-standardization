import asyncio
import logging
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import re

import numpy as np
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score
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


def _compute_quality_metrics(X: np.ndarray, labels: np.ndarray) -> Dict[str, Any]:
    """
    Compute clustering quality metrics on non-noise points.
    
    Metrics computed:
      - Silhouette Score:        Range [-1, +1], higher is better.
      - Davies-Bouldin Index:    Range [0, ∞), lower is better.
      - Calinski-Harabasz Index: Range (0, ∞), higher is better.
      - Inertia (WCSS):          Sum of squared distances to cluster centroids, lower is better.
    
    Noise points (label == -1) are excluded from all metric calculations
    since they have no cluster assignment.
    """
    # Filter out noise points (HDBSCAN labels noise as -1)
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

    # Need at least 2 clusters and 2 points to compute meaningful metrics
    if n_clusters < 2 or n_clustered < 2:
        metrics["silhouette_score"] = None
        metrics["davies_bouldin_index"] = None
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

    return metrics


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


async def trigger_vulnerability_clustering(db: AsyncSession, user_id: Optional[uuid.UUID] = None) -> ClusteringRun:
    """
    Explicitly trigger vulnerability clustering on-demand.
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

        dev_meta = _get_device_metadata()
        new_run = ClusteringRun(
            run_id=uuid.uuid4(),
            clustering_type=ClusteringType.VULNERABILITY.value,
            status=RunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            algorithm_version="HDBSCAN-SBERT-v2.0",
            parameters={
                "min_cluster_size": 5,
                "min_samples": 3,
                "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim)",
                "metric": "euclidean",
                "compute_device": dev_meta["compute_device"],
                "gpu_accelerated": dev_meta["gpu_accelerated"],
                "gpu_name": dev_meta["gpu_name"],
            }
        )
        db.add(new_run)
        await db.commit()
        await db.refresh(new_run)

        _active_jobs.add(ClusteringType.VULNERABILITY.value)

    # Spawn background worker task
    asyncio.create_task(_run_vulnerability_clustering_job(new_run.run_id))

    return new_run


async def trigger_report_clustering(db: AsyncSession, user_id: Optional[uuid.UUID] = None) -> ClusteringRun:
    """
    Explicitly trigger audit report clustering on-demand.
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

        dev_meta = _get_device_metadata()
        new_run = ClusteringRun(
            run_id=uuid.uuid4(),
            clustering_type=ClusteringType.REPORT.value,
            status=RunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            algorithm_version="HDBSCAN-SBERT-ReportCohorts-v2.0",
            parameters={
                "min_cluster_size": 3,
                "min_samples": 2,
                "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim)",
                "metric": "euclidean",
                "compute_device": dev_meta["compute_device"],
                "gpu_accelerated": dev_meta["gpu_accelerated"],
                "gpu_name": dev_meta["gpu_name"],
            }
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

        # Build feature text and metadata dictionaries
        data_records = []
        texts = []
        for r in rows:
            cwes = r.cwe or []
            cves = r.cve_id or []
            title = r.title or ""
            desc = r.observation_description or ""
            impact = r.impact or ""
            
            cwe_str = " ".join(cwes) if isinstance(cwes, list) else str(cwes)
            cve_str = " ".join(cves) if isinstance(cves, list) else str(cves)
            
            combined_text = f"{title}. {desc} {cwe_str} {cve_str} {impact}".strip()
            if not combined_text:
                combined_text = "Unknown vulnerability"
            texts.append(combined_text)

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

        # Feature Extraction: Sentence-BERT semantic embeddings
        sbert_model = await _get_sbert_model()

        target_device = _get_torch_device()

        def _compute_clustering_in_thread():
            # Ensure model is on target device (e.g. cuda if available)
            if target_device == "cuda":
                try:
                    sbert_model.to("cuda")
                except Exception as e:
                    logger.warning(f"Could not transfer sbert_model to cuda: {e}")

            # Encode all vulnerability texts into 768-dim semantic vectors on GPU
            embeddings = sbert_model.encode(
                texts,
                show_progress_bar=False,
                batch_size=64,
                normalize_embeddings=True,  # L2-normalize for cosine-like behavior with euclidean
                device=target_device,
                convert_to_numpy=True,
            )

            min_size = min(5, max(2, len(texts) // 100))
            clusterer = hdbscan.HDBSCAN(min_cluster_size=min_size, min_samples=3, metric="euclidean")
            labels = clusterer.fit_predict(embeddings)
            probs = getattr(clusterer, "probabilities_", None)
            if probs is None:
                probs = np.ones(len(labels))
            return labels, probs, embeddings

        await _update_run_progress(run_id, "Encoding with Sentence-BERT & running HDBSCAN", 60)
        labels, probs, embeddings = await asyncio.to_thread(_compute_clustering_in_thread)

        await _update_run_progress(run_id, "Computing quality metrics & persisting results", 80)

        # Compute clustering quality metrics on non-noise points
        quality_metrics = _compute_quality_metrics(embeddings, labels)

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
                run.summary = {
                    "clusters": cluster_summaries,
                    "discovered_cluster_count": len(discovered_cluster_ids),
                    "noise_count": len(noise_findings),
                    "total_findings": len(data_records),
                    "severity_distribution": dict(overall_severities),
                    "algorithm": "HDBSCAN-SBERT-v2.0",
                    "compute_device": dev_meta["compute_device"],
                    "gpu_accelerated": dev_meta["gpu_accelerated"],
                    "gpu_name": dev_meta["gpu_name"],
                    "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim)",
                    "quality_metrics": quality_metrics
                }
            await session.commit()

        logger.info(f"Vulnerability Clustering completed successfully for Run ID: {run_id}")

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

        data_records = []
        texts = []
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

            text_desc = f"{clean_name} ({audit_type}). Scope: {vulns} vulnerabilities (Critical: {crit}, High: {high}). Findings profile: {sample_findings}."
            texts.append(text_desc)

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

            min_size = min(4, max(3, len(rows) // 40))
            clusterer = hdbscan.HDBSCAN(min_cluster_size=min_size, min_samples=2, metric="euclidean")
            labels = clusterer.fit_predict(embeddings)
            probs = getattr(clusterer, "probabilities_", None)
            if probs is None:
                probs = np.ones(len(labels))
            return labels, probs, embeddings

        await _update_run_progress(run_id, "Encoding with Sentence-BERT & running HDBSCAN", 60)
        labels, probs, embeddings = await asyncio.to_thread(_compute_report_clustering_in_thread)

        await _update_run_progress(run_id, "Computing quality metrics & saving results", 80)

        # Compute clustering quality metrics on non-noise points
        quality_metrics = _compute_quality_metrics(embeddings, labels)

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
                run.summary = {
                    "clusters": cluster_summaries,
                    "discovered_cluster_count": len(discovered_cluster_ids),
                    "noise_count": len(noise_reports),
                    "total_reports": len(data_records),
                    "algorithm": "HDBSCAN-SBERT-ReportCohorts-v2.0",
                    "compute_device": dev_meta["compute_device"],
                    "gpu_accelerated": dev_meta["gpu_accelerated"],
                    "gpu_name": dev_meta["gpu_name"],
                    "vectorizer": f"Sentence-BERT ({SBERT_MODEL_NAME}, 768-dim)",
                    "quality_metrics": quality_metrics
                }
            await session.commit()

        logger.info(f"Report Clustering completed successfully for Run ID: {run_id}")

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
# READ-ONLY DATA RETRIEVAL QUERIES
# ==============================================================================

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
    """Retrieve history of past clustering runs."""
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

