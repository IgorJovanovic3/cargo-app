from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.config import CORS_ORIGINS, DEMO_MODE, SERVE_FRONTEND
from app.websocket_auth import authenticate_websocket
from pathlib import Path
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
from app.routers import auth, shipments, notifications, admin, reviews, chat
from typing import Dict
import json
from datetime import datetime, timezone, timedelta
import asyncio

# ========== AUTO KREIRANJE TABELA I KORISNIKA ==========
from app.database import SessionLocal
from app.models import Base, User, UserType, DriverProfile, ChatMessage, Pricing

# Kreiraj tabele ako ne postoje
print("🔧 Kreiranje tabela...")
Base.metadata.create_all(bind=engine)
print("✅ Tabele su kreirane (ili već postoje)")

# Privileged and demo users are never created automatically.
db_session = SessionLocal()

# Dodaj cenovnik ako ne postoji
pricing = db_session.query(Pricing).first()
if not pricing:
    print("🔧 Dodavanje cenovnika...")
    pricing_items = [
        Pricing(vehicle_class="bike", name="Bicikl", price_per_km=30, price_per_kg=20, base_price=100, max_weight_kg=5, is_active=1),
        Pricing(vehicle_class="motorcycle", name="Motocikl", price_per_km=40, price_per_kg=25, base_price=150, max_weight_kg=20, is_active=1),
        Pricing(vehicle_class="car", name="Automobil", price_per_km=50, price_per_kg=30, base_price=200, max_weight_kg=100, is_active=1),
        Pricing(vehicle_class="van", name="Kombi", price_per_km=70, price_per_kg=40, base_price=300, max_weight_kg=500, is_active=1),
        Pricing(vehicle_class="truck", name="Kamion", price_per_km=100, price_per_kg=50, base_price=500, max_weight_kg=3000, is_active=1),
    ]
    for item in pricing_items:
        db_session.add(item)
    db_session.commit()
    print("✅ Cenovnik dodat")
else:
    print("✅ Cenovnik već postoji")

db_session.close()

if DEMO_MODE:
    from app.demo import reset_demo_data
    reset_demo_data()

app = FastAPI(
    title="Cargo App API",
    description="API za cargo/logistika aplikaciju",
    version="1.0.0",
    # root_path="/api"
)

# A public demo cannot send mail or store arbitrarily large uploads.
if DEMO_MODE:
    @app.middleware("http")
    async def demo_request_limits(request, call_next):
        try:
            length = int(request.headers.get("content-length", "0"))
        except ValueError:
            return JSONResponse({"detail": "Invalid content length"}, status_code=400)
        if length > 2_000_000:
            return JSONResponse({"detail": "The demo upload limit is 2 MB"}, status_code=413)
        return await call_next(request)

# ========== CORS MIDDLEWARE ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type", "Authorization"],
)

# A user may have multiple tabs and independent notification/tracking sockets.
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, user_id, websocket):
        await websocket.accept(subprotocol="cargo")
        self.active_connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id, websocket):
        sockets = self.active_connections.get(user_id, set())
        sockets.discard(websocket)
        if not sockets:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id, data):
        sent = False
        for websocket in tuple(self.active_connections.get(user_id, ())):
            try:
                await websocket.send_json(data)
                sent = True
            except Exception:
                self.disconnect(user_id, websocket)
        return sent

    async def broadcast_driver_location(self, client_id, shipment_id, lat, lng, driver_id):
        await self.send_to_user(client_id, {
            "type": "driver_location", "shipment_id": shipment_id,
            "lat": lat, "lng": lng, "driver_id": driver_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

manager = ConnectionManager()

@app.websocket("/ws/client/{client_id}")
async def websocket_client(websocket: WebSocket, client_id: int):
    if await authenticate_websocket(websocket, client_id, UserType.CLIENT) is None:
        return
    await manager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(client_id, websocket)
    except Exception as e:
        print(f"WebSocket client error: {e}")
        manager.disconnect(client_id, websocket)

@app.websocket("/ws/driver/{driver_id}")
async def websocket_driver(websocket: WebSocket, driver_id: int):
    from app.database import SessionLocal
    from app.models import Shipment, DriverProfile
    
    if await authenticate_websocket(websocket, driver_id, UserType.DRIVER) is None:
        return
    await manager.connect(driver_id, websocket)
    db = SessionLocal()
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                json_data = json.loads(data)
                
                if json_data.get("type") == "location_update":
                    shipment_id = json_data.get("shipment_id")
                    lat = json_data.get("lat")
                    lng = json_data.get("lng")
                    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
                        await websocket.send_json({"type": "error", "message": "Invalid coordinates"})
                        continue
                    
                    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
                    
                    if shipment and shipment.client_id and shipment.driver_id == driver_id:
                        await manager.broadcast_driver_location(
                            client_id=shipment.client_id,
                            shipment_id=shipment_id,
                            lat=lat,
                            lng=lng,
                            driver_id=driver_id
                        )
                        
                        driver_profile = db.query(DriverProfile).filter(
                            DriverProfile.user_id == driver_id
                        ).first()
                        
                        if driver_profile:
                            driver_profile.current_latitude = lat
                            driver_profile.current_longitude = lng
                            driver_profile.last_location_update = datetime.now(timezone.utc)
                            db.commit()
                            print(f"✅ Driver {driver_id} location saved to DB")
                    else:
                        await websocket.send_json({"type": "error", "message": "Driver is not assigned to this shipment"})
                    
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Error processing WebSocket message: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(driver_id, websocket)
        print(f"🔌 Driver {driver_id} disconnected")
    finally:
        manager.disconnect(driver_id, websocket)
        db.close()

@app.websocket("/ws/notifications/{user_id}")
async def websocket_notifications(websocket: WebSocket, user_id: int):
    if await authenticate_websocket(websocket, user_id) is None:
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as e:
        print(f"WebSocket notifications error: {e}")
        manager.disconnect(user_id, websocket)

@app.websocket("/chat/ws/{shipment_id}/{user_id}")
async def websocket_chat_endpoint(websocket: WebSocket, shipment_id: int, user_id: int):
    from app.routers.chat import handle_chat_websocket
    await handle_chat_websocket(websocket, shipment_id, user_id)

app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(reviews.router)
app.include_router(chat.router)

@app.get("/")
def root():
    if SERVE_FRONTEND:
        return FileResponse(FRONTEND_DIRECTORY / "index.html")
    return {"message": "Cargo App API", "docs": "/docs", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/demo-info")
def get_demo_information():
    if DEMO_MODE:
        from app.demo import demo_information
        return demo_information()
    return {"enabled": False}


# The hosting service serves the real React build and API on the same origin.
FRONTEND_DIRECTORY = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if SERVE_FRONTEND:
    if not (FRONTEND_DIRECTORY / "index.html").is_file():
        raise RuntimeError("Build frontend/dist before enabling SERVE_FRONTEND.")
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIRECTORY / "assets"), name="assets")

    @app.get("/{frontend_path:path}", include_in_schema=False)
    def serve_frontend_page(frontend_path: str):
        if frontend_path in {"login", "register", "dashboard", "admin", "nova-posiljka", "profile", "forgot-password", "reset-password"}:
            return FileResponse(FRONTEND_DIRECTORY / "index.html")
        file = (FRONTEND_DIRECTORY / frontend_path).resolve()
        if FRONTEND_DIRECTORY.resolve() in file.parents and file.is_file():
            return FileResponse(file)
        raise HTTPException(status_code=404, detail="Not found")
