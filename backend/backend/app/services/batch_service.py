import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

import httpx
from sqlalchemy import select, update, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.batch import (
    BatchJob,
    BatchItem,
    BatchStatus,
    BatchItemStatus,
    BatchSourceType,
)
from app.models.report import (
    Report,
    ReportsData,
    DetailedObservation,
    ReportImage,
    ObservationSeverity,
    ObservationStatus,
    ObservationImpact,
    ObservationLikelihood,
    ObservationNewRepeat,
)
from app.services import report_service
from app.utils.file_utils import validate_extension
from app.utils.encryption_utils import (
    is_pdf_encrypted,
    decrypt_pdf,
    is_docx_encrypted,
    decrypt_docx,
)
from app.utils.seaweedfs_utils import (
    upload_file,
    get_file_bytes,
    delete_file,
    delete_dir,
)
from app.routers.report_images import (
    sync_report_images_from_dict,
    sync_report_images_from_seaweedfs,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-Memory Event Broadcaster for SSE
# ---------------------------------------------------------------------------

class BatchEventBroadcaster:
    def __init__(self):
        self._subscribers: Dict[uuid.UUID, List[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, batch_id: uuid.UUID) -> asyncio.Queue:
        async with self._lock:
            if batch_id not in self._subscribers:
                self._subscribers[batch_id] = []
            queue = asyncio.Queue()
            self._subscribers[batch_id].append(queue)
            return queue

    async def unsubscribe(self, batch_id: uuid.UUID, queue: asyncio.Queue):
        async with self._lock:
            if batch_id in self._subscribers:
                if queue in self._subscribers[batch_id]:
                    self._subscribers[batch_id].remove(queue)
                if not self._subscribers[batch_id]:
                    del self._subscribers[batch_id]

    async def broadcast(self, batch_id: uuid.UUID, event_type: str, data: dict):
        async with self._lock:
            queues = list(self._subscribers.get(batch_id, []))
        
        payload = f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
        for q in queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass


broadcaster = BatchEventBroadcaster()

# ---------------------------------------------------------------------------
# Global Task & State Registry
# ---------------------------------------------------------------------------

ACTIVE_WORKERS: Dict[uuid.UUID, asyncio.Task] = {}
PAUSE_FLAGS: Dict[uuid.UUID, bool] = {}
CANCEL_FLAGS: Dict[uuid.UUID, bool] = {}


# ---------------------------------------------------------------------------
# Helper: Pipeline Persistence
# ---------------------------------------------------------------------------

async def save_pipeline_results_to_db(
    session: AsyncSession,
    report_id: uuid.UUID,
    final_data: Optional[dict],
    final_manifest: Optional[dict],
):
    """Saves AI Pipeline parsed JSON and observations to the database."""
    if final_data:
        data = dict(final_data)
        vulns = data.pop("detailed_observations", data.pop("vulnerabilities", []))

        existing_rd_res = await session.execute(
            select(ReportsData).where(ReportsData.report_id == report_id)
        )
        rd = existing_rd_res.scalar_one_or_none()
        if rd:
            rd.data = data
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(rd, "data")
            rd.updated_at = datetime.now(timezone.utc)
        else:
            rd = ReportsData(report_id=report_id, data=data)
            session.add(rd)

        await session.execute(
            delete(DetailedObservation).where(DetailedObservation.report_id == report_id)
        )

        for v in vulns:
            severity_str = str(v.get("severity", "")).upper()
            severity_enum = None
            if severity_str == "CRITICAL": severity_enum = ObservationSeverity.CRITICAL
            elif severity_str == "HIGH": severity_enum = ObservationSeverity.HIGH
            elif severity_str == "MEDIUM": severity_enum = ObservationSeverity.MEDIUM
            elif severity_str == "LOW": severity_enum = ObservationSeverity.LOW

            status_str = str(v.get("status", "")).upper()
            status_enum = None
            if status_str == "OPEN": status_enum = ObservationStatus.OPEN
            elif status_str == "CLOSED": status_enum = ObservationStatus.CLOSED
            elif "PARTIALLY" in status_str: status_enum = ObservationStatus.PARTIALLY_REMEDIATED

            impact_str = str(v.get("impact_level", "")).upper()
            impact_enum = None
            if impact_str == "MAJOR": impact_enum = ObservationImpact.MAJOR
            elif impact_str == "MODERATE": impact_enum = ObservationImpact.MODERATE
            elif impact_str == "MINOR": impact_enum = ObservationImpact.MINOR

            like_str = str(v.get("likelihood_level", "")).upper()
            like_enum = None
            if like_str == "EASY": like_enum = ObservationLikelihood.EASY
            elif like_str == "MODERATE": like_enum = ObservationLikelihood.MODERATE
            elif like_str == "HARD": like_enum = ObservationLikelihood.HARD

            nr_str = str(v.get("new_or_repeat", "")).upper()
            nr_enum = None
            if nr_str == "NEW": nr_enum = ObservationNewRepeat.NEW
            elif nr_str == "REPEAT": nr_enum = ObservationNewRepeat.REPEAT

            obs_date = None
            date_str = v.get("observation_date")
            if date_str:
                try:
                    obs_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    pass

            obs = DetailedObservation(
                report_id=report_id,
                title=v.get("title", v.get("vulnerability_title", "Unknown Title")),
                status=status_enum,
                severity=severity_enum,
                impact_level=impact_enum,
                likelihood_level=like_enum,
                cve_id=v.get("cve_id", v.get("cve_ids", [])),
                cvss_score=v.get("cvss_score"),
                cvss_vector=v.get("cvss_vector"),
                severity_rationale=v.get("severity_rationale"),
                reported_epss_score=v.get("reported_epss_score"),
                observation_date=obs_date,
                cwe=v.get("cwe", v.get("cwe_ids", [])),
                affected_asset=v.get("affected_asset", v.get("affected_assets", [])),
                regulatory_references=v.get("regulatory_references", []),
                observation_description=v.get(
                    "observation_description", v.get("detailed_observation")
                ),
                preconditions=v.get("preconditions"),
                proof_of_concept=v.get("proof_of_concept"),
                impact=v.get("impact"),
                likely_root_cause=v.get("likely_root_cause"),
                recommendation=v.get("recommendation"),
                reference=v.get("reference"),
                new_or_repeat=nr_enum,
                meta_data=v.get("additional meta", {}),
            )
            session.add(obs)
        await session.commit()

    if final_manifest:
        await sync_report_images_from_dict(session, report_id, final_manifest)
    else:
        await sync_report_images_from_seaweedfs(session, report_id)


# ---------------------------------------------------------------------------
# Helper: Decrypt file with password mapping or fallback
# ---------------------------------------------------------------------------

def decrypt_file_if_needed(
    file_bytes: bytes,
    filename: str,
    password_map: Optional[dict] = None,
    bulk_passwords: Optional[list] = None,
) -> Tuple[bytes, str]:
    """
    Checks encryption status for PDF / DOCX.
    Returns (decrypted_bytes, is_protected_str):
      is_protected_str: "No", "Decrypted", or raises ValueError.
    """
    ext_valid, extension = validate_extension(filename)
    if not ext_valid:
        return file_bytes, "No"

    passwords_to_try = []
    base_name = os.path.splitext(filename)[0]

    if password_map:
        # Check by lowercase base filename or full filename
        pwd = password_map.get(base_name.lower()) or password_map.get(filename.lower())
        if pwd:
            passwords_to_try.append(pwd)

    if bulk_passwords:
        for p in bulk_passwords:
            if p and p not in passwords_to_try:
                passwords_to_try.append(p)

    if extension == ".pdf":
        if is_pdf_encrypted(file_bytes):
            if not passwords_to_try:
                raise ValueError("PASSWORD_REQUIRED: File is password protected")
            decrypted = False
            for pwd in passwords_to_try:
                try:
                    file_bytes = decrypt_pdf(file_bytes, pwd)
                    decrypted = True
                    break
                except Exception:
                    continue
            if not decrypted:
                raise ValueError("INVALID_PASSWORD: Failed to decrypt with available passwords")
            return file_bytes, "Decrypted"
    elif extension == ".docx":
        if is_docx_encrypted(file_bytes):
            if not passwords_to_try:
                raise ValueError("PASSWORD_REQUIRED: File is password protected")
            decrypted = False
            for pwd in passwords_to_try:
                try:
                    file_bytes = decrypt_docx(file_bytes, pwd)
                    decrypted = True
                    break
                except Exception:
                    continue
            if not decrypted:
                raise ValueError("INVALID_PASSWORD: Failed to decrypt with available passwords")
            return file_bytes, "Decrypted"

    return file_bytes, "No"


# ---------------------------------------------------------------------------
# Worker Task: Process Single Item
# ---------------------------------------------------------------------------

async def process_batch_item(
    batch_id: uuid.UUID,
    item_id: uuid.UUID,
    created_by: Optional[uuid.UUID],
    agency_id: Optional[uuid.UUID],
    source_type: BatchSourceType,
    server_path: Optional[str],
    password_map: Optional[dict],
    bulk_passwords: Optional[list],
):
    """Processes a single batch item: upload -> validate -> run AI pipeline -> save."""
    # Check pause/cancel before beginning
    if PAUSE_FLAGS.get(batch_id) or CANCEL_FLAGS.get(batch_id):
        return

    async with AsyncSessionLocal() as session:
        # Fetch item
        item_res = await session.execute(select(BatchItem).where(BatchItem.item_id == item_id))
        item = item_res.scalar_one_or_none()
        if not item or item.status in (BatchItemStatus.SUCCESS, BatchItemStatus.SKIPPED):
            return

        item.status = BatchItemStatus.UPLOADING
        item.detail = "Reading file..."
        item.started_at = datetime.now(timezone.utc)
        await session.commit()

        await broadcaster.broadcast(
            batch_id,
            "item_update",
            {
                "item_id": str(item_id),
                "status": item.status.value,
                "detail": item.detail,
                "original_filename": item.original_filename,
            },
        )

        report_id = None
        file_bytes = None

        try:
            # 1. Read file bytes
            if source_type == BatchSourceType.SERVER_PATH:
                file_full_path = item.stored_file_path or os.path.join(server_path or "", item.original_filename)
                if not os.path.exists(file_full_path):
                    raise FileNotFoundError(f"File not found on server: {file_full_path}")
                with open(file_full_path, "rb") as f:
                    file_bytes = f.read()
            else:
                # Raw upload stored in SeaweedFS
                if not item.stored_file_path:
                    raise FileNotFoundError("Raw upload file path is missing in storage record")
                file_bytes = get_file_bytes(item.stored_file_path)

            # Check pause/cancel
            if CANCEL_FLAGS.get(batch_id):
                if item.stored_file_path and (item.stored_file_path.startswith("raw_batches/") or source_type == BatchSourceType.UPLOAD):
                    try:
                        delete_file(item.stored_file_path)
                    except Exception:
                        pass
                await session.delete(item)
                await session.commit()
                return

            if PAUSE_FLAGS.get(batch_id):
                item.status = BatchItemStatus.PENDING
                item.detail = "Paused before upload"
                await session.commit()
                return

            # 2. Check encryption & decrypt
            item.detail = "Checking password protection..."
            file_bytes, protected_str = decrypt_file_if_needed(
                file_bytes, item.original_filename, password_map, bulk_passwords
            )
            if item.is_protected != "Decrypted":
                item.is_protected = protected_str

            # 3. Upload & Validate Report
            item.detail = "Uploading and validating report..."
            await session.commit()
            await broadcaster.broadcast(
                batch_id,
                "item_update",
                {
                    "item_id": str(item_id),
                    "status": item.status.value,
                    "detail": item.detail,
                    "is_protected": item.is_protected,
                },
            )

            # upload_report commits/flushes on its own session or takes our session
            upload_result = await report_service.upload_report(
                session,
                file_bytes,
                item.original_filename,
                created_by or uuid.uuid4(),
                agency_id,
                batch_id=batch_id,
            )
            report_id = upload_result["report_id"]
            item.report_id = report_id

            # 4. Run AI Pipeline
            item.status = BatchItemStatus.PIPELINE
            item.detail = "Running AI Pipeline..."
            await session.commit()
            await broadcaster.broadcast(
                batch_id,
                "item_update",
                {
                    "item_id": str(item_id),
                    "status": item.status.value,
                    "detail": item.detail,
                    "report_id": str(report_id),
                },
            )

            pipeline_url = f"{settings.AI_PIPELINE_URL}/run"
            final_data = None
            final_manifest = None

            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    pipeline_url,
                    data={"report_id": str(report_id)},
                    files={"file": (item.original_filename, file_bytes, "application/pdf")},
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            try:
                                payload_obj = json.loads(line[6:])
                                p_type = payload_obj.get("type")
                                if p_type == "log":
                                    msg = payload_obj.get("message", "")
                                    item.detail = msg
                                    # Broadcast step log to UI
                                    await broadcaster.broadcast(
                                        batch_id,
                                        "item_update",
                                        {
                                            "item_id": str(item_id),
                                            "status": item.status.value,
                                            "detail": item.detail,
                                        },
                                    )
                                elif p_type == "result":
                                    final_data = payload_obj.get("data")
                                    final_manifest = payload_obj.get("manifest_data")
                                elif p_type == "error":
                                    if payload_obj.get("manifest_data"):
                                        final_manifest = payload_obj.get("manifest_data")
                                    raise RuntimeError(payload_obj.get("message", "Pipeline error"))
                            except json.JSONDecodeError:
                                pass

            # Save pipeline outputs to DB
            item.detail = "Saving pipeline observations..."
            await save_pipeline_results_to_db(session, report_id, final_data, final_manifest)

            # 5. Success
            item.status = BatchItemStatus.SUCCESS
            item.detail = "Completed successfully"
            item.completed_at = datetime.now(timezone.utc)
            item.error_message = None

            # Increment batch completed_files
            await session.execute(
                update(BatchJob)
                .where(BatchJob.batch_id == batch_id)
                .values(completed_files=BatchJob.completed_files + 1)
            )
            await session.commit()

            # Broadcast success
            await broadcaster.broadcast(
                batch_id,
                "item_update",
                {
                    "item_id": str(item_id),
                    "status": item.status.value,
                    "detail": item.detail,
                    "report_id": str(report_id),
                    "is_protected": item.is_protected,
                    "completed_at": item.completed_at.isoformat(),
                },
            )

        except Exception as exc:
            logger.error(f"Error processing batch item {item_id} ({item.original_filename}): {exc}", exc_info=True)
            # Rollback report if created
            if report_id:
                try:
                    await report_service.delete_report(session, report_id, created_by or uuid.uuid4())
                except Exception as rollback_err:
                    logger.warning(f"Failed to delete partial report {report_id}: {rollback_err}")

            if CANCEL_FLAGS.get(batch_id):
                # If batch was cancelled, delete the queued in-flight item and staged file
                if item.stored_file_path and (item.stored_file_path.startswith("raw_batches/") or source_type == BatchSourceType.UPLOAD):
                    try:
                        delete_file(item.stored_file_path)
                    except Exception:
                        pass
                await session.delete(item)
                await session.commit()
                return

            item.status = BatchItemStatus.FAILED
            item.error_message = str(exc)
            item.detail = f"Failed: {str(exc)[:200]}"
            item.completed_at = datetime.now(timezone.utc)

            # Increment batch failed_files
            await session.execute(
                update(BatchJob)
                .where(BatchJob.batch_id == batch_id)
                .values(failed_files=BatchJob.failed_files + 1)
            )
            await session.commit()

            await broadcaster.broadcast(
                batch_id,
                "item_update",
                {
                    "item_id": str(item_id),
                    "status": item.status.value,
                    "detail": item.detail,
                    "error_message": item.error_message,
                    "completed_at": item.completed_at.isoformat(),
                },
            )


# ---------------------------------------------------------------------------
# Background Worker: Full Batch Loop
# ---------------------------------------------------------------------------

async def batch_worker(batch_id: uuid.UUID):
    """
    Main background worker loop for a batch.
    Processes items with concurrency bound, updates DB status, broadcasts events.
    """
    logger.info(f"Starting batch worker for batch_id={batch_id}")
    PAUSE_FLAGS[batch_id] = False
    CANCEL_FLAGS[batch_id] = False

    try:
        async with AsyncSessionLocal() as session:
            batch_res = await session.execute(select(BatchJob).where(BatchJob.batch_id == batch_id))
            batch = batch_res.scalar_one_or_none()
            if not batch:
                logger.error(f"Batch {batch_id} not found")
                return

            if batch.status in (BatchStatus.COMPLETED, BatchStatus.CANCELLED):
                logger.info(f"Batch {batch_id} is already {batch.status.value}, skipping.")
                return

            batch.status = BatchStatus.RUNNING
            if not batch.started_at:
                batch.started_at = datetime.now(timezone.utc)
            await session.commit()

            concurrency = max(1, min(batch.concurrency or 4, 32))
            created_by = batch.created_by
            agency_id = batch.agency_id
            source_type = batch.source_type
            server_path = batch.server_path
            password_map = batch.password_map or {}
            bulk_passwords = batch.bulk_passwords or []

            await broadcaster.broadcast(
                batch_id,
                "batch_update",
                {
                    "batch_id": str(batch_id),
                    "status": BatchStatus.RUNNING.value,
                    "started_at": batch.started_at.isoformat() if batch.started_at else None,
                },
            )

        semaphore = asyncio.Semaphore(concurrency)

        async def worker_wrapper(item_id: uuid.UUID):
            async with semaphore:
                if CANCEL_FLAGS.get(batch_id) or PAUSE_FLAGS.get(batch_id):
                    return
                await process_batch_item(
                    batch_id=batch_id,
                    item_id=item_id,
                    created_by=created_by,
                    agency_id=agency_id,
                    source_type=source_type,
                    server_path=server_path,
                    password_map=password_map,
                    bulk_passwords=bulk_passwords,
                )

        while True:
            # Check pause / cancel
            if CANCEL_FLAGS.get(batch_id):
                break
            if PAUSE_FLAGS.get(batch_id):
                break

            # Fetch next batch of pending items
            async with AsyncSessionLocal() as session:
                items_res = await session.execute(
                    select(BatchItem.item_id)
                    .where(BatchItem.batch_id == batch_id)
                    .where(BatchItem.status.in_([BatchItemStatus.PENDING, BatchItemStatus.UPLOADING]))
                    .limit(concurrency * 2)
                )
                pending_item_ids = [row[0] for row in items_res.fetchall()]

            if not pending_item_ids:
                # All items finished
                break

            tasks = [asyncio.create_task(worker_wrapper(iid)) for iid in pending_item_ids]
            await asyncio.gather(*tasks, return_exceptions=True)

        # Finalize batch status
        async with AsyncSessionLocal() as session:
            batch_res = await session.execute(
                select(BatchJob)
                .options(selectinload(BatchJob.items))
                .where(BatchJob.batch_id == batch_id)
            )
            batch = batch_res.scalar_one_or_none()
            if not batch:
                return

            if CANCEL_FLAGS.get(batch_id):
                batch.status = BatchStatus.CANCELLED
                batch.total_files = (batch.completed_files or 0) + (batch.failed_files or 0)
                if not batch.completed_at:
                    batch.completed_at = datetime.now(timezone.utc)
            elif PAUSE_FLAGS.get(batch_id):
                batch.status = BatchStatus.PAUSED
            else:
                # Verify all items
                has_pending = any(item.status == BatchItemStatus.PENDING for item in batch.items)
                if has_pending:
                    batch.status = BatchStatus.PAUSED
                elif batch.completed_files == 0 and batch.failed_files > 0:
                    batch.status = BatchStatus.FAILED
                else:
                    batch.status = BatchStatus.COMPLETED
                batch.completed_at = datetime.now(timezone.utc)

            await session.commit()

            await broadcaster.broadcast(
                batch_id,
                "batch_update",
                {
                    "batch_id": str(batch_id),
                    "status": batch.status.value,
                    "completed_files": batch.completed_files,
                    "failed_files": batch.failed_files,
                    "total_files": batch.total_files,
                    "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
                },
            )
            logger.info(f"Batch worker finished for batch_id={batch_id} with status={batch.status.value}")

    except Exception as e:
        logger.error(f"Fatal error in batch worker for batch {batch_id}: {e}", exc_info=True)
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(BatchJob)
                .where(BatchJob.batch_id == batch_id)
                .values(
                    status=BatchStatus.FAILED,
                    error_message=f"Fatal worker exception: {str(e)}",
                    completed_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()
    finally:
        ACTIVE_WORKERS.pop(batch_id, None)
        PAUSE_FLAGS.pop(batch_id, None)
        CANCEL_FLAGS.pop(batch_id, None)


def start_batch_worker(batch_id: uuid.UUID) -> asyncio.Task:
    """Spawns batch worker in background if not already active."""
    existing_task = ACTIVE_WORKERS.get(batch_id)
    if existing_task and not existing_task.done():
        return existing_task

    task = asyncio.create_task(batch_worker(batch_id))
    ACTIVE_WORKERS[batch_id] = task
    return task


# ---------------------------------------------------------------------------
# Batch Creation APIs
# ---------------------------------------------------------------------------

async def create_server_path_batch(
    db: AsyncSession,
    user_id: uuid.UUID,
    server_path: str,
    name: Optional[str] = None,
    agency_id: Optional[uuid.UUID] = None,
    concurrency: int = 4,
    password_map: Optional[dict] = None,
    bulk_passwords: Optional[list] = None,
) -> BatchJob:
    """Creates a batch from an existing directory on the server filesystem."""
    clean_path = os.path.abspath(server_path.strip().strip('"').strip("'"))
    if not os.path.exists(clean_path) or not os.path.isdir(clean_path):
        raise ValueError(f"Directory does not exist or is not accessible: {clean_path}")

    # Scan files
    valid_exts = {".pdf", ".docx", ".doc"}
    matched_files = []
    extracted_passwords = list(bulk_passwords or [])

    for root, _, files in os.walk(clean_path):
        for f in sorted(files):
            if f.startswith("."):
                continue
            ext = os.path.splitext(f)[1].lower()
            full_p = os.path.join(root, f)
            if ext in valid_exts:
                matched_files.append((f, full_p))
            elif ext == ".txt":
                # Check for password txt file
                try:
                    with open(full_p, "r", encoding="utf-8", errors="ignore") as txt_f:
                        for line in txt_f:
                            line_s = line.strip()
                            if line_s and line_s not in extracted_passwords:
                                extracted_passwords.append(line_s)
                except Exception:
                    pass

    if not matched_files:
        raise ValueError(f"No valid reports (.pdf, .docx, .doc) found in directory: {clean_path}")

    batch_name = name or os.path.basename(clean_path.rstrip("/\\")) or f"Batch {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    batch = BatchJob(
        name=batch_name,
        created_by=user_id,
        agency_id=agency_id,
        status=BatchStatus.PENDING,
        total_files=len(matched_files),
        completed_files=0,
        failed_files=0,
        concurrency=max(1, min(concurrency, 32)),
        password_map=password_map or {},
        bulk_passwords=extracted_passwords,
        source_type=BatchSourceType.SERVER_PATH,
        server_path=clean_path,
    )
    db.add(batch)
    await db.flush()

    for filename, filepath in matched_files:
        item = BatchItem(
            batch_id=batch.batch_id,
            original_filename=filename,
            stored_file_path=filepath,
            status=BatchItemStatus.PENDING,
            detail="Queued",
        )
        db.add(item)

    await db.commit()
    await db.refresh(batch)

    # Spawn worker
    start_batch_worker(batch.batch_id)
    return batch


async def create_upload_batch(
    db: AsyncSession,
    user_id: uuid.UUID,
    files: List[Tuple[str, bytes]],
    name: Optional[str] = None,
    agency_id: Optional[uuid.UUID] = None,
    concurrency: int = 4,
    password_map: Optional[dict] = None,
    bulk_passwords: Optional[list] = None,
) -> BatchJob:
    """Creates a batch from uploaded file binaries stored in SeaweedFS staging."""
    valid_files = []
    for filename, file_bytes in files:
        ext_valid, _ = validate_extension(filename)
        if ext_valid and file_bytes:
            valid_files.append((filename, file_bytes))

    if not valid_files:
        raise ValueError("No valid report files provided in upload")

    batch_id = uuid.uuid4()
    batch_name = name or f"Upload Batch ({len(valid_files)} files)"

    batch = BatchJob(
        batch_id=batch_id,
        name=batch_name,
        created_by=user_id,
        agency_id=agency_id,
        status=BatchStatus.PENDING,
        total_files=len(valid_files),
        completed_files=0,
        failed_files=0,
        concurrency=max(1, min(concurrency, 32)),
        password_map=password_map or {},
        bulk_passwords=bulk_passwords or [],
        source_type=BatchSourceType.UPLOAD,
        server_path=None,
    )
    db.add(batch)
    await db.flush()

    # Upload raw staging files to SeaweedFS
    for filename, file_bytes in valid_files:
        staging_path = f"raw_batches/{batch_id}/{filename}"
        try:
            upload_file(staging_path, file_bytes)
        except Exception as e:
            logger.error(f"Failed to stage uploaded file {filename}: {e}")
            raise ValueError(f"Failed to stage file {filename} in storage: {e}")

        item = BatchItem(
            batch_id=batch.batch_id,
            original_filename=filename,
            stored_file_path=staging_path,
            status=BatchItemStatus.PENDING,
            detail="Queued",
        )
        db.add(item)

    await db.commit()
    await db.refresh(batch)

    # Spawn worker
    start_batch_worker(batch.batch_id)
    return batch


async def create_zip_batch(
    db: AsyncSession,
    user_id: uuid.UUID,
    zip_bytes: bytes,
    zip_filename: str,
    name: Optional[str] = None,
    agency_id: Optional[uuid.UUID] = None,
    concurrency: int = 4,
    password_map: Optional[dict] = None,
    bulk_passwords: Optional[list] = None,
) -> BatchJob:
    """
    Creates a batch from an uploaded ZIP archive.
    Extracts nested directories, harvests passwords from .txt/.csv and credential .docx files,
    pre-emptively decrypts protected reports, stages them into SeaweedFS, and launches background processing.
    """
    from app.services.zip_service import analyze_and_extract_zip

    reports, extracted_map, extracted_pwds = analyze_and_extract_zip(
        zip_bytes,
        user_password_map=password_map,
        user_bulk_passwords=bulk_passwords,
    )

    if not reports:
        raise ValueError("No valid report files (.pdf, .docx, .doc) found in the ZIP archive.")

    batch_id = uuid.uuid4()
    base_zip_name = os.path.splitext(os.path.basename(zip_filename))[0]
    batch_name = name or f"ZIP: {base_zip_name} ({len(reports)} files)"

    # Combine passwords for recordkeeping & fallback
    merged_password_map = dict(password_map or {})
    merged_password_map.update(extracted_map)

    merged_bulk_passwords = list(bulk_passwords or [])
    for p in extracted_pwds:
        if p and p not in merged_bulk_passwords:
            merged_bulk_passwords.append(p)

    batch = BatchJob(
        batch_id=batch_id,
        name=batch_name,
        created_by=user_id,
        agency_id=agency_id,
        status=BatchStatus.PENDING,
        total_files=len(reports),
        completed_files=0,
        failed_files=0,
        concurrency=max(1, min(concurrency, 32)),
        password_map=merged_password_map,
        bulk_passwords=merged_bulk_passwords,
        source_type=BatchSourceType.UPLOAD,
        server_path=None,
    )
    db.add(batch)
    await db.flush()

    for r in reports:
        item_id = uuid.uuid4()
        safe_item_name = os.path.basename(r.relative_path)
        staging_path = f"raw_batches/{batch_id}/{item_id}_{safe_item_name}"
        try:
            upload_file(staging_path, r.file_bytes)
        except Exception as e:
            logger.error(f"Failed to stage extracted report {r.relative_path}: {e}")
            raise ValueError(f"Failed to stage file {r.relative_path} in storage: {e}")

        item = BatchItem(
            item_id=item_id,
            batch_id=batch.batch_id,
            original_filename=r.relative_path,
            stored_file_path=staging_path,
            status=BatchItemStatus.PENDING,
            is_protected=r.protection_status,
            detail="Queued from ZIP",
        )
        db.add(item)

    await db.commit()
    await db.refresh(batch)

    # Spawn worker
    start_batch_worker(batch.batch_id)
    return batch



# ---------------------------------------------------------------------------
# Batch Management APIs
# ---------------------------------------------------------------------------

async def list_batches(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    agency_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[BatchJob], int]:
    """Lists batches with pagination, filters, and total count."""
    stmt = select(BatchJob).order_by(BatchJob.created_at.desc())
    count_stmt = select(func.count(BatchJob.batch_id))

    if user_id:
        stmt = stmt.where(BatchJob.created_by == user_id)
        count_stmt = count_stmt.where(BatchJob.created_by == user_id)
    if agency_id:
        stmt = stmt.where(BatchJob.agency_id == agency_id)
        count_stmt = count_stmt.where(BatchJob.agency_id == agency_id)
    if status:
        status_list = [s.strip().upper() for s in status.split(",") if s.strip()]
        if status_list:
            stmt = stmt.where(BatchJob.status.in_(status_list))
            count_stmt = count_stmt.where(BatchJob.status.in_(status_list))

    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    batches = res.scalars().all()

    return list(batches), total


async def get_batch_by_id(
    db: AsyncSession,
    batch_id: uuid.UUID,
    load_items: bool = True,
) -> Optional[BatchJob]:
    """Retrieves batch details and optionally items."""
    stmt = select(BatchJob).where(BatchJob.batch_id == batch_id)
    if load_items:
        stmt = stmt.options(selectinload(BatchJob.items))
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def pause_batch(batch_id: uuid.UUID) -> bool:
    """Signals worker to pause and updates batch status to PAUSED."""
    PAUSE_FLAGS[batch_id] = True
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(BatchJob)
            .where(BatchJob.batch_id == batch_id)
            .values(status=BatchStatus.PAUSED)
        )
        await session.commit()
    await broadcaster.broadcast(
        batch_id,
        "batch_update",
        {"batch_id": str(batch_id), "status": BatchStatus.PAUSED.value},
    )
    return True


async def resume_batch(batch_id: uuid.UUID) -> bool:
    """Clears pause flag, sets status to RUNNING, and restarts worker. Fails if cancelled."""
    async with AsyncSessionLocal() as session:
        batch_res = await session.execute(
            select(BatchJob).where(BatchJob.batch_id == batch_id)
        )
        batch = batch_res.scalar_one_or_none()
        if not batch:
            raise ValueError("Batch not found")
        if batch.status == BatchStatus.CANCELLED:
            raise ValueError("A cancelled batch cannot be resumed.")
        if batch.status == BatchStatus.COMPLETED:
            raise ValueError("A completed batch cannot be resumed.")

        PAUSE_FLAGS[batch_id] = False
        CANCEL_FLAGS[batch_id] = False
        batch.status = BatchStatus.RUNNING
        await session.commit()

    start_batch_worker(batch_id)
    await broadcaster.broadcast(
        batch_id,
        "batch_update",
        {"batch_id": str(batch_id), "status": BatchStatus.RUNNING.value},
    )
    return True


async def cancel_batch(batch_id: uuid.UUID) -> bool:
    """
    Cancels a batch:
    1. Sets CANCEL_FLAGS[batch_id] = True to stop worker.
    2. Identifies all items that were only queued (not processed into a report).
    3. Deletes raw staging files from SeaweedFS for those queued items.
    4. Deletes those queued item records from the database.
    5. Updates batch.total_files to reflect only processed items (completed + failed).
    6. Marks batch status as CANCELLED.
    """
    CANCEL_FLAGS[batch_id] = True

    async with AsyncSessionLocal() as session:
        batch_res = await session.execute(
            select(BatchJob).where(BatchJob.batch_id == batch_id)
        )
        batch = batch_res.scalar_one_or_none()
        if not batch:
            logger.warning(f"cancel_batch: Batch {batch_id} not found")
            return False

        if batch.status == BatchStatus.CANCELLED:
            logger.info(f"cancel_batch: Batch {batch_id} already cancelled")
            return True

        # Find all queued, unprocessed items (report_id is None and not SUCCESS/FAILED)
        unprocessed_items_res = await session.execute(
            select(BatchItem)
            .where(BatchItem.batch_id == batch_id)
            .where(BatchItem.report_id.is_(None))
            .where(
                BatchItem.status.in_([
                    BatchItemStatus.PENDING,
                    BatchItemStatus.UPLOADING,
                    BatchItemStatus.SKIPPED,
                ])
            )
        )
        unprocessed_items = unprocessed_items_res.scalars().all()
        unprocessed_ids = [item.item_id for item in unprocessed_items]

        logger.info(
            f"Cancelling batch {batch_id}: deleting {len(unprocessed_items)} queued unprocessed files and records."
        )

        # Delete staged raw files from SeaweedFS
        for item in unprocessed_items:
            file_path = item.stored_file_path
            if file_path and (file_path.startswith("raw_batches/") or batch.source_type == BatchSourceType.UPLOAD):
                try:
                    deleted = delete_file(file_path)
                    logger.info(f"Deleted staged raw file '{file_path}' from SeaweedFS: {deleted}")
                except Exception as e:
                    logger.warning(f"Failed to delete staged raw file '{file_path}': {e}")

        # Delete the queued items from DB
        if unprocessed_ids:
            await session.execute(
                delete(BatchItem).where(BatchItem.item_id.in_(unprocessed_ids))
            )

        # If batch source was UPLOAD, check if any items remain; if 0, delete the staging dir
        if batch.source_type == BatchSourceType.UPLOAD:
            remaining_res = await session.execute(
                select(func.count(BatchItem.item_id)).where(BatchItem.batch_id == batch_id)
            )
            remaining_count = remaining_res.scalar() or 0
            if remaining_count == 0:
                try:
                    delete_dir(f"raw_batches/{batch_id}")
                    logger.info(f"Deleted empty raw staging dir raw_batches/{batch_id}")
                except Exception as e:
                    logger.warning(f"Failed to delete staging dir raw_batches/{batch_id}: {e}")

        # Update batch counts and status: total_files now strictly matches processed files
        batch.total_files = (batch.completed_files or 0) + (batch.failed_files or 0)
        batch.status = BatchStatus.CANCELLED
        batch.completed_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(batch)

    await broadcaster.broadcast(
        batch_id,
        "batch_update",
        {
            "batch_id": str(batch_id),
            "status": BatchStatus.CANCELLED.value,
            "total_files": batch.total_files,
            "completed_files": batch.completed_files,
            "failed_files": batch.failed_files,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
            "deleted_queued_count": len(unprocessed_ids),
        },
    )
    return True


async def retry_failed_items(batch_id: uuid.UUID) -> bool:
    """Resets all FAILED items to PENDING and restarts the batch worker. Fails if cancelled."""
    async with AsyncSessionLocal() as session:
        batch_res = await session.execute(select(BatchJob).where(BatchJob.batch_id == batch_id))
        batch = batch_res.scalar_one_or_none()
        if not batch:
            raise ValueError("Batch not found")
        if batch.status == BatchStatus.CANCELLED:
            raise ValueError("A cancelled batch cannot be retried or resumed.")

        # Reset failed items to PENDING
        items_res = await session.execute(
            select(BatchItem)
            .where(BatchItem.batch_id == batch_id)
            .where(BatchItem.status == BatchItemStatus.FAILED)
        )
        failed_items = items_res.scalars().all()
        if not failed_items:
            return False

        for item in failed_items:
            item.status = BatchItemStatus.PENDING
            item.detail = "Queued for retry"
            item.retry_count += 1
            item.error_message = None

        # Re-adjust failed_files count
        batch.failed_files = max(0, batch.failed_files - len(failed_items))
        batch.status = BatchStatus.RUNNING
        batch.completed_at = None

        await session.commit()

    start_batch_worker(batch_id)
    await broadcaster.broadcast(
        batch_id,
        "batch_update",
        {
            "batch_id": str(batch_id),
            "status": BatchStatus.RUNNING.value,
            "retried_count": len(failed_items),
        },
    )
    return True


async def delete_batch(db: AsyncSession, batch_id: uuid.UUID) -> bool:
    """
    Deletes a batch job and its items.
    Enforces rule: A batch CANNOT be deleted if one or more files have succeeded!
    """
    batch = await get_batch_by_id(db, batch_id, load_items=True)
    if not batch:
        raise ValueError("Batch not found")

    if batch.status == BatchStatus.RUNNING:
        raise ValueError("Cannot delete an actively running batch. Pause or cancel it first.")

    # Rule: A batch cannot be deleted if one or more files have succeeded
    has_success_item = any(
        item.status == BatchItemStatus.SUCCESS or item.report_id is not None
        for item in (batch.items or [])
    )
    if (batch.completed_files or 0) > 0 or has_success_item:
        raise ValueError(
            "Batch cannot be deleted because one or more files have succeeded. "
            "Delete the individual reports first if you wish to remove this batch."
        )

    # Cross-check if any reports in the reports table link to this batch
    linked_reports_res = await db.execute(
        select(func.count(Report.report_id)).where(Report.batch_id == batch_id)
    )
    linked_reports_count = linked_reports_res.scalar() or 0
    if linked_reports_count > 0:
        raise ValueError(
            "Batch cannot be deleted because one or more files have succeeded. "
            "Delete the individual reports first if you wish to remove this batch."
        )

    # Stop any in-memory worker reference
    ACTIVE_WORKERS.pop(batch_id, None)
    PAUSE_FLAGS.pop(batch_id, None)
    CANCEL_FLAGS[batch_id] = True

    # Delete staged files from SeaweedFS if any
    try:
        delete_dir(f"raw_batches/{batch_id}")
    except Exception as e:
        logger.warning(f"Failed to delete SeaweedFS staging dir for batch {batch_id}: {e}")

    # Delete batch from database (cascade deletes BatchItems)
    await db.delete(batch)
    await db.commit()

    return True


# ---------------------------------------------------------------------------
# Server Startup Resilience Hook
# ---------------------------------------------------------------------------

async def resume_interrupted_batches():
    """Called on server lifespan startup to automatically resume interrupted batches."""
    logger.info("Checking for interrupted batch jobs to resume...")
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(
                select(BatchJob.batch_id)
                .where(BatchJob.status.in_([BatchStatus.RUNNING, BatchStatus.PENDING]))
            )
            interrupted_ids = [row[0] for row in res.fetchall()]

        if interrupted_ids:
            logger.info(f"Found {len(interrupted_ids)} active batches to resume: {interrupted_ids}")
            for bid in interrupted_ids:
                start_batch_worker(bid)
        else:
            logger.info("No interrupted batches found.")
    except Exception as e:
        logger.error(f"Error resuming interrupted batches on startup: {e}", exc_info=True)
