import json
import os
import secrets
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from starlette.websockets import WebSocketDisconnect

from app.database import SessionLocal
from app.demo import DEMO_CLIENT_EMAIL, DEMO_DRIVER_EMAIL, DEMO_PASSWORD, reset_demo_data
from app.models import ChatMessage, Shipment, User, UserType
from app.routers.auth import create_access_token, get_password_hash


def login_as(client, email):
    response = client.post('/auth/login', data={'username': email, 'password': DEMO_PASSWORD})
    assert response.status_code == 200
    data = response.json()
    return data['user'], data['access_token'], {'Authorization': f"Bearer {data['access_token']}"}


@pytest.fixture
def demo_client(client, monkeypatch):
    from app import main, email_service
    from app.routers import auth, shipments, chat
    for module in [main, email_service, auth, shipments, chat]:
        monkeypatch.setattr(module, 'DEMO_MODE', True)
    reset_demo_data()
    return client


def test_demo_info_only_exposes_deliberately_public_demo_credentials(demo_client):
    info = demo_client.get('/demo-info').json()
    assert info['enabled'] is True
    assert {x['role'] for x in info['accounts']} == {'client', 'driver'}
    assert info['password'] == DEMO_PASSWORD
    assert 'SECRET_KEY' not in info


def test_regular_mode_does_not_publish_demo_credentials(client):
    assert client.get('/demo-info').json() == {'enabled': False}


def test_demo_scenarios_client_driver_accept_delivery_and_export(demo_client):
    client_user, _, client_headers = login_as(demo_client, DEMO_CLIENT_EMAIL)
    driver_user, _, driver_headers = login_as(demo_client, DEMO_DRIVER_EMAIL)
    assert client_user['user_type'] == 'client'
    assert driver_user['user_type'] == 'driver'
    shipments = demo_client.get('/shipments/client/', headers=client_headers).json()['shipments']
    assert len(shipments) == 6
    created = demo_client.post('/shipments/create', headers=client_headers, json={
        'pickup_address': 'Demo pickup', 'pickup_lat': 44.8125, 'pickup_lng': 20.4612,
        'delivery_address': 'Demo delivery', 'delivery_lat': 44.7963, 'delivery_lng': 20.4744,
        'cargo_description': 'Fictional test parcel', 'weight_kg': 2, 'dimensions': '20x15x10',
        'price': 550, 'is_urgent': False,
    })
    assert created.status_code == 200
    pending = created.json()
    assert pending['qr_code'].startswith('data:image/png;base64,')
    assert demo_client.post(f"/shipments/{pending['id']}/accept", headers=driver_headers).status_code == 200
    assert demo_client.put(f"/shipments/{pending['id']}/status", headers=driver_headers, json={'status': 'picked_up'}).status_code == 200
    completed = demo_client.put(f"/shipments/{pending['id']}/complete", headers=driver_headers, json={'signature': 'demo-signature'})
    assert completed.status_code == 200
    earnings = demo_client.get('/shipments/driver/earnings', headers=driver_headers)
    assert earnings.status_code == 200
    assert earnings.json()['total_shipments'] == 3
    export = demo_client.get('/shipments/driver/export/excel', headers=driver_headers)
    assert export.status_code == 200
    assert export.content.startswith(b'PK')
    assert demo_client.get('/admin/users', headers=client_headers).status_code == 403


@pytest.mark.parametrize('path,method,payload', [
    ('/auth/register', 'post', {'email': 'fake@example.invalid', 'full_name': 'Fake', 'phone': '000', 'password': 'demo-password', 'user_type': 'client'}),
    ('/auth/profile', 'put', {'full_name': 'Changed Name'}),
    ('/auth/forgot-password?email=client@cargo.example', 'post', None),
    ('/auth/reset-password?token=fake&new_password=changed-password', 'post', None),
])
def test_demo_accounts_cannot_be_registered_modified_or_reset(demo_client, path, method, payload):
    _, _, headers = login_as(demo_client, DEMO_CLIENT_EMAIL)
    response = getattr(demo_client, method)(path, headers=headers, json=payload)
    assert response.status_code == 403
    login_as(demo_client, DEMO_CLIENT_EMAIL)


def test_demo_reset_is_repeatable_and_preserves_only_demo_users(demo_client):
    reset_demo_data()
    reset_demo_data()
    with SessionLocal() as db:
        assert db.query(User).count() == 2
        assert db.query(Shipment).count() == 6
        assert db.query(ChatMessage).count() == 2
        assert db.query(User).filter(User.user_type == UserType.ADMIN).count() == 0


def test_demo_reset_refuses_database_with_non_demo_user(client):
    with SessionLocal() as db:
        db.add(User(email='private@example.invalid', full_name='Private User', phone='000',
                    hashed_password=get_password_hash('local-password'), user_type=UserType.CLIENT))
        db.commit()
    with pytest.raises(RuntimeError, match='non-demo users'):
        reset_demo_data()
    with SessionLocal() as db:
        assert db.query(User).count() == 1


@pytest.mark.parametrize('protocols', [[], ['cargo', 'invalid-token']])
def test_websocket_rejects_missing_or_invalid_auth(demo_client, protocols):
    with pytest.raises(WebSocketDisconnect):
        with demo_client.websocket_connect('/ws/client/1', subprotocols=protocols):
            pass


def test_websocket_checks_identity_and_role(demo_client):
    user, token, _ = login_as(demo_client, DEMO_CLIENT_EMAIL)
    for path in [f"/ws/client/{user['id'] + 1}", f"/ws/driver/{user['id']}"]:
        with pytest.raises(WebSocketDisconnect):
            with demo_client.websocket_connect(path, subprotocols=['cargo', token]):
                pass
    with demo_client.websocket_connect(f"/ws/client/{user['id']}", subprotocols=['cargo', token]) as ws:
        assert ws.accepted_subprotocol == 'cargo'
        ws.send_text('ping')
        assert ws.receive_text() == 'pong'


def test_chat_requires_shipment_participant_and_delivers_message(demo_client):
    client_user, client_token, _ = login_as(demo_client, DEMO_CLIENT_EMAIL)
    driver_user, driver_token, _ = login_as(demo_client, DEMO_DRIVER_EMAIL)
    with SessionLocal() as db:
        shipment = db.query(Shipment).filter(Shipment.driver_id == driver_user['id']).first()
        shipment_id = shipment.id
        db.add(User(email='outsider@example.invalid', full_name='Outsider', phone='000',
                    hashed_password=get_password_hash('outsider-password'), user_type=UserType.CLIENT))
        db.commit()
        outsider_id = db.query(User).filter(User.email == 'outsider@example.invalid').first().id
    outsider_token = create_access_token({'sub': 'outsider@example.invalid'})
    with pytest.raises(WebSocketDisconnect):
        with demo_client.websocket_connect(f'/chat/ws/{shipment_id}/{outsider_id}', subprotocols=['cargo', outsider_token]):
            pass
    denied = demo_client.get(f'/shipments/{shipment_id}/location', headers={'Authorization': f'Bearer {outsider_token}'})
    assert denied.status_code == 403
    with demo_client.websocket_connect(f"/chat/ws/{shipment_id}/{driver_user['id']}", subprotocols=['cargo', driver_token]) as recipient:
        with demo_client.websocket_connect(f"/chat/ws/{shipment_id}/{client_user['id']}", subprotocols=['cargo', client_token]) as sender:
            sender.send_json({'type': 'message', 'message': 'Test delivery message'})
            delivered = recipient.receive_json()
            assert delivered['message'] == 'Test delivery message'
            assert delivered['shipment_id'] == shipment_id
            assert sender.receive_json()['type'] == 'message_sent'


def test_location_updates_require_assigned_driver_and_reach_all_client_sockets(demo_client):
    client_user, client_token, _ = login_as(demo_client, DEMO_CLIENT_EMAIL)
    driver_user, driver_token, _ = login_as(demo_client, DEMO_DRIVER_EMAIL)
    with SessionLocal() as db:
        assigned = db.query(Shipment).filter(Shipment.driver_id == driver_user['id']).first().id
        unassigned = db.query(Shipment).filter(Shipment.driver_id.is_(None)).first().id
    with demo_client.websocket_connect(f"/ws/client/{client_user['id']}", subprotocols=['cargo', client_token]) as first:
        with demo_client.websocket_connect(f"/ws/notifications/{client_user['id']}", subprotocols=['cargo', client_token]) as second:
            with demo_client.websocket_connect(f"/ws/driver/{driver_user['id']}", subprotocols=['cargo', driver_token]) as driver:
                driver.send_json({'type': 'location_update', 'shipment_id': unassigned, 'lat': 44.8, 'lng': 20.4})
                assert driver.receive_json()['type'] == 'error'
                driver.send_json({'type': 'location_update', 'shipment_id': assigned, 'lat': 144.8, 'lng': 20.4})
                assert driver.receive_json()['type'] == 'error'
                driver.send_json({'type': 'location_update', 'shipment_id': assigned, 'lat': 44.8, 'lng': 20.4})
                assert first.receive_json()['shipment_id'] == assigned
                assert second.receive_json()['shipment_id'] == assigned


def test_hosted_demo_starts_with_real_frontend_and_fresh_database():
    with tempfile.TemporaryDirectory(prefix='cargo-hosting-test-') as directory:
        env = dict(os.environ, SECRET_KEY=secrets.token_hex(32), DEMO_MODE='true',
                   SERVE_FRONTEND='true', DATABASE_URL=f'sqlite:///{Path(directory) / "demo.db"}')
        script = '''
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    assert c.get('/health').json() == {'status': 'ok'}
    assert '<div id="root">' in c.get('/').text
    assert '<div id="root">' in c.get('/login').text
    assert c.get('/demo-info').json()['enabled'] is True
    assert c.get('/unknown-api-route').status_code == 404
    assert c.get('/backend/.env').status_code == 404
    assert c.get('/docs').status_code == 200
    assert c.get('/openapi.json').status_code == 200
print('Hosted FastAPI + React smoke check passed')
'''
        result = subprocess.run([sys.executable, '-c', script], env=env, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        assert 'Duplicate Operation ID' not in result.stderr
