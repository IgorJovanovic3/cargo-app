from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# ========== USER SCHEMAS ==========

class UserBase(BaseModel):
    email: str
    full_name: str
    phone: str

class UserCreate(UserBase):
    password: str
    user_type: str = "client"
    is_company: Optional[int] = 0
    company_name: Optional[str] = None
    company_pib: Optional[str] = None
    company_mb: Optional[str] = None
    company_address: Optional[str] = None
    company_tax_number: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(UserBase):
    id: int
    user_type: str
    is_active: int
    is_company: Optional[int] = 0
    company_name: Optional[str] = None
    tokens: Optional[float] = 0.0
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ========== DRIVER PROFILE SCHEMAS ==========

class DriverProfileBase(BaseModel):
    vehicle_type: Optional[str] = None
    vehicle_subtype: Optional[str] = None
    fuel_type: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_plate: Optional[str] = None
    max_load_kg: Optional[float] = None
    is_available: Optional[int] = 1

class DriverProfileCreate(DriverProfileBase):
    pass

class DriverProfileResponse(DriverProfileBase):
    id: int
    user_id: int
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None

    class Config:
        from_attributes = True

# ========== SHIPMENT SCHEMAS ==========

class ShipmentBase(BaseModel):
    pickup_address: str
    pickup_lat: float
    pickup_long: float
    delivery_address: str
    delivery_lat: float
    delivery_long: float
    cargo_description: str
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    price: float
    is_urgent: Optional[bool] = False

class ShipmentCreate(ShipmentBase):
    pass

class ShipmentUpdate(BaseModel):
    pickup_address: Optional[str] = None
    delivery_address: Optional[str] = None
    cargo_description: Optional[str] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    price: Optional[float] = None
    is_urgent: Optional[bool] = None

class ShipmentStatusUpdate(BaseModel):
    status: str

class ShipmentResponse(ShipmentBase):
    id: int
    client_id: int
    driver_id: Optional[int] = None
    status: str
    qr_code: Optional[str] = None
    signature: Optional[str] = None
    signature_date: Optional[datetime] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ========== NOTIFICATION SCHEMAS ==========

class NotificationBase(BaseModel):
    title: str
    message: str
    type: Optional[str] = None
    related_shipment_id: Optional[int] = None

class NotificationCreate(NotificationBase):
    user_id: int

class Notification(NotificationBase):
    id: int
    user_id: int
    is_read: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# ========== REVIEW SCHEMAS ==========

class ReviewBase(BaseModel):
    rating: int
    comment: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class ReviewResponse(ReviewBase):
    id: int
    shipment_id: int
    reviewer_id: int
    driver_id: Optional[int] = None
    client_id: Optional[int] = None
    review_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class DriverRatingResponse(BaseModel):
    average_rating: float
    total_reviews: int
    histogram: dict

# ========== CHAT SCHEMAS ==========

class ChatMessageBase(BaseModel):
    message: str

class ChatMessageCreate(ChatMessageBase):
    shipment_id: int
    sender_id: int

class ChatMessageResponse(ChatMessageBase):
    id: int
    shipment_id: int
    sender_id: int
    sender_name: Optional[str] = None
    is_read: int
    created_at: datetime

    class Config:
        from_attributes = True

# ========== LOCATION SCHEMA ==========

class LocationUpdate(BaseModel):
    lat: float
    lng: float
    shipment_id: int