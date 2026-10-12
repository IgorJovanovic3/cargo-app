# Cargo App — Logistics and Delivery Prototype

A Python backend and React web application for managing deliveries between clients and drivers. The project brings shipment management, role-based dashboards, maps, pricing, chat, notifications, and delivery confirmation into one workflow.

Originally developed step by step for my own courier service, this project was built around a practical delivery workflow. The original application was developed locally with test data and was not used for real customer operations. A public portfolio demo is now available below.

## Live demo

**[Try the live Cargo App demo](https://cargo-portfolio-demo.onrender.com/login)**

Choose **Try as Client** or **Try as Driver** to sign in instantly; no registration or local installation is required. The demo includes fictional shipments, chat, delivery workflows, reports, and simulated driver movement.

Demo data is shared among visitors and resets when the server restarts. The first visit after inactivity may take longer while the free hosting service wakes up.

The demo implementation is available on the [`portfolio/public-demo` branch](https://github.com/IgorJovanovic3/cargo-app/tree/portfolio/public-demo).

## Business use case

A small delivery business needs to keep customer requests, driver assignments, shipment statuses, and proof of delivery together. Cargo App explores that workflow through a REST API backed by a relational database and a browser interface for clients, drivers, and administrators.

## Features implemented in the source

- Client and driver registration, JWT login, and profile management.
- Shipment creation, driver assignment, status updates, and shipment history.
- Map interfaces, address lookup, route-based price estimates, and vehicle pricing.
- WebSocket handlers for driver locations, notifications, and shipment chat.
- QR scanning and signature capture interfaces for delivery confirmation.
- Reviews, rating charts, administration screens, and data/report exports.
- Optional SMTP email for welcome messages, shipment events, and password reset.

This is a portfolio prototype. The presence of a feature in the source does not imply that it has been validated for production use. See [project status](#project-status-and-limitations).

## Technology

| Layer | Technologies |
| --- | --- |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Authentication | JWT with python-jose; bcrypt with Passlib |
| Database | SQLite for local demonstrations; PostgreSQL/MySQL via SQLAlchemy |
| Web frontend | React, Vite, Axios, React Router |
| Maps and charts | Leaflet, OpenStreetMap services, Chart.js |
| Reporting | Pandas, OpenPyXL, ReportLab, QRCode |

The runnable interface in this repository is the React web application in `frontend/`. The root package manifest contains mobile-related dependencies, but a mobile app is not included here.

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/app/main.py` | FastAPI application, WebSocket handlers, and initial pricing |
| `backend/app/routers/` | Authentication, shipments, notifications, administration, reviews, chat |
| `backend/app/models.py` | SQLAlchemy data model |
| `backend/app/schemas.py` | Request and response schemas |
| `backend/app/config.py` | Environment configuration |
| `backend/app/create_admin.py` | Explicit, interactive administrator creation |
| `frontend/src/` | React pages, components, API client, translations |

## Run locally

Use Python 3.12 and a Node.js version supported by Vite 8 (Node 24 is used for validation). Start backend commands from `backend/` and frontend commands from `frontend/`.

### Backend

```bash
git clone https://github.com/IgorJovanovic3/cargo-app.git
cd cargo-app/backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

```bash
# macOS / Linux
source .venv/bin/activate
cp .env.example .env
```

```bash
python -m pip install -r requirements.txt
python -c "import secrets; print(secrets.token_hex(32))"
```

Put the generated value in `SECRET_KEY` in your local `.env`. Keep the SQLite setting for a local demo, or supply your own database URL. Do not use an old published key. The application refuses to start with a missing key or one shorter than 32 characters.

```bash
python -m uvicorn app.main:app --reload --port 8000
```

- API documentation: `http://localhost:8000/docs`
- Health endpoint: `http://localhost:8000/health`

Tables and default vehicle prices are created on startup. No user accounts are automatically created. Register a client or driver through the interface; create an administrator explicitly when needed:

```bash
python -m app.create_admin
```

This command prompts for the administrator's details and password. It does not print the password or promote an existing account.

### Frontend

In a second terminal:

```bash
cd cargo-app/frontend
npm ci
```

Copy `frontend/.env.example` to `frontend/.env` (PowerShell: `Copy-Item .env.example .env`; macOS/Linux: `cp .env.example .env`).

```bash
npm run dev
```

Open `http://localhost:5173`. `VITE_API_URL` controls the API address and the derived WebSocket address. Vite reads it when the frontend starts/builds; restart or rebuild after changing it.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Required JWT signing key; generate a new private value |
| `DATABASE_URL` | Database connection; defaults to local SQLite when absent |
| `FRONTEND_URL` | Frontend origin and password-reset/email links |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins; defaults to `FRONTEND_URL` |
| `SMTP_SERVER`, `SMTP_PORT` | Optional mail server; defaults to Gmail SMTP on port 587 |
| `SENDER_EMAIL`, `SENDER_PASSWORD` | Optional sender credentials; email is skipped when absent |
| `VITE_API_URL` | Public frontend API base URL, without an added `/api` prefix |

The backend loads its local `.env` without overriding host environment variables. For PostgreSQL, add `sslmode=require` to your connection URL when required by your provider. Hosted deployments must set their own database URL and frontend origins. `VITE_*` values are visible in browser builds and must never contain credentials.

## Verification

Security regression checks use an isolated temporary SQLite database, not a developer or hosted database:

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest tests -q
```

To check the frontend build:

```bash
cd frontend
npm run build
```

## Project status and limitations

- WebSockets require JWT authentication and check user identity, role, and shipment participation. A wider security review is still needed before using this prototype with real business data.
- Database migrations are not included. Automatic table creation is intended for development and does not upgrade existing database schemas.
- WebSocket connection storage is in process memory and is not designed for multiple backend workers.
- Map, geocoding, routing, and SMTP features depend on external services and are not covered by the local regression checks. Public demo driver movement is simulated and outgoing email is disabled.
- SMTP must be configured for password-reset delivery. Reset tokens are sent by email, never returned in the API response or logged.
- Deployment manifests are starting points; supply and verify your own service addresses and host configuration.

## Credential cleanup

Local environment files, database snapshots, and Python caches are excluded from the current source tree. The original accounts and configuration were for local testing; the application was not used for real customer operations. Removing files in a new commit does **not** erase earlier Git history. Credential rotation is only needed if a test value was also used for a real account or service. See [credential cleanup notes](docs/credential-cleanup.md).
