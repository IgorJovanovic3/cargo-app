import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import PasswordReset, User


def register(client, role="client"):
    return client.post("/auth/register", json={
        "email": "demo@example.invalid",
        "full_name": "Demo User",
        "phone": "000000000",
        "password": "local-test-password",
        "user_type": role,
    })


def test_startup_never_seeds_users(client):
    from app.main import app
    with TestClient(app):
        with SessionLocal() as db:
            assert db.query(User).count() == 0


def test_health_and_allowed_cors(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.json() == {"status": "ok"}
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    rejected = client.get("/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in rejected.headers


@pytest.mark.parametrize("role", ["client", "driver"])
def test_register_and_login_allowed_roles(client, role):
    response = register(client, role)
    assert response.status_code == 200
    login = client.post("/auth/login", data={
        "username": "demo@example.invalid", "password": "local-test-password",
    })
    assert login.status_code == 200
    token = login.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user_type"] == role


@pytest.mark.parametrize("role", ["admin", "ADMIN", "unknown"])
def test_public_registration_cannot_create_admin(client, role):
    assert register(client, role).status_code == 422
    with SessionLocal() as db:
        assert db.query(User).count() == 0


def test_inactive_user_cannot_login_or_use_existing_token(client):
    register(client)
    token = client.post("/auth/login", data={
        "username": "demo@example.invalid", "password": "local-test-password",
    }).json()["access_token"]
    with SessionLocal() as db:
        db.query(User).first().is_active = 0
        db.commit()
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.post("/auth/login", data={
        "username": "demo@example.invalid", "password": "local-test-password",
    }).status_code == 401


def test_reset_link_only_sent_through_email(client, monkeypatch, capsys):
    from app.routers import auth
    captured = []
    monkeypatch.setattr(auth, "send_email", lambda *args: captured.append(args) or True)
    register(client)
    response = client.post("/auth/forgot-password", params={"email": "demo@example.invalid"})
    unknown = client.post("/auth/forgot-password", params={"email": "missing@example.invalid"})
    assert response.json() == unknown.json()
    assert "reset_link" not in response.json()
    with SessionLocal() as db:
        token = db.query(PasswordReset).first().token
    assert captured[0][0] == "demo@example.invalid"
    assert f"http://localhost:5173/reset-password?token={token}" in captured[0][2]
    assert token not in response.text
    assert token not in capsys.readouterr().out


def test_reset_token_is_single_use(client):
    register(client)
    with SessionLocal() as db:
        db.add(PasswordReset(
            user_id=db.query(User).first().id,
            token="temporary-local-reset-token",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ))
        db.commit()
    params = {"token": "temporary-local-reset-token", "new_password": "changed-local-password"}
    assert client.post("/auth/reset-password", params=params).status_code == 200
    assert client.post("/auth/reset-password", params=params).status_code == 400
    assert client.post("/auth/login", data={
        "username": "demo@example.invalid", "password": "changed-local-password",
    }).status_code == 200


@pytest.mark.parametrize("secret", [None, "short"])
def test_missing_or_short_key_prevents_startup(secret):
    env = dict(os.environ)
    if secret is None:
        env.pop("SECRET_KEY", None)
    else:
        env["SECRET_KEY"] = secret
    result = subprocess.run(
        [sys.executable, "-c", "import app.config"], env=env, capture_output=True, text=True,
    )
    assert result.returncode != 0
    assert "Set SECRET_KEY" in result.stderr


def test_unconfigured_email_does_not_open_smtp_connection(monkeypatch):
    from app import email_service
    def forbidden(*args, **kwargs):
        pytest.fail("Unconfigured email tried to contact SMTP")
    monkeypatch.setattr(email_service.smtplib, "SMTP", forbidden)
    assert email_service.send_email("demo@example.invalid", "Test", "<p>Test</p>") is False


def test_admin_created_explicitly_without_logging_password(client, monkeypatch, capsys):
    from app import create_admin
    responses = iter(["administrator@example.invalid", "Local Administrator", "000000000"])
    monkeypatch.setattr("builtins.input", lambda prompt: next(responses))
    monkeypatch.setattr(create_admin, "getpass", lambda prompt: "unique-local-admin-password")
    create_admin.main()
    with SessionLocal() as db:
        user = db.query(User).first()
        assert user.user_type.value == "admin"
        assert user.hashed_password != "unique-local-admin-password"
    assert "unique-local-admin-password" not in capsys.readouterr().out
    assert client.post("/auth/login", data={
        "username": "administrator@example.invalid", "password": "unique-local-admin-password",
    }).status_code == 200
    responses = iter(["administrator@example.invalid", "Local Administrator", "000000000"])
    with pytest.raises(SystemExit, match="already exists"):
        create_admin.main()


def test_admin_command_does_not_promote_existing_client(client, monkeypatch):
    from app import create_admin
    register(client)
    responses = iter(["demo@example.invalid", "Demo User", "000000000"])
    monkeypatch.setattr("builtins.input", lambda prompt: next(responses))
    monkeypatch.setattr(create_admin, "getpass", lambda prompt: "unique-local-admin-password")
    with pytest.raises(SystemExit, match="already exists"):
        create_admin.main()
    with SessionLocal() as db:
        assert db.query(User).first().user_type.value == "client"
