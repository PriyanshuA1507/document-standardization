import asyncio
import logging
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import StandardScaler
import hdbscan

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

        # Create new queued run record
        new_run = ClusteringRun(
            run_id=uuid.uuid4(),
            clustering_type=ClusteringType.VULNERABILITY.value,
            status=RunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            algorithm_version="HDBSCAN-TFIDF-v1.0",
            parameters={
                "min_cluster_size": 5,
                "min_samples": 3,
                "vectorizer": "TF-IDF + TruncatedSVD(30)",
                "metric": "euclidean"
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

        new_run = ClusteringRun(
            run_id=uuid.uuid4(),
            clustering_type=ClusteringType.REPORT.value,
            status=RunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            algorithm_version="HDBSCAN-RiskProfile-v1.0",
            parameters={
                "min_cluster_size": 4,
                "min_samples": 2,
                "scaler": "StandardScaler",
                "metric": "euclidean"
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

        # Feature Extraction: TF-IDF + TruncatedSVD
        def _compute_clustering_in_thread():
            vec = TfidfVectorizer(max_features=1000, stop_words="english", ngram_range=(1, 2))
            X_tfidf = vec.fit_transform(texts)
            n_components = min(30, max(2, X_tfidf.shape[1] - 1))
            svd = TruncatedSVD(n_components=n_components, random_state=42)
            X_reduced = svd.fit_transform(X_tfidf)

            min_size = min(5, max(2, len(texts) // 100))
            clusterer = hdbscan.HDBSCAN(min_cluster_size=min_size, min_samples=3, metric="euclidean")
            labels = clusterer.fit_predict(X_reduced)
            probs = getattr(clusterer, "probabilities_", None)
            if probs is None:
                probs = np.ones(len(labels))
            return labels, probs

        await _update_run_progress(run_id, "Running HDBSCAN density clustering", 60)
        labels, probs = await asyncio.to_thread(_compute_clustering_in_thread)

        await _update_run_progress(run_id, "Analyzing clusters & persisting results", 80)

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
                run.summary = {
                    "clusters": cluster_summaries,
                    "discovered_cluster_count": len(discovered_cluster_ids),
                    "noise_count": len(noise_findings),
                    "total_findings": len(data_records),
                    "severity_distribution": dict(overall_severities),
                    "algorithm": "HDBSCAN-TFIDF-v1.0"
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
                    rd.data->'report_meta'->>'report_title' AS report_title
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

        await _update_run_progress(run_id, "Constructing risk profile feature vectors", 35)

        data_records = []
        feature_matrix = []
        for r in rows:
            tot = max(1, r["total_vulns"])
            crit_ratio = float(r["crit_count"]) / tot
            high_ratio = float(r["high_count"]) / tot
            med_ratio = float(r["med_count"]) / tot
            low_ratio = float(r["low_count"]) / tot
            open_ratio = float(r["open_count"]) / tot
            repeat_ratio = float(r["repeat_count"]) / tot
            avg_cvss = float(r["avg_cvss"])
            max_cvss = float(r["max_cvss"])
            total_vulns = float(r["total_vulns"])

            feature_vec = [
                total_vulns,
                avg_cvss,
                max_cvss,
                crit_ratio,
                high_ratio,
                med_ratio,
                low_ratio,
                open_ratio,
                repeat_ratio,
            ]
            feature_matrix.append(feature_vec)

            data_records.append({
                "report_id": r["report_id"],
                "original_filename": r["original_filename"],
                "audit_type": r["audit_type"] or "General Audit",
                "report_title": r["report_title"] or r["original_filename"],
                "total_vulns": int(r["total_vulns"]),
                "avg_cvss": round(avg_cvss, 1),
                "crit_count": int(r["crit_count"]),
                "high_count": int(r["high_count"]),
                "open_count": int(r["open_count"]),
                "repeat_count": int(r["repeat_count"]),
                "crit_ratio": round(crit_ratio, 2),
                "open_ratio": round(open_ratio, 2),
            })

        def _compute_report_clustering_in_thread():
            X = np.array(feature_matrix)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            min_size = min(4, max(2, len(rows) // 30))
            clusterer = hdbscan.HDBSCAN(min_cluster_size=min_size, min_samples=2, metric="euclidean")
            labels = clusterer.fit_predict(X_scaled)
            probs = getattr(clusterer, "probabilities_", None)
            if probs is None:
                probs = np.ones(len(labels))
            return labels, probs

        await _update_run_progress(run_id, "Executing HDBSCAN density clustering", 60)
        labels, probs = await asyncio.to_thread(_compute_report_clustering_in_thread)

        await _update_run_progress(run_id, "Analyzing profiles & saving results", 80)

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

            # Profile classification
            if avg_crit_ratio > 0.25 or avg_c_cvss >= 7.0:
                profile_type = "High Risk / Critical Vulnerabilities"
            elif avg_c_vulns > 30:
                profile_type = "Large Scope / Broad Surface"
            elif avg_open_ratio < 0.3:
                profile_type = "Remediated / Low Residual Risk"
            elif avg_c_cvss < 4.0:
                profile_type = "Low Risk / Informational Focus"
            else:
                profile_type = "Moderate Operational Risk"

            cluster_label = f"Cluster #{c_id}: {profile_type} ({len(members)} Reports)"

            rep_reports = sorted(members, key=lambda x: x["strength"], reverse=True)[:4]

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
                    for rr in rep_reports
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
                    "algorithm": "HDBSCAN-RiskProfile-v1.0"
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

