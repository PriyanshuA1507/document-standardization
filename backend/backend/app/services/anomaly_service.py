import asyncio
import logging
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

import numpy as np
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA
from sqlalchemy import select, func, case, and_, desc, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.report import Report, ReportsData, DetailedObservation, ObservationSeverity, ObservationStatus
from app.models.agency import Agency
from app.models.anomaly import (
    AnomalyRun,
    AnomalyReportRecord,
    AnomalyRunStatus,
    AnomalyTier,
)

logger = logging.getLogger(__name__)

# Concurrency lock to prevent duplicate simultaneous executions
_active_jobs_lock = asyncio.Lock()
_active_jobs: set = set()

# Lazy-loaded global SBERT model (loaded once, reused across runs)
_sbert_model: Optional[SentenceTransformer] = None
_sbert_model_lock = asyncio.Lock()

SBERT_MODEL_NAME = "all-mpnet-base-v2"  # 768-dim, locally cached sentence embeddings


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
            if _sbert_model is None:
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


def get_anomaly_config_options() -> Dict[str, Any]:
    """Return all available anomaly detection algorithms, feature toggles, parameter schemas, and presets."""
    return {
        "detectors": [
            {
                "id": "IFOREST",
                "name": "Isolation Forest & EIF",
                "tagline": "Recursive Hyperplane Partitioning Baseline",
                "description": "Industry standard for tabular audit metrics. Isolates anomalies via random partitions. Supports standard axis-aligned cuts or oblique Extended Isolation Forest cuts.",
                "parameters": [
                    {"key": "contamination", "label": "Expected Contamination", "type": "float", "default": 0.10, "min": 0.01, "max": 0.35, "step": 0.01, "help": "Expected proportion of anomalies in the dataset"},
                    {"key": "n_estimators", "label": "Number of Trees", "type": "int", "default": 100, "min": 50, "max": 300, "step": 10, "help": "Number of isolation trees in the ensemble"},
                    {"key": "extended_hyperplanes", "label": "Extended Oblique Hyperplanes", "type": "bool", "default": False, "help": "Use random oblique cuts (EIF) to eliminate coordinate axis bias"}
                ]
            },
            {
                "id": "ECOD",
                "name": "ECOD (Empirical Cumulative Distribution)",
                "tagline": "Parameter-Free Statistical Tail Estimator",
                "description": "Modern non-parametric statistical detector. Calculates empirical left/right tail probabilities with sample skewness correction. Delivers 100% transparent feature-level outlier attributions.",
                "parameters": []
            },
            {
                "id": "EMBEDDING",
                "name": "Semantic Embedding Outliers",
                "tagline": "Transformer Semantic Space Metric Engine",
                "description": "Air-gapped Sentence-BERT embeddings (all-mpnet-base-v2). Flags reports whose narrative profile, scope, and findings portfolio deviate semantically from peer norms.",
                "parameters": [
                    {"key": "k_neighbors", "label": "k-Nearest Neighbors", "type": "int", "default": 5, "min": 2, "max": 15, "step": 1, "help": "Number of nearest semantic neighbors for local distance evaluation"}
                ]
            },
            {
                "id": "ENSEMBLE",
                "name": "Tri-Model Consensus Ensemble",
                "tagline": "Rank-Normalized Score Fusion",
                "description": "Fuses Isolation Forest, ECOD, and Embedding scores via percentile rank normalization. Detects consensus outliers and categorizes discordance.",
                "parameters": [
                    {"key": "weight_iforest", "label": "Isolation Forest Weight", "type": "float", "default": 0.40, "min": 0.0, "max": 1.0, "step": 0.05, "help": "Relative weighting for Isolation Forest score"},
                    {"key": "weight_ecod", "label": "ECOD Weight", "type": "float", "default": 0.35, "min": 0.0, "max": 1.0, "step": 0.05, "help": "Relative weighting for ECOD score"},
                    {"key": "weight_embedding", "label": "Embedding Weight", "type": "float", "default": 0.25, "min": 0.0, "max": 1.0, "step": 0.05, "help": "Relative weighting for Transformer embedding score"}
                ]
            }
        ],
        "feature_catalog": [
            {"key": "total_findings", "label": "Total Findings Count", "category": "Density", "default": True},
            {"key": "avg_cvss", "label": "Mean CVSS Score", "category": "Severity", "default": True},
            {"key": "max_cvss", "label": "Peak CVSS Ceiling", "category": "Severity", "default": True},
            {"key": "cvss_variance", "label": "CVSS Volatility (Variance)", "category": "Severity", "default": True},
            {"key": "p90_cvss", "label": "90th-Percentile CVSS Spike", "category": "Severity", "default": True},
            {"key": "critical_ratio", "label": "Critical Vulnerability Ratio", "category": "Risk", "default": True},
            {"key": "high_critical_ratio", "label": "Critical + High Ratio", "category": "Risk", "default": True},
            {"key": "open_findings", "label": "Open Findings Volume", "category": "Backlog", "default": True},
            {"key": "unresolved_ratio", "label": "Unresolved Backlog Ratio", "category": "Backlog", "default": True},
            {"key": "avg_days_open", "label": "Average Days Open", "category": "SLA", "default": True},
            {"key": "sla_breach_count", "label": "SLA Breach Volume", "category": "SLA", "default": True},
            {"key": "page_count", "label": "Report Document Page Count", "category": "Scope", "default": True},
            {"key": "report_narrative", "label": "Semantic Narrative Text Profile", "category": "NLP", "default": True}
        ],
        "presets": [
            {
                "id": "balanced_tri_model",
                "name": "Comprehensive Tri-Model Ensemble (Recommended)",
                "description": "Industry default: Combines Isolation Forest (40%), ECOD (35%), and Local SBERT Embeddings (25%) with 10% contamination.",
                "algorithm_mode": "ENSEMBLE",
                "parameters": {
                    "contamination": 0.10,
                    "n_estimators": 100,
                    "extended_hyperplanes": False,
                    "k_neighbors": 5,
                    "weight_iforest": 0.40,
                    "weight_ecod": 0.35,
                    "weight_embedding": 0.25
                },
                "selected_features": [
                    "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
                    "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count",
                    "page_count", "report_narrative"
                ]
            },
            {
                "id": "fast_tabular_audit",
                "name": "High-Throughput Tabular Audit",
                "description": "Zero GPU overhead: Pairs Isolation Forest and ECOD with pure tabular telemetry. Ideal for instant CPU batch audits.",
                "algorithm_mode": "ENSEMBLE",
                "parameters": {
                    "contamination": 0.10,
                    "n_estimators": 100,
                    "extended_hyperplanes": False,
                    "k_neighbors": 5,
                    "weight_iforest": 0.55,
                    "weight_ecod": 0.45,
                    "weight_embedding": 0.0
                },
                "selected_features": [
                    "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
                    "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count"
                ]
            },
            {
                "id": "pure_ecod_explainable",
                "name": "Pure ECOD (100% Explainable Attribution)",
                "description": "Deterministic parameter-free empirical cumulative tail detection with exact dimensional attribution percentages.",
                "algorithm_mode": "ECOD",
                "parameters": {
                    "contamination": 0.10
                },
                "selected_features": [
                    "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
                    "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count", "page_count"
                ]
            },
            {
                "id": "semantic_audit_focus",
                "name": "Semantic Audit & Narrative Outliers",
                "description": "Focuses heavily on Sentence-BERT semantic profiles to flag reports with anomalous findings distributions and wording.",
                "algorithm_mode": "ENSEMBLE",
                "parameters": {
                    "contamination": 0.15,
                    "n_estimators": 100,
                    "extended_hyperplanes": False,
                    "k_neighbors": 5,
                    "weight_iforest": 0.20,
                    "weight_ecod": 0.25,
                    "weight_embedding": 0.55
                },
                "selected_features": [
                    "total_findings", "avg_cvss", "critical_ratio", "sla_breach_count", "report_narrative"
                ]
            }
        ]
    }


def _fit_ecod_pure_numpy(X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Pure NumPy implementation of ECOD (Empirical Cumulative Distribution Outlier Detection).
    Evaluates empirical left and right tail probabilities with sample skewness correction.
    
    Returns:
        scores: 1D array of ECOD outlier scores (higher = more anomalous)
        attributions: 2D array (N x d) of exact percentage contribution per feature
    """
    N, d = X.shape
    if N <= 1 or d == 0:
        return np.zeros(N), np.zeros((N, max(d, 1)))

    scores = np.zeros(N)
    feat_contributions = np.zeros((N, d))

    for j in range(d):
        col = X[:, j]
        sorted_col = np.sort(col)

        # Left-tail empirical CDF P(X <= x)
        left_counts = np.searchsorted(sorted_col, col, side="right")
        left_prob = np.maximum(left_counts / float(N), 1.0 / float(N))

        # Right-tail empirical survival P(X >= x)
        right_counts = N - np.searchsorted(sorted_col, col, side="left")
        right_prob = np.maximum(right_counts / float(N), 1.0 / float(N))

        ol = -np.log(left_prob)
        or_ = -np.log(right_prob)

        mean_val = np.mean(col)
        std_val = np.std(col)
        if std_val > 1e-9:
            skew = float(np.mean(((col - mean_val) / std_val) ** 3))
        else:
            skew = 0.0

        if skew > 0.5:
            # Right-skewed: heavy tail on large values
            oj = or_ + 0.1 * ol
        elif skew < -0.5:
            # Left-skewed: heavy tail on small values
            oj = ol + 0.1 * or_
        else:
            # Symmetric
            oj = np.maximum(ol, or_)

        feat_contributions[:, j] = oj
        scores += oj

    # Calculate exact percentage attribution per feature for each record
    denominator = scores[:, None] + 1e-9
    attr_pct = (feat_contributions / denominator) * 100.0

    return scores, attr_pct


def _percentile_rank(scores: np.ndarray) -> np.ndarray:
    """Normalize raw detector scores to empirical percentile ranks in [0.0, 1.0]."""
    if len(scores) <= 1:
        return np.zeros(len(scores))
    ranks = pd.Series(scores).rank(pct=True, method="average").values
    return ranks


async def _extract_report_dataset(db: AsyncSession) -> pd.DataFrame:
    """Query and engineer multi-dimensional telemetry across reports, findings, and agencies."""
    query = (
        select(
            Report.report_id,
            Report.original_filename,
            Report.upload_status,
            Report.page_count,
            Report.file_size,
            Report.created_at.label("report_created_at"),
            Agency.agency_id,
            Agency.agency_name,
            Agency.agency_code,
            Agency.cert_in_empanelled,
            DetailedObservation.finding_id,
            DetailedObservation.title.label("finding_title"),
            DetailedObservation.cvss_score,
            DetailedObservation.severity,
            DetailedObservation.status.label("observation_status"),
            DetailedObservation.created_at.label("finding_created_at"),
            DetailedObservation.cve_id
        )
        .select_from(Report)
        .outerjoin(Agency, Report.agency_id == Agency.agency_id)
        .outerjoin(DetailedObservation, Report.report_id == DetailedObservation.report_id)
    )

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return pd.DataFrame()

    now = datetime.now(timezone.utc)
    records = []
    for r in rows:
        days_open = 0
        if r.finding_created_at:
            days_open = max((now - r.finding_created_at).days, 0)
        records.append({
            "report_id": str(r.report_id),
            "report_title": r.original_filename or "Audit Report",
            "upload_status": r.upload_status.value if r.upload_status else "UPLOADED",
            "page_count": r.page_count or 0,
            "file_size": r.file_size or 0,
            "created_at": r.report_created_at.isoformat() if r.report_created_at else None,
            "agency_id": str(r.agency_id) if r.agency_id else None,
            "agency_name": r.agency_name or "Unassigned Agency",
            "agency_code": r.agency_code or "N/A",
            "cert_in_empanelled": bool(r.cert_in_empanelled) if r.cert_in_empanelled is not None else False,
            "finding_id": str(r.finding_id) if r.finding_id else None,
            "finding_title": r.finding_title or "",
            "cvss": float(r.cvss_score) if r.cvss_score is not None else 0.0,
            "severity": str(r.severity.value) if r.severity else "Unknown",
            "observation_status": str(r.observation_status.value) if r.observation_status else "Unknown",
            "has_cve": bool(r.cve_id and len(r.cve_id) > 0),
            "days_open": days_open
        })

    df_raw = pd.DataFrame(records)

    report_list = []
    group_cols = [
        "report_id", "report_title", "upload_status", "page_count",
        "file_size", "created_at", "agency_id", "agency_name",
        "agency_code", "cert_in_empanelled"
    ]

    for (rid, rtitle, ustatus, pcount, fsize, rdate, aid, aname, acode, emp), grp in df_raw.groupby(group_cols):
        finds = grp[grp["finding_id"].notnull()]
        n_finds = len(finds)

        sample_titles = []
        if n_finds > 0:
            cvss_s = finds["cvss"]
            avg_cvss = float(cvss_s.mean())
            max_cvss = float(cvss_s.max())
            cvss_var = float(cvss_s.var()) if len(cvss_s) > 1 else 0.0
            p90_cvss = float(cvss_s.quantile(0.9))
            crit_count = int((finds["severity"] == "Critical").sum())
            high_count = int((finds["severity"] == "High").sum())
            med_count = int((finds["severity"] == "Medium").sum())
            low_count = int((finds["severity"] == "Low").sum())
            crit_ratio = crit_count / max(n_finds, 1)
            high_crit_ratio = (crit_count + high_count) / max(n_finds, 1)

            open_finds = finds[finds["observation_status"].isin(["Open", "Partially Remediated"])]
            open_count = len(open_finds)
            unres_ratio = open_count / max(n_finds, 1)
            avg_days = float(open_finds["days_open"].mean()) if open_count > 0 else 0.0

            sla_breaches = int((
                ((open_finds["severity"] == "Critical") & (open_finds["days_open"] > 15)) |
                ((open_finds["severity"] == "High") & (open_finds["days_open"] > 30)) |
                (open_finds["days_open"] > 90)
            ).sum())

            # Top 3 finding titles for narrative profile
            sample_titles = finds["finding_title"].dropna().tolist()[:3]
        else:
            avg_cvss = 0.0
            max_cvss = 0.0
            cvss_var = 0.0
            p90_cvss = 0.0
            crit_count = 0
            high_count = 0
            med_count = 0
            low_count = 0
            crit_ratio = 0.0
            high_crit_ratio = 0.0
            open_count = 0
            unres_ratio = 0.0
            avg_days = 0.0
            sla_breaches = 0

        # Synthesize rich semantic narrative profile for Sentence-BERT embedding
        emp_badge = "CERT-In Empanelled" if emp else "Standard Auditing Agency"
        samples_str = "; ".join(sample_titles) if sample_titles else "No specific observations"
        narrative = (
            f"Audit Report: {rtitle}. Assessed by {aname} ({acode}, {emp_badge}). "
            f"Document scope: {pcount} pages. Findings portfolio: {n_finds} total vulnerabilities "
            f"(Critical: {crit_count}, High: {high_count}, Medium: {med_count}, Low: {low_count}). "
            f"Mean CVSS: {avg_cvss:.1f}, Max CVSS: {max_cvss:.1f}. "
            f"Unresolved backlog: {open_count} open findings ({unres_ratio*100:.1f}%), "
            f"with {sla_breaches} SLA breach incidents. "
            f"Sample observations: {samples_str}."
        )

        report_list.append({
            "report_id": rid,
            "report_title": rtitle,
            "upload_status": ustatus,
            "page_count": pcount,
            "file_size": fsize,
            "created_at": rdate,
            "agency_id": aid,
            "agency_name": aname,
            "agency_code": acode,
            "cert_in_empanelled": emp,
            "total_findings": n_finds,
            "critical_count": crit_count,
            "high_count": high_count,
            "medium_count": med_count,
            "low_count": low_count,
            "critical_ratio": round(crit_ratio, 3),
            "high_critical_ratio": round(high_crit_ratio, 3),
            "avg_cvss": round(avg_cvss, 2),
            "max_cvss": round(max_cvss, 1),
            "cvss_variance": round(cvss_var, 3),
            "p90_cvss": round(p90_cvss, 2),
            "open_findings": open_count,
            "unresolved_ratio": round(unres_ratio, 3),
            "avg_days_open": round(avg_days, 1),
            "sla_breach_count": sla_breaches,
            "report_narrative": narrative,
            "sample_titles": sample_titles
        })

    return pd.DataFrame(report_list)


async def execute_anomaly_detection_job(run_id: uuid.UUID, config: Dict[str, Any], requested_by: Optional[uuid.UUID] = None):
    """
    Background worker task executing multi-detector anomaly detection:
    1. Extract report telemetry and feature spaces
    2. Fit Isolation Forest & Extended Isolation Forest
    3. Fit ECOD and compute exact dimensional attributions
    4. Fit SBERT embeddings and compute semantic distance & neighbors
    5. Perform rank-normalized score fusion and consensus categorization
    6. Generate human-readable explainability drivers
    7. Persist records and update run status in PostgreSQL
    """
    logger.info(f"Starting Anomaly Detection Job [Run ID: {run_id}]...")
    async with AsyncSessionLocal() as db:
        try:
            # 1. Update status to RUNNING
            run = await db.get(AnomalyRun, run_id)
            if not run:
                logger.error(f"Anomaly run {run_id} not found in database.")
                return

            run.status = AnomalyRunStatus.RUNNING.value
            run.current_stage = "Extracting Audit Telemetry & Features"
            run.progress_percent = 15
            run.started_at = datetime.now(timezone.utc)
            await db.commit()

            # 2. Extract telemetry dataset
            rdf = await _extract_report_dataset(db)
            N = len(rdf)

            if N < 4:
                run.status = AnomalyRunStatus.COMPLETED.value
                run.current_stage = "Completed (Insufficient Data)"
                run.progress_percent = 100
                run.completed_at = datetime.now(timezone.utc)
                run.total_reports_evaluated = N
                run.anomalies_detected = 0
                run.summary = {
                    "message": "At least 4 audit reports are required for statistical and multi-detector anomaly evaluation.",
                    "insufficient_data": True
                }
                await db.commit()
                return

            # Extract user configuration parameters safely
            cfg = config or {}
            params = cfg.get("parameters") or {}
            algorithm_mode = str(cfg.get("algorithm_mode") or "ENSEMBLE").upper()
            contamination = float(params.get("contamination") or 0.10)
            n_estimators = int(params.get("n_estimators") or 100)
            extended_hyperplanes = bool(params.get("extended_hyperplanes") or False)
            k_neighbors = min(int(params.get("k_neighbors") or 5), max(N - 1, 1))

            w_if = float(params.get("weight_iforest") if params.get("weight_iforest") is not None else 0.40)
            w_ecod = float(params.get("weight_ecod") if params.get("weight_ecod") is not None else 0.35)
            w_embed = float(params.get("weight_embedding") if params.get("weight_embedding") is not None else 0.25)

            # Selected tabular features
            all_tabular_cols = [
                "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
                "p90_cvss", "critical_ratio", "high_critical_ratio", "open_findings",
                "unresolved_ratio", "avg_days_open", "sla_breach_count", "page_count"
            ]
            selected_features = cfg.get("selected_features") or all_tabular_cols
            feature_cols = [col for col in all_tabular_cols if col in selected_features and col in rdf.columns]
            if not feature_cols:
                feature_cols = ["total_findings", "avg_cvss", "max_cvss", "critical_ratio", "open_findings", "sla_breach_count"]

            X_tab = rdf[feature_cols].fillna(0).values.astype(np.float64)

            # Compute Fleet-wide Medians and MADs for Robust Explainability
            fleet_medians = {col: float(rdf[col].median()) for col in feature_cols}
            fleet_mads = {}
            for col in feature_cols:
                col_vals = rdf[col].values
                med = fleet_medians[col]
                mad = float(np.median(np.abs(col_vals - med)))
                fleet_mads[col] = max(mad, 1e-4)

            fleet_benchmarks = {
                "fleet_median_cvss": round(float(rdf["avg_cvss"].median()), 2),
                "fleet_avg_findings": round(float(rdf["total_findings"].mean()), 1),
                "fleet_avg_days_open": round(float(rdf["avg_days_open"].mean()), 1),
                "fleet_sla_breach_rate": round(float(rdf["sla_breach_count"].sum() / max(rdf["total_findings"].sum(), 1) * 100), 1),
                "fleet_critical_ratio": round(float(rdf["critical_ratio"].mean() * 100), 1),
                "total_reports_monitored": N
            }

            # 3. Isolation Forest / Extended Isolation Forest
            run.current_stage = "Fitting Isolation Forest Trees"
            run.progress_percent = 35
            await db.commit()

            X_scaled = StandardScaler().fit_transform(X_tab)

            if extended_hyperplanes and X_scaled.shape[1] > 1:
                # Extended Isolation Forest: Random oblique projections
                np.random.seed(42)
                d = X_scaled.shape[1]
                n_proj = max(d, 8)
                rot_matrix = np.random.randn(d, n_proj)
                rot_matrix /= np.linalg.norm(rot_matrix, axis=0, keepdims=True)
                X_if_input = np.dot(X_scaled, rot_matrix)
            else:
                X_if_input = X_scaled

            iso = IsolationForest(
                contamination=contamination,
                n_estimators=n_estimators,
                random_state=42
            )
            iso.fit(X_if_input)
            raw_if_scores = -iso.score_samples(X_if_input)  # Higher = more anomalous
            norm_if_scores = _percentile_rank(raw_if_scores)

            # 4. ECOD Statistical Detector
            run.current_stage = "Computing ECOD Empirical Tail Distributions"
            run.progress_percent = 55
            await db.commit()

            raw_ecod_scores, ecod_attributions = _fit_ecod_pure_numpy(X_tab)
            norm_ecod_scores = _percentile_rank(raw_ecod_scores)

            # 5. SBERT Semantic Textual Embeddings
            run.current_stage = "Encoding Sentence-BERT Narrative Vectors"
            run.progress_percent = 75
            await db.commit()

            narrative_texts = rdf["report_narrative"].tolist()
            sbert = await _get_sbert_model()

            def _encode_texts():
                return sbert.encode(
                    narrative_texts,
                    batch_size=32,
                    show_progress_bar=False,
                    normalize_embeddings=True
                )

            embeddings = await asyncio.to_thread(_encode_texts)
            # embeddings is N x 768 L2-normalized

            # Pairwise cosine distance: D = 1 - (u . v)
            sim_matrix = np.dot(embeddings, embeddings.T)
            dist_matrix = np.clip(1.0 - sim_matrix, 0.0, 2.0)

            # k-NN distance score (mean distance to k nearest neighbors, excluding self)
            raw_embed_scores = np.zeros(N)
            semantic_neighbors_list = []

            prototype_vector = np.mean(embeddings, axis=0)
            prototype_vector /= np.linalg.norm(prototype_vector) + 1e-9

            for i in range(N):
                dists = dist_matrix[i].copy()
                dists[i] = np.inf  # exclude self
                sorted_indices = np.argsort(dists)
                k_idx = sorted_indices[:k_neighbors]
                raw_embed_scores[i] = float(np.mean(dists[k_idx]))

                # Nearest neighbor metadata
                nn_info = []
                for idx in k_idx[:3]:
                    nn_info.append({
                        "report_id": rdf.iloc[idx]["report_id"],
                        "report_title": rdf.iloc[idx]["report_title"],
                        "agency_name": rdf.iloc[idx]["agency_name"],
                        "semantic_distance": round(float(dists[idx]), 3),
                        "cosine_similarity": round(float(1.0 - dists[idx]), 3)
                    })
                semantic_neighbors_list.append(nn_info)

            norm_embed_scores = _percentile_rank(raw_embed_scores)

            # 6. Rank-Normalized Ensembling & Consensus
            run.current_stage = "Synthesizing Consensus & Explainability"
            run.progress_percent = 90
            await db.commit()

            if algorithm_mode == "IFOREST":
                composite_scores = norm_if_scores
            elif algorithm_mode == "ECOD":
                composite_scores = norm_ecod_scores
            elif algorithm_mode == "EMBEDDING":
                composite_scores = norm_embed_scores
            else:
                total_w = w_if + w_ecod + w_embed
                if total_w < 1e-4:
                    total_w = 1.0
                    w_if, w_ecod, w_embed = 0.4, 0.35, 0.25
                composite_scores = (
                    w_if * norm_if_scores +
                    w_ecod * norm_ecod_scores +
                    w_embed * norm_embed_scores
                ) / total_w

            # Threshold for anomaly flag based on contamination rate
            anomaly_threshold = float(np.percentile(composite_scores, (1.0 - contamination) * 100))

            # 2D PCA Projection for Interactive Scatter Plot (hybrid space)
            pca_input = np.hstack([X_scaled, embeddings])
            pca = PCA(n_components=2, random_state=42)
            coords_2d = pca.fit_transform(pca_input)
            pca_var_ratio = [round(float(v) * 100, 1) for v in pca.explained_variance_ratio_]

            # 7. Construct Records & Primary Drivers
            records_to_insert = []
            anomalies_count = 0
            tier_distribution = {
                AnomalyTier.CRITICAL_OUTLIER.value: 0,
                AnomalyTier.ELEVATED_OUTLIER.value: 0,
                AnomalyTier.SEMANTIC_ANOMALY.value: 0,
                AnomalyTier.METRIC_ANOMALY.value: 0,
                AnomalyTier.NOMINAL_COMPLIANT.value: 0,
            }

            for i in range(N):
                row = rdf.iloc[i]
                comp_score = float(composite_scores[i])
                s_if = float(norm_if_scores[i])
                s_ecod = float(norm_ecod_scores[i])
                s_embed = float(norm_embed_scores[i])

                is_anom = bool(comp_score >= anomaly_threshold)
                if is_anom:
                    anomalies_count += 1

                # Anomaly Tiering Logic
                if comp_score >= 0.90 and ((s_if > 0.85 and s_ecod > 0.85) or (s_if > 0.85 and s_embed > 0.85)):
                    tier = AnomalyTier.CRITICAL_OUTLIER.value
                elif s_embed >= 0.88 and s_if < 0.65 and s_ecod < 0.65:
                    tier = AnomalyTier.SEMANTIC_ANOMALY.value
                elif (s_if >= 0.88 or s_ecod >= 0.88) and s_embed < 0.65:
                    tier = AnomalyTier.METRIC_ANOMALY.value
                elif is_anom or comp_score >= 0.75:
                    tier = AnomalyTier.ELEVATED_OUTLIER.value
                else:
                    tier = AnomalyTier.NOMINAL_COMPLIANT.value

                tier_distribution[tier] = tier_distribution.get(tier, 0) + 1

                # Drivers formulation: Combine ECOD percentage attribution + Robust Z-Scores
                drivers = []
                feature_deviations = {}
                ecod_attrs_dict = {}

                for j, col in enumerate(feature_cols):
                    val = float(row[col])
                    med = fleet_medians[col]
                    mad = fleet_mads[col]
                    z_rob = (val - med) / (1.4826 * mad)
                    feature_deviations[col] = round(float(z_rob), 2)

                    attr_pct = float(ecod_attributions[i, j])
                    ecod_attrs_dict[col] = round(attr_pct, 1)

                    if attr_pct >= 25.0 or abs(z_rob) >= 2.0:
                        direction = "elevated above" if z_rob > 0 else "suppressed below"
                        if col == "sla_breach_count" and val > 0:
                            drivers.append(f"Severe SLA Breach Volume: {int(val)} overdue findings ({attr_pct:.1f}% ECOD driver, {abs(z_rob):.1f} MAD {direction} fleet median)")
                        elif col == "critical_ratio" and val > 0:
                            drivers.append(f"Disproportionate Critical Findings: {val*100:.1f}% vs fleet median {med*100:.1f}% ({attr_pct:.1f}% ECOD driver)")
                        elif col == "total_findings":
                            drivers.append(f"Extreme Finding Density: {int(val)} findings in report ({attr_pct:.1f}% ECOD driver)")
                        elif col == "avg_cvss":
                            drivers.append(f"Elevated Mean Severity: CVSS {val:.1f} vs fleet median {med:.1f} ({attr_pct:.1f}% ECOD driver)")
                        elif col == "open_findings":
                            drivers.append(f"Unresolved Backlog Density: {int(val)} open findings ({attr_pct:.1f}% ECOD driver)")
                        elif col == "p90_cvss":
                            drivers.append(f"Severe 90th-Percentile Severity Spike: CVSS {val:.1f}")
                        elif col == "cvss_variance":
                            drivers.append(f"Erratic Severity Volatility: Variance {val:.2f}")
                        else:
                            drivers.append(f"Significant {col.replace('_', ' ').title()}: {val:.1f} ({attr_pct:.1f}% ECOD driver)")

                if tier == AnomalyTier.SEMANTIC_ANOMALY.value:
                    drivers.insert(0, f"Narrative Profile Discrepancy: Semantic distance to peer reports is in the top {round((1.0 - s_embed)*100, 1)}% of fleet")
                elif not drivers and is_anom:
                    drivers.append("Multivariate anomaly deviation across composite risk metrics")

                record_obj = AnomalyReportRecord(
                    record_id=uuid.uuid4(),
                    run_id=run_id,
                    report_id=uuid.UUID(row["report_id"]),
                    is_anomaly=is_anom,
                    anomaly_tier=tier,
                    ensemble_score=round(comp_score, 4),
                    iforest_score=round(s_if, 4),
                    ecod_score=round(s_ecod, 4),
                    embedding_score=round(s_embed, 4),
                    primary_drivers=drivers[:4],
                    ecod_attributions=ecod_attrs_dict,
                    feature_deviations=feature_deviations,
                    semantic_profile={
                        "narrative_preview": row["report_narrative"][:220] + "...",
                        "semantic_outlier_score": round(s_embed, 4),
                        "nearest_neighbors": semantic_neighbors_list[i]
                    },
                    record_metadata={
                        "report_title": str(row["report_title"]),
                        "agency_id": str(row["agency_id"]) if row["agency_id"] else None,
                        "agency_name": str(row["agency_name"]),
                        "agency_code": str(row["agency_code"]),
                        "cert_in_empanelled": bool(row["cert_in_empanelled"]) if pd.notnull(row["cert_in_empanelled"]) else False,
                        "page_count": int(row["page_count"]),
                        "total_findings": int(row["total_findings"]),
                        "critical_count": int(row["critical_count"]),
                        "high_count": int(row["high_count"]),
                        "medium_count": int(row["medium_count"]),
                        "low_count": int(row["low_count"]),
                        "open_findings": int(row["open_findings"]),
                        "avg_cvss": float(row["avg_cvss"]),
                        "max_cvss": float(row["max_cvss"]),
                        "sla_breach_count": int(row["sla_breach_count"]),
                        "created_at": str(row["created_at"]) if row["created_at"] else None,
                        "pca_coords": [round(float(coords_2d[i, 0]), 3), round(float(coords_2d[i, 1]), 3)]
                    }
                )
                records_to_insert.append(record_obj)

            # Insert in chunks of 500
            for k in range(0, len(records_to_insert), 500):
                chunk = records_to_insert[k:k+500]
                db.add_all(chunk)
                await db.flush()

            # 8. Complete run metadata
            run.status = AnomalyRunStatus.COMPLETED.value
            run.current_stage = "Completed"
            run.progress_percent = 100
            run.completed_at = datetime.now(timezone.utc)
            run.total_reports_evaluated = N
            run.anomalies_detected = anomalies_count
            run.fleet_benchmarks = fleet_benchmarks
            run.summary = {
                "algorithm_mode": algorithm_mode,
                "total_reports": N,
                "anomalies_detected": anomalies_count,
                "anomaly_rate_percent": round((anomalies_count / max(N, 1)) * 100, 1),
                "contamination_applied": contamination,
                "tier_distribution": tier_distribution,
                "pca_explained_variance_ratio": pca_var_ratio,
                "detector_correlations": {
                    "iforest_ecod": round(float(np.corrcoef(norm_if_scores, norm_ecod_scores)[0, 1]), 3),
                    "iforest_embed": round(float(np.corrcoef(norm_if_scores, norm_embed_scores)[0, 1]), 3),
                    "ecod_embed": round(float(np.corrcoef(norm_ecod_scores, norm_embed_scores)[0, 1]), 3)
                },
                "hardware": _get_device_metadata()
            }
            await db.commit()
            logger.info(f"Anomaly Detection Job [Run ID: {run_id}] completed successfully: {anomalies_count}/{N} anomalies detected.")

            # Automatically prune older runs for this algorithm to ensure strictly 1 run per algorithm is kept
            try:
                async with AsyncSessionLocal() as prune_session:
                    await prune_older_runs_for_anomaly_algorithm(
                        prune_session, algorithm_mode, keep_run_id=run_id
                    )
            except Exception as prune_err:
                logger.warning(f"Failed to prune older anomaly runs for algorithm {algorithm_mode}: {prune_err}")

        except Exception as err:
            logger.exception(f"Fatal error in Anomaly Detection Job [Run ID: {run_id}]: {err}")
            await db.rollback()
            try:
                run = await db.get(AnomalyRun, run_id)
                if run:
                    run.status = AnomalyRunStatus.FAILED.value
                    run.current_stage = f"Failed: {str(err)[:80]}"
                    run.error_message = str(err)
                    run.completed_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception as inner_err:
                logger.error(f"Failed to record run failure status: {inner_err}")
        finally:
            async with _active_jobs_lock:
                _active_jobs.discard(run_id)


async def get_anomaly_run_detail(
    run_id: uuid.UUID,
    db: AsyncSession,
    tier_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50
) -> Dict[str, Any]:
    """Retrieve full anomaly run details, KPI benchmarks, and paginated records."""
    stmt = select(AnomalyRun).where(AnomalyRun.run_id == run_id).execution_options(populate_existing=True)
    res = await db.execute(stmt)
    run = res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Anomaly detection run not found.")

    query = select(AnomalyReportRecord).where(AnomalyReportRecord.run_id == run_id)

    if tier_filter and tier_filter.upper() != "ALL":
        query = query.where(AnomalyReportRecord.anomaly_tier == tier_filter.upper())

    # Order primarily by ensemble score descending (most anomalous first)
    query = query.order_by(AnomalyReportRecord.ensemble_score.desc())

    result = await db.execute(query)
    all_records = result.scalars().all()

    # Search filter in Python on metadata
    if search:
        s = search.lower().strip()
        filtered = []
        for rec in all_records:
            meta = rec.record_metadata or {}
            title = str(meta.get("report_title", "")).lower()
            agency = str(meta.get("agency_name", "")).lower()
            code = str(meta.get("agency_code", "")).lower()
            if s in title or s in agency or s in code:
                filtered.append(rec)
        all_records = filtered

    total_count = len(all_records)
    offset = (page - 1) * page_size
    paged_records = all_records[offset:offset + page_size]

    records_out = []
    scatter_points = []

    for rec in all_records:
        meta = rec.record_metadata or {}
        pca_coords = meta.get("pca_coords", [0, 0])
        scatter_points.append({
            "record_id": str(rec.record_id),
            "report_id": str(rec.report_id),
            "report_title": meta.get("report_title", "Audit Report"),
            "agency_name": meta.get("agency_name", "Unassigned"),
            "anomaly_tier": rec.anomaly_tier,
            "is_anomaly": rec.is_anomaly,
            "ensemble_score": float(rec.ensemble_score),
            "total_findings": meta.get("total_findings", 0),
            "avg_cvss": meta.get("avg_cvss", 0.0),
            "sla_breach_count": meta.get("sla_breach_count", 0),
            "pca_x": pca_coords[0],
            "pca_y": pca_coords[1]
        })

    for rec in paged_records:
        meta = rec.record_metadata or {}
        records_out.append({
            "record_id": str(rec.record_id),
            "report_id": str(rec.report_id),
            "is_anomaly": rec.is_anomaly,
            "anomaly_tier": rec.anomaly_tier,
            "ensemble_score": float(rec.ensemble_score),
            "iforest_score": float(rec.iforest_score) if rec.iforest_score is not None else None,
            "ecod_score": float(rec.ecod_score) if rec.ecod_score is not None else None,
            "embedding_score": float(rec.embedding_score) if rec.embedding_score is not None else None,
            "primary_drivers": rec.primary_drivers or [],
            "ecod_attributions": rec.ecod_attributions or {},
            "feature_deviations": rec.feature_deviations or {},
            "semantic_profile": rec.semantic_profile or {},
            "metadata": meta,
            "created_at": rec.created_at.isoformat() if rec.created_at else None
        })

    return {
        "status": "success",
        "run": {
            "run_id": str(run.run_id),
            "status": run.status,
            "current_stage": run.current_stage,
            "progress_percent": run.progress_percent,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "total_reports_evaluated": run.total_reports_evaluated,
            "anomalies_detected": run.anomalies_detected,
            "parameters": run.parameters or {},
            "summary": run.summary or {},
            "fleet_benchmarks": run.fleet_benchmarks or {},
            "error_message": run.error_message
        },
        "pagination": {
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, int(np.ceil(total_count / float(page_size))))
        },
        "scatter_points": scatter_points,
        "records": records_out
    }


async def compare_anomaly_runs(run_id_a: uuid.UUID, run_id_b: uuid.UUID, db: AsyncSession) -> Dict[str, Any]:
    """Compare two anomaly detection runs side-by-side to benchmark detectors and parameters."""
    run_a = await db.get(AnomalyRun, run_id_a)
    run_b = await db.get(AnomalyRun, run_id_b)

    if not run_a or not run_b:
        raise HTTPException(status_code=404, detail="One or both anomaly runs not found.")

    res_a = await db.execute(select(AnomalyReportRecord).where(AnomalyReportRecord.run_id == run_id_a))
    res_b = await db.execute(select(AnomalyReportRecord).where(AnomalyReportRecord.run_id == run_id_b))

    records_a = {str(r.report_id): r for r in res_a.scalars().all()}
    records_b = {str(r.report_id): r for r in res_b.scalars().all()}

    common_ids = set(records_a.keys()).intersection(set(records_b.keys()))

    both_anomalies = 0
    only_a_anomalies = 0
    only_b_anomalies = 0
    neither_anomalies = 0
    score_differences = []

    for rid in common_ids:
        ra = records_a[rid]
        rb = records_b[rid]
        is_a = ra.is_anomaly
        is_b = rb.is_anomaly

        if is_a and is_b:
            both_anomalies += 1
        elif is_a and not is_b:
            only_a_anomalies += 1
        elif not is_a and is_b:
            only_b_anomalies += 1
        else:
            neither_anomalies += 1

        score_diff = abs(float(ra.ensemble_score) - float(rb.ensemble_score))
        meta = ra.record_metadata or {}
        score_differences.append({
            "report_id": rid,
            "report_title": meta.get("report_title", "Audit Report"),
            "score_a": float(ra.ensemble_score),
            "score_b": float(rb.ensemble_score),
            "tier_a": ra.anomaly_tier,
            "tier_b": rb.anomaly_tier,
            "abs_difference": round(score_diff, 4)
        })

    score_differences.sort(key=lambda x: x["abs_difference"], reverse=True)

    agreement_rate = (both_anomalies + neither_anomalies) / max(len(common_ids), 1) * 100.0

    return {
        "status": "success",
        "run_a": {
            "run_id": str(run_a.run_id),
            "parameters": run_a.parameters or {},
            "anomalies_detected": run_a.anomalies_detected,
            "total_evaluated": run_a.total_reports_evaluated,
            "summary": run_a.summary or {}
        },
        "run_b": {
            "run_id": str(run_b.run_id),
            "parameters": run_b.parameters or {},
            "anomalies_detected": run_b.anomalies_detected,
            "total_evaluated": run_b.total_reports_evaluated,
            "summary": run_b.summary or {}
        },
        "comparison_metrics": {
            "common_reports_count": len(common_ids),
            "agreement_rate_percent": round(agreement_rate, 1),
            "both_anomalous_count": both_anomalies,
            "only_run_a_anomalous": only_a_anomalies,
            "only_run_b_anomalous": only_b_anomalies,
            "neither_anomalous": neither_anomalies
        },
        "top_discordant_reports": score_differences[:15]
    }


async def trigger_anomaly_detection(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    config: Optional[Dict[str, Any]] = None
) -> AnomalyRun:
    """
    Explicitly trigger an anomaly detection run on-demand with user-configured parameters.
    Enforces strict concurrency control.
    """
    async with _active_jobs_lock:
        if len(_active_jobs) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An Anomaly Detection run is already actively running in memory."
            )

        # Check DB for currently running jobs
        res = await db.execute(
            select(AnomalyRun).where(AnomalyRun.status.in_([AnomalyRunStatus.RUNNING.value, AnomalyRunStatus.QUEUED.value]))
        )
        active_db_run = res.scalar_one_or_none()
        if active_db_run:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An Anomaly Detection run is already in progress (Run ID: {active_db_run.run_id})."
            )

        cfg = config or {}
        algo_mode = str(cfg.get("algorithm_mode") or "ENSEMBLE").upper()
        selected_features = cfg.get("selected_features") or [
            "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
            "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count",
            "page_count", "report_narrative"
        ]
        user_params = cfg.get("parameters") or {
            "contamination": 0.10,
            "n_estimators": 100,
            "extended_hyperplanes": False,
            "k_neighbors": 5,
            "weight_iforest": 0.40,
            "weight_ecod": 0.35,
            "weight_embedding": 0.25
        }

        dev_meta = _get_device_metadata()
        stored_params = {
            "algorithm_mode": algo_mode,
            "selected_features": selected_features,
            "parameters": user_params,
            "compute_device": dev_meta["compute_device"],
            "gpu_accelerated": dev_meta["gpu_accelerated"],
            "gpu_name": dev_meta["gpu_name"]
        }

        new_run = AnomalyRun(
            run_id=uuid.uuid4(),
            status=AnomalyRunStatus.QUEUED.value,
            current_stage="Queued",
            progress_percent=0,
            requested_by=user_id,
            parameters=stored_params
        )
        db.add(new_run)
        await db.commit()
        await db.refresh(new_run)

        _active_jobs.add(new_run.run_id)

    # Spawn async background worker
    asyncio.create_task(execute_anomaly_detection_job(new_run.run_id, cfg, requested_by=user_id))
    return new_run


async def get_run_status(db: AsyncSession, run_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """Poll run execution status and current stage."""
    stmt = select(AnomalyRun).where(AnomalyRun.run_id == run_id).execution_options(populate_existing=True)
    res = await db.execute(stmt)
    run = res.scalar_one_or_none()
    if not run:
        return None
    return {
        "run_id": str(run.run_id),
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_percent": run.progress_percent,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "error_message": run.error_message
    }


def _normalize_anomaly_algorithm(mode: Optional[str]) -> str:
    """Normalize algorithm mode string to canonical enum value: ENSEMBLE, IFOREST, ECOD, EMBEDDING."""
    mode_str = str(mode or "ENSEMBLE").strip().upper()
    if "IFOREST" in mode_str or "ISOLATION" in mode_str:
        return "IFOREST"
    if "ECOD" in mode_str:
        return "ECOD"
    if "EMBED" in mode_str or "SBERT" in mode_str:
        return "EMBEDDING"
    return "ENSEMBLE"


def _extract_algorithm_from_anomaly_run(run: AnomalyRun) -> str:
    """Extract standard algorithm mode (ENSEMBLE, IFOREST, ECOD, EMBEDDING) from run parameters or summary."""
    params = run.parameters or {}
    summary = run.summary or {}
    mode = params.get("algorithm_mode") or summary.get("algorithm_mode")
    return _normalize_anomaly_algorithm(mode)


async def prune_older_runs_for_anomaly_algorithm(
    session: AsyncSession,
    algorithm_mode: str,
    keep_run_id: uuid.UUID
) -> int:
    """
    Ensure history keeps strictly 1 run per algorithm (maximum 4 history runs total).
    When a new run completes for an algorithm mode, all older runs for that same
    algorithm are deleted completely along with cascaded report records to prevent DB bloat.
    """
    target_algo = _normalize_anomaly_algorithm(algorithm_mode)

    query = (
        select(AnomalyRun)
        .where(
            AnomalyRun.run_id != keep_run_id
        )
    )
    res = await session.execute(query)
    other_runs = res.scalars().all()

    deleted_count = 0
    for r in other_runs:
        run_algo = _extract_algorithm_from_anomaly_run(r)
        if run_algo == target_algo:
            logger.info(f"Pruning older anomaly run {r.run_id} ({run_algo}) to keep only latest run for {target_algo}")
            await session.delete(r)
            deleted_count += 1

    if deleted_count > 0:
        await session.commit()
        logger.info(f"Pruned {deleted_count} older {target_algo} anomaly runs from database history.")

    return deleted_count


async def enforce_max_anomaly_algorithm_history(session: AsyncSession) -> int:
    """
    Scans the database and prunes any duplicate historical runs per algorithm mode,
    guaranteeing strictly the single latest run per algorithm is retained (at most 4 runs total).
    """
    query = select(AnomalyRun)
    res = await session.execute(query)
    all_runs = res.scalars().all()

    grouped: Dict[str, List[AnomalyRun]] = {}
    for r in all_runs:
        algo = _extract_algorithm_from_anomaly_run(r)
        grouped.setdefault(algo, []).append(r)

    deleted_total = 0
    for algo, runs in grouped.items():
        if len(runs) > 1:
            runs_sorted = sorted(
                runs,
                key=lambda x: x.completed_at or x.created_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True
            )
            for old_run in runs_sorted[1:]:
                logger.info(f"Enforce history: Deleting older redundant anomaly run {old_run.run_id} for algorithm {algo}")
                await session.delete(old_run)
                deleted_total += 1

    if deleted_total > 0:
        await session.commit()
        logger.info(f"Enforce anomaly history cleanup complete: Deleted {deleted_total} redundant historical runs.")

    return deleted_total


async def get_latest_completed_run(db: AsyncSession, algorithm_mode: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Fetch the latest completed anomaly detection run (optionally filtered by algorithm_mode).
    Enforces that only the single latest run per algorithm is retained.
    """
    try:
        await enforce_max_anomaly_algorithm_history(db)
    except Exception as cleanup_err:
        logger.warning(f"Error enforcing anomaly algorithm history retention: {cleanup_err}")

    stmt = (
        select(AnomalyRun)
        .order_by(desc(AnomalyRun.completed_at), desc(AnomalyRun.created_at))
    )
    result = await db.execute(stmt)
    runs = result.scalars().all()
    if not runs:
        return None

    if algorithm_mode:
        target_algo = _normalize_anomaly_algorithm(algorithm_mode)
        for r in runs:
            if _extract_algorithm_from_anomaly_run(r) == target_algo:
                return await get_anomaly_run_detail(r.run_id, db)

    # Return the latest run overall
    return await get_anomaly_run_detail(runs[0].run_id, db)


async def list_anomaly_runs(db: AsyncSession, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    """Retrieve historical anomaly runs list with pagination (strictly 1 latest run per algorithm)."""
    try:
        await enforce_max_anomaly_algorithm_history(db)
    except Exception as cleanup_err:
        logger.warning(f"Error enforcing anomaly algorithm history retention: {cleanup_err}")

    count_stmt = select(func.count(AnomalyRun.run_id))
    total_count = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(AnomalyRun)
        .order_by(desc(AnomalyRun.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    runs = result.scalars().all()

    runs_out = []
    for r in runs:
        runs_out.append({
            "run_id": str(r.run_id),
            "status": r.status,
            "current_stage": r.current_stage,
            "progress_percent": r.progress_percent,
            "algorithm_mode": _extract_algorithm_from_anomaly_run(r),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "total_reports_evaluated": r.total_reports_evaluated,
            "anomalies_detected": r.anomalies_detected,
            "parameters": r.parameters or {},
            "summary": r.summary or {}
        })

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "runs": runs_out
    }

