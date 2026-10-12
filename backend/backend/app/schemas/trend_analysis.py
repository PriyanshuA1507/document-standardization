import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TrendRunTriggerRequest(BaseModel):
    date_basis: str = Field("effective", description="'strict' for observation_date only, 'effective' for observation_date with report assessment date fallback")
    frequency: str = Field("M", description="'M' for monthly or 'W' for weekly")
    horizon: int = Field(6, ge=1, le=26, description="Forecast horizon steps")
    start_date: Optional[str] = Field(None, description="ISO Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="ISO End date YYYY-MM-DD")
    severities: Optional[List[str]] = Field(None, description="Filter list of severities")
    statuses: Optional[List[str]] = Field(None, description="Filter list of statuses")
    audit_types: Optional[List[str]] = Field(None, description="Filter list of audit types")
    asset_criticalities: Optional[List[str]] = Field(None, description="Filter list of asset criticalities")
    agency_id: Optional[uuid.UUID] = Field(None, description="Agency/tenant scope")


class TrendRunTriggerResponse(BaseModel):
    status: str
    message: str
    run_id: str
    job_status: str
    current_stage: str
    progress_percent: int
    created_at: str


class TrendRunStatusResponse(BaseModel):
    status: str
    data: Dict[str, Any]


class TrendRunResultsResponse(BaseModel):
    status: str
    data: Dict[str, Any]


class TrendSummaryResponse(BaseModel):
    status: str
    data: Dict[str, Any]


class DrilldownResponse(BaseModel):
    status: str
    total: int
    limit: int
    offset: int
    data: List[Dict[str, Any]]

