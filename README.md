# Face Recognition Attendance System

Production-grade face attendance stack with a FastAPI backend, MongoDB storage, and a React 18 + Vite frontend.

## Project Layout

```
face-recognition/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── face_service.py
│   ├── database.py
│   ├── schemas.py
│   └── requirements.txt
└── frontend/
	├── src/
	│   ├── pages/
	│   ├── components/
	│   ├── api/
	│   ├── App.jsx
	│   ├── main.jsx
	│   └── index.css
	├── index.html
	├── package.json
	├── vite.config.js
	├── tailwind.config.js
	└── postcss.config.js
```

## What’s Included

- Dashboard with live stats, recent check-ins, and trend charts
- Live attendance camera flow with realtime recognition feedback
- Multi-angle face registration with upload progress
- Filterable, paginated attendance records with CSV export
- Settings screen for recognition threshold, working hours, and departments
- FastAPI backend with MongoDB, CORS, duplicate prevention, and settings storage

## Backend

From the `backend` folder:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
set MONGODB_URI=mongodb://localhost:27017
set MONGODB_DB_NAME=face_attendance
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend API base URL: `http://localhost:8000`

MongoDB stores employees, attendance, and settings in the `face_attendance` database by default.

## Frontend

From the `frontend` folder:

```bash
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## API Surface

- `POST /api/recognize`
- `POST /api/register`
- `GET /api/attendance`
- `GET /api/stats/today`
- `GET /api/settings`
- `PUT /api/settings`

## Notes

- The backend uses a HuggingFace image-feature-extraction pipeline with a cosine similarity matcher.
- The Vite dev server proxies `/api` requests to FastAPI during development.
- MongoDB collections are created automatically on startup with the needed indexes.
