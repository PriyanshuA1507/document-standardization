import uuid
import math
import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Task 4: Audit Score Comparisons (Anomaly Detection)
    Enhanced Isolation Forest with variance and percentile feature engineering.
    """
    query = select(Agency.agency_id, Agency.agency_name, Report.report_id, DetailedObservation.cvss_score).select_from(Agency).outerjoin(Report, Agency.agency_id == Report.agency_id).outerjoin(DetailedObservation, Report.report_id == DetailedObservation.report_id)
    
    result = await db.execute(query)
    rows = result.all()
    
    if len(rows) < 4:
        return {"status": "insufficient_data", "message": "Need more data for robust Isolation Forest detection."}
        
    df_raw = pd.DataFrame([{"agency_id": str(r.agency_id), "agency_name": r.agency_name, "report_id": str(r.report_id), "cvss": float(r.cvss_score or 0.0)} for r in rows])
    
    # Feature Engineering
    agg_df = df_raw.groupby(['agency_id', 'agency_name']).agg(
        total_reports=('report_id', 'nunique'),
        avg_cvss=('cvss', 'mean'),
        cvss_variance=('cvss', 'var'),
        p90_cvss=('cvss', lambda x: x.quantile(0.9) if len(x) > 0 else 0)
    ).reset_index()
    
    agg_df.fillna(0, inplace=True)
    
    features = ['total_reports', 'avg_cvss', 'cvss_variance', 'p90_cvss']
    X = agg_df[features].values
    
    # Isolation Forest
    iso = IsolationForest(contamination=0.1, random_state=42)
    preds = iso.fit_predict(X)
    scores = iso.decision_function(X)
    
    agg_df['is_anomaly'] = preds == -1
    agg_df['anomaly_score'] = scores
    
    anomalies_out = []
    for _, row in agg_df.iterrows():
        anomalies_out.append({
            "agency_id": row['agency_id'],
            "agency_name": row['agency_name'],
            "is_anomaly": bool(row['is_anomaly']),
            "anomaly_score": float(row['anomaly_score']),
            "metrics": {f: row[f] for f in features}
        })
        
    anomalies_out.sort(key=lambda x: x['anomaly_score'])
    
    return {
        "status": "success",
        "total_agencies": len(anomalies_out),
        "anomalies_detected": sum(1 for a in anomalies_out if a['is_anomaly']),
        "data": anomalies_out
    }


@router.get("/prioritize")
async def task_prioritization(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Task 5: Task Prioritization
    Upgraded TOPSIS with exponential decay function for long-standing critical tasks.
    OPTIMIZATION: Limits DB retrieval to the top 1000 most pressing (highest CVSS) to prevent RAM explosion at extreme scale.
    """
    # OPTIMIZATION: Database-Level Scalability
    query = (
        select(DetailedObservation)
        .where(DetailedObservation.status == ObservationStatus.OPEN)
        .order_by(DetailedObservation.cvss_score.desc())
        .limit(1000)
    )
    result = await db.execute(query)
    vulns = result.scalars().all()
    
    if not vulns:
        return {"status": "success", "data": []}
        
    data = []
    now = datetime.now(timezone.utc)
    for v in vulns:
        days_open = (now - v.created_at).days
        
        # Exponential Decay / Non-linear urgency for Days Open
        urgency_score = math.exp(days_open / 100.0)
        
        has_cve = 1 if (v.cve_id and len(v.cve_id) > 0) else 0
        cvss = float(v.cvss_score or 0.0)
        
        data.append([str(v.finding_id), v.title, cvss, days_open, urgency_score, has_cve])
        
    df = pd.DataFrame(data, columns=['finding_id', 'title', 'cvss', 'days_open', 'urgency_score', 'has_cve'])
    
    X = df[['cvss', 'urgency_score', 'has_cve']].values
    
    # Normalize
    norm_X = X / np.sqrt((X**2).sum(axis=0) + 1e-8)
    
    # Apply Weights (CVSS: 60%, Urgency: 30%, CVE: 10%)
    weights = np.array([0.6, 0.3, 0.1])
    weighted_X = norm_X * weights
    
    ideal_best = weighted_X.max(axis=0)
    ideal_worst = weighted_X.min(axis=0)
    
    dist_best = np.sqrt(((weighted_X - ideal_best)**2).sum(axis=1))
    dist_worst = np.sqrt(((weighted_X - ideal_worst)**2).sum(axis=1))
    
    scores = dist_worst / (dist_best + dist_worst + 1e-8)
    df['topsis_score'] = scores
    
    df = df.sort_values('topsis_score', ascending=False)
    
    prioritized = []
    for _, row in df.iterrows():
        prioritized.append({
            "finding_id": row['finding_id'],
            "title": row['title'],
            "cvss": row['cvss'],
            "days_open": row['days_open'],
            "urgency_multiplier": round(float(row['urgency_score']), 2),
            "priority_score": round(float(row['topsis_score']) * 100, 2)
        })
        
    return {"status": "success", "total": len(prioritized), "data": prioritized}
