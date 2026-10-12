"""Run against a disposable database, with mail and local dotenv loading disabled."""

import atexit
import os
import secrets
import tempfile
from pathlib import Path

import pytest

test_directory = tempfile.TemporaryDirectory(prefix="cargo-tests-")
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
os.environ["SECRET_KEY"] = secrets.token_hex(32)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(test_directory.name) / 'test.db'}"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["SENDER_EMAIL"] = ""
os.environ["SENDER_PASSWORD"] = ""

from app.main import app
from app.database import Base, SessionLocal, engine
from fastapi.testclient import TestClient


def cleanup():
    engine.dispose()
    test_directory.cleanup()


atexit.register(cleanup)


@pytest.fixture
def client():
    with SessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    with TestClient(app) as test_client:
        yield test_client
