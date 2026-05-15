from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.database import get_db
from app.models import User, Notification
from app.schemas import NotificationResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()
    
    print(f"📩 Dohvaćeno {len(notifications)} notifikacija za korisnika {current_user.id}")
    return notifications

@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notifikacija nije pronađena")
    
    notification.is_read = 1
    db.commit()
    
    return {"message": "Notifikacija označena kao pročitana"}

@router.post("/mark-all-read")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    
    return {"message": "Sve notifikacije označene kao pročitane"}

def create_notification(db: Session, user_id: int, title: str, message: str, type: str, shipment_id: int = None):
    """Kreira notifikaciju i odmah commit-u"""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        related_shipment_id=shipment_id,
        created_at=datetime.now(timezone.utc),
        is_read=0
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    print(f"✅ Notifikacija #{notif.id} kreirana: {title} za korisnika {user_id}")
    return notif