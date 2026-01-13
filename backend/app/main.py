from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

# Load .env file before other imports that use environment variables
load_dotenv()

from .routers import upload, items
from .database import init_database

app = FastAPI(title="ClotherAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
