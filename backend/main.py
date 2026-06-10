from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta, timezone
from collections import defaultdict
from math import ceil
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo import DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database

from database import get_db, init_db
from face_service import (
    average_embeddings,
    compare_embeddings,
    top_k_matches,
    decode_base64_image,
    embedding_from_json,
    embeddings_to_json,
    get_face_embedding,
)
from schemas import (
    AttendanceItem,
    AttendancePage,
    MonthlyAttendanceReportItem,
    MonthlyAttendanceReportResponse,
    MonthlyAttendanceReportSummary,
    RecognizeRequest,
    RecognizeResponse,
    RecentCheckIn,
    RegisterRequest,
    RegisterResponse,
    SettingsResponse,
    SettingsUpdate,
    TodayStats,
    Holiday,
)


app = FastAPI(title="Face Recognition Attendance API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_DEPARTMENTS = ["Engineering", "HR", "Operations", "Security"]
SETTINGS_KEY = "system"

# Minimum minutes between check-in and check-out
MIN_WORK_MINUTES = 30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def local_day_key(moment: datetime | None = None) -> str:
    current = moment or utc_now()
    return current.astimezone().date().isoformat()


def parse_time(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def employees_collection(db: Database) -> Collection[dict[str, Any]]:
    return db["employees"]


def attendance_collection(db: Database) -> Collection[dict[str, Any]]:
    return db["attendance"]


def settings_collection(db: Database) -> Collection[dict[str, Any]]:
    return db["settings"]


def holidays_collection(db: Database) -> Collection[dict[str, Any]]:
    return db["holidays"]


def serialize_settings(settings: dict[str, Any]) -> SettingsResponse:
    return SettingsResponse(
        confidence_threshold=float(settings.get("confidence_threshold", 0.6)),
        match_margin=float(settings.get("match_margin", 0.05)),
        working_hours_start=str(settings.get("working_hours_start", "09:00")),
        working_hours_end=str(settings.get("working_hours_end", "17:00")),
        late_after_minutes=int(settings.get("late_after_minutes", 15)),
        departments=list(settings.get("departments", DEFAULT_DEPARTMENTS)),
    )


def ensure_default_settings(db: Database) -> dict[str, Any]:
    collection = settings_collection(db)
    settings = collection.find_one({"key": SETTINGS_KEY})
    if settings is None:
        settings = {
            "key": SETTINGS_KEY,
            "confidence_threshold": 0.60,
            "match_margin": 0.05,
            "working_hours_start": "09:00",
            "working_hours_end": "17:00",
            "late_after_minutes": 15,
            "departments": DEFAULT_DEPARTMENTS,
            "updated_at": utc_now(),
        }
        collection.insert_one(settings)
    return settings


def is_within_working_hours(moment: datetime, settings: dict[str, Any]) -> tuple[bool, str]:
    """
    Returns (is_allowed, reason_if_not_allowed).
    Checks if the current local time falls within configured working hours.
    """
    working_start = parse_time(str(settings.get("working_hours_start", "09:00")))
    working_end   = parse_time(str(settings.get("working_hours_end",   "17:00")))
    current_time  = moment.astimezone().time().replace(second=0, microsecond=0)

    if working_start <= current_time <= working_end:
        return True, ""

    start_str = datetime.strptime(str(settings.get("working_hours_start", "09:00")), "%H:%M").strftime("%I:%M %p")
    end_str   = datetime.strptime(str(settings.get("working_hours_end",   "17:00")), "%H:%M").strftime("%I:%M %p")

    if current_time < working_start:
        return False, f"Office not open yet. Working hours start at {start_str}."
    return False, f"Working hours ended at {end_str}. Attendance is closed for today."


def determine_status(check_in_time: datetime, settings: dict[str, Any]) -> str:
    working_start = parse_time(str(settings.get("working_hours_start", "09:00")))
    late_cutoff = (
        datetime.combine(check_in_time.astimezone().date(), working_start)
        + timedelta(minutes=int(settings.get("late_after_minutes", 15)))
    ).time()
    return "late" if check_in_time.astimezone().time() > late_cutoff else "present"


def log_attendance(
    db: Database,
    employee: dict[str, Any],
    confidence: float,
    settings: dict[str, Any],
) -> tuple[str, str, datetime]:
    """
    Returns (attendance_status, action, timestamp)
    attendance_status: "present" | "late" | "checked_out" | "duplicate" | "outside_hours" | "checkout_expired"
    action: "check_in" | "check_out" | "duplicate" | "none"

    Check-out window: only allowed between MIN_WORK_MINUTES and CHECKOUT_WINDOW_MINUTES after check-in.
    """
    now = utc_now()
    local_now = now.astimezone()
    current_time = local_now.time()
    day_key = local_day_key(now)
    collection = attendance_collection(db)

    working_start = parse_time(str(settings.get("working_hours_start", "09:00")))
    working_end   = parse_time(str(settings.get("working_hours_end",   "17:00")))

    existing = collection.find_one(
        {"employee_id": employee["employee_id"], "attendance_date": day_key}
    )
    is_pending_checkout = existing and existing.get("action") == "check_in"

    # Block outside working hours unless a checkout is pending
    if not (working_start <= current_time <= working_end) and not is_pending_checkout:
        print(f"⏰ Outside working hours: {current_time} not in {working_start}–{working_end}")
        return "outside_hours", "none", now

    # ── No record yet → CHECK-IN ──────────────────────────────────────────
    if not existing:
        status_value = determine_status(now, settings)
        payload = {
            "employee_id": employee["employee_id"],
            "name": employee["name"],
            "department": employee["department"],
            "timestamp": now,
            "attendance_date": day_key,
            "status": status_value,
            "confidence": float(confidence),
            "action": "check_in",
            "check_in_time": now,
            "check_out_time": None,
            "work_duration_minutes": None,
        }
        collection.insert_one(payload)
        print(f"✅ Check-in: {employee['name']} at {now}")
        return status_value, "check_in", now

    # ── Already has a record ──────────────────────────────────────────────
    last_action = existing.get("action", "check_in")
    check_in_time = existing.get("check_in_time")

    # Already checked out today
    if last_action == "check_out":
        elapsed = now - existing.get("check_out_time", now)
        if elapsed < timedelta(hours=6):
            print(f"⚠️  Already checked out: {employee['name']}")
            return "duplicate", "duplicate", existing.get("check_out_time", now)
        # Re-check-in after 6 hours (next shift)
        if not (working_start <= current_time <= working_end):
            return "outside_hours", "none", now
        status_value = determine_status(now, settings)
        collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "status": status_value,
                "confidence": float(confidence),
                "action": "check_in",
                "check_in_time": now,
                "check_out_time": None,
                "work_duration_minutes": None,
                "timestamp": now,
            }}
        )
        return status_value, "check_in", now

    # ── Checked in → validate checkout window ────────────────────────────
    if last_action == "check_in" and check_in_time:
        elapsed_minutes = (now - check_in_time).total_seconds() / 60

        # Too soon — must wait at least MIN_WORK_MINUTES
        if elapsed_minutes < MIN_WORK_MINUTES:
            remaining = int(MIN_WORK_MINUTES - elapsed_minutes)
            print(f"⚠️  Too soon: {elapsed_minutes:.1f} min elapsed, need {MIN_WORK_MINUTES}")
            return "too_soon", "duplicate", check_in_time

        # ✅ Checkout allowed — record it
        work_duration = int(elapsed_minutes)
        collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "action": "check_out",
                "check_out_time": now,
                "work_duration_minutes": work_duration,
                "confidence": float(confidence),
                "timestamp": now,
            }}
        )
        print(f"✅ Check-out: {employee['name']} — worked {work_duration} min")
        return "checked_out", "check_out", now

    return "duplicate", "duplicate", existing.get("timestamp", now)


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup_event() -> None:
    init_db()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

@app.post("/api/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register_face(payload: RegisterRequest, db: Database = Depends(get_db)) -> RegisterResponse:
    if not payload.images:
        raise HTTPException(status_code=400, detail="At least one face image is required.")

    settings = ensure_default_settings(db)
    departments = list(settings.get("departments", DEFAULT_DEPARTMENTS))
    if payload.department not in departments:
        raise HTTPException(status_code=400, detail="Department is not configured.")

    # Step 1 — Extract embeddings
    embeddings = []
    for i, image_data in enumerate(payload.images):
        try:
            image = decode_base64_image(image_data)
            emb = get_face_embedding(image)
            embeddings.append(emb)
            print(f"✅ Image {i + 1}/{len(payload.images)} embedding extracted")
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Image {i + 1} failed: {str(exc)}",
            ) from exc

    # Step 2 — Validate consistency across angles
    if len(embeddings) >= 2:
        similarities = []
        for j in range(len(embeddings)):
            for k in range(j + 1, len(embeddings)):
                similarities.append(compare_embeddings(embeddings[j], embeddings[k]))
        avg_similarity = sum(similarities) / len(similarities)
        print(f"📊 Inter-image similarity: {avg_similarity:.3f}")
        if avg_similarity < 0.25:
            raise HTTPException(
                status_code=422,
                detail="Face images appear inconsistent. Ensure all images show the same person.",
            )

    averaged_embedding = average_embeddings(embeddings)

    # Step 3 — Check duplicate Employee ID
    employees = employees_collection(db)
    existing_by_id = employees.find_one({"employee_id": payload.employee_id})
    if existing_by_id:
        raise HTTPException(
            status_code=409,
            detail=f"Employee ID '{payload.employee_id}' is already registered as "
                   f"'{existing_by_id['name']}'. Use a different ID or contact admin.",
        )

    # Step 4 — Check duplicate face
    all_employees = list(employees.find())
    if all_employees:
        candidate_pool = [
            (doc["employee_id"], embedding_from_json(doc["embedding_vector"]))
            for doc in all_employees
        ]
        top_matches = top_k_matches(averaged_embedding, candidate_pool, k=1)
        if top_matches:
            best_id, best_score = top_matches[0]
            threshold = float(settings.get("confidence_threshold", 0.60))
            print(f"🔍 Face similarity check: {best_id} → {best_score:.3f} (threshold: {threshold})")
            if best_score >= threshold:
                matched_doc = next((d for d in all_employees if d["employee_id"] == best_id), None)
                matched_name = matched_doc["name"] if matched_doc else best_id
                raise HTTPException(
                    status_code=409,
                    detail=f"This face is already registered as '{matched_name}' "
                           f"(ID: {best_id}). Duplicate face registrations are not allowed.",
                )

    # Step 5 — Insert new employee
    now = utc_now()
    employees.insert_one({
        "employee_id": payload.employee_id,
        "name": payload.name,
        "department": payload.department,
        "embedding_vector": embeddings_to_json(averaged_embedding),
        "image_count": len(embeddings),
        "created_at": now,
        "updated_at": now,
    })
    employee = employees.find_one({"employee_id": payload.employee_id})
    print(f"✅ Registered: {payload.name} (ID: {payload.employee_id})")

    return RegisterResponse(
        status="registered",
        message="Employee registered successfully.",
        employee_id=str(employee["employee_id"]),
        name=str(employee["name"]),
        department=str(employee["department"]),
        image_count=int(employee.get("image_count", 0)),
    )


# ---------------------------------------------------------------------------
# Recognize — supports check-in AND check-out
# ---------------------------------------------------------------------------

@app.post("/api/recognize", response_model=RecognizeResponse)
def recognize_face(payload: RecognizeRequest, db: Database = Depends(get_db)) -> RecognizeResponse:
    # Step 1 — decode and embed
    try:
        image = decode_base64_image(payload.image)
        candidate_embedding = get_face_embedding(image)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    settings = ensure_default_settings(db)
    threshold = float(settings.get("confidence_threshold", 0.60))
    margin = float(settings.get("match_margin", 0.05))
    employee_docs = list(employees_collection(db).find())

    if not employee_docs:
        return RecognizeResponse(status="unknown", timestamp=utc_now())

    # Step 2 — match against all employees
    candidate_pool = [
        (doc["employee_id"], embedding_from_json(doc["embedding_vector"]))
        for doc in employee_docs
    ]
    top_matches = top_k_matches(candidate_embedding, candidate_pool, k=3)
    print("Top matches:", top_matches)

    if not top_matches:
        return RecognizeResponse(status="unknown", timestamp=utc_now())

    best_employee_id, best_score = top_matches[0]

    # Step 3 — hard threshold check
    if best_score < threshold:
        print(f"❌ Rejected: score {best_score:.3f} below threshold {threshold}")
        return RecognizeResponse(status="unknown", confidence=float(best_score), timestamp=utc_now())

    # Step 4 — margin check
    if len(top_matches) > 1:
        second_score = top_matches[1][1]
        if (best_score - second_score) < margin:
            print(f"❌ Rejected: margin {best_score - second_score:.3f} below required {margin}")
            return RecognizeResponse(status="unknown", confidence=float(best_score), timestamp=utc_now())
    else:
        strict_threshold = max(threshold, 0.70)
        if best_score < strict_threshold:
            print(f"❌ Rejected (single employee): score {best_score:.3f} below strict {strict_threshold}")
            return RecognizeResponse(status="unknown", confidence=float(best_score), timestamp=utc_now())

    # Step 5 — enforce working hours window before logging
    allowed, reason = is_within_working_hours(utc_now(), settings)
    if not allowed:
        print(f"⏰ Outside working hours: {reason}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=reason,
        )

    # Step 6 — log check-in or check-out
    employee = next(doc for doc in employee_docs if doc["employee_id"] == best_employee_id)
    attendance_status, action, logged_timestamp = log_attendance(db, employee, float(best_score), settings)

    # Fetch updated record to return check_in/check_out times
    day_key = local_day_key(logged_timestamp)
    att_record = attendance_collection(db).find_one(
        {"employee_id": best_employee_id, "attendance_date": day_key}
    )

    if attendance_status == "duplicate":
        return RecognizeResponse(
            status="duplicate",
            name=str(employee["name"]),
            employee_id=str(employee["employee_id"]),
            confidence=float(best_score),
            timestamp=logged_timestamp,
            department=str(employee["department"]),
            action=action,
            check_in_time=att_record.get("check_in_time") if att_record else None,
            check_out_time=att_record.get("check_out_time") if att_record else None,
        )

    return RecognizeResponse(
        status=attendance_status,
        name=str(employee["name"]),
        employee_id=str(employee["employee_id"]),
        confidence=float(best_score),
        timestamp=logged_timestamp,
        department=str(employee["department"]),
        action=action,
        check_in_time=att_record.get("check_in_time") if att_record else None,
        check_out_time=att_record.get("check_out_time") if att_record else None,
    )


# ---------------------------------------------------------------------------
# Attendance records
# ---------------------------------------------------------------------------

@app.get("/api/attendance", response_model=AttendancePage)
def get_attendance_records(
    date_value: str | None = Query(default=None, alias="date"),
    name: str | None = None,
    employee_id: str | None = None,
    department: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Database = Depends(get_db),
) -> AttendancePage:
    query: dict[str, Any] = {"attendance_date": date_value or local_day_key()}
    if employee_id:
        query["employee_id"] = {"$regex": employee_id, "$options": "i"}
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    if name:
        query["name"] = {"$regex": name, "$options": "i"}

    collection = attendance_collection(db)
    total = collection.count_documents(query)
    docs = list(
        collection.find(query)
        .sort("timestamp", DESCENDING)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )

    items = [
        AttendanceItem(
            id=str(doc["_id"]),
            employee_id=str(doc["employee_id"]),
            name=str(doc["name"]),
            department=str(doc["department"]),
            timestamp=doc["timestamp"],
            status=str(doc["status"]),
            confidence=float(doc["confidence"]),
            action=doc.get("action"),
            check_in_time=doc.get("check_in_time"),
            check_out_time=doc.get("check_out_time"),
            work_duration_minutes=doc.get("work_duration_minutes"),
        )
        for doc in docs
    ]

    total_pages = ceil(total / page_size) if total else 0
    return AttendancePage(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


# ---------------------------------------------------------------------------
# Monthly Report
# ---------------------------------------------------------------------------

@app.get("/api/attendance/monthly-report", response_model=MonthlyAttendanceReportResponse)
def get_monthly_attendance_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1900, le=2100),
    department: str | None = None,
    db: Database = Depends(get_db),
) -> MonthlyAttendanceReportResponse:
    ensure_default_settings(db)

    _, last_day = calendar.monthrange(year, month)
    all_days_in_month = {
        date(year, month, day).isoformat()
        for day in range(1, last_day + 1)
    }

    holiday_docs = list(holidays_collection(db).find({
        "date": {"$regex": f"^{year}-{month:02d}"}
    }))
    holiday_dates = {doc["date"] for doc in holiday_docs}
    working_days_set = all_days_in_month - holiday_dates

    today = date.today()
    if year == today.year and month == today.month:
        elapsed_days_set = {d for d in working_days_set if date.fromisoformat(d) <= today}
    else:
        elapsed_days_set = working_days_set

    total_working_days = len(elapsed_days_set)

    employee_query: dict[str, Any] = {}
    if department:
        employee_query["department"] = department

    employees = list(employees_collection(db).find(employee_query).sort("name", 1))

    if not employees:
        return MonthlyAttendanceReportResponse(
            month=month, year=year, department=department,
            total_working_days=total_working_days, items=[],
            summary=MonthlyAttendanceReportSummary(
                total_employees=0, average_attendance_percentage=0.0,
                perfect_attendance_count=0, below_75_count=0,
            ),
        )

    month_prefix = f"{year}-{month:02d}"
    att_query: dict[str, Any] = {"attendance_date": {"$regex": f"^{month_prefix}"}}
    if department:
        att_query["department"] = department

    monthly_docs = list(attendance_collection(db).find(att_query))
    attendance_by_employee: dict[str, dict[str, int]] = defaultdict(lambda: {"present": 0, "late": 0})

    for doc in monthly_docs:
        raw_date = doc.get("attendance_date", "")
        attendance_date = raw_date[:10] if isinstance(raw_date, str) else ""
        if attendance_date not in elapsed_days_set:
            continue
        emp_id = str(doc.get("employee_id", "")).strip()
        if not emp_id:
            continue
        status_value = str(doc.get("status", "present")).strip().lower()
        if status_value == "late":
            attendance_by_employee[emp_id]["late"] += 1
        else:
            attendance_by_employee[emp_id]["present"] += 1

    items: list[MonthlyAttendanceReportItem] = []
    attendance_percentages: list[float] = []

    for employee in employees:
        emp_id = str(employee.get("employee_id", "")).strip()
        counts = attendance_by_employee.get(emp_id, {"present": 0, "late": 0})
        present_days = counts["present"]
        late_days = counts["late"]
        attended_days = present_days + late_days
        absent_days = max(total_working_days - attended_days, 0)
        attendance_percentage = (
            round((attended_days / total_working_days) * 100.0, 1)
            if total_working_days > 0 else 0.0
        )
        attendance_percentages.append(attendance_percentage)
        items.append(MonthlyAttendanceReportItem(
            employee_id=emp_id,
            name=str(employee.get("name", "")),
            department=str(employee.get("department", "")),
            total_working_days=total_working_days,
            present_days=present_days,
            late_days=late_days,
            absent_days=absent_days,
            attendance_percentage=attendance_percentage,
        ))

    avg_pct = round(sum(attendance_percentages) / len(attendance_percentages), 1) if attendance_percentages else 0.0

    return MonthlyAttendanceReportResponse(
        month=month, year=year, department=department,
        total_working_days=total_working_days, items=items,
        summary=MonthlyAttendanceReportSummary(
            total_employees=len(items),
            average_attendance_percentage=avg_pct,
            perfect_attendance_count=sum(1 for v in attendance_percentages if v == 100.0),
            below_75_count=sum(1 for v in attendance_percentages if v < 75.0),
        ),
    )


# ---------------------------------------------------------------------------
# Holidays
# ---------------------------------------------------------------------------

@app.get("/api/holidays")
def get_holidays(
    year: int | None = None,
    month: int | None = None,
    db: Database = Depends(get_db),
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if year and month:
        query["date"] = {"$regex": f"^{year}-{month:02d}"}
    elif year:
        query["date"] = {"$regex": f"^{year}-"}
    docs = list(holidays_collection(db).find(query).sort("date", 1))
    return {
        "holidays": [
            {"date": doc["date"], "name": doc["name"], "holiday_type": doc.get("holiday_type", "public")}
            for doc in docs
        ],
        "total": len(docs),
    }


@app.post("/api/holidays", status_code=status.HTTP_201_CREATED)
def add_holiday(payload: Holiday, db: Database = Depends(get_db)) -> dict[str, Any]:
    collection = holidays_collection(db)
    if collection.find_one({"date": payload.date}):
        raise HTTPException(status_code=409, detail=f"A holiday on {payload.date} already exists.")
    collection.insert_one({"date": payload.date, "name": payload.name, "holiday_type": payload.holiday_type, "created_at": utc_now()})
    return {"status": "created", "date": payload.date, "name": payload.name}


@app.delete("/api/holidays/{holiday_date}")
def delete_holiday(holiday_date: str, db: Database = Depends(get_db)) -> dict[str, Any]:
    result = holidays_collection(db).delete_one({"date": holiday_date})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found.")
    return {"status": "deleted", "date": holiday_date}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/api/stats/today", response_model=TodayStats)
def get_today_stats(db: Database = Depends(get_db)) -> TodayStats:
    ensure_default_settings(db)
    today_key = local_day_key()

    employees_count = employees_collection(db).count_documents({})
    today_records = list(
        attendance_collection(db)
        .find({"attendance_date": today_key})
        .sort("timestamp", DESCENDING)
    )

    present_count = len(today_records)
    late_count = sum(1 for doc in today_records if doc["status"] == "late")
    checked_out_count = sum(1 for doc in today_records if doc.get("action") == "check_out" or doc.get("check_out_time") is not None)
    absent_count = max(employees_count - present_count, 0)

    recent_checkins = [
        RecentCheckIn(
            name=str(doc["name"]),
            employee_id=str(doc["employee_id"]),
            department=str(doc["department"]),
            status=str(doc["status"]),
            timestamp=doc["timestamp"],
            confidence=float(doc["confidence"]),
            action=doc.get("action"),
        )
        for doc in today_records[:8]
    ]

    weekly_trend = []
    for days_ago in range(6, -1, -1):
        day = date.today() - timedelta(days=days_ago)
        day_key = day.isoformat()
        day_docs = list(attendance_collection(db).find({"attendance_date": day_key}))
        weekly_trend.append({
            "date": day_key,
            "present": len(day_docs),
            "late": sum(1 for doc in day_docs if doc["status"] == "late"),
        })

    return TodayStats(
        total_registered=employees_count,
        present=present_count,
        absent=absent_count,
        late=late_count,
        checked_out=checked_out_count,
        recent_checkins=recent_checkins,
        weekly_trend=weekly_trend,
    )


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@app.get("/api/settings", response_model=SettingsResponse)
def get_settings(db: Database = Depends(get_db)) -> SettingsResponse:
    return serialize_settings(ensure_default_settings(db))


@app.put("/api/settings", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdate, db: Database = Depends(get_db)) -> SettingsResponse:
    collection = settings_collection(db)
    update_data = payload.model_dump()
    update_data["updated_at"] = utc_now()
    collection.update_one(
        {"key": SETTINGS_KEY},
        {"$set": update_data, "$setOnInsert": {"key": SETTINGS_KEY}},
        upsert=True,
    )
    return serialize_settings(collection.find_one({"key": SETTINGS_KEY}))


# ---------------------------------------------------------------------------
# Employee monthly detail
# ---------------------------------------------------------------------------

@app.get("/api/attendance/employee-detail")
def get_employee_monthly_detail(
    employee_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1900, le=2100),
    db: Database = Depends(get_db),
) -> dict[str, Any]:
    _, last_day = calendar.monthrange(year, month)
    today = date.today()
    elapsed_last_day = today.day if (year == today.year and month == today.month) else last_day
    all_days = [date(year, month, day).isoformat() for day in range(1, elapsed_last_day + 1)]

    holiday_docs = list(holidays_collection(db).find({"date": {"$regex": f"^{year}-{month:02d}"}}))
    holiday_dates = {doc["date"]: doc["name"] for doc in holiday_docs}

    month_prefix = f"{year}-{month:02d}"
    att_docs = list(attendance_collection(db).find({
        "employee_id": employee_id,
        "attendance_date": {"$regex": f"^{month_prefix}"},
    }))
    att_by_date = {str(doc["attendance_date"])[:10]: doc for doc in att_docs}

    employee = employees_collection(db).find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    day_records = []
    for day_str in all_days:
        if day_str in holiday_dates:
            day_records.append({"date": day_str, "status": "holiday", "holiday_name": holiday_dates[day_str], "check_in_time": None, "check_out_time": None, "work_duration_minutes": None, "confidence": None})
        elif day_str in att_by_date:
            doc = att_by_date[day_str]
            ts = doc.get("check_in_time") or doc.get("timestamp")
            check_in_str = ts.astimezone().strftime("%I:%M %p") if ts else None
            co = doc.get("check_out_time")
            check_out_str = co.astimezone().strftime("%I:%M %p") if co else None
            day_records.append({
                "date": day_str,
                "status": doc.get("status", "present"),
                "holiday_name": None,
                "check_in_time": check_in_str,
                "check_out_time": check_out_str,
                "work_duration_minutes": doc.get("work_duration_minutes"),
                "confidence": round(float(doc.get("confidence", 0)) * 100, 1),
            })
        else:
            day_records.append({"date": day_str, "status": "absent", "holiday_name": None, "check_in_time": None, "check_out_time": None, "work_duration_minutes": None, "confidence": None})

    working_days = [d for d in all_days if d not in holiday_dates]
    attended = sum(1 for d in day_records if d["status"] in ("present", "late"))

    return {
        "employee_id": employee_id,
        "name": str(employee.get("name", "")),
        "department": str(employee.get("department", "")),
        "month": month,
        "year": year,
        "total_elapsed_days": len(working_days),
        "attended_days": attended,
        "attendance_percentage": round((attended / len(working_days)) * 100, 1) if working_days else 0.0,
        "days": day_records,
    }