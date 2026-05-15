from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, shipments, notifications, admin, reviews, chat
from typing import Dict
import json
from datetime import datetime, timezone, timedelta
import asyncio

# Kreiraj tabele
Base.metadata.create_all(bind=engine)

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