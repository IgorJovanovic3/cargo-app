"""Deliberately public demo accounts; never seed them into a real user database."""

from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext

from app.database import Base, SessionLocal, engine
from app.models import ChatMessage, DriverProfile, Notification, Shipment, ShipmentStatus, User, UserType

DEMO_PASSWORD = "CargoDemo2026!"
DEMO_CLIENT_EMAIL = "client@cargo.example"
DEMO_DRIVER_EMAIL = "driver@cargo.example"


def reset_demo_data():
    if engine.url.get_backend_name() != "sqlite":
        raise RuntimeError("Public demo mode requires its own disposable SQLite database.")
    with SessionLocal() as db:
        existing_emails = {email for (email,) in db.query(User.email).all()}
        if not existing_emails.issubset({DEMO_CLIENT_EMAIL, DEMO_DRIVER_EMAIL}):
            raise RuntimeError("Refusing to reset a database containing non-demo users.")
        for table in reversed(Base.metadata.sorted_tables):
            if table.name != "pricing":
                db.execute(table.delete())
        password_hash = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(DEMO_PASSWORD)
        client = User(email=DEMO_CLIENT_EMAIL, hashed_password=password_hash,
                      full_name="Demo Client", phone="000000000", user_type=UserType.CLIENT)
        driver = User(email=DEMO_DRIVER_EMAIL, hashed_password=password_hash,
                      full_name="Demo Driver", phone="000000000", user_type=UserType.DRIVER)
        db.add_all([client, driver])
        db.flush()
        now = datetime.now(timezone.utc)
        db.add(DriverProfile(user_id=driver.id, vehicle_type="car", vehicle_plate="DEMO-001",
                             max_load_kg=100, current_latitude=44.807, current_longitude=20.466,
                             last_location_update=now))
        rows = []
        scenarios = [
            (ShipmentStatus.PENDING, "Demo documents", 450, 0),
            (ShipmentStatus.PENDING, "Demo parcel", 750, 1),
            (ShipmentStatus.ACCEPTED, "Demo office supplies", 900, 2),
            (ShipmentStatus.DELIVERED, "Demo books", 1200, 30),
            (ShipmentStatus.DELIVERED, "Demo sample package", 650, 60),
            (ShipmentStatus.CANCELLED, "Demo cancelled delivery", 500, 90),
        ]
        for status, description, price, days in scenarios:
            created = now - timedelta(days=days)
            item = Shipment(
                client_id=client.id,
                driver_id=None if status == ShipmentStatus.PENDING else driver.id,
                pickup_address="Demo pickup point — Belgrade",
                pickup_lat=44.8125, pickup_lng=20.4612,
                delivery_address="Demo delivery point — Belgrade",
                delivery_lat=44.7963, delivery_lng=20.4744,
                cargo_description=description, weight_kg=2, dimensions="20x15x10",
                status=status, price=price, created_at=created,
                accepted_at=created if status != ShipmentStatus.PENDING else None,
                delivered_at=created if status == ShipmentStatus.DELIVERED else None,
            )
            db.add(item)
            rows.append(item)
        db.flush()
        from app.routers.shipments import generate_qr_code
        for item in rows:
            item.qr_code = generate_qr_code(item.id)
        db.add_all([
            ChatMessage(shipment_id=rows[2].id, sender_id=client.id,
                        message="Demo message: the parcel is ready for pickup."),
            ChatMessage(shipment_id=rows[2].id, sender_id=driver.id,
                        message="Demo message: delivery accepted."),
            Notification(user_id=client.id, title="Demo delivery accepted",
                         message="Open a shipment to try the chat and tracking.",
                         type="shipment_accepted", related_shipment_id=rows[2].id),
        ])
        db.commit()


def demo_information():
    return {
        "enabled": True,
        "password": DEMO_PASSWORD,
        "accounts": [
            {"role": "client", "email": DEMO_CLIENT_EMAIL},
            {"role": "driver", "email": DEMO_DRIVER_EMAIL},
        ],
        "shared_data": True,
    }
