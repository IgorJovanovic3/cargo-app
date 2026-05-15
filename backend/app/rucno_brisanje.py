from app.database import SessionLocal
from app.models import Shipment, Notification

db = SessionLocal()

# Prvo obriši notifikacije za pošiljku #4
deleted_notifs = db.query(Notification).filter(Notification.related_shipment_id == 4).delete()
print(f"Obrisano {deleted_notifs} notifikacija za pošiljku #4")

# Onda obriši pošiljku
shipment = db.query(Shipment).filter(Shipment.id == 4).first()
if shipment:
    db.delete(shipment)
    print("Pošiljka #4 je obrisana")
else:
    print("Pošiljka #4 ne postoji")

db.commit()
db.close()
exit()