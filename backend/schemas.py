from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class RecognizeRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded image")


class RecognizeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    name: Optional[str] = None
    employee_id: Optional[str] = None
    confidence: Optional[float] = None
    timestamp: datetime
    department: Optional[str] = None
    action: Optional[str] = None          # "check_in" | "check_out"
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None


class RegisterRequest(BaseModel):
    name: str
    employee_id: str
    department: str
    images: List[str]


class RegisterResponse(BaseModel):
    status: str
    message: str
    employee_id: str
    name: str
    department: str
    image_count: int


class AttendanceItem(BaseModel):
    id: str
    employee_id: str
    name: str
    department: str
    timestamp: datetime
    status: str
    confidence: float
    action: Optional[str] = None          # "check_in" | "check_out"
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    work_duration_minutes: Optional[int] = None


class AttendancePage(BaseModel):
    items: List[AttendanceItem]
    page: int
    page_size: int
    total: int
    total_pages: int


class RecentCheckIn(BaseModel):
    name: str
    employee_id: str
    department: str
    status: str
    timestamp: datetime
    confidence: float
    action: Optional[str] = None


class TodayStats(BaseModel):
    total_registered: int
    present: int
    absent: int
    late: int
    checked_out: int = 0
    recent_checkins: List[RecentCheckIn]
    weekly_trend: List[dict] = Field(default_factory=list)


class SettingsResponse(BaseModel):
    confidence_threshold: float
    match_margin: float
    working_hours_start: str
    working_hours_end: str
    late_after_minutes: int
    departments: List[str]


class SettingsUpdate(BaseModel):
    confidence_threshold: float = Field(ge=0.0, le=1.0)
    match_margin: float = Field(default=0.05, ge=0.0, le=1.0)
    working_hours_start: str
    working_hours_end: str
    late_after_minutes: int = Field(ge=0)
    departments: List[str]


class MonthlyAttendanceReportItem(BaseModel):
    employee_id: str
    name: str
    department: str
    total_working_days: int
    present_days: int
    late_days: int
    absent_days: int
    attendance_percentage: float


class MonthlyAttendanceReportSummary(BaseModel):
    total_employees: int
    average_attendance_percentage: float
    perfect_attendance_count: int
    below_75_count: int


class MonthlyAttendanceReportResponse(BaseModel):
    month: int
    year: int
    department: str | None = None
    total_working_days: int
    items: List[MonthlyAttendanceReportItem]
    summary: MonthlyAttendanceReportSummary


class Holiday(BaseModel):
    date: str
    name: str
    holiday_type: str = "public"