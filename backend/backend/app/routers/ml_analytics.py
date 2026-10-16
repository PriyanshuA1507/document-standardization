import uuid
import math
import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Text, cast, String
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.report import Report, DetailedObservation, ObservationStatus
from app.models.agency import Agency

# Deep Learning / Advanced ML Libraries
from transformers import pipeline
from sklearn.ensemble import IsolationForest
import torch

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])

def _val(v, default):
    if v is None:
        return default
    if hasattr(v, "default"):
        return v.default if v.default is not ... else default
    return v

# Lazy loading the HF Pipeline to save memory during tests if unused
_nlp_pipeline = None

def get_nlp_pipeline():
    global _nlp_pipeline
    if _nlp_pipeline is None:
        try:
            # We use facebook/bart-large-mnli as requested
            print("Loading Transformer Model into memory...")
            pipe = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
            
            # OPTIMIZATION 1: PyTorch Dynamic INT8 Quantization
            # Converts the heavy 32-bit Linear layers into 8-bit integers.
            # This cuts memory footprint by ~50% and vastly accelerates CPU inference.
            print("Applying dynamic INT8 quantization to model...")
            quantized_model = torch.quantization.quantize_dynamic(
                pipe.model, {torch.nn.Linear}, dtype=torch.qint8
            )
            pipe.model = quantized_model
            _nlp_pipeline = pipe
            print("Model quantized and ready.")
            
        except Exception as e:
            raise RuntimeError(f"Failed to load/quantize NLP model: {e}")
    return _nlp_pipeline


@router.get("/severity-assessment")
async def severity_assessment(
    report_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Task 2: Severity and Risk Assessment
    Upgraded to Batched Zero-Shot NLP with INT8 Quantization.
    """
    query = select(DetailedObservation)
    if report_id:
        query = query.where(DetailedObservation.report_id == report_id)
    else:
        # For massive scale, limit independent un-filtered assessments to top 500
        # to prevent OOM API crashes when viewing global data.
        query = query.limit(500)
    
    result = await db.execute(query)
    vulns = result.scalars().all()
    
    if not vulns:
        return {"status": "success", "total_assessed": 0, "data": []}
        
    try:
        pipe = get_nlp_pipeline()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    candidate_labels = ["Critical Risk", "High Risk", "Medium Risk", "Low Risk"]
    
    # OPTIMIZATION 2: Dynamic Batching
    # Instead of predicting sequentially in a loop, we feed all texts to the pipeline
    # simultaneously utilizing internal batching and vectorized tensor math.
    texts = [f"{v.title}. {v.observation_description or ''} {v.impact or ''}" for v in vulns]
    
    # Run in a background thread to prevent blocking FastAPI's async event loop
    results = await asyncio.to_thread(pipe, texts, candidate_labels, batch_size=16)
    
    # If only 1 item was passed, HF pipeline returns a dict, not a list of dicts.
    if isinstance(results, dict):
        results = [results]
        
    assessed_vulns = []
    
    for v, res in zip(vulns, results):
        top_label = res['labels'][0]
        
        suggested_severity = "INFORMATIONAL"
        if top_label == "Critical Risk": suggested_severity = "Critical"
        elif top_label == "High Risk": suggested_severity = "HIGH"
        elif top_label == "Medium Risk": suggested_severity = "MEDIUM"
        elif top_label == "Low Risk": suggested_severity = "LOW"
        
        # NLP Confidence Score
        confidence = round(res['scores'][0] * 100, 1)
        
        assessed_vulns.append({
            "finding_id": str(v.finding_id),
            "title": v.title,
            "current_severity": v.severity.value if v.severity else None,
            "suggested_severity": suggested_severity,
            "nlp_confidence": confidence,
            "cvss_score": float(v.cvss_score) if v.cvss_score else None,
            "match": (v.severity.value if v.severity else "") == suggested_severity
        })
        
    return {"status": "success", "total_assessed": len(assessed_vulns), "data": assessed_vulns}


@router.get("/anomalies")
async def audit_score_anomalies(
    contamination: float = Query(0.10, ge=0.01, le=0.35, description="Expected proportion of outliers in the data"),
    n_estimators: int = Query(100, ge=50, le=300, description="Number of trees in Isolation Forest"),
    filter_status: str = Query("ALL", description="Filter results: ALL, OUTLIER, or NORMAL"),
    agency_id: Optional[uuid.UUID] = Query(None, description="Filter reports by agency"),
    search: Optional[str] = Query(None, description="Search report by title, filename, or agency"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Task 4: Production-Grade Audit Report Anomaly Detection (Isolation Forest)
    Multi-feature unsupervised anomaly detection across Audit Reports (VAPT reports).
    Evaluates finding counts, critical severity ratios, CVSS distributions, max severity spikes,
    unresolved backlogs, and SLA breach volumes at the report level.
    """
    contamination = float(_val(contamination, 0.10))
    n_estimators = int(_val(n_estimators, 100))
    filter_status = str(_val(filter_status, "ALL"))
    agency_id = _val(agency_id, None)
    search = _val(search, None)

    query = (
        select(
            Report.report_id,
            Report.original_filename,
            Report.upload_status,
            Report.page_count,
            Report.created_at.label("report_created_at"),
            Agency.agency_id,
            Agency.agency_name,
            Agency.agency_code,
            Agency.cert_in_empanelled,
            DetailedObservation.finding_id,
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

    if agency_id:
        query = query.where(Report.agency_id == agency_id)

    result = await db.execute(query)
    rows = result.all()

    if len(rows) < 4:
        return {"status": "insufficient_data", "message": "Need at least 4 audit reports for robust Isolation Forest detection."}

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
            "created_at": r.report_created_at.isoformat() if r.report_created_at else None,
            "agency_id": str(r.agency_id) if r.agency_id else None,
            "agency_name": r.agency_name or "Unassigned Agency",
            "agency_code": r.agency_code or "N/A",
            "cert_in_empanelled": bool(r.cert_in_empanelled) if r.cert_in_empanelled is not None else False,
            "finding_id": str(r.finding_id) if r.finding_id else None,
            "cvss": float(r.cvss_score) if r.cvss_score is not None else 0.0,
            "severity": str(r.severity.value) if r.severity else "Unknown",
            "observation_status": str(r.observation_status.value) if r.observation_status else "Unknown",
            "has_cve": bool(r.cve_id and len(r.cve_id) > 0),
            "days_open": days_open
        })

    df_raw = pd.DataFrame(records)

    # Report-level Multi-Dimensional Feature Engineering
    report_list = []
    for rid, grp in df_raw.groupby("report_id", dropna=False):
        first = grp.iloc[0]
        rtitle = first["report_title"]
        ustatus = first["upload_status"]
        pcount = first["page_count"]
        rdate = first["created_at"]
        aid = first["agency_id"]
        aname = first["agency_name"]
        acode = first["agency_code"]
        emp = first["cert_in_empanelled"]
        finds = grp[grp["finding_id"].notnull()]
        n_finds = len(finds)

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
            crit_ratio = (crit_count + high_count) / n_finds

            open_finds = finds[finds["observation_status"].isin(["Open", "Partially Remediated"])]
            open_count = len(open_finds)
            unres_ratio = open_count / n_finds
            avg_days = float(open_finds["days_open"].mean()) if open_count > 0 else 0.0

            sla_breaches = int((
                ((open_finds["severity"] == "Critical") & (open_finds["days_open"] > 15)) |
                ((open_finds["severity"] == "High") & (open_finds["days_open"] > 30)) |
                (open_finds["days_open"] > 90)
            ).sum())
            cve_count = int(finds["has_cve"].sum())
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
            open_count = 0
            unres_ratio = 0.0
            avg_days = 0.0
            sla_breaches = 0
            cve_count = 0

        report_list.append({
            "report_id": rid,
            "report_title": rtitle,
            "upload_status": ustatus,
            "page_count": pcount,
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
            "critical_high_count": crit_count + high_count,
            "critical_ratio": round(crit_ratio, 3),
            "avg_cvss": round(avg_cvss, 2),
            "max_cvss": round(max_cvss, 1),
            "cvss_variance": round(cvss_var, 3),
            "p90_cvss": round(p90_cvss, 2),
            "open_findings": open_count,
            "unresolved_ratio": round(unres_ratio, 3),
            "avg_days_open": round(avg_days, 1),
            "sla_breach_count": sla_breaches,
            "cve_count": cve_count
        })

    rdf = pd.DataFrame(report_list)

    if len(rdf) < 4:
        return {"status": "insufficient_data", "message": "Need at least 4 audit reports for Isolation Forest anomaly evaluation."}

    # Features selected for Report-level Isolation Forest space
    feature_cols = [
        "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
        "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count"
    ]
    X = rdf[feature_cols].fillna(0).values

    # Fit Isolation Forest
    iso = IsolationForest(
        contamination=float(contamination),
        n_estimators=int(n_estimators),
        random_state=42
    )
    preds = iso.fit_predict(X)
    scores = iso.decision_function(X)

    rdf["is_anomaly"] = (preds == -1)
    rdf["anomaly_score"] = scores

    # Calculate Fleet-wide Benchmark Medians & Means for Context
    fleet_medians = {col: float(rdf[col].median()) for col in feature_cols}
    fleet_stds = {col: float(rdf[col].std()) if float(rdf[col].std()) > 1e-4 else 1.0 for col in feature_cols}

    fleet_benchmarks = {
        "fleet_median_cvss": round(float(rdf["avg_cvss"].median()), 2),
        "fleet_avg_findings": round(float(rdf["total_findings"].mean()), 1),
        "fleet_avg_days_open": round(float(rdf["avg_days_open"].mean()), 1),
        "fleet_sla_breach_rate": round(float(rdf["sla_breach_count"].sum() / max(rdf["total_findings"].sum(), 1) * 100), 1),
        "fleet_critical_ratio": round(float(rdf["critical_ratio"].mean() * 100), 1),
        "total_reports_monitored": len(rdf),
        "anomalies_detected": int((rdf["is_anomaly"]).sum())
    }

    # Build primary drivers / root-cause attribution for each report
    anomalies_out = []
    for _, row in rdf.iterrows():
        drivers = []
        deviations = {}

        for col in feature_cols:
            val = float(row[col])
            med = fleet_medians[col]
            std = fleet_stds[col]
            z = (val - med) / std
            deviations[col] = round(z, 2)

            if z > 1.8:
                if col == "critical_ratio":
                    drivers.append(f"Disproportionate Critical Findings ({round(val*100, 1)}% vs fleet {round(med*100, 1)}%)")
                elif col == "sla_breach_count":
                    drivers.append(f"Severe SLA Breach Volume ({int(val)} overdue vulnerabilities)")
                elif col == "avg_cvss":
                    drivers.append(f"Elevated Mean Severity (CVSS {round(val, 1)} vs fleet {round(med, 1)})")
                elif col == "max_cvss":
                    drivers.append(f"Critical Severity Ceiling (Max CVSS {round(val, 1)})")
                elif col == "cvss_variance":
                    drivers.append(f"Erratic Severity Variance (Volatility: {round(val, 2)})")
                elif col == "p90_cvss":
                    drivers.append(f"High 90th-Percentile Severity Spike ({round(val, 1)})")
                elif col == "total_findings":
                    drivers.append(f"Extreme Finding Density ({int(val)} vulnerabilities in report)")
                elif col == "open_findings":
                    drivers.append(f"Unresolved Backlog Density ({int(val)} open findings)")

        if not drivers and row["is_anomaly"]:
            drivers.append("Multivariate anomaly deviation across composite risk metrics")

        score = float(row["anomaly_score"])
        is_anom = bool(row["is_anomaly"])

        if score < -0.10:
            tier = "CRITICAL_OUTLIER"
            tier_label = "Critical Risk Outlier Report"
        elif is_anom or score < 0.0:
            tier = "ELEVATED_OUTLIER"
            tier_label = "Elevated Anomaly Report"
        elif score > 0.08 and row["avg_cvss"] < fleet_benchmarks["fleet_median_cvss"]:
            tier = "EXEMPLARY_COMPLIANT"
            tier_label = "Low-Risk Baseline Report"
        else:
            tier = "TYPICAL_NORMAL"
            tier_label = "Standard Fleet Report"

        anomalies_out.append({
            "report_id": row["report_id"],
            "report_title": row["report_title"],
            "upload_status": row["upload_status"],
            "page_count": int(row["page_count"]),
            "created_at": row["created_at"],
            "agency_id": row["agency_id"],
            "agency_name": row["agency_name"],
            "agency_code": row["agency_code"],
            "cert_in_empanelled": bool(row["cert_in_empanelled"]),
            "is_anomaly": is_anom,
            "anomaly_score": round(score, 4),
            "anomaly_tier": tier,
            "tier_label": tier_label,
            "total_findings": int(row["total_findings"]),
            "critical_count": int(row["critical_count"]),
            "high_count": int(row["high_count"]),
            "critical_high_count": int(row["critical_high_count"]),
            "critical_ratio": float(row["critical_ratio"]),
            "avg_cvss": float(row["avg_cvss"]),
            "max_cvss": float(row["max_cvss"]),
            "cvss_variance": float(row["cvss_variance"]),
            "p90_cvss": float(row["p90_cvss"]),
            "open_findings": int(row["open_findings"]),
            "unresolved_ratio": float(row["unresolved_ratio"]),
            "avg_days_open": float(row["avg_days_open"]),
            "sla_breach_count": int(row["sla_breach_count"]),
            "cve_count": int(row["cve_count"]),
            "primary_drivers": drivers[:3],
            "deviations": deviations,
            "metrics": {
                "total_findings": int(row["total_findings"]),
                "avg_cvss": float(row["avg_cvss"]),
                "max_cvss": float(row["max_cvss"]),
                "cvss_variance": float(row["cvss_variance"]),
                "p90_cvss": float(row["p90_cvss"])
            }
        })

    # Sort primarily by anomaly score ascending (most anomalous first)
    anomalies_out.sort(key=lambda x: x["anomaly_score"])

    # Filtering
    filtered_data = anomalies_out
    if filter_status.upper() == "OUTLIER":
        filtered_data = [a for a in filtered_data if a["is_anomaly"]]
    elif filter_status.upper() == "NORMAL":
        filtered_data = [a for a in filtered_data if not a["is_anomaly"]]

    if search:
        s = search.lower().strip()
        filtered_data = [
            a for a in filtered_data
            if s in str(a.get("report_title") or "").lower()
            or s in str(a.get("agency_name") or "").lower()
            or s in str(a.get("agency_code") or "").lower()
        ]

    return {
        "status": "success",
        "total_reports": len(anomalies_out),
        "total_agencies": len({a["agency_id"] for a in anomalies_out if a.get("agency_id")}),
        "anomalies_detected": sum(1 for a in anomalies_out if a.get("is_anomaly")),
        "contamination_applied": float(contamination),
        "fleet_benchmarks": fleet_benchmarks,
        "data": filtered_data
    }


@router.get("/anomalies/report/{report_id}")
async def report_anomaly_detail(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Detailed audit telemetry and findings breakdown for an individual report.
    """
    rep_res = await db.execute(
        select(Report, Agency)
        .outerjoin(Agency, Report.agency_id == Agency.agency_id)
        .where(Report.report_id == report_id)
    )
    row = rep_res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    report, agency = row

    # Fetch findings for this report
    obs_res = await db.execute(
        select(DetailedObservation)
        .where(DetailedObservation.report_id == report_id)
        .order_by(DetailedObservation.cvss_score.desc())
    )
    findings = obs_res.scalars().all()

    now = datetime.now(timezone.utc)
    findings_data = []
    crit_count = 0
    high_count = 0
    med_count = 0
    low_count = 0
    open_count = 0
    cvss_scores = []

    for f in findings:
        days_open = max((now - f.created_at).days, 0) if f.created_at else 0
        sev = f.severity.value if f.severity else "Unknown"
        cvss = float(f.cvss_score or 0.0)
        cvss_scores.append(cvss)

        if sev == "Critical": crit_count += 1
        elif sev == "High": high_count += 1
        elif sev == "Medium": med_count += 1
        elif sev == "Low": low_count += 1

        if f.status and f.status.value in ["Open", "Partially Remediated"]:
            open_count += 1

        findings_data.append({
            "finding_id": str(f.finding_id),
            "title": f.title,
            "severity": sev,
            "cvss_score": cvss,
            "status": f.status.value if f.status else "Unknown",
            "days_open": days_open,
            "cve_id": f.cve_id or [],
            "affected_asset": f.affected_asset or []
        })

    avg_cvss = round(float(np.mean(cvss_scores)), 2) if cvss_scores else 0.0
    max_cvss = round(float(np.max(cvss_scores)), 1) if cvss_scores else 0.0

    return {
        "status": "success",
        "report": {
            "report_id": str(report.report_id),
            "original_filename": report.original_filename,
            "upload_status": report.upload_status.value if report.upload_status else "UPLOADED",
            "page_count": report.page_count or 0,
            "file_size": report.file_size,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "agency": {
                "agency_id": str(agency.agency_id) if agency else None,
                "agency_name": agency.agency_name if agency else "Unassigned Agency",
                "agency_code": agency.agency_code if agency else "N/A",
                "agency_type": agency.agency_type if agency else "N/A",
                "cert_in_empanelled": agency.cert_in_empanelled if agency else False
            }
        },
        "stats": {
            "total_findings": len(findings),
            "critical_count": crit_count,
            "high_count": high_count,
            "medium_count": med_count,
            "low_count": low_count,
            "open_findings": open_count,
            "avg_cvss": avg_cvss,
            "max_cvss": max_cvss
        },
        "findings": findings_data
    }


@router.get("/anomalies/agency/{agency_id}")
async def agency_anomaly_detail(
    agency_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Detailed telemetry and audit breakdown for an individual agency (legacy/secondary endpoint).
    """
    agency_res = await db.execute(select(Agency).where(Agency.agency_id == agency_id))
    agency = agency_res.scalar_one_or_none()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")

    reports_res = await db.execute(
        select(Report)
        .where(Report.agency_id == agency_id)
        .order_by(Report.created_at.desc())
    )
    reports = reports_res.scalars().all()

    report_ids = [r.report_id for r in reports]
    findings = []
    if report_ids:
        obs_res = await db.execute(
            select(DetailedObservation)
            .where(DetailedObservation.report_id.in_(report_ids))
            .order_by(DetailedObservation.cvss_score.desc())
        )
        findings = obs_res.scalars().all()

    now = datetime.now(timezone.utc)
    findings_data = []
    for f in findings[:25]:
        days_open = max((now - f.created_at).days, 0) if f.created_at else 0
        findings_data.append({
            "finding_id": str(f.finding_id),
            "title": f.title,
            "severity": f.severity.value if f.severity else "Unknown",
            "cvss_score": float(f.cvss_score or 0.0),
            "status": f.status.value if f.status else "Unknown",
            "days_open": days_open,
            "cve_id": f.cve_id or []
        })

    reports_data = [
        {
            "report_id": str(r.report_id),
            "original_filename": r.original_filename,
            "upload_status": r.upload_status.value if r.upload_status else "UPLOADED",
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in reports[:10]
    ]

    return {
        "status": "success",
        "agency": {
            "agency_id": str(agency.agency_id),
            "agency_name": agency.agency_name,
            "agency_code": agency.agency_code,
            "agency_type": agency.agency_type,
            "cert_in_empanelled": agency.cert_in_empanelled,
            "empanelment_number": agency.empanelment_number,
            "contact_person": agency.contact_person,
            "contact_email": agency.contact_email,
            "status": agency.status,
            "city": agency.city,
            "state": agency.state
        },
        "stats": {
            "total_reports": len(reports),
            "total_findings": len(findings),
            "critical_findings": sum(1 for f in findings if f.severity and f.severity.value == "Critical"),
            "high_findings": sum(1 for f in findings if f.severity and f.severity.value == "High"),
            "open_findings": sum(1 for f in findings if f.status and f.status.value == "Open")
        },
        "recent_reports": reports_data,
    }



@router.get("/prioritize")
async def task_prioritization(
    w_cvss: float = Query(0.50, ge=0.0, le=1.0, description="TOPSIS criteria weight for CVSS score"),
    w_aging: float = Query(0.25, ge=0.0, le=1.0, description="TOPSIS criteria weight for aging urgency"),
    w_cve: float = Query(0.15, ge=0.0, le=1.0, description="TOPSIS criteria weight for known CVE exploit presence"),
    w_asset: float = Query(0.10, ge=0.0, le=1.0, description="TOPSIS criteria weight for asset scope & impact"),
    decay_factor: float = Query(100.0, ge=10.0, le=500.0, description="Exponential scale factor for aging days open"),
    agency_id: Optional[uuid.UUID] = Query(None, description="Filter queue by agency"),
    severity: Optional[str] = Query(None, description="Filter queue by severity (Critical, High, Medium, Low)"),
    status: Optional[str] = Query("Open", description="Filter queue by observation status (Open, Partially Remediated, All)"),
    search: Optional[str] = Query(None, description="Search finding title, CVE, or asset"),
    limit: int = Query(500, ge=10, le=2000, description="Maximum prioritized findings to evaluate"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Task 5: Production-Grade Vulnerability Task Prioritization (TOPSIS Engine)
    Multi-Criteria Decision Analysis (MCDA) implementing vector normalization and Euclidean distance
    from ideal positive (A+) and ideal negative (A-) benchmarks.
    """
    w_cvss = float(_val(w_cvss, 0.50))
    w_aging = float(_val(w_aging, 0.25))
    w_cve = float(_val(w_cve, 0.15))
    w_asset = float(_val(w_asset, 0.10))
    decay_factor = float(_val(decay_factor, 100.0))
    agency_id = _val(agency_id, None)
    severity = _val(severity, None)
    status = _val(status, "Open")
    search = _val(search, None)
    limit = int(_val(limit, 500))

    # Normalize input weights to sum to 1.0
    raw_weights = [max(w_cvss, 0.0), max(w_aging, 0.0), max(w_cve, 0.0), max(w_asset, 0.0)]
    total_w = sum(raw_weights)
    if total_w < 1e-6:
        norm_weights = np.array([0.50, 0.25, 0.15, 0.10])
    else:
        norm_weights = np.array(raw_weights) / total_w

    # Build DB Query with joined agency and report metadata
    query = (
        select(
            DetailedObservation,
            Report.original_filename,
            Report.report_id,
            Agency.agency_id,
            Agency.agency_name
        )
        .join(Report, DetailedObservation.report_id == Report.report_id)
        .outerjoin(Agency, Report.agency_id == Agency.agency_id)
    )

    if status and status.lower() != "all":
        if status.lower() == "open":
            query = query.where(DetailedObservation.status == ObservationStatus.OPEN)
        elif status.lower() in ["partially remediated", "partially_remediated"]:
            query = query.where(DetailedObservation.status == ObservationStatus.PARTIALLY_REMEDIATED)
        else:
            query = query.where(DetailedObservation.status.in_([ObservationStatus.OPEN, ObservationStatus.PARTIALLY_REMEDIATED]))

    if agency_id:
        query = query.where(Agency.agency_id == agency_id)

    if severity and severity.lower() != "all":
        # Match severity string (case insensitive)
        query = query.where(func.lower(DetailedObservation.severity.cast(Text)) == severity.lower())

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.where(func.lower(DetailedObservation.title).like(s))

    query = query.order_by(DetailedObservation.cvss_score.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return {
            "status": "success",
            "total": 0,
            "summary": {
                "p1_count": 0,
                "p2_count": 0,
                "p3_count": 0,
                "p4_count": 0,
                "avg_priority_score": 0.0,
                "avg_days_open": 0.0,
                "sla_breached_count": 0,
                "sla_compliance_rate": 100.0,
                "max_days_open": 0,
                "weights_applied": {
                    "cvss": round(float(norm_weights[0]), 3),
                    "aging": round(float(norm_weights[1]), 3),
                    "cve": round(float(norm_weights[2]), 3),
                    "asset": round(float(norm_weights[3]), 3)
                }
            },
            "data": []
        }

    now = datetime.now(timezone.utc)
    records = []
    for obs, rep_filename, rep_id, aid, aname in rows:
        days_open = max((now - obs.created_at).days, 0) if obs.created_at else 0
        urgency_score = math.exp(days_open / float(decay_factor))
        has_cve = 1.0 if (obs.cve_id and len(obs.cve_id) > 0) else 0.1
        if obs.reported_epss_score:
            has_cve = max(has_cve, float(obs.reported_epss_score) * 2.0)

        # Asset & Impact score
        asset_count = len(obs.affected_asset) if obs.affected_asset else 1
        impact_val = 1.0 if obs.impact_level == "Major" else 0.6 if obs.impact_level == "Moderate" else 0.3
        asset_impact_score = min(asset_count * 0.5 + impact_val * 0.5, 3.0)

        cvss = float(obs.cvss_score or 0.0)
        sev_str = obs.severity.value if obs.severity else "Unknown"

        records.append({
            "finding_id": str(obs.finding_id),
            "title": obs.title or "Untitled Observation",
            "severity": sev_str,
            "cvss": cvss,
            "days_open": days_open,
            "urgency_score": urgency_score,
            "has_cve": has_cve,
            "asset_impact_score": asset_impact_score,
            "cve_id": obs.cve_id or [],
            "cwe": obs.cwe or [],
            "affected_asset": obs.affected_asset or [],
            "agency_id": str(aid) if aid else None,
            "agency_name": aname or "Unassigned Agency",
            "report_id": str(rep_id) if rep_id else None,
            "report_title": rep_filename or "Audit Report",
            "created_at": obs.created_at.isoformat() if obs.created_at else None
        })

    df = pd.DataFrame(records)

    # Criteria matrix: [CVSS, Urgency/Aging, Known CVE/Exploit, Asset Scope/Impact]
    X = df[["cvss", "urgency_score", "has_cve", "asset_impact_score"]].values

    # Step 1: Vector Normalization
    col_norms = np.sqrt((X**2).sum(axis=0) + 1e-8)
    norm_X = X / col_norms

    # Step 2: Weighting
    weighted_X = norm_X * norm_weights

    # Step 3: Ideal Best (A+) and Ideal Worst (A-)
    ideal_best = weighted_X.max(axis=0)
    ideal_worst = weighted_X.min(axis=0)

    # Step 4: Euclidean Distances
    dist_best = np.sqrt(((weighted_X - ideal_best)**2).sum(axis=1))
    dist_worst = np.sqrt(((weighted_X - ideal_worst)**2).sum(axis=1))

    # Step 5: Closeness Coefficient (0.0 to 1.0)
    scores = dist_worst / (dist_best + dist_worst + 1e-8)
    df["topsis_score"] = scores
    df["dist_best"] = dist_best
    df["dist_worst"] = dist_worst

    # Sort descending by priority score
    df = df.sort_values("topsis_score", ascending=False).reset_index(drop=True)

    prioritized = []
    sla_breaches = 0
    p1_count = 0
    p2_count = 0
    p3_count = 0
    p4_count = 0
    sev_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Unknown": 0}

    for idx, row in df.iterrows():
        score = round(float(row["topsis_score"]) * 100, 2)
        days = int(row["days_open"])
        sev = row["severity"]
        sev_counts[sev] = sev_counts.get(sev, 0) + 1

        # SLA Determination
        sla_limit = 15 if sev == "Critical" else 30 if sev == "High" else 60 if sev == "Medium" else 90
        if days > sla_limit:
            sla_status = "BREACHED"
            sla_breaches += 1
        elif days > (sla_limit * 0.75):
            sla_status = "WARNING"
        else:
            sla_status = "COMPLIANT"

        if score >= 85.0:
            tier = "P1"
            tier_label = "P1 - Immediate Intervention"
            p1_count += 1
        elif score >= 70.0:
            tier = "P2"
            tier_label = "P2 - High Urgency"
            p2_count += 1
        elif score >= 50.0:
            tier = "P3"
            tier_label = "P3 - Scheduled Remediation"
            p3_count += 1
        else:
            tier = "P4"
            tier_label = "P4 - Backlog Review"
            p4_count += 1

        # Relative contribution breakdown
        w_row = weighted_X[idx]
        w_sum = max(w_row.sum(), 1e-6)
        contributions = {
            "cvss_pct": round(float(w_row[0] / w_sum * 100), 1),
            "aging_pct": round(float(w_row[1] / w_sum * 100), 1),
            "cve_pct": round(float(w_row[2] / w_sum * 100), 1),
            "asset_pct": round(float(w_row[3] / w_sum * 100), 1)
        }

        prioritized.append({
            "rank": idx + 1,
            "finding_id": row["finding_id"],
            "title": row["title"],
            "severity": sev,
            "cvss": float(row["cvss"]),
            "days_open": days,
            "urgency_multiplier": round(float(row["urgency_score"]), 2),
            "priority_score": score,
            "priority_tier": tier,
            "tier_label": tier_label,
            "sla_status": sla_status,
            "sla_target_days": sla_limit,
            "agency_id": None if pd.isna(row["agency_id"]) else str(row["agency_id"]),
            "agency_name": "Unassigned" if pd.isna(row["agency_name"]) else str(row["agency_name"]),
            "report_id": None if pd.isna(row["report_id"]) else str(row["report_id"]),
            "report_title": "Audit Report" if pd.isna(row["report_title"]) else str(row["report_title"]),
            "cve_id": [] if (isinstance(row["cve_id"], float) and math.isnan(row["cve_id"])) else (row["cve_id"] or []),
            "cwe": [] if (isinstance(row["cwe"], float) and math.isnan(row["cwe"])) else (row["cwe"] or []),
            "affected_asset": [] if (isinstance(row["affected_asset"], float) and math.isnan(row["affected_asset"])) else (row["affected_asset"] or []),
            "created_at": None if pd.isna(row["created_at"]) else str(row["created_at"]),
            "dist_best": round(float(row["dist_best"]), 4),
            "dist_worst": round(float(row["dist_worst"]), 4),
            "criteria_contributions": contributions
        })

    total_items = len(prioritized)
    avg_score = round(float(df["topsis_score"].mean() * 100), 1) if total_items > 0 else 0.0
    avg_days = round(float(df["days_open"].mean()), 1) if total_items > 0 else 0.0
    max_days = int(df["days_open"].max()) if total_items > 0 else 0
    compliance_rate = round(float((total_items - sla_breaches) / max(total_items, 1) * 100), 1)

    return {
        "status": "success",
        "total": total_items,
        "summary": {
            "p1_count": p1_count,
            "p2_count": p2_count,
            "p3_count": p3_count,
            "p4_count": p4_count,
            "avg_priority_score": avg_score,
            "avg_days_open": avg_days,
            "sla_breached_count": sla_breaches,
            "sla_compliance_rate": compliance_rate,
            "max_days_open": max_days,
            "weights_applied": {
                "cvss": round(float(norm_weights[0]), 3),
                "aging": round(float(norm_weights[1]), 3),
                "cve": round(float(norm_weights[2]), 3),
                "asset": round(float(norm_weights[3]), 3)
            },
            "severity_breakdown": sev_counts
        },
        "data": prioritized
    }


@router.get("/prioritize/{finding_id}")
async def task_prioritization_detail(
    finding_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Detailed inspection of an individual vulnerability in the prioritization queue.
    """
    query = (
        select(
            DetailedObservation,
            Report.original_filename,
            Report.report_id,
            Agency.agency_id,
            Agency.agency_name,
            Agency.agency_code
        )
        .join(Report, DetailedObservation.report_id == Report.report_id)
        .outerjoin(Agency, Report.agency_id == Agency.agency_id)
        .where(DetailedObservation.finding_id == finding_id)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Finding not found")

    obs, rep_filename, rep_id, aid, aname, acode = row

    now = datetime.now(timezone.utc)
    days_open = max((now - obs.created_at).days, 0) if obs.created_at else 0
    sev = obs.severity.value if obs.severity else "Unknown"

    sla_limit = 15 if sev == "Critical" else 30 if sev == "High" else 60 if sev == "Medium" else 90
    sla_status = "BREACHED" if days_open > sla_limit else "WARNING" if days_open > (sla_limit * 0.75) else "COMPLIANT"

    return {
        "status": "success",
        "data": {
            "finding_id": str(obs.finding_id),
            "title": obs.title,
            "severity": sev,
            "cvss_score": float(obs.cvss_score or 0.0),
            "cvss_vector": obs.cvss_vector,
            "status": obs.status.value if obs.status else "Unknown",
            "days_open": days_open,
            "sla_limit_days": sla_limit,
            "sla_status": sla_status,
            "cve_id": obs.cve_id or [],
            "cwe": obs.cwe or [],
            "affected_asset": obs.affected_asset or [],
            "observation_description": obs.observation_description,
            "preconditions": obs.preconditions,
            "impact": obs.impact,
            "likely_root_cause": obs.likely_root_cause,
            "recommendation": obs.recommendation,
            "reference": obs.reference,
            "new_or_repeat": obs.new_or_repeat.value if obs.new_or_repeat else "Unknown",
            "created_at": obs.created_at.isoformat() if obs.created_at else None,
            "agency": {
                "agency_id": str(aid) if aid else None,
                "agency_name": aname or "Unassigned",
                "agency_code": acode
            },
            "report": {
                "report_id": str(rep_id) if rep_id else None,
                "filename": rep_filename
            }
        }
    }

