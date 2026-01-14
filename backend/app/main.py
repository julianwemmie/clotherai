from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import traceback

# Load .env file before other imports that use environment variables
load_dotenv()

from .routers import upload, items
from .database import init_database

app = FastAPI(title="ClotherAI API", version="1.0.0")

# Define allowed origins
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions with proper CORS headers."""
    origin = request.headers.get("origin")

    # Log the error for debugging
    print(f"Unhandled exception: {exc}")
    traceback.print_exc()

    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

    # Add CORS headers if origin is allowed
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response

# Include routers
app.include_router(upload.router)
app.include_router(items.router)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_database()


@app.get("/")
async def root():
    return {"message": "ClotherAI API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
