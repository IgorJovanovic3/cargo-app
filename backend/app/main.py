from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, shipments, notifications, admin, reviews, chat
from typing import Dict
import json
from datetime import datetime, timezone, timedelta
import asyncio

# ========== AUTO KREIRANJE TABELA I ADMINA ==========
from app.database import engine, SessionLocal
from app.models import Base, User, UserType
from passlib.context import CryptContext
import logging

# Kreiraj tabele ako ne postoje
print("🔧 Kreiranje tabela...")
Base.metadata.create_all(bind=engine)
print("✅ Tabele su kreirane (ili već postoje)")

# Kreiraj admin korisnika ako ne postoji
print("🔧 Provera admin korisnika...")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()

admin = db.query(User).filter(User.email == "admin@test.com").first()
if not admin:
    admin = User(
        email="admin@test.com",
        hashed_password=pwd_context.hash("admin123"),
        full_name="Admin User",
        phone="0610000000",
        user_type=UserType.ADMIN,
        is_active=1
    )
    db.add(admin)
    db.commit()
    print("✅ Admin korisnik kreiran (email: admin@test.com, password: admin123)")
else:
    print("✅ Admin korisnik već postoji")

# Kreiraj test klijenta ako ne postoji
client = db.query(User).filter(User.email == "klijent@test.com").first()
if not client:
    client = User(
        email="klijent@test.com",
        hashed_password=pwd_context.hash("123456"),
        full_name="Test Klijent",
        phone="0611234567",
        user_type=UserType.CLIENT,
        is_active=1
    )
    db.add(client)
    db.commit()
    print("✅ Test klijent kreiran (email: klijent@test.com, password: 123456)")
else:
    print("✅ Test klijent već postoji")

# Kreiraj test vozača ako ne postoji
driver = db.query(User).filter(User.email == "vozac@test.com").first()
if not driver:
    driver = User(
        email="vozac@test.com",
        hashed_password=pwd_context.hash("123456"),
        full_name="Test Vozač",
        phone="0611234568",
        user_type=UserType.DRIVER,
        is_active=1
    )
    db.add(driver)
    db.commit()
    
    # Kreiraj i driver profile
    from app.models import DriverProfile
    driver_profile = DriverProfile(user_id=driver.id)
    db.add(driver_profile)
    db.commit()
    print("✅ Test vozač kreiran (email: vozac@test.com, password: 123456)")
else:
    print("✅ Test vozač već postoji")

db.close()
# ========== KRAJ AUTO KREIRANJA ==========

app = FastAPI(
    title="Cargo App API",
    description="API za cargo/logistika aplikaciju",
    version="1.0.0"
)

# CORS - dozvoli sve za sada (kasnije možeš suziti)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"✅ User {user_id} connected via WebSocket")

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        print(f"❌ User {user_id} disconnected")

    async def send_to_user(self, user_id: int, data: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(data)
                return True
            except:
                self.disconnect(user_id)
        return False

    async def broadcast_driver_location(self, client_id: int, shipment_id: int, lat: float, lng: float, driver_id: int):
        await self.send_to_user(client_id, {
            "type": "driver_location",
            "shipment_id": shipment_id,
            "lat": lat,
            "lng": lng,
            "driver_id": driver_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

manager = ConnectionManager()

# WebSocket endpoint za klijente
@app.websocket("/ws/client/{client_id}")
async def websocket_client(websocket: WebSocket, client_id: int):
    await manager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket client error: {e}")
        manager.disconnect(client_id)

# WebSocket endpoint za vozače
@app.websocket("/ws/driver/{driver_id}")
async def websocket_driver(websocket: WebSocket, driver_id: int):
    from app.database import SessionLocal
    from app.models import Shipment, DriverProfile
    
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
                    
                    print(f"📍 Driver {driver_id} location update: ({lat}, {lng}) for shipment {shipment_id}")
                    
                    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
                    
                    if shipment and shipment.client_id:
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
                    
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Error processing WebSocket message: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(driver_id)
        print(f"🔌 Driver {driver_id} disconnected")
    finally:
        db.close()

# WebSocket za notifikacije
@app.websocket("/ws/notifications/{user_id}")
async def websocket_notifications(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WebSocket notifications error: {e}")
        manager.disconnect(user_id)

# Uključi routere
app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(reviews.router)
app.include_router(chat.router)

@app.get("/")
def root():
    return {
        "message": "Cargo App API",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}