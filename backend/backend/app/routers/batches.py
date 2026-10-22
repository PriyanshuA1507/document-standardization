"""
Batch Router
------------
Endpoints for managing server-side batch report processing:
- Creation (Server Path & File Upload)
- Real-time SSE streaming for live progress
- Querying batch list & item details
- Pause, Resume, Cancel, and Retry-Failed
"""

import asyncio
import json
import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.batch import (
    BatchCreateServerPathRequest,
    BatchJobOut,
    BatchJobDetailOut,
    BatchListResponse,
    BatchItemOut,
)
from app.services import batch_service, audit_service

router = APIRouter(prefix="/api/batches", tags=["Batches"])


@router.post("", response_model=BatchJobOut, status_code=status.HTTP_201_CREATED)
async def create_batch_from_server_path(
    req: BatchCreateServerPathRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a server-side batch from a server filesystem directory.
    Scans for valid documents (.pdf, .docx, .doc) and triggers processing.
    """
    try:
        batch = await batch_service.create_server_path_batch(
            db=db,
            user_id=current_user.user_id,
            server_path=req.server_path,
            name=req.name,
            agency_id=req.agency_id,
            concurrency=req.concurrency,
            password_map=req.password_map,
            bulk_passwords=req.bulk_passwords,
        )
        await audit_service.create_audit_log(
            db,
            action="BATCH_CREATE",
            status="SUCCESS",
            user_id=current_user.user_id,
            details={"batch_id": str(batch.batch_id), "name": batch.name, "total_files": batch.total_files, "source": "server_path"},
        )
        await db.commit()
        return BatchJobOut(
            batch_id=batch.batch_id,
            name=batch.name,
            created_by=batch.created_by,
            creator_username=current_user.username,
            agency_id=batch.agency_id,
            agency_name=batch.agency.name if batch.agency else None,
            status=batch.status.value,
            total_files=batch.total_files,
            completed_files=batch.completed_files,
            failed_files=batch.failed_files,
            concurrency=batch.concurrency,
            source_type=batch.source_type.value,
            server_path=batch.server_path,
            error_message=batch.error_message,
            created_at=batch.created_at,
            started_at=batch.started_at,
            completed_at=batch.completed_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create batch: {str(e)}",
        )


@router.post("/upload", response_model=BatchJobOut, status_code=status.HTTP_201_CREATED)
async def create_batch_from_upload(
    files: List[UploadFile] = File(...),
    name: Optional[str] = Form(None),
    agency_id: Optional[uuid.UUID] = Form(None),
    concurrency: int = Form(4),
    password_map: Optional[str] = Form(None),
    bulk_passwords: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a server-side batch from uploaded files.
    Files are stored in staging storage and processed independently in the background.
    """
    parsed_password_map = {}
    if password_map:
        try:
            parsed_password_map = json.loads(password_map)
        except Exception:
            pass

    parsed_bulk_passwords = []
    if bulk_passwords:
        try:
            parsed_bulk_passwords = json.loads(bulk_passwords)
        except Exception:
            pass

    file_tuples = []
    for f in files:
        contents = await f.read()
        file_tuples.append((f.filename, contents))

    try:
        batch = await batch_service.create_upload_batch(
            db=db,
            user_id=current_user.user_id,
            files=file_tuples,
            name=name,
            agency_id=agency_id,
            concurrency=concurrency,
            password_map=parsed_password_map,
            bulk_passwords=parsed_bulk_passwords,
        )
        await audit_service.create_audit_log(
            db,
            action="BATCH_CREATE",
            status="SUCCESS",
            user_id=current_user.user_id,
            details={"batch_id": str(batch.batch_id), "name": batch.name, "total_files": batch.total_files, "source": "upload"},
        )
        await db.commit()
        return BatchJobOut(
            batch_id=batch.batch_id,
            name=batch.name,
            created_by=batch.created_by,
            creator_username=current_user.username,
            agency_id=batch.agency_id,
            agency_name=batch.agency.name if batch.agency else None,
            status=batch.status.value,
            total_files=batch.total_files,
            completed_files=batch.completed_files,
            failed_files=batch.failed_files,
            concurrency=batch.concurrency,
            source_type=batch.source_type.value,
            server_path=batch.server_path,
            error_message=batch.error_message,
            created_at=batch.created_at,
            started_at=batch.started_at,
            completed_at=batch.completed_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create batch: {str(e)}",
        )


@router.post("/upload-zip", response_model=BatchJobOut, status_code=status.HTTP_201_CREATED)
async def create_batch_from_zip_upload(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    agency_id: Optional[uuid.UUID] = Form(None),
    concurrency: int = Form(4),
    password_map: Optional[str] = Form(None),
    bulk_passwords: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a server-side batch by uploading a ZIP archive.
    Extracts nested directories, harvests candidate passwords from .txt, .csv,
    and credential .docx files, pre-emptively decrypts protected reports,
    stages files into SeaweedFS, and launches the background processing worker.
    """
    parsed_password_map = {}
    if password_map:
        try:
            parsed_password_map = json.loads(password_map)
        except Exception:
            pass

    parsed_bulk_passwords = []
    if bulk_passwords:
        try:
            parsed_bulk_passwords = json.loads(bulk_passwords)
        except Exception:
            pass

    zip_bytes = await file.read()
    if not zip_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded ZIP file is empty",
        )

    try:
        batch = await batch_service.create_zip_batch(
            db=db,
            user_id=current_user.user_id,
            zip_bytes=zip_bytes,
            zip_filename=file.filename or "archive.zip",
            name=name,
            agency_id=agency_id,
            concurrency=concurrency,
            password_map=parsed_password_map,
            bulk_passwords=parsed_bulk_passwords,
        )
        return BatchJobOut(
            batch_id=batch.batch_id,
            name=batch.name,
            created_by=batch.created_by,
            creator_username=current_user.username,
            agency_id=batch.agency_id,
            agency_name=batch.agency.name if batch.agency else None,
            status=batch.status.value,
            total_files=batch.total_files,
            completed_files=batch.completed_files,
            failed_files=batch.failed_files,
            concurrency=batch.concurrency,
            source_type=batch.source_type.value,
            server_path=batch.server_path,
            error_message=batch.error_message,
            created_at=batch.created_at,
            started_at=batch.started_at,
            completed_at=batch.completed_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process ZIP batch: {str(e)}",
        )



@router.get("", response_model=BatchListResponse)
async def list_batches(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (comma separated)"),
    agency_id: Optional[uuid.UUID] = Query(None, description="Filter by agency"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List batches with pagination and optional status filter."""
    offset = (page - 1) * page_size
    batches, total = await batch_service.list_batches(
        db=db,
        agency_id=agency_id,
        status=status_filter,
        limit=page_size,
        offset=offset,
    )

    out_list = [
        BatchJobOut(
            batch_id=b.batch_id,
            name=b.name,
            created_by=b.created_by,
            creator_username=b.creator.username if b.creator else None,
            agency_id=b.agency_id,
            agency_name=b.agency.name if b.agency else None,
            status=b.status.value,
            total_files=b.total_files,
            completed_files=b.completed_files,
            failed_files=b.failed_files,
            concurrency=b.concurrency,
            source_type=b.source_type.value,
            server_path=b.server_path,
            error_message=b.error_message,
            created_at=b.created_at,
            started_at=b.started_at,
            completed_at=b.completed_at,
        )
        for b in batches
    ]

    return BatchListResponse(
        batches=out_list,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{batch_id}", response_model=BatchJobDetailOut)
async def get_batch_details(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full batch details including all individual file items."""
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=True)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch job not found",
        )

    items_out = [
        BatchItemOut(
            item_id=item.item_id,
            batch_id=item.batch_id,
            original_filename=item.original_filename,
            status=item.status.value,
            detail=item.detail,
            report_id=item.report_id,
            stored_file_path=item.stored_file_path,
            is_protected=item.is_protected,
            retry_count=item.retry_count,
            error_message=item.error_message,
            created_at=item.created_at,
            started_at=item.started_at,
            completed_at=item.completed_at,
        )
        for item in batch.items
    ]

    return BatchJobDetailOut(
        batch_id=batch.batch_id,
        name=batch.name,
        created_by=batch.created_by,
        creator_username=batch.creator.username if batch.creator else None,
        agency_id=batch.agency_id,
        agency_name=batch.agency.name if batch.agency else None,
        status=batch.status.value,
        total_files=batch.total_files,
        completed_files=batch.completed_files,
        failed_files=batch.failed_files,
        concurrency=batch.concurrency,
        source_type=batch.source_type.value,
        server_path=batch.server_path,
        error_message=batch.error_message,
        created_at=batch.created_at,
        started_at=batch.started_at,
        completed_at=batch.completed_at,
        items=items_out,
    )


@router.get("/{batch_id}/stream")
async def stream_batch_progress(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events (SSE) endpoint for real-time batch progress.
    Streams item updates, detailed logs, and status transitions.
    """
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=True)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch job not found",
        )

    async def event_generator():
        queue = await batch_service.broadcaster.subscribe(batch_id)
        try:
            # 1. Send initial snapshot
            initial_snapshot = {
                "type": "snapshot",
                "batch_id": str(batch.batch_id),
                "status": batch.status.value,
                "total_files": batch.total_files,
                "completed_files": batch.completed_files,
                "failed_files": batch.failed_files,
                "items": [
                    {
                        "item_id": str(item.item_id),
                        "original_filename": item.original_filename,
                        "status": item.status.value,
                        "detail": item.detail,
                        "report_id": str(item.report_id) if item.report_id else None,
                        "is_protected": item.is_protected,
                        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                    }
                    for item in batch.items
                ],
            }
            yield f"event: snapshot\ndata: {json.dumps(initial_snapshot)}\n\n"

            # 2. If already completed/failed/cancelled, close stream after snapshot
            if batch.status in (
                batch_service.BatchStatus.COMPLETED,
                batch_service.BatchStatus.CANCELLED,
            ):
                return

            # 3. Stream live events
            while True:
                msg = await queue.get()
                yield msg

                # Check if this was a completion event
                if '"status": "COMPLETED"' in msg or '"status": "CANCELLED"' in msg or '"status": "FAILED"' in msg:
                    # Give small delay to flush
                    await asyncio.sleep(0.5)
                    break
        except asyncio.CancelledError:
            pass
        finally:
            await batch_service.broadcaster.unsubscribe(batch_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{batch_id}/pause")
async def pause_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause an active batch."""
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=False)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    await batch_service.pause_batch(batch_id)
    return {"message": "Batch paused successfully"}


@router.post("/{batch_id}/resume")
async def resume_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused batch. A cancelled batch cannot be resumed."""
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=False)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    if batch.status == batch_service.BatchStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancelled batch cannot be resumed.",
        )
    if batch.status == batch_service.BatchStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A completed batch cannot be resumed.",
        )
    try:
        await batch_service.resume_batch(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"message": "Batch resumed successfully"}


@router.post("/{batch_id}/cancel")
async def cancel_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a batch, stopping processing and deleting all queued unprocessed files and records."""
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=False)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    await batch_service.cancel_batch(batch_id)
    await audit_service.create_audit_log(
        db,
        action="BATCH_CANCEL",
        status="SUCCESS",
        user_id=current_user.user_id,
        details={"batch_id": str(batch_id), "name": batch.name},
    )
    await db.commit()
    return {"message": "Batch cancelled successfully and queued files deleted"}


@router.post("/{batch_id}/retry-failed")
async def retry_failed_items(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retry all items in a batch that previously failed."""
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=False)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    if batch.status == batch_service.BatchStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancelled batch cannot be retried or resumed.",
        )
    try:
        retried = await batch_service.retry_failed_items(batch_id)
        if not retried:
            return {"message": "No failed items to retry"}
        return {"message": "Failed items re-queued and worker started"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{batch_id}")
async def delete_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a batch job.
    Enforces rule: A batch CANNOT be deleted if one or more files have succeeded.
    """
    batch = await batch_service.get_batch_by_id(db, batch_id, load_items=False)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    is_admin = any(r.role.role_name == "ADMIN" for r in current_user.roles)
    if not is_admin and batch.created_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this batch")

    try:
        await batch_service.delete_batch(db, batch_id)
        await audit_service.create_audit_log(
            db,
            action="BATCH_DELETE",
            status="SUCCESS",
            user_id=current_user.user_id,
            details={"batch_id": str(batch_id), "name": batch.name},
        )
        await db.commit()
        return {"message": "Batch deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete batch: {str(e)}")
