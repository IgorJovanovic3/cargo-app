from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from enum import Enum

# Enums
class UserType(str, Enum):
    CLIENT = "client"
    DRIVER = "driver"
    ADMIN = "admin"

class ShipmentStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# User schemas
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str
    user_type: UserType
# Samo za firme
    is_company: Optional[bool] = False
    company_name: Optional[str] = None
    company_pib: Optional[str] = None
    company_mb: Optional[str] = None
    company_address: Optional[str] = None
    company_tax_number: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str
    user_type: UserType
    is_active: int
    created_at: datetime
# Samo za firme    
    is_company: int
    company_name: Optional[str] = None
    company_pib: Optional[str] = None
    company_mb: Optional[str] = None
    company_address: Optional[str] = None
    company_tax_number: Optional[str] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None

# DriverProfile schemas
class DriverProfileCreate(BaseModel):
    vehicle_type: str
    vehicle_plate: str
    max_load_kg: float

class DriverProfileResponse(BaseModel):
    id: int
    user_id: int
    vehicle_type: Optional[str] = None
    vehicle_plate: Optional[str] = None
    max_load_kg: Optional[float] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    is_available: int
    last_location_update: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Shipment schemas
class ShipmentCreate(BaseModel):
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    cargo_description: str
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    price: float
    is_urgent: Optional[bool] = False

class ShipmentUpdate(BaseModel):
    status: Optional[ShipmentStatus] = None
    driver_id: Optional[int] = None

class ShipmentResponse(BaseModel):
    id: int
    client_id: int
    driver_id: Optional[int] = None
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    cargo_description: str
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    status: ShipmentStatus
    price: float
    created_at: datetime
    accepted_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ShipmentListResponse(BaseModel):
    shipments: list[ShipmentResponse]
    total: int

# Location schemas
class LocationUpdate(BaseModel):
    shipment_id: int
    lat: float
    lng: float

# Notification schemas
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: Optional[str] = None
    is_read: int
    related_shipment_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Review schemas
class ReviewCreate(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: int
    shipment_id: int
    reviewer_id: int
    driver_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class DriverRatingResponse(BaseModel):
    driver_id: int
    driver_name: str
    average_rating: float
    total_reviews: int
    reviews: List[ReviewResponse]

class ChatMessageCreate(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    id: int
    shipment_id: int
    sender_id: int
    message: str
    is_read: int
    created_at: datetime
    
    class Config:
        from_attributes = True