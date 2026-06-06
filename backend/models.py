from __future__ import annotations

from datetime import datetime
from typing import List, TypedDict


class EmployeeDocument(TypedDict, total=False):
    employee_id: str
    name: str
    department: str
    embedding_vector: str
    image_count: int
    created_at: datetime
    updated_at: datetime


class AttendanceDocument(TypedDict, total=False):
    employee_id: str
    name: str
    department: str
    timestamp: datetime
    attendance_date: str
    status: str
    confidence: float


class SettingsDocument(TypedDict, total=False):
    key: str
    confidence_threshold: float
    working_hours_start: str
    working_hours_end: str
    late_after_minutes: int
    departments: List[str]
    updated_at: datetime