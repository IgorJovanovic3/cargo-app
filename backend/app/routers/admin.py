from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.models import User, UserType, Shipment, ShipmentStatus, Notification, Pricing
from app.schemas import UserResponse, ShipmentResponse, NotificationResponse
from app.routers.auth import get_current_user
from app.routers.notifications import create_notification
import io
import pandas as pd
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import base64
from reportlab.lib.utils import ImageReader
from io import BytesIO

router = APIRouter(prefix="/admin", tags=["admin"])

def check_admin(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Samo admin ima pristup")
    return current_user


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    user_type: Optional[str] = Query(None, description="client, driver, admin"),
    is_active: Optional[int] = Query(None, description="0 ili 1"),
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if user_type:
        query = query.filter(User.user_type == user_type)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    users = query.order_by(User.created_at.desc()).all()
    return users


@router.put("/users/{user_id}/block")
async def block_user(
    user_id: int,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    if user.user_type == UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Ne možete blokirati admina")
    user.is_active = 0
    db.commit()
    return {"message": f"Korisnik {user.email} je blokiran"}


@router.put("/users/{user_id}/activate")
async def activate_user(
    user_id: int,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    user.is_active = 1
    db.commit()
    return {"message": f"Korisnik {user.email} je aktiviran"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    if user.user_type == UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Ne možete obrisati admina")
    db.delete(user)
    db.commit()
    return {"message": f"Korisnik {user.email} je obrisan"}


@router.get("/shipments", response_model=List[ShipmentResponse])
async def get_all_shipments(
    status: Optional[str] = None,
    limit: int = 100,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Shipment)
    if status:
        try:
            query = query.filter(Shipment.status == ShipmentStatus(status))
        except:
            pass
    shipments = query.order_by(Shipment.created_at.desc()).limit(limit).all()
    return shipments


@router.delete("/shipments/{shipment_id}")
async def delete_shipment(
    shipment_id: int,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    if shipment.client_id:
        create_notification(
            db=db,
            user_id=shipment.client_id,
            title="❌ Pošiljka obrisana od strane admina",
            message=f"Vaša pošiljka #{shipment_id} je obrisana od strane administratora.",
            type="shipment_deleted_by_admin",
            shipment_id=shipment_id
        )
    db.delete(shipment)
    db.commit()
    return {"message": f"Pošiljka #{shipment_id} je obrisana"}


@router.get("/stats")
async def get_stats(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()
    total_clients = db.query(User).filter(User.user_type == UserType.CLIENT).count()
    total_drivers = db.query(User).filter(User.user_type == UserType.DRIVER).count()
    active_drivers = db.query(User).filter(
        User.user_type == UserType.DRIVER,
        User.is_active == 1
    ).count()
    total_shipments = db.query(Shipment).count()
    pending_shipments = db.query(Shipment).filter(Shipment.status == ShipmentStatus.PENDING).count()
    in_transit_shipments = db.query(Shipment).filter(
        Shipment.status.in_([ShipmentStatus.ACCEPTED, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT])
    ).count()
    delivered_shipments = db.query(Shipment).filter(Shipment.status == ShipmentStatus.DELIVERED).count()
    total_earnings = db.query(Shipment.price).filter(Shipment.status == ShipmentStatus.DELIVERED).all()
    total_earnings_sum = sum([e[0] for e in total_earnings if e[0]]) if total_earnings else 0
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    shipments_last_week = db.query(Shipment).filter(Shipment.created_at >= week_ago).count()
    return {
        "users": {
            "total": total_users,
            "clients": total_clients,
            "drivers": total_drivers,
            "active_drivers": active_drivers
        },
        "shipments": {
            "total": total_shipments,
            "pending": pending_shipments,
            "in_transit": in_transit_shipments,
            "delivered": delivered_shipments,
            "last_7_days": shipments_last_week
        },
        "earnings": {
            "total_rsd": round(total_earnings_sum, 0)
        }
    }


@router.get("/pricing/all")
async def get_all_pricing(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    pricing = db.query(Pricing).filter(Pricing.is_active == 1).order_by(Pricing.max_weight_kg).all()
    return pricing


@router.put("/pricing/{pricing_id}")
async def update_pricing_item(
    pricing_id: int,
    pricing_data: dict,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    pricing = db.query(Pricing).filter(Pricing.id == pricing_id).first()
    if not pricing:
        raise HTTPException(status_code=404, detail="Cenovnik nije pronađen")
    if "base_price" in pricing_data:
        pricing.base_price = pricing_data["base_price"]
    if "price_per_km" in pricing_data:
        pricing.price_per_km = pricing_data["price_per_km"]
    if "price_per_kg" in pricing_data:
        pricing.price_per_kg = pricing_data["price_per_kg"]
    if "max_weight_kg" in pricing_data:
        pricing.max_weight_kg = pricing_data["max_weight_kg"]
    if "urgent_multiplier" in pricing_data:
        pricing.urgent_multiplier = pricing_data["urgent_multiplier"]
    if "volumetric_divisor" in pricing_data:
        pricing.volumetric_divisor = pricing_data["volumetric_divisor"]
    db.commit()
    db.refresh(pricing)
    return pricing


@router.get("/notifications", response_model=List[NotificationResponse])
async def get_all_notifications(
    limit: int = 100,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    notifications = db.query(Notification).order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications


@router.get("/export/users/excel")
async def export_users_excel(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    data = []
    for u in users:
        data.append({
            "ID": u.id,
            "Ime i prezime": u.full_name,
            "Email": u.email,
            "Telefon": u.phone,
            "Tip": u.user_type.value,
            "Status": "Aktivan" if u.is_active else "Blokiran",
            "Firma": "Da" if u.is_company else "Ne",
            "Naziv firme": u.company_name or "",
            "PIB": u.company_pib or "",
            "Datum registracije": u.created_at.strftime("%d.%m.%Y %H:%M") if u.created_at else ""
        })
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="Korisnici", index=False)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=korisnici.xlsx"}
    )


@router.get("/export/shipments/excel")
async def export_shipments_excel(
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Export svih pošiljki u Excel format sa filtriranjem"""
    
    query = db.query(Shipment)
    
    if status:
        try:
            query = query.filter(Shipment.status == ShipmentStatus(status))
        except:
            pass
    
    if date_from:
        try:
            date_from_parsed = datetime.fromisoformat(date_from)
            query = query.filter(Shipment.created_at >= date_from_parsed)
        except:
            pass
    
    if date_to:
        try:
            date_to_parsed = datetime.fromisoformat(date_to)
            query = query.filter(Shipment.created_at <= date_to_parsed)
        except:
            pass
    
    shipments = query.order_by(Shipment.created_at.desc()).all()
    
    data = []
    for s in shipments:
        client = db.query(User).filter(User.id == s.client_id).first()
        driver = db.query(User).filter(User.id == s.driver_id).first() if s.driver_id else None
        data.append({
            "ID": s.id,
            "Klijent": client.full_name if client else "",
            "Vozač": driver.full_name if driver else "",
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
        df.to_excel(writer, sheet_name="Pošiljke", index=False)
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=posiljke.xlsx"}
    )


@router.get("/export/shipment/pdf/{shipment_id}")
async def export_shipment_pdf(
    shipment_id: int,
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    client = db.query(User).filter(User.id == shipment.client_id).first()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    title = Paragraph(f"<b>RAČUN - Pošiljka #{shipment.id}</b>", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 20))
    data = [
        ["Broj pošiljke:", str(shipment.id)],
        ["Datum kreiranja:", shipment.created_at.strftime("%d.%m.%Y %H:%M") if shipment.created_at else ""],
        ["Status:", shipment.status.value if shipment.status else ""],
        ["Hitna dostava:", "Da" if shipment.is_urgent else "Ne"],
    ]
    if client:
        data.append(["Klijent:", client.full_name])
        if client.is_company:
            data.append(["Firma:", client.company_name or ""])
            data.append(["PIB:", client.company_pib or ""])
            data.append(["Matični broj:", client.company_mb or ""])
    data.extend([
        ["", ""],
        ["<b>Adresa preuzimanja:</b>", shipment.pickup_address],
        ["<b>Adresa dostave:</b>", shipment.delivery_address],
        ["<b>Opis robe:</b>", shipment.cargo_description],
        ["Težina:", f"{shipment.weight_kg} kg" if shipment.weight_kg else ""],
        ["Dimenzije:", shipment.dimensions or ""],
        ["", ""],
        ["<b>Cena:</b>", f"<b>{shipment.price} RSD</b>"],
    ])
    table = Table(data, colWidths=[120, 350])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    if shipment.signature:
        story.append(Spacer(1, 30))
        story.append(Paragraph("<b>Potvrda o preuzimanju</b>", styles['Normal']))
        story.append(Spacer(1, 10))
        img_data = base64.b64decode(shipment.signature.split(',')[1])
        img = ImageReader(BytesIO(img_data))
        story.append(Table([[img]], colWidths=[200], rowHeights=[100]))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<i>Datum preuzimanja: {shipment.delivered_at.strftime('%d.%m.%Y %H:%M') if shipment.delivered_at else ''}</i>", styles['Normal']))
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=racun_{shipment.id}.pdf"}
    )


@router.post("/cleanup-expired")
async def cleanup_expired_shipments(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    expired_time = datetime.now(timezone.utc) - timedelta(hours=24)
    expired_shipments = db.query(Shipment).filter(
        Shipment.status == ShipmentStatus.PENDING,
        Shipment.created_at < expired_time
    ).all()
    count = len(expired_shipments)
    for shipment in expired_shipments:
        if shipment.client_id:
            create_notification(
                db=db,
                user_id=shipment.client_id,
                title="❌ Pošiljka otkazana",
                message=f"Vaša pošiljka #{shipment.id} je otkazana jer nije prihvaćena u roku.",
                type="shipment_cancelled",
                shipment_id=shipment.id
            )
        db.delete(shipment)
    db.commit()
    return {"message": f"Obrisano {count} neprihvaćenih pošiljki"}


@router.get("/stats/shipments-by-month")
async def get_shipments_by_month(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Broj pošiljki po mesecima za grafikone"""
    
    shipments = db.query(Shipment).all()
    
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


@router.get("/stats/earnings-by-month")
async def get_earnings_by_month(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Zarada po mesecima za grafikone"""
    
    delivered = db.query(Shipment).filter(
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


@router.get("/stats/by-status")
async def get_stats_by_status(
    admin_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Statistika po statusima za torta grafikon"""
    
    status_counts = {}
    for status in ShipmentStatus:
        count = db.query(Shipment).filter(Shipment.status == status).count()
        if count > 0:
            status_counts[status.value] = count
    
    return status_counts