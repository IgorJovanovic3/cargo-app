from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
import enum
from datetime import datetime, timezone

class UserType(str, enum.Enum):
    CLIENT = "client"
    DRIVER = "driver"
    ADMIN = "admin"

class ShipmentStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    user_type = Column(Enum(UserType), nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Podaci za firmu
    is_company = Column(Integer, default=0)
    company_name = Column(String(200), nullable=True)
    company_pib = Column(String(20), nullable=True)
    company_mb = Column(String(20), nullable=True)
    company_address = Column(String(255), nullable=True)
    company_tax_number = Column(String(50), nullable=True)
    
    # Tokeni (kredit)
    tokens = Column(Float, default=0.0)
    
    # Relacije
    shipments_sent = relationship("Shipment", foreign_keys="Shipment.client_id", back_populates="client")
    shipments_driven = relationship("Shipment", foreign_keys="Shipment.driver_id", back_populates="driver")
    driver_profile = relationship("DriverProfile", uselist=False, back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    reviews_given = relationship("Review", foreign_keys="Review.reviewer_id", back_populates="reviewer")
    reviews_received = relationship("Review", foreign_keys="Review.driver_id", back_populates="driver")

class DriverProfile(Base):
    __tablename__ = "driver_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    vehicle_type = Column(String(50))  # bike, motorcycle, car, van, truck
    vehicle_subtype = Column(String(50))  # electric, traditional, hybrid
    fuel_type = Column(String(30))  # petrol, diesel, electric, hybrid
    vehicle_year = Column(Integer)
    vehicle_plate = Column(String(20))
    max_load_kg = Column(Float)
    current_latitude = Column(Float)
    current_longitude = Column(Float)
    is_available = Column(Integer, default=1)
    last_location_update = Column(DateTime)
    
    user = relationship("User", back_populates="driver_profile")

class Shipment(Base):
    __tablename__ = "shipments"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    pickup_address = Column(Text, nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    
    delivery_address = Column(Text, nullable=False)
    delivery_lat = Column(Float, nullable=False)
    delivery_lng = Column(Float, nullable=False)
    
    cargo_description = Column(Text, nullable=False)
    weight_kg = Column(Float)
    dimensions = Column(String(50))
    
    status = Column(Enum(ShipmentStatus), default=ShipmentStatus.PENDING)
    price = Column(Float)
    is_urgent = Column(Integer, default=0)
    
    qr_code = Column(Text, nullable=True)
    signature = Column(Text, nullable=True)
    signature_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_at = Column(DateTime)
    picked_up_at = Column(DateTime)
    delivered_at = Column(DateTime)
    
    # Relacije
    client = relationship("User", foreign_keys=[client_id], back_populates="shipments_sent")
    driver = relationship("User", foreign_keys=[driver_id], back_populates="shipments_driven")
    notifications = relationship("Notification", back_populates="shipment")
    reviews = relationship("Review", back_populates="shipment")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50))
    is_read = Column(Integer, default=0)
    related_shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="notifications")
    shipment = relationship("Shipment", back_populates="notifications")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, unique=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    review_type = Column(String(20), default="driver")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    shipment = relationship("Shipment", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    driver = relationship("User", foreign_keys=[driver_id])
    client = relationship("User", foreign_keys=[client_id])

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    shipment = relationship("Shipment", foreign_keys=[shipment_id])
    sender = relationship("User", foreign_keys=[sender_id])

class PasswordReset(Base):
    __tablename__ = "password_resets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", foreign_keys=[user_id])

class Pricing(Base):
    __tablename__ = "pricing"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_class = Column(String(50), default="car")
    name = Column(String(100), nullable=False)
    price_per_km = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    base_price = Column(Float, nullable=False)
    urgent_multiplier = Column(Float, default=1.3)
    volumetric_divisor = Column(Integer, default=6000)
    max_weight_kg = Column(Float, default=100)
    description = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))