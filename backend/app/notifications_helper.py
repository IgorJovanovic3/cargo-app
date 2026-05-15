from sqlalchemy.orm import Session
from datetime import datetime
from app.models import Notification

def create_notification(db: Session, user_id: int, title: str, message: str, type: str, shipment_id: int = None):
    """Kreira notifikaciju u bazi"""
    try:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            related_shipment_id=shipment_id,
            created_at=datetime.utcnow(),
            is_read=0
        )
        db.add(notification)
        db.flush()  # Ne commit-uj odmah, neka se commituje spolja
        print(f"✅ Notifikacija kreirana: {title} za korisnika {user_id}")
        return notification
    except Exception as e:
        print(f"❌ Greška pri kreiranju notifikacije: {e}")
        return None