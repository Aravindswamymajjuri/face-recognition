from __future__ import annotations

import os
from functools import lru_cache
from typing import Iterator

from pymongo import MongoClient
from pymongo.database import Database


MONGODB_URI = os.getenv("MONGODB_URI", "mongodb+srv://aravindswamymajjuri143:xCuKYeBVOQyv0QdL@projects.m06dc.mongodb.net/?retryWrites=true&w=majority&appName=Projects")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "face_attendance")


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    return MongoClient(MONGODB_URI, tz_aware=True)


def get_database() -> Database:
    return get_mongo_client()[MONGODB_DB_NAME]


def get_db() -> Iterator[Database]:
    yield get_database()


def init_db() -> None:
    database = get_database()
    database.employees.create_index("employee_id", unique=True)
    database.attendance.create_index([("employee_id", 1), ("attendance_date", 1)], unique=True)
    database.attendance.create_index("timestamp")
    database.attendance.create_index("attendance_date")
    database.attendance.create_index("department")
    database.settings.create_index("key", unique=True)
