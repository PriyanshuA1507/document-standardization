import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from sqlalchemy import select, func, or_, cast, String, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog, SecurityEvent
from app.models.report import Report
from app.models.user import User

logger = logging.getLogger(__name__)


async def create_audit_log(
    db: AsyncSession,
    action: str,
    status: str,
    user_id: Optional[uuid.UUID] = None,
    report_id: Optional[uuid.UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Centrally record an audit log entry in the database.
    Catches exceptions so logging never breaks the primary transaction flow.
    If status is FAILED or action represents a security risk, also creates a SecurityEvent.
    """
    try:
        log_details = dict(details) if details else {}
        if ip_address and "ip_address" not in log_details:
            log_details["ip_address"] = ip_address
        if user_agent and "user_agent" not in log_details:
            log_details["user_agent"] = user_agent

        log = AuditLog(
            log_id=uuid.uuid4(),
            user_id=user_id,
            report_id=report_id,
            action=action.upper(),
            status=status.upper(),
            details=log_details,
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.flush()

        # Check if this qualifies as a SecurityEvent
        is_security_alert = (
            status.upper() == "FAILED"
            or "MALWARE" in action.upper()
            or "SECURITY" in action.upper()
            or "FAILED" in action.upper()
            or (log_details.get("reason") and "malware" in str(log_details.get("reason")).lower())
        )

        if is_security_alert:
            severity = "MEDIUM"
            if "MALWARE" in action.upper() or (log_details.get("reason") and "malware" in str(log_details.get("reason")).lower()):
                severity = "CRITICAL"
            elif "LOGIN_FAILED" in action.upper() or "UNAUTHORIZED" in action.upper():
                severity = "HIGH"

            desc_text = log_details.get("reason") or f"Security relevant failure during {action}"
            sec_event = SecurityEvent(
                event_id=uuid.uuid4(),
                user_id=user_id,
                severity=severity,
                event_type=action.upper(),
                description=str(desc_text),
                event_metadata=log_details,
                created_at=datetime.now(timezone.utc),
            )
            db.add(sec_event)
            await db.flush()

        return log
    except Exception as e:
        logger.error(f"Failed to create audit log for {action}: {e}", exc_info=True)
        return None


async def create_security_event(
    db: AsyncSession,
    event_type: str,
    severity: str,
    description: str,
    user_id: Optional[uuid.UUID] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[SecurityEvent]:
    """Record a direct security incident / event."""
    try:
        sec_event = SecurityEvent(
            event_id=uuid.uuid4(),
            user_id=user_id,
            severity=severity.upper(),
            event_type=event_type.upper(),
            description=description,
            event_metadata=metadata or {},
            created_at=datetime.now(timezone.utc),
        )
        db.add(sec_event)
        await db.flush()
        return sec_event
    except Exception as e:
        logger.error(f"Failed to create security event: {e}", exc_info=True)
        return None


async def get_audit_logs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    action: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    report_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> tuple[List[AuditLog], int]:
    """Get paginated list of audit logs with rich filtering & full search."""
    query = select(AuditLog).options(selectinload(AuditLog.user))
    count_query = select(func.count(AuditLog.log_id))

    # Outer join with User to allow searching by username
    if search:
        query = query.outerjoin(User, AuditLog.user_id == User.user_id)
        count_query = count_query.outerjoin(User, AuditLog.user_id == User.user_id)

    # 1. Action filter
    if action:
        query = query.where(AuditLog.action == action.upper())
        count_query = count_query.where(AuditLog.action == action.upper())

    # 2. Status filter
    if status and status.upper() != "ALL":
        query = query.where(AuditLog.status == status.upper())
        count_query = count_query.where(AuditLog.status == status.upper())

    # 3. User filter
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    # 4. Report filter
    if report_id:
        query = query.where(AuditLog.report_id == report_id)
        count_query = count_query.where(AuditLog.report_id == report_id)

    # 5. Category grouping filter
    if category and category.upper() != "ALL":
        cat = category.upper()
        if cat == "AUTH":
            auth_actions = ["USER_LOGIN", "USER_LOGOUT", "USER_LOGIN_FAILED", "TOKEN_REFRESH", "SESSION_REVOKED"]
            query = query.where(AuditLog.action.in_(auth_actions))
            count_query = count_query.where(AuditLog.action.in_(auth_actions))
        elif cat == "FILES":
            file_actions = ["FILE_UPLOAD", "FILE_DELETE", "REPORT_DOWNLOAD", "REPORT_REPROCESS", "REPORT_EXPORT"]
            query = query.where(AuditLog.action.in_(file_actions))
            count_query = count_query.where(AuditLog.action.in_(file_actions))
        elif cat == "PIPELINE":
            pipe_actions = ["PIPELINE_START", "PIPELINE_SUCCESS", "PIPELINE_FAILED", "PIPELINE_RUN"]
            query = query.where(AuditLog.action.in_(pipe_actions))
            count_query = count_query.where(AuditLog.action.in_(pipe_actions))
        elif cat == "USERS":
            user_actions = ["USER_CREATE", "USER_UPDATE", "USER_DELETE", "USER_DEACTIVATE", "PROFILE_UPDATE"]
            query = query.where(AuditLog.action.in_(user_actions))
            count_query = count_query.where(AuditLog.action.in_(user_actions))
        elif cat == "SECURITY":
            query = query.where(
                or_(
                    AuditLog.status == "FAILED",
                    AuditLog.action.like("%FAIL%"),
                    AuditLog.action.like("%ALERT%"),
                    AuditLog.action.like("%QUARANTINE%"),
                )
            )
            count_query = count_query.where(
                or_(
                    AuditLog.status == "FAILED",
                    AuditLog.action.like("%FAIL%"),
                    AuditLog.action.like("%ALERT%"),
                    AuditLog.action.like("%QUARANTINE%"),
                )
            )
        elif cat == "BATCHES":
            query = query.where(AuditLog.action.like("BATCH_%"))
            count_query = count_query.where(AuditLog.action.like("BATCH_%"))

    # 6. Date Range filters
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
        count_query = count_query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
        count_query = count_query.where(AuditLog.created_at <= end_date)

    # 7. Search text
    if search:
        search_pattern = f"%{search.strip()}%"
        search_condition = or_(
            AuditLog.action.ilike(search_pattern),
            AuditLog.status.ilike(search_pattern),
            cast(AuditLog.details, String).ilike(search_pattern),
            User.username.ilike(search_pattern),
            User.full_name.ilike(search_pattern),
        )
        query = query.where(search_condition)
        count_query = count_query.where(search_condition)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    )
    logs = result.scalars().unique().all()

    return list(logs), total


async def get_audit_stats(db: AsyncSession) -> Dict[str, Any]:
    """Compute high-level KPI metrics for the Audit Operations Center."""
    # Total count
    total_result = await db.execute(select(func.count(AuditLog.log_id)))
    total_logs = total_result.scalar() or 0

    # Successful vs Failed
    success_result = await db.execute(
        select(func.count(AuditLog.log_id)).where(AuditLog.status == "SUCCESS")
    )
    success_count = success_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count(AuditLog.log_id)).where(AuditLog.status == "FAILED")
    )
    failed_count = failed_result.scalar() or 0

    # Security alerts count
    sec_result = await db.execute(select(func.count(SecurityEvent.event_id)))
    security_alerts_count = sec_result.scalar() or 0

    # Action counts breakdown
    actions_result = await db.execute(
        select(AuditLog.action, func.count(AuditLog.log_id))
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.log_id)))
        .limit(10)
    )
    action_counts = {row[0]: row[1] for row in actions_result.all()}

    # Activity in the last 24 hours
    since_yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    today_result = await db.execute(
        select(func.count(AuditLog.log_id)).where(AuditLog.created_at >= since_yesterday)
    )
    activity_today = today_result.scalar() or 0

    # Distinct operators
    operators_result = await db.execute(
        select(func.count(func.distinct(AuditLog.user_id))).where(AuditLog.user_id.isnot(None))
    )
    distinct_operators = operators_result.scalar() or 0

    # Recent security events (last 5)
    sec_events_res = await db.execute(
        select(SecurityEvent).order_by(desc(SecurityEvent.created_at)).limit(5)
    )
    recent_sec_events = [
        {
            "event_id": str(e.event_id),
            "severity": e.severity,
            "event_type": e.event_type,
            "description": e.description,
            "created_at": e.created_at.isoformat(),
        }
        for e in sec_events_res.scalars().all()
    ]

    success_rate = round((success_count / total_logs) * 100, 1) if total_logs > 0 else 100.0

    return {
        "total_logs": total_logs,
        "success_count": success_count,
        "failed_count": failed_count,
        "success_rate": success_rate,
        "security_alerts_count": security_alerts_count,
        "action_counts": action_counts,
        "activity_today": activity_today,
        "distinct_operators": distinct_operators,
        "recent_security_events": recent_sec_events,
    }


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Get dashboard statistics with integrated real-time audit activity feed."""
    # Total reports
    reports_count = await db.execute(select(func.count(Report.report_id)))
    total_reports = reports_count.scalar() or 0

    # Total users
    users_count = await db.execute(select(func.count(User.user_id)))
    total_users = users_count.scalar() or 0

    # Reports by status
    from app.models.report import UploadStatus
    status_counts = {}
    for status in UploadStatus:
        count_result = await db.execute(
            select(func.count(Report.report_id)).where(
                Report.upload_status == status
            )
        )
        status_counts[status.value] = count_result.scalar() or 0

    # Recent uploads (last 10)
    recent_result = await db.execute(
        select(Report)
        .order_by(Report.created_at.desc())
        .limit(10)
    )
    recent = recent_result.scalars().all()
    recent_uploads = [
        {
            "report_id": str(r.report_id),
            "original_filename": r.original_filename,
            "file_size": r.file_size,
            "upload_status": r.upload_status.value if hasattr(r.upload_status, 'value') else r.upload_status,
            "created_at": r.created_at.isoformat(),
        }
        for r in recent
    ]

    # Live recent audit activity (last 10 events) for dashboard first view
    audit_res = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(desc(AuditLog.created_at))
        .limit(10)
    )
    recent_logs = audit_res.scalars().unique().all()
    recent_activity = [
        {
            "log_id": str(l.log_id),
            "user_id": str(l.user_id) if l.user_id else None,
            "username": l.user.username if l.user else (l.details.get("username") if l.details else "System"),
            "report_id": str(l.report_id) if l.report_id else None,
            "action": l.action,
            "status": l.status,
            "details": l.details or {},
            "created_at": l.created_at.isoformat(),
        }
        for l in recent_logs
    ]

    # Quick audit summary metrics
    total_logs_res = await db.execute(select(func.count(AuditLog.log_id)))
    total_audit_logs = total_logs_res.scalar() or 0

    failed_logs_res = await db.execute(select(func.count(AuditLog.log_id)).where(AuditLog.status == "FAILED"))
    failed_audit_logs = failed_logs_res.scalar() or 0

    sec_alerts_res = await db.execute(select(func.count(SecurityEvent.event_id)))
    total_sec_alerts = sec_alerts_res.scalar() or 0

    audit_summary = {
        "total_events": total_audit_logs,
        "failed_events": failed_audit_logs,
        "security_alerts": total_sec_alerts,
        "success_rate": round(((total_audit_logs - failed_audit_logs) / max(total_audit_logs, 1)) * 100, 1),
    }

    return {
        "total_reports": total_reports,
        "total_users": total_users,
        "recent_uploads": recent_uploads,
        "reports_by_status": status_counts,
        "recent_activity": recent_activity,
        "audit_summary": audit_summary,
    }
