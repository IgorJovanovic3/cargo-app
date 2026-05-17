from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, shipments, notifications, admin, reviews, chat
from typing import Dict
import json
from datetime import datetime, timezone, timedelta
import asyncio

# ========== AUTO KREIRANJE TABELA I KORISNIKA ==========
from app.database import SessionLocal
from app.models import Base, User, UserType, DriverProfile, ChatMessage
from passlib.context import CryptContext

# Kreiraj tabele ako ne postoje
print("🔧 Kreiranje tabela...")
Base.metadata.create_all(bind=engine)
print("✅ Tabele su kreirane (ili već postoje)")

# Kreiraj administrator korisnika ako ne postoji
print("🔧 Provera administrator korisnika...")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db_session = SessionLocal()

administrator = db_session.query(User).filter(User.email == "admin@test.com").first()
if not administrator:
    administrator = User(
        email="admin@test.com",
        hashed_password=pwd_context.hash("admin123"),
        full_name="Administrator",
        phone="0610000000",
        user_type=UserType.ADMIN,
        is_active=1
    )
    db_session.add(administrator)
    db_session.commit()
    print("✅ Administrator korisnik kreiran (email: admin@test.com, password: admin123)")
else:
    print("✅ Administrator korisnik već postoji")

# Kreiraj test klijenta ako ne postoji
client_user = db_session.query(User).filter(User.email == "klijent@test.com").first()
if not client_user:
    client_user = User(
        email="klijent@test.com",
        hashed_password=pwd_context.hash("123456"),
        full_name="Test Klijent",
        phone="0611234567",
        user_type=UserType.CLIENT,
        is_active=1
    )
    db_session.add(client_user)
    db_session.commit()
    print("✅ Test klijent kreiran (email: klijent@test.com, password: 123456)")
else:
    print("✅ Test klijent već postoji")

# Kreiraj test vozača ako ne postoji
driver_user = db_session.query(User).filter(User.email == "vozac@test.com").first()
if not driver_user:
    driver_user = User(
        email="vozac@test.com",
        hashed_password=pwd_context.hash("123456"),
        full_name="Test Vozač",
        phone="0611234568",
        user_type=UserType.DRIVER,
        is_active=1
    )
    db_session.add(driver_user)
    db_session.commit()
    
    # Kreiraj i driver profile
    driver_profile = DriverProfile(user_id=driver_user.id)
    db_session.add(driver_profile)
    db_session.commit()
    print("✅ Test vozač kreiran (email: vozac@test.com, password: 123456)")
else:
    print("✅ Test vozač već postoji")

db_session.close()
# ========== KRAJ AUTO KREIRANJA ==========

app = FastAPI(
    title="Cargo App API",
    description="API za cargo/logistika aplikaciju",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cargo-frontend-8k22.onrender.com",
        "https://cargo-frontend.onrender.com",
        "https://cargo-backend-mqx7.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.chat_connections: Dict[str, WebSocket] = {}  # za chat: key = f"{shipment_id}_{user_id}"

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

    # Chat metode
    async def connect_chat(self, shipment_id: int, user_id: int, websocket: WebSocket):
        await websocket.accept()
        key = f"{shipment_id}_{user_id}"
        self.chat_connections[key] = websocket
        print(f"💬 Chat connected: shipment {shipment_id}, user {user_id}")
        return key

    def disconnect_chat(self, shipment_id: int, user_id: int):
        key = f"{shipment_id}_{user_id}"
        self.chat_connections.pop(key, None)
        print(f"💬 Chat disconnected: shipment {shipment_id}, user {user_id}")

    async def send_chat_message(self, shipment_id: int, recipient_id: int, data: dict):
        key = f"{shipment_id}_{recipient_id}"
        if key in self.chat_connections:
            try:
                await self.chat_connections[key].send_json(data)
                return True
            except:
                self.disconnect_chat(shipment_id, recipient_id)
        return False

manager = ConnectionManager()

# WebSocket endpoint za klijente (praćenje lokacije)
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

# WebSocket endpoint za vozače (slanje lokacije)
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

# ========== CHAT WEBSOCKET ENDPOINT (POTPUNO ISPRAVLJEN SA FILTRIRANJEM) ==========
@app.websocket("/chat/ws/{shipment_id}/{user_id}")
async def websocket_chat(websocket: WebSocket, shipment_id: int, user_id: int):
    from app.database import SessionLocal
    from app.models import Shipment, User, ChatMessage
    
    await websocket.accept()
    db = SessionLocal()
    
    # Pravimo unique key za ovu konekciju
    connection_key = f"{shipment_id}_{user_id}"
    
    try:
        # Proveri da li shipment postoji
        shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
        if not shipment:
            await websocket.send_json({"type": "error", "message": "Shipment not found"})
            await websocket.close()
            return
        
        # Odredi drugog učesnika
        if user_id == shipment.client_id:
            other_participant_id = shipment.driver_id
            user_role = "client"
        elif user_id == shipment.driver_id:
            other_participant_id = shipment.client_id
            user_role = "driver"
        else:
            await websocket.send_json({"type": "error", "message": "You are not part of this shipment"})
            await websocket.close()
            return
        
        # Sačuvaj konekciju
        manager.chat_connections[connection_key] = websocket
        
        print(f"💬 Chat connected: shipment {shipment_id}, user {user_id} ({user_role}) -> other: {other_participant_id}")
        print(f"💬 Active chat connections: {list(manager.chat_connections.keys())}")
        
        # Obeleži nepročitane poruke
        if other_participant_id:
            db.query(ChatMessage).filter(
                ChatMessage.shipment_id == shipment_id,
                ChatMessage.sender_id == other_participant_id,
                ChatMessage.is_read == 0
            ).update({"is_read": 1})
            db.commit()
        
        while True:
            data = await websocket.receive_text()
            print(f"📨 Chat from user {user_id} (shipment {shipment_id}): {data[:100]}")
            
            try:
                json_data = json.loads(data)
                
                if json_data.get("type") == "message":
                    message_text = json_data.get("message", "")
                    
                    if message_text.strip():
                        # Sačuvaj poruku
                        new_message = ChatMessage(
                            shipment_id=shipment_id,  # KORISTI TRENUTNI shipment_id
                            sender_id=user_id,
                            message=message_text.strip(),
                            is_read=0,
                            created_at=datetime.now(timezone.utc)
                        )
                        db.add(new_message)
                        db.commit()
                        db.refresh(new_message)
                        
                        # Dohvati ime
                        sender = db.query(User).filter(User.id == user_id).first()
                        sender_name = sender.full_name if sender else f"User {user_id}"
                        
                        # Pošalji SAMO drugom učesniku i SAMO za ovaj shipment
                        if other_participant_id:
                            other_key = f"{shipment_id}_{other_participant_id}"
                            message_data = {
                                "type": "new_message",
                                "shipment_id": shipment_id,  # EKSPLICITNO ŠALJEMO shipment_id
                                "message_id": new_message.id,
                                "sender_id": user_id,
                                "sender_name": sender_name,
                                "message": message_text.strip(),
                                "timestamp": new_message.created_at.isoformat()
                            }
                            
                            # Proveri da li je drugi korisnik povezan ZA ISTI SHIPMENT
                            if other_key in manager.chat_connections:
                                try:
                                    await manager.chat_connections[other_key].send_json(message_data)
                                    print(f"💬 Message sent to {other_participant_id} for shipment {shipment_id}")
                                except Exception as e:
                                    print(f"Failed to send: {e}")
                            else:
                                print(f"⚠️ User {other_participant_id} not connected for shipment {shipment_id}")
                                print(f"⚠️ Available keys: {list(manager.chat_connections.keys())}")
                        
                        # Potvrda pošiljaocu
                        await websocket.send_json({
                            "type": "message_sent",
                            "status": "ok",
                            "message_id": new_message.id
                        })
                        
            except json.JSONDecodeError as e:
                print(f"Invalid JSON: {data}, error: {e}")
            except Exception as e:
                print(f"Error processing message: {e}")
                import traceback
                traceback.print_exc()
                
    except WebSocketDisconnect:
        print(f"💬 Chat disconnected: shipment {shipment_id}, user {user_id}")
    except Exception as e:
        print(f"WebSocket chat error: {e}")
    finally:
        # Očisti konekciju
        manager.chat_connections.pop(connection_key, None)
        print(f"💬 Removed connection: {connection_key}")
        db.close()

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