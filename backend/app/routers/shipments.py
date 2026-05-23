from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.models import User, UserType, Shipment, ShipmentStatus, DriverProfile, Pricing
from app.schemas import (
    ShipmentCreate, ShipmentResponse, 
    LocationUpdate
)
from app.routers.auth import get_current_user
from app.routers.notifications import create_notification
import requests
import qrcode
import base64
from io import BytesIO
import pandas as pd
import io
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/shipments", tags=["shipments"])

def generate_qr_code(shipment_id):
    qr_data = f"CARGO:{shipment_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="#667eea", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"


def approximate_distance(lat1, lng1, lat2, lng2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def get_suggested_class(weight_kg: float, db: Session) -> str:
    """Predlaže odgovarajuću klasu vozila na osnovu težine"""
    pricing_options = db.query(Pricing).filter(Pricing.is_active == 1).order_by(Pricing.max_weight_kg).all()
    for option in pricing_options:
        if weight_kg <= option.max_weight_kg:
            return option.vehicle_class
    return "truck"


# ========== KREIRANJE POŠILJKE ==========
@router.post("/create", response_model=ShipmentResponse)
async def create_shipment(
    shipment: ShipmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.CLIENT:
        raise HTTPException(status_code=403, detail="Samo klijenti mogu kreirati pošiljke")
    
    # ShipmentCreate ima pickup_long i delivery_long (ne pickup_lng/delivery_lng)
    new_shipment = Shipment(
        client_id=current_user.id,
        pickup_address=shipment.pickup_address,
        pickup_lat=shipment.pickup_lat,
        pickup_lng=shipment.pickup_long,      # <-- ISPRAVLJENO
        delivery_address=shipment.delivery_address,
        delivery_lat=shipment.delivery_lat,
        delivery_lng=shipment.delivery_long,  # <-- ISPRAVLJENO
        cargo_description=shipment.cargo_description,
        weight_kg=shipment.weight_kg,
        dimensions=shipment.dimensions,
        price=shipment.price,
        status=ShipmentStatus.PENDING,
        is_urgent=1 if shipment.is_urgent else 0
    )
    
    db.add(new_shipment)
    db.commit()
    db.refresh(new_shipment)
    
    qr_code_base64 = generate_qr_code(new_shipment.id)
    new_shipment.qr_code = qr_code_base64
    db.commit()
    db.refresh(new_shipment)
    
    return new_shipment


# ========== DOHVATI POŠILJKE ZA KLIJENTA ==========
@router.get("/client/")
async def get_client_shipments(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    sort: str = "newest",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.CLIENT:
        raise HTTPException(status_code=403, detail="Samo klijenti mogu videti svoje pošiljke")
    
    query = db.query(Shipment).filter(Shipment.client_id == current_user.id)
    
    if status:
        try:
            query = query.filter(Shipment.status == ShipmentStatus(status))
        except:
            pass
    
    if search:
        query = query.filter(
            (Shipment.pickup_address.contains(search)) |
            (Shipment.delivery_address.contains(search))
        )
    
    if sort == "newest":
        query = query.order_by(Shipment.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Shipment.created_at.asc())
    elif sort == "price_asc":
        query = query.order_by(Shipment.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Shipment.price.desc())
    else:
        query = query.order_by(Shipment.created_at.desc())
    
    total = query.count()
    offset = (page - 1) * limit
    shipments = query.offset(offset).limit(limit).all()
    
    return {
        "shipments": shipments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1
    }


# ========== DOHVATI DOSTUPNE POŠILJKE ZA VOZAČE ==========
@router.get("/available/")
async def get_available_shipments(
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu videti dostupne pošiljke")
    
    query = db.query(Shipment).filter(Shipment.status == ShipmentStatus.PENDING)
    
    total = query.count()
    offset = (page - 1) * limit
    shipments = query.order_by(Shipment.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "shipments": shipments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1
    }


# ========== DOHVATI POŠILJKE ZA VOZAČA ==========
@router.get("/driver/")
async def get_driver_shipments(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    sort: str = "newest",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu videti svoje pošiljke")
    
    query = db.query(Shipment).filter(Shipment.driver_id == current_user.id)
    
    if status:
        try:
            query = query.filter(Shipment.status == ShipmentStatus(status))
        except:
            pass
    
    if search:
        query = query.filter(
            (Shipment.pickup_address.contains(search)) |
            (Shipment.delivery_address.contains(search))
        )
    
    if sort == "newest":
        query = query.order_by(Shipment.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Shipment.created_at.asc())
    elif sort == "price_asc":
        query = query.order_by(Shipment.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Shipment.price.desc())
    else:
        query = query.order_by(Shipment.created_at.desc())
    
    total = query.count()
    offset = (page - 1) * limit
    shipments = query.offset(offset).limit(limit).all()
    
    return {
        "shipments": shipments,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1
    }


# ========== AŽURIRANJE POŠILJKE ==========
@router.put("/{shipment_id}")
async def update_shipment(
    shipment_id: int,
    shipment_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if current_user.user_type == UserType.DRIVER and shipment.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste dodeljeni ovoj pošiljci")
    if current_user.user_type == UserType.CLIENT and shipment.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste vlasnik ove pošiljke")
    
    if "pickup_address" in shipment_data:
        shipment.pickup_address = shipment_data["pickup_address"]
    if "delivery_address" in shipment_data:
        shipment.delivery_address = shipment_data["delivery_address"]
    if "cargo_description" in shipment_data:
        shipment.cargo_description = shipment_data["cargo_description"]
    if "weight_kg" in shipment_data:
        shipment.weight_kg = shipment_data["weight_kg"]
    if "dimensions" in shipment_data:
        shipment.dimensions = shipment_data["dimensions"]
    
    db.commit()
    db.refresh(shipment)
    
    return {"message": "Pošiljka ažurirana", "shipment": shipment}


# ========== ZAVRŠETAK DOSTAVE SA POTPISOM ==========
@router.put("/{shipment_id}/complete")
async def complete_shipment(
    shipment_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if shipment.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste dodeljeni ovoj pošiljci")
    
    shipment.signature = data.get("signature")
    shipment.signature_date = datetime.now(timezone.utc)
    shipment.status = ShipmentStatus.DELIVERED
    shipment.delivered_at = datetime.now(timezone.utc)
    
    db.commit()
    
    create_notification(
        db=db,
        user_id=shipment.client_id,
        title="📦 Pošiljka dostavljena",
        message=f"Vaša pošiljka #{shipment_id} je uspešno dostavljena. Potpis je sačuvan.",
        type="shipment_delivered",
        shipment_id=shipment_id
    )
    
    return {"message": "Dostava završena", "signature": shipment.signature}


# ========== PRIHVATANJE POŠILJKE ==========
@router.post("/{shipment_id}/accept")
async def accept_shipment(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu prihvatiti pošiljku")
    
    shipment = db.query(Shipment).filter(
        Shipment.id == shipment_id,
        Shipment.status == ShipmentStatus.PENDING
    ).first()
    
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena ili nije dostupna")
    
    shipment.driver_id = current_user.id
    shipment.status = ShipmentStatus.ACCEPTED
    shipment.accepted_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(shipment)
    
    create_notification(
        db=db,
        user_id=shipment.client_id,
        title="✅ Pošiljka prihvaćena",
        message=f"Vozač {current_user.full_name} je prihvatio vašu pošiljku #{shipment_id}",
        type="shipment_accepted",
        shipment_id=shipment_id
    )
    
    return {"message": "Pošiljka prihvaćena", "shipment": shipment}


# ========== AŽURIRANJE STATUSA ==========
@router.put("/{shipment_id}/status")
async def update_shipment_status(
    shipment_id: int,
    status_update: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if current_user.user_type == UserType.DRIVER and shipment.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste dodeljeni ovoj pošiljci")
    
    if current_user.user_type == UserType.CLIENT and shipment.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste vlasnik ove pošiljke")
    
    new_status = status_update.get("status")
    status_mapping = {
        "accepted": ShipmentStatus.ACCEPTED,
        "picked_up": ShipmentStatus.PICKED_UP,
        "in_transit": ShipmentStatus.IN_TRANSIT,
        "delivered": ShipmentStatus.DELIVERED,
        "cancelled": ShipmentStatus.CANCELLED
    }
    
    if new_status not in status_mapping:
        raise HTTPException(status_code=400, detail="Nevalidan status")
    
    shipment.status = status_mapping[new_status]
    
    if new_status == "picked_up":
        shipment.picked_up_at = datetime.now(timezone.utc)
    elif new_status == "delivered":
        shipment.delivered_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(shipment)
    
    status_messages = {
        "picked_up": ("📦 Pošiljka preuzeta", f"Vozač je preuzeo vašu pošiljku #{shipment_id}"),
        "in_transit": ("🚚 Pošiljka u transportu", f"Vaša pošiljka #{shipment_id} je na putu"),
        "delivered": ("🏁 Pošiljka dostavljena", f"Vaša pošiljka #{shipment_id} je uspešno dostavljena!")
    }
    
    if new_status in status_messages:
        title, message = status_messages[new_status]
        create_notification(
            db=db,
            user_id=shipment.client_id,
            title=title,
            message=message,
            type=f"shipment_{new_status}",
            shipment_id=shipment_id
        )
    
    return {"message": "Status ažuriran", "shipment": shipment}


# ========== LOKACIJA ==========
@router.post("/location")
async def update_driver_location(
    location: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu slati lokaciju")
    
    shipment = db.query(Shipment).filter(
        Shipment.id == location.shipment_id,
        Shipment.driver_id == current_user.id
    ).first()
    
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    driver_profile = db.query(DriverProfile).filter(
        DriverProfile.user_id == current_user.id
    ).first()
    
    if driver_profile:
        driver_profile.current_latitude = location.lat
        driver_profile.current_longitude = location.lng
        driver_profile.last_location_update = datetime.now(timezone.utc)
        db.commit()
    
    return {"status": "ok", "message": "Lokacija primljena"}


@router.get("/{shipment_id}/location")
async def get_shipment_location(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if shipment.driver_id:
        driver_profile = db.query(DriverProfile).filter(
            DriverProfile.user_id == shipment.driver_id
        ).first()
        
        if driver_profile and driver_profile.current_latitude:
            return {
                "lat": driver_profile.current_latitude,
                "lng": driver_profile.current_longitude,
                "last_update": driver_profile.last_location_update
            }
    
    return {"lat": None, "lng": None, "last_update": None}


# ========== IZRAČUN CENE ==========
@router.post("/calculate-price")
async def calculate_price(
    pickup_lat: float,
    pickup_lng: float,
    delivery_lat: float,
    delivery_lng: float,
    weight_kg: float = 0,
    length_cm: float = 0,
    width_cm: float = 0,
    height_cm: float = 0,
    is_urgent: bool = False,
    vehicle_class: str = "car",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{pickup_lng},{pickup_lat};{delivery_lng},{delivery_lat}?overview=false"
        response = requests.get(osrm_url, timeout=5)
        data = response.json()
        
        if data.get("code") == "Ok":
            distance_meters = data["routes"][0]["distance"]
            distance_km = distance_meters / 1000
        else:
            distance_km = approximate_distance(pickup_lat, pickup_lng, delivery_lat, delivery_lng)
    except:
        distance_km = approximate_distance(pickup_lat, pickup_lng, delivery_lat, delivery_lng)
    
    pricing = db.query(Pricing).filter(
        Pricing.vehicle_class == vehicle_class,
        Pricing.is_active == 1
    ).first()
    
    if not pricing:
        pricing = db.query(Pricing).filter(Pricing.vehicle_class == "car").first()
    
    if not pricing:
        raise HTTPException(status_code=500, detail="Cenovnik nije podešen")
    
    if weight_kg > pricing.max_weight_kg:
        suggested = get_suggested_class(weight_kg, db)
        return {
            "error": True,
            "message": f"Težina {weight_kg}kg premašuje maksimum za klasu {pricing.name} ({pricing.max_weight_kg}kg)",
            "suggested_class": suggested
        }
    
    volumetric_weight = (length_cm * width_cm * height_cm) / pricing.volumetric_divisor if (length_cm and width_cm and height_cm) else 0
    effective_weight = max(weight_kg, volumetric_weight)
    
    distance_price = distance_km * pricing.price_per_km
    weight_price = effective_weight * pricing.price_per_kg
    total_price = pricing.base_price + distance_price + weight_price
    urgent_multiplier = pricing.urgent_multiplier if is_urgent else 1.0
    final_price = total_price * urgent_multiplier
    
    return {
        "vehicle_class": vehicle_class,
        "vehicle_name": pricing.name,
        "max_weight_kg": pricing.max_weight_kg,
        "distance_km": round(distance_km, 1),
        "distance_price": round(distance_price, 0),
        "weight_price": round(weight_price, 0),
        "volumetric_weight": round(volumetric_weight, 1),
        "effective_weight": round(effective_weight, 1),
        "base_price": pricing.base_price,
        "total_price": round(total_price, 0),
        "is_urgent": is_urgent,
        "urgent_multiplier": urgent_multiplier,
        "final_price": round(final_price, 0)
    }


# ========== DOSTUPNI VOZAČI ZA KLIJENTA ==========
@router.get("/drivers/available")
async def get_available_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dohvata sve dostupne vozače sa njihovim trenutnim lokacijama"""
    
    # Samo klijenti mogu videti dostupne vozače
    if current_user.user_type != UserType.CLIENT:
        raise HTTPException(status_code=403, detail="Samo klijenti mogu videti dostupne vozače")
    
    drivers = db.query(User).filter(
        User.user_type == UserType.DRIVER,
        User.is_active == 1
    ).all()
    
    result = []
    for driver in drivers:
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == driver.id).first()
        # Prikazujemo samo vozače koji imaju aktivnu lokaciju
        if profile and profile.current_latitude and profile.current_longitude:
            result.append({
                "id": driver.id,
                "full_name": driver.full_name,
                "current_latitude": profile.current_latitude,
                "current_longitude": profile.current_longitude,
                "vehicle_type": profile.vehicle_type or "Nepoznato",
                "vehicle_plate": profile.vehicle_plate or "",
                "max_load_kg": profile.max_load_kg or 0,
                "is_available": profile.is_available
            })
    
    return result


# ========== VOZAČ EXPORT ==========
@router.get("/driver/export/excel")
async def export_driver_shipments_excel(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu exportovati svoje pošiljke")
    
    shipments = db.query(Shipment).filter(
        Shipment.driver_id == current_user.id
    ).order_by(Shipment.created_at.desc()).all()
    
    data = []
    for s in shipments:
        client = db.query(User).filter(User.id == s.client_id).first()
        data.append({
            "ID": s.id,
            "Klijent": client.full_name if client else "",
            "Od": s.pickup_address,
            "Do": s.delivery_address,
            "Opis": s.cargo_description,
            "Težina (kg)": s.weight_kg or "",
            "Dimenzije": s.dimensions or "",
            "Cena (RSD)": s.price or "",
            "Hitno": "Da" if s.is_urgent else "Ne",
            "Status": s.status.value if s.status else "",
            "Kreirano": s.created_at.strftime("%d.%m.%Y %H:%M") if s.created_at else "",
            "Dostavljeno": s.delivered_at.strftime("%d.%m.%Y %H:%M") if s.delivered_at else ""
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="Moje posiljke", index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=moje_posiljke_{current_user.id}.xlsx"}
    )


@router.get("/driver/earnings")
async def get_driver_earnings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu videti svoju zaradu")
    
    delivered = db.query(Shipment).filter(
        Shipment.driver_id == current_user.id,
        Shipment.status == ShipmentStatus.DELIVERED
    ).all()
    
    earnings_by_month = {}
    for s in delivered:
        if s.delivered_at:
            month = s.delivered_at.strftime("%Y-%m")
            if month not in earnings_by_month:
                earnings_by_month[month] = {"count": 0, "total": 0}
            earnings_by_month[month]["count"] += 1
            earnings_by_month[month]["total"] += s.price or 0
    
    total_earnings = sum(s.price or 0 for s in delivered)
    total_shipments = len(delivered)
    
    return {
        "total_shipments": total_shipments,
        "total_earnings": round(total_earnings, 0),
        "earnings_by_month": earnings_by_month
    }


# ========== VOZAČ GRAFIKONI ==========
@router.get("/driver/stats/shipments-by-month")
async def get_driver_shipments_by_month(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Broj vozačevih pošiljki po mesecima za grafikone"""
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu videti svoju statistiku")
    
    shipments = db.query(Shipment).filter(
        Shipment.driver_id == current_user.id
    ).all()
    
    monthly_data = {}
    for s in shipments:
        month = s.created_at.strftime("%Y-%m")
        if month not in monthly_data:
            monthly_data[month] = 0
        monthly_data[month] += 1
    
    sorted_months = sorted(monthly_data.keys())
    
    return {
        "labels": sorted_months,
        "data": [monthly_data[m] for m in sorted_months]
    }


@router.get("/driver/stats/earnings-by-month")
async def get_driver_earnings_by_month(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Zarada vozača po mesecima za grafikone"""
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu videti svoju zaradu")
    
    delivered = db.query(Shipment).filter(
        Shipment.driver_id == current_user.id,
        Shipment.status == ShipmentStatus.DELIVERED
    ).all()
    
    monthly_data = {}
    for s in delivered:
        if s.delivered_at:
            month = s.delivered_at.strftime("%Y-%m")
            if month not in monthly_data:
                monthly_data[month] = 0
            monthly_data[month] += s.price or 0
    
    sorted_months = sorted(monthly_data.keys())
    
    return {
        "labels": sorted_months,
        "data": [monthly_data[m] for m in sorted_months]
    }