import uuid
import os

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.user import User
from app.schemas.report import ReportOut, ReportListOut, UploadResponse
from app.services import report_service, audit_service
from app.config import settings

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_report(
    file: UploadFile = File(...),
    agency_id: uuid.UUID = Form(None),
    file_password: str = Form(None),
    bulk_passwords: str = Form(None),
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    """Upload a report file (PDF, DOCX, or TXT)."""
    # Check file size
    file_bytes = await file.read()
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB",
        )

    import json
    passwords_to_try = []
    if file_password:
        passwords_to_try.append(file_password)
    if bulk_passwords:
        try:
            parsed = json.loads(bulk_passwords)
            if isinstance(parsed, list):
                passwords_to_try.extend(parsed)
        except Exception:
            pass

    # Check password protection
    from app.utils.file_utils import validate_extension
    from app.utils.encryption_utils import is_pdf_encrypted, decrypt_pdf, is_docx_encrypted, decrypt_docx
    
    ext_valid, extension = validate_extension(file.filename)
    is_decrypted = False
    if ext_valid:
        if extension == '.pdf':
            if is_pdf_encrypted(file_bytes):
                if not passwords_to_try:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PASSWORD_REQUIRED")
                
                decrypted = False
                for pwd in passwords_to_try:
                    try:
                        file_bytes = decrypt_pdf(file_bytes, pwd)
                        decrypted = True
                        break
                    except Exception:
                        continue
                if not decrypted:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_PASSWORD")
                is_decrypted = True
        elif extension == '.docx':
            if is_docx_encrypted(file_bytes):
                if not passwords_to_try:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PASSWORD_REQUIRED")
                
                decrypted = False
                for pwd in passwords_to_try:
                    try:
                        file_bytes = decrypt_docx(file_bytes, pwd)
                        decrypted = True
                        break
                    except Exception:
                        continue
                if not decrypted:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_PASSWORD")
                is_decrypted = True

    try:
        result = await report_service.upload_report(
            db, file_bytes, file.filename, current_user.user_id, agency_id
        )
        if isinstance(result, dict):
            result['decrypted'] = is_decrypted
        return UploadResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload processing failed: {str(e)}"
        )


from pydantic import BaseModel
from typing import List, Optional

class LocalFolderRequest(BaseModel):
    folder_path: str

class LocalFolderResponse(BaseModel):
    files: List[str]

class LocalUploadRequest(BaseModel):
    file_path: str
    agency_id: Optional[uuid.UUID] = None
    file_password: Optional[str] = None
    bulk_passwords: Optional[str] = None

@router.post("/list-local-folder", response_model=LocalFolderResponse)
async def list_local_folder(
    req: LocalFolderRequest,
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
):
    """List allowed files in a server local directory."""
    path = req.folder_path
    if not os.path.exists(path) or not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Folder does not exist on server")
    
    allowed_exts = {".pdf", ".docx", ".doc", ".txt"}
    files = []
    try:
        for f in os.listdir(path):
            full_path = os.path.join(path, f)
            if os.path.isfile(full_path):
                ext = os.path.splitext(f)[1].lower()
                if ext in allowed_exts:
                    files.append(full_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"files": files}

@router.post("/upload-local", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_local_file(
    req: LocalUploadRequest,
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    """Process a local file on the server as if it were uploaded."""
    path = req.file_path
    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=400, detail="File does not exist on server")
    
    import asyncio
    def _read_file():
        with open(path, "rb") as f:
            return f.read()
    
    file_bytes = await asyncio.to_thread(_read_file)
    await asyncio.sleep(0.05) # Yield to allow concurrent requests to interleave

    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB",
        )

    import json
    passwords_to_try = []
    if req.file_password:
        passwords_to_try.append(req.file_password)
    if req.bulk_passwords:
        try:
            parsed = json.loads(req.bulk_passwords)
            if isinstance(parsed, list):
                passwords_to_try.extend(parsed)
        except Exception:
            pass

    from app.utils.file_utils import validate_extension
    from app.utils.encryption_utils import is_pdf_encrypted, decrypt_pdf, is_docx_encrypted, decrypt_docx
    
    filename = os.path.basename(path)
    ext_valid, extension = validate_extension(filename)
    is_decrypted = False
    if ext_valid:
        if extension == '.pdf':
            if is_pdf_encrypted(file_bytes):
                if not passwords_to_try:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PASSWORD_REQUIRED")
                
                decrypted = False
                for pwd in passwords_to_try:
                    try:
                        file_bytes = decrypt_pdf(file_bytes, pwd)
                        decrypted = True
                        break
                    except Exception:
                        continue
                if not decrypted:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_PASSWORD")
                is_decrypted = True
        elif extension == '.docx':
            if is_docx_encrypted(file_bytes):
                if not passwords_to_try:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PASSWORD_REQUIRED")
                
                decrypted = False
                for pwd in passwords_to_try:
                    try:
                        file_bytes = decrypt_docx(file_bytes, pwd)
                        decrypted = True
                        break
                    except Exception:
                        continue
                if not decrypted:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_PASSWORD")
                is_decrypted = True

    try:
        result = await report_service.upload_report(
            db, file_bytes, filename, current_user.user_id, req.agency_id
        )
        if isinstance(result, dict):
            result['decrypted'] = is_decrypted
        return UploadResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload processing failed: {str(e)}")


@router.post("/decrypt-file")
async def decrypt_file_endpoint(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    bulk_passwords: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    Pre-flight decrypt an encrypted report file.
    Returns the plaintext decrypted file bytes directly.
    If the file is not encrypted, returns original bytes.
    """
    contents = await file.read()
    from app.utils.file_utils import validate_extension
    ext_valid, extension = validate_extension(file.filename)
    if not ext_valid:
        raise HTTPException(status_code=400, detail="Invalid file format")

    passwords_to_try = []
    if password:
        passwords_to_try.append(password)
    if bulk_passwords:
        try:
            parsed = json.loads(bulk_passwords)
            if isinstance(parsed, list):
                for p in parsed:
                    if p and p not in passwords_to_try:
                        passwords_to_try.append(str(p))
        except Exception:
            pass

    from app.utils.encryption_utils import is_pdf_encrypted, decrypt_pdf, is_docx_encrypted, decrypt_docx
    from fastapi.responses import Response

    if extension == ".pdf":
        if is_pdf_encrypted(contents):
            if not passwords_to_try:
                raise HTTPException(status_code=400, detail="PASSWORD_REQUIRED")
            decrypted = False
            for pwd in passwords_to_try:
                try:
                    contents = decrypt_pdf(contents, pwd)
                    decrypted = True
                    break
                except Exception:
                    continue
            if not decrypted:
                raise HTTPException(status_code=400, detail="INVALID_PASSWORD")
        return Response(content=contents, media_type="application/pdf")

    elif extension in (".docx", ".doc"):
        if is_docx_encrypted(contents):
            if not passwords_to_try:
                raise HTTPException(status_code=400, detail="PASSWORD_REQUIRED")
            decrypted = False
            for pwd in passwords_to_try:
                try:
                    contents = decrypt_docx(contents, pwd)
                    decrypted = True
                    break
                except Exception:
                    continue
            if not decrypted:
                raise HTTPException(status_code=400, detail="INVALID_PASSWORD")
        return Response(content=contents, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    return Response(content=contents, media_type="application/octet-stream")


@router.get("", response_model=ReportListOut)
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(None, max_length=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reports with optional search."""
    reports, total = await report_service.get_reports(
        db, skip=skip, limit=limit, search=search
    )
    return ReportListOut(
        reports=[ReportOut.from_orm_with_uploader(r) for r in reports],
        total=total,
    )


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single report with metadata."""
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return ReportOut.from_orm_with_uploader(report)


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a report file."""
    from fastapi.responses import Response
    from app.utils.seaweedfs_utils import get_file_bytes

    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    if not report.storage or not report.storage.encrypted_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File storage record not found",
        )

    object_name = report.storage.encrypted_file_path
    try:
        encrypted_data = get_file_bytes(object_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found in storage: {e}",
        )

    # Decrypt if needed
    if report.storage.encryption_algorithm == "Fernet":
        from app.utils.encryption_utils import decrypt_file
        file_data = decrypt_file(encrypted_data)
    else:
        file_data = encrypted_data

    # All stored files are PDF (converted on upload)
    download_filename = report.original_filename
    if not download_filename.lower().endswith(".pdf"):
        # Replace the original extension with .pdf for the download name
        base_name = os.path.splitext(download_filename)[0]
        download_filename = f"{base_name}.pdf"

    await audit_service.create_audit_log(
        db,
        action="REPORT_DOWNLOAD",
        status="SUCCESS",
        user_id=current_user.user_id,
        report_id=report.report_id,
        details={
            "filename": download_filename,
            "original_filename": report.original_filename,
            "file_size": len(file_data),
        },
    )
    await db.commit()

    return Response(
        content=file_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
    )


@router.delete("/{report_id}")
async def delete_report(
    report_id: uuid.UUID,
    current_user: User = Depends(require_roles("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a report."""
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    
    is_admin = any(r.role.role_name == "ADMIN" for r in current_user.roles)
    if not is_admin and report.uploaded_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this report")

    success = await report_service.delete_report(db, report_id, current_user.user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return {"message": "Report deleted successfully"}
