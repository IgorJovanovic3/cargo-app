# app/routers/notifications.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Notification
from app.schemas import Notification as NotificationSchema
from app.schemas import NotificationCreate
from app.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dohvati sve notifikacije za trenutnog korisnika"""
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()
    
    return notifications

@router.get("/unread/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dohvati broj nepročitanih notifikacija"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == 0
    ).count()
    
    return {"unread_count": count}

@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Označi notifikaciju kao pročitanu"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notifikacija nije pronađena")
    
    notification.is_read = 1
    db.commit()
    
    return {"status": "ok"}

@router.post("/mark-all-read")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Označi sve notifikacije kao pročitane"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    
    return {"status": "ok"}