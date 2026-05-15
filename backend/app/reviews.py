from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.database import get_db
from app.models import User, UserType, Shipment, ShipmentStatus, Review
from app.schemas import ReviewCreate, ReviewResponse, DriverRatingResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["reviews"])

@router.post("/shipment/{shipment_id}")
async def create_review(
    shipment_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Klijent ostavlja ocenu za vozača nakon dostave"""
    
    # Proveri da li je korisnik klijent
    if current_user.user_type != UserType.CLIENT:
        raise HTTPException(status_code=403, detail="Samo klijenti mogu ostaviti ocenu")
    
    # Proveri da li pošiljka postoji i da li je dostavljena
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    # Proveri da li je klijent vlasnik pošiljke
    if shipment.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste vlasnik ove pošiljke")
    
    # Proveri da li je pošiljka dostavljena
    if shipment.status != ShipmentStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Možete oceniti samo dostavljene pošiljke")
    
    # Proveri da li već postoji ocena za ovu pošiljku
    existing = db.query(Review).filter(Review.shipment_id == shipment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Već ste ocenili ovu pošiljku")
    
    # Proveri da li vozač postoji
    if not shipment.driver_id:
        raise HTTPException(status_code=400, detail="Pošiljka nema dodeljenog vozača")
    
    # Proveri rating (1-5)
    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=400, detail="Ocena mora biti između 1 i 5")
    
    # Kreiraj ocenu
    review = Review(
        shipment_id=shipment_id,
        reviewer_id=current_user.id,
        driver_id=shipment.driver_id,
        rating=review_data.rating,
        comment=review_data.comment,
        created_at=datetime.now(timezone.utc)
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    return {"message": "Ocena je sačuvana", "review": review}


@router.get("/driver/{driver_id}")
async def get_driver_reviews(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dohvata sve ocene i komentare za vozača"""
    
    driver = db.query(User).filter(User.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Vozač nije pronađen")
    
    reviews = db.query(Review).filter(Review.driver_id == driver_id).order_by(Review.created_at.desc()).all()
    
    # Izračunaj prosečnu ocenu
    if reviews:
        avg_rating = sum(r.rating for r in reviews) / len(reviews)
    else:
        avg_rating = 0
    
    return {
        "driver_id": driver_id,
        "driver_name": driver.full_name,
        "average_rating": round(avg_rating, 1),
        "total_reviews": len(reviews),
        "reviews": reviews
    }


@router.get("/check/{shipment_id}")
async def can_review(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Proverava da li klijent može da oceni pošiljku"""
    
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        return {"can_review": False, "reason": "Pošiljka nije pronađena"}
    
    if shipment.client_id != current_user.id:
        return {"can_review": False, "reason": "Niste vlasnik pošiljke"}
    
    if shipment.status != ShipmentStatus.DELIVERED:
        return {"can_review": False, "reason": "Pošiljka nije dostavljena"}
    
    existing = db.query(Review).filter(Review.shipment_id == shipment_id).first()
    if existing:
        return {"can_review": False, "reason": "Već ste ocenili ovu pošiljku"}
    
    return {"can_review": True, "reason": ""}