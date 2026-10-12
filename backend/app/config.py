"""Environment configuration shared by the API and local management commands."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load local settings without overriding values supplied by the hosting service.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

SECRET_KEY = os.getenv("SECRET_KEY", "")
if len(SECRET_KEY) < 32:
    raise RuntimeError("Set SECRET_KEY to a newly generated value of at least 32 characters.")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cargo_app.db")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
    if origin.strip()
]
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
