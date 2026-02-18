"""
HealthGuard Edge Node – FastAPI Application Entry Point.

Sets up the application with:
  • Database initialisation on startup
  • Background sensor data collection
  • Periodic sync scheduler
  • REST API routers
  • Static file serving for the React dashboard
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.database.database import init_db
from app.sensors.sensor_manager import start_collection, stop_collection
from app.routes import vitals, patient, system

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("healthguard")

settings = get_settings()

# ── Sync scheduler ──────────────────────────────────────────────────────────
_sync_task: asyncio.Task | None = None


async def _periodic_sync() -> None:
    """Background loop that syncs data at the configured interval."""
    from app.sync.sync_service import sync_now

    while True:
        await asyncio.sleep(settings.SYNC_INTERVAL_SECONDS)
        try:
            result = await sync_now()
            logger.info(
                f"Periodic sync complete: {result.records_sent} records, "
                f"status={result.status}, {result.duration_ms}ms"
            )
        except Exception as exc:
            logger.error(f"Periodic sync error: {exc}", exc_info=True)


# ── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    global _sync_task

    logger.info("=" * 60)
    logger.info("  HealthGuard Edge Node  –  Starting Up")
    logger.info(f"  Device ID  : {settings.DEVICE_ID}")
    logger.info(f"  Mock Mode  : {settings.MOCK_MODE}")
    logger.info(f"  Database   : {settings.DATABASE_URL}")
    logger.info("=" * 60)

    # 1. Initialise database
    await init_db()
    logger.info("✅ Database initialised")

    # 2. Start sensor collection
    await start_collection()
    logger.info("✅ Sensor collection started")

    # 3. Start periodic sync
    _sync_task = asyncio.create_task(_periodic_sync())
    logger.info(f"✅ Sync scheduler started (every {settings.SYNC_INTERVAL_SECONDS}s)")

    yield  # ── Application runs ──

    # Shutdown
    logger.info("Shutting down…")
    if _sync_task:
        _sync_task.cancel()
        try:
            await _sync_task
        except asyncio.CancelledError:
            pass
    await stop_collection()
    logger.info("👋 HealthGuard Edge Node stopped")


# ── App Factory ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="HealthGuard Edge Node",
    description="Embedded IoT medical monitoring system for Raspberry Pi",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow the local React dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(vitals.router)
app.include_router(patient.router)
app.include_router(system.router)

# ── Static files (React dashboard build) ────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA – all non-API routes fall back to index.html."""
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "service": "HealthGuard Edge Node",
            "status": "running",
            "docs": "/docs",
            "note": "Build the React frontend to serve the dashboard at /",
        }
