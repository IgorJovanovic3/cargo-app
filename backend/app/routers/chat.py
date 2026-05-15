from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict
from datetime import datetime, timezone
from app.database import get_db, SessionLocal
from app.models import User, UserType, Shipment, ShipmentStatus, ChatMessage
from app.schemas import ChatMessageResponse
from app.routers.auth import get_current_user
import json

router = APIRouter(prefix="/chat", tags=["chat"])

# WebSocket za chat
class ChatConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}  # user_id -> websocket

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"💬 User {user_id} connected to chat")

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        print(f"💬 User {user_id} disconnected from chat")

    async def send_to_user(self, user_id: int, data: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(data)
                return True
            except:
                self.disconnect(user_id)
        return False

chat_manager = ChatConnectionManager()


@router.websocket("/ws/{shipment_id}/{user_id}")
async def websocket_chat(websocket: WebSocket, shipment_id: int, user_id: int):
    await chat_manager.connect(user_id, websocket)
    db = SessionLocal()
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                json_data = json.loads(data)
                
                if json_data.get("type") == "message":
                    message_text = json_data.get("message")
                    
                    # Pronađi primaoca
                    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
                    if not shipment:
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
                        await chat_manager.send_to_user(recipient_id, {
                            "type": "new_message",
                            "shipment_id": shipment_id,
                            "sender_id": user_id,
                            "sender_name": sender_name,
                            "message": message_text,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                        
                        # Pošalji potvrdu pošiljaocu
                        await chat_manager.send_to_user(user_id, {
                            "type": "message_sent",
                            "message_id": new_message.id
                        })
                    
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"Chat error: {e}")
                
    except WebSocketDisconnect:
        chat_manager.disconnect(user_id)
    finally:
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