from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class BatchCreateServerPathRequest(BaseModel):
    server_path: str = Field(..., description="Absolute path on the server where documents are stored")
    name: Optional[str] = Field(None, description="Optional custom batch name")
    agency_id: Optional[UUID] = Field(None, description="Agency UUID to associate with all reports")
    concurrency: int = Field(4, ge=1, le=32, description="Number of concurrent pipeline workers (1-32)")
    password_map: Optional[Dict[str, str]] = Field(default_factory=dict, description="Mapping of base filename to password")
    bulk_passwords: Optional[List[str]] = Field(default_factory=list, description="List of fallback passwords to attempt")


class BatchItemOut(BaseModel):
    item_id: UUID
    batch_id: UUID
    original_filename: str
    status: str
    detail: str
    report_id: Optional[UUID] = None
    stored_file_path: Optional[str] = None
    is_protected: Optional[str] = "Unknown"
    retry_count: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BatchJobOut(BaseModel):
    batch_id: UUID
    name: Optional[str] = None
    created_by: Optional[UUID] = None
    creator_username: Optional[str] = None
    agency_id: Optional[UUID] = None
    agency_name: Optional[str] = None
    status: str
    total_files: int
    completed_files: int
    failed_files: int
    concurrency: int
    source_type: str
    server_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BatchJobDetailOut(BatchJobOut):
    items: List[BatchItemOut] = []


class BatchListResponse(BaseModel):
    batches: List[BatchJobOut]
    total: int
    page: int
    page_size: int
