# HealthGuard Project Details

## 1) Project Summary

HealthGuard is an edge medical monitoring system built with:

- A FastAPI backend that reads sensor data, stores it locally, raises alerts, and syncs to Supabase.
- A React dashboard for real-time monitoring, history analysis, alerts, and appointment notifications.
- A local SQLite database for offline-first operation on an edge device (for example Raspberry Pi).

Primary goals:

- Continuous vital sign collection.
- Real-time anomaly detection and alerting.
- Local resilience with periodic cloud synchronization.
- Role-based authenticated access to monitoring data.

## 2) Technology Stack

### Backend

- Python 3.x
- FastAPI
- SQLAlchemy Async (with aiosqlite)
- Pydantic v2 + pydantic-settings
- python-jose (JWT)
- bcrypt (password hashing)
- httpx (external API calls)
- Uvicorn (ASGI server)

### Frontend

- React 18
- Vite
- Tailwind CSS
- Recharts
- Lucide React icons

### External Integrations

- Supabase REST API for cloud sync:
  - patients table
  - vital_readings table
  - alerts table
  - appointments table
- Doctor backend for doctor invite code verification

## 3) High-Level Architecture

1. Sensor Manager starts on backend startup.
2. Sensor Reader (mock or real PPG over I2C) provides readings at fixed intervals.
3. Readings are persisted locally into SQLite.
4. Alert Engine checks thresholds and creates alerts when values are out of range.
5. Frontend consumes data via REST and SSE:
   - REST for dashboard snapshots and paging
   - SSE for real-time vitals and alerts
6. Sync Service periodically pushes local data to Supabase and records sync logs.

## 4) Backend Structure

- app/main.py
  - FastAPI app initialization
  - lifespan startup/shutdown
  - database init
  - admin user seeding
  - sensor collection start/stop
  - periodic sync loop
  - static SPA serving from app/static

- app/config.py
  - central settings from environment/.env with defaults

- app/database/database.py
  - async SQLAlchemy engine/session
  - table initialization
  - lightweight startup migrations for patients columns

- app/database/models.py
  - ORM models: User, Patient, VitalReading, Alert, Appointment, SyncLog

- app/auth.py
  - JWT creation/validation
  - password hashing/verification
  - auth dependency used by protected routes

- app/sensors/
  - sensor_interface.py: normalized SensorData + abstract reader
  - mock_sensor.py: generated test vitals with occasional anomalies
  - ppg_sensor.py: MAX30102 I2C implementation and fallback stub
  - sensor_manager.py: background collection loop + DB persistence
  - alert_engine.py: threshold checks, cooldown, SSE alert bus

- app/sync/sync_service.py
  - upsert sync to Supabase for patients, vitals, alerts
  - retry/backoff for sync requests
  - local sync audit logging

- app/routes/
  - auth.py, patient.py, vitals.py, alerts.py, appointments.py, system.py

## 5) Frontend Structure

- frontend/src/App.jsx
  - authentication gate
  - tabbed dashboard (monitor/history/alerts/notifications)
  - alert toast system
  - dark/light theme toggle

- frontend/src/api.js
  - API client with JWT handling and auto-logout on 401
  - SSE subscriptions for vitals and alerts

- frontend/src/hooks/useHealthData.js
  - polling and stream hooks for vitals, patient, system, alerts, appointments

- frontend/vite.config.js
  - dev proxy: /api -> http://localhost:8000
  - build output: ../app/static (served by FastAPI)

## 6) Authentication and Roles

Authentication model:

- Login endpoint returns a JWT token.
- Protected endpoints require Bearer token.
- SSE endpoints support token query parameter because EventSource cannot set custom auth headers.

Role behavior:

- admin:
  - can register new users
  - can create appointments
- viewer:
  - read-only access to monitoring endpoints

Startup seed behavior:

- If no users exist, backend auto-creates:
  - username: admin
  - password: DEFAULT_ADMIN_PASSWORD (default currently admin)

## 7) Database Models

### User

- id, uuid, username, hashed_password, role, is_active, created_at

### Patient

- profile info and doctor assignment fields:
  - doctor_id, doctor_invite_code, assigned_doctor_name

### VitalReading

- timestamped vitals:
  - heart_rate, spo2, temperature, blood_pressure_sys, blood_pressure_dia, respiratory_rate, ppg_raw
- sync tracking:
  - synced, synced_at

### Alert

- anomaly records with:
  - severity, alert_type, vital_name, vital_value, threshold
  - acknowledged, acknowledged_at, acknowledged_by

### Appointment

- appointment metadata and read tracking

### SyncLog

- records_sent, status, error_message, duration_ms, timestamp

## 8) API Endpoints (Summary)

Base prefix: /api

### Auth

- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/register (admin only)

### Patient

- GET /api/patient
- POST /api/patient
- PUT /api/patient

### Vitals

- GET /api/vitals
- GET /api/vitals/latest
- GET /api/vitals/stats
- GET /api/vitals/history
- GET /api/vitals/stream (SSE)

### Alerts

- GET /api/alerts
- GET /api/alerts/active
- GET /api/alerts/stats
- GET /api/alerts/stream (SSE)
- POST /api/alerts/{alert_id}/acknowledge

### Appointments (Supabase-backed)

- GET /api/appointments
- GET /api/appointments/stats
- POST /api/appointments (admin only)
- POST /api/appointments/{appointment_uuid}/read

### System

- GET /api/system/status
- POST /api/system/sync

## 9) Sensor and Alert Logic

Collection:

- Runs every SENSOR_INTERVAL_SECONDS.
- Mock mode can generate realistic wave/noise data and occasional anomalies.

Alerting:

- Thresholds are configurable via environment settings.
- Uses confirmation count (2 consecutive breaches) to reduce noise.
- Uses cooldown window to avoid repeated duplicate alerts.
- Detects sensor disconnect when all vitals are null.

## 10) Synchronization Behavior

Periodic sync loop:

- Runs every SYNC_INTERVAL_SECONDS.
- Sync order:
  1. Patients
  2. Unsynced vitals
  3. Alerts
- Marks local vitals as synced after successful upload.
- Writes sync result to SyncLog.
- Uses retry with exponential backoff for transient failures.

## 11) Configuration Variables

Configured in app/config.py via environment variables or .env.

Important variables:

- DEVICE_ID
- DATABASE_URL
- MOCK_MODE
- SENSOR_INTERVAL_SECONDS
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_VITALS_TABLE
- SUPABASE_PATIENTS_TABLE
- SUPABASE_ALERTS_TABLE
- SUPABASE_APPOINTMENTS_TABLE
- DOCTOR_BACKEND_URL
- SYNC_INTERVAL_SECONDS
- SYNC_BATCH_SIZE
- SECRET_KEY
- ACCESS_TOKEN_EXPIRE_MINUTES
- DEFAULT_ADMIN_PASSWORD
- ALERT_* threshold variables
- HOST
- PORT

## 12) Local Development Setup

### Prerequisites

- Python 3.10+ (recommended)
- Node.js 18+ (recommended)
- npm

### Backend

1. Create virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install backend dependencies:

```powershell
pip install -r requirements.txt
```

3. Start backend:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend docs:

- Swagger UI: http://localhost:8000/docs

### Frontend (dev mode)

1. Install dependencies:

```powershell
cd frontend
npm install
```

2. Start Vite dev server:

```powershell
npm run dev
```

3. Open:

- http://localhost:5173

The dev server proxies /api to the backend at http://localhost:8000.

## 13) Production-Like Build Flow

1. Build frontend assets:

```powershell
cd frontend
npm run build
```

This outputs static files into app/static.

2. Run backend normally:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI serves the built SPA from app/static.

## 14) Operational Notes

- Local DB file defaults to healthguard.db in project root.
- On startup, a placeholder patient may be auto-created if none exists.
- Patient registration validates doctor code through external doctor backend.
- Appointments are fetched and updated directly in Supabase.

## 15) Security and Hardening Notes

Current defaults are development-friendly and should be hardened before production:

- Change SECRET_KEY to a strong random value.
- Change DEFAULT_ADMIN_PASSWORD immediately.
- Move Supabase and sensitive credentials to environment-only secrets.
- Restrict CORS origins (currently allow_origins is open).
- Consider HTTPS termination and secure token storage strategy.

## 16) Suggested .env Template

Use a .env file in project root:

```env
DEVICE_ID=edge-node-001
DATABASE_URL=sqlite+aiosqlite:///./healthguard.db
MOCK_MODE=true
SENSOR_INTERVAL_SECONDS=5

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
SUPABASE_VITALS_TABLE=vital_readings
SUPABASE_PATIENTS_TABLE=patients
SUPABASE_ALERTS_TABLE=alerts
SUPABASE_APPOINTMENTS_TABLE=appointments

DOCTOR_BACKEND_URL=http://localhost:3001/api
SYNC_INTERVAL_SECONDS=300
SYNC_BATCH_SIZE=100

SECRET_KEY=replace-with-strong-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=480
DEFAULT_ADMIN_PASSWORD=change-me

ALERT_HR_LOW=50
ALERT_HR_HIGH=120
ALERT_SPO2_LOW=90
ALERT_TEMP_HIGH=38.5
ALERT_TEMP_LOW=35
ALERT_BP_SYS_HIGH=140
ALERT_BP_SYS_LOW=90
ALERT_BP_DIA_HIGH=90
ALERT_BP_DIA_LOW=60
ALERT_RR_HIGH=25
ALERT_RR_LOW=10
ALERT_COOLDOWN_SECONDS=300

HOST=0.0.0.0
PORT=8000
```

## 17) Quick Verification Checklist

- Backend starts without errors.
- Login works and returns JWT token.
- New vital readings appear in /api/vitals/latest.
- SSE updates flow for /api/vitals/stream and /api/alerts/stream.
- Manual sync endpoint /api/system/sync succeeds.
- Frontend dashboard loads and displays live data.

---

Document generated from current repository implementation as of April 15, 2026.
