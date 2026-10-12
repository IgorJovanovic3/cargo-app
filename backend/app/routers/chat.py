from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict
from datetime import datetime, timezone
from app.database import get_db, SessionLocal
from app.models import User, UserType, Shipment, ShipmentStatus, ChatMessage
from app.schemas import ChatMessageResponse
from app.routers.auth import get_current_user
from app.websocket_auth import authenticate_websocket
from app.config import DEMO_MODE
import json

router = APIRouter(prefix="/chat", tags=["chat"])

# Keep rooms separate and support several browser tabs per participant.
class ChatConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, shipment_id, user_id, websocket):
        await websocket.accept(subprotocol="cargo")
        self.active_connections.setdefault((shipment_id, user_id), set()).add(websocket)

    def disconnect(self, shipment_id, user_id, websocket):
        sockets = self.active_connections.get((shipment_id, user_id), set())
        sockets.discard(websocket)
        if not sockets:
            self.active_connections.pop((shipment_id, user_id), None)

    async def send_to_user(self, shipment_id, user_id, data):
        sent = False
        for websocket in tuple(self.active_connections.get((shipment_id, user_id), ())):
            try:
                await websocket.send_json(data)
                sent = True
            except Exception:
                self.disconnect(shipment_id, user_id, websocket)
        return sent

chat_manager = ChatConnectionManager()


@router.websocket("/ws/{shipment_id}/{user_id}")
async def websocket_chat(websocket: WebSocket, shipment_id: int, user_id: int):
    if await authenticate_websocket(websocket, user_id) is None:
        return
    db = SessionLocal()
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment or user_id not in {shipment.client_id, shipment.driver_id}:
        db.close()
        await websocket.close(code=1008)
        return
    await chat_manager.connect(shipment_id, user_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                json_data = json.loads(data)
                
                if json_data.get("type") == "message":
                    message_text = json_data.get("message")
                    if not isinstance(message_text, str) or not message_text.strip() or len(message_text) > 2000:
                        await websocket.send_json({"type": "error", "message": "Message must contain 1–2000 characters."})
                        continue
                    if DEMO_MODE and db.query(ChatMessage).count() >= 200:
                        await websocket.send_json({"type": "error", "message": "The demo message limit has been reached."})
                        continue
                    
                    # Pronađi primaoca
                    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
                    if not shipment or user_id not in {shipment.client_id, shipment.driver_id}:
                        continue
                    
                    recipient_id = shipment.driver_id if user_id == shipment.client_id else shipment.client_id
                    
                    # Dohvati ime pošiljaoca
                    sender = db.query(User).filter(User.id == user_id).first()
                    sender_name = sender.full_name if sender else "Neko"
                    
                    # Sačuvaj poruku u bazu
                    new_message = ChatMessage(
                        shipment_id=shipment_id,
                        sender_id=user_id,
                        message=message_text,
                        created_at=datetime.now(timezone.utc),
                        is_read=0
                    )
                    db.add(new_message)
                    db.commit()
                    
                    if recipient_id:
                        # Pošalji poruku primaocu
                        await chat_manager.send_to_user(shipment_id, recipient_id, {
                            "type": "new_message",
                            "shipment_id": shipment_id,
                            "sender_id": user_id,
                            "sender_name": sender_name,
                            "message": message_text,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                        
                        # Pošalji potvrdu pošiljaocu
                        await chat_manager.send_to_user(shipment_id, user_id, {
                            "type": "message_sent",
                            "message_id": new_message.id
                        })
                    
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Chat error: {e}")
                
    except WebSocketDisconnect:
        chat_manager.disconnect(shipment_id, user_id, websocket)
    finally:
        chat_manager.disconnect(shipment_id, user_id, websocket)
        db.close()


@router.get("/messages/{shipment_id}")
async def get_chat_messages(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Dohvata sve poruke za pošiljku"""
    
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if shipment.client_id != current_user.id and shipment.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nemate pristup ovom chatu")
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.shipment_id == shipment_id
    ).order_by(ChatMessage.created_at.asc()).all()
    
    return messages


@router.post("/mark-read/{shipment_id}")
async def mark_messages_as_read(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Označava sve poruke u chatu kao pročitane"""
    
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if shipment.client_id != current_user.id and shipment.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nemate pristup ovom chatu")
    
    db.query(ChatMessage).filter(
        ChatMessage.shipment_id == shipment_id,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    
    return {"message": "Poruke označene kao pročitane"}

# ========== POMOĆNA FUNKCIJA ZA MAIN.PY ==========

async def handle_chat_websocket(websocket: WebSocket, shipment_id: int, user_id: int):
    """Pomoćna funkcija za pozivanje iz main.py"""
    await websocket_chat(websocket, shipment_id, user_id)
