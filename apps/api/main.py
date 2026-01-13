from fastapi import FastAPI
from app.routers import auth
from app.core.config import settings

app = FastAPI(
    title="Vacation Price Tracker API",
    version="1.0.0",
    # Configure root_path for proxy servers if needed in production
    # root_path="/api/v1" if settings.is_production else "",
)

app.include_router(auth.router, tags=["Authentication"])

@app.get("/", tags=["Health"])
def read_root():
    """A simple health check endpoint."""
    return {"status": "ok"}
