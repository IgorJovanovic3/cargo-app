from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.database import get_db
from app.models import User, UserType, Shipment, ShipmentStatus, Review
from app.schemas import ReviewCreate, ReviewResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["reviews"])

# ========== OCENA VOZAČA (OD STRANE KLIJENTA) ==========
@router.post("/driver/{shipment_id}")
async def rate_driver(
    shipment_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Klijent ocenjuje vozača nakon dostave"""
    
    if current_user.user_type != UserType.CLIENT:
        raise HTTPException(status_code=403, detail="Samo klijenti mogu oceniti vozača")
    
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if shipment.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste vlasnik ove pošiljke")
    
    if shipment.status != ShipmentStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Možete oceniti samo dostavljene pošiljke")
    
    if not shipment.driver_id:
        raise HTTPException(status_code=400, detail="Pošiljka nema dodeljenog vozača")
    
    existing = db.query(Review).filter(
        Review.shipment_id == shipment_id,
        Review.review_type == "driver"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Već ste ocenili vozača za ovu pošiljku")
    
    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=400, detail="Ocena mora biti između 1 i 5")
    
    review = Review(
        shipment_id=shipment_id,
        reviewer_id=current_user.id,
        driver_id=shipment.driver_id,
        rating=review_data.rating,
        comment=review_data.comment,
        review_type="driver",
        created_at=datetime.now(timezone.utc)
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    return {"message": "Vozač je ocenjen", "review": review}


@router.get("/driver/{driver_id}")
async def get_driver_reviews(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dohvata ocene za vozača sa histogramom"""
    
    driver = db.query(User).filter(User.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Vozač nije pronađen")
    
    reviews = db.query(Review).filter(
        Review.driver_id == driver_id,
        Review.review_type == "driver"
    ).order_by(Review.created_at.desc()).all()
    
    histogram = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in reviews:
        histogram[r.rating] += 1
    
    avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else 0
    
    return {
        "driver_id": driver_id,
        "driver_name": driver.full_name,
        "average_rating": round(avg_rating, 1),
        "total_reviews": len(reviews),
        "histogram": histogram,
        "reviews": reviews
    }


# ========== OCENA KLIJENTA (OD STRANE VOZAČA) ==========
@router.post("/client/{shipment_id}")
async def rate_client(
    shipment_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vozač ocenjuje klijenta nakon dostave"""
    
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Samo vozači mogu oceniti klijenta")
    
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Pošiljka nije pronađena")
    
    if shipment.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Niste dodeljeni ovoj pošiljci")
    
    if shipment.status != ShipmentStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Možete oceniti samo dostavljene pošiljke")
    
    existing = db.query(Review).filter(
        Review.shipment_id == shipment_id,
        Review.review_type == "client"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Već ste ocenili klijenta za ovu pošiljku")
    
    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=400, detail="Ocena mora biti između 1 i 5")
    
    review = Review(
        shipment_id=shipment_id,
        reviewer_id=current_user.id,
        driver_id=None,
        client_id=shipment.client_id,
        rating=review_data.rating,
        comment=review_data.comment,
        review_type="client",
        created_at=datetime.now(timezone.utc)
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    return {"message": "Klijent je ocenjen", "review": review}


@router.get("/client/{client_id}")
async def get_client_reviews(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dohvata ocene za klijenta sa histogramom"""
    
    client = db.query(User).filter(User.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Klijent nije pronađen")
    
    reviews = db.query(Review).filter(
        Review.client_id == client_id,
        Review.review_type == "client"
    ).order_by(Review.created_at.desc()).all()
    
    histogram = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in reviews:
        histogram[r.rating] += 1
    
    avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else 0
    
    return {
        "client_id": client_id,
        "client_name": client.full_name,
        "average_rating": round(avg_rating, 1),
        "total_reviews": len(reviews),
        "histogram": histogram,
        "reviews": reviews
    }


# ========== PROVERA DA LI SE MOŽE OCENITI ==========
@router.get("/can-review/{shipment_id}")
async def can_review(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Proverava da li korisnik može da oceni pošiljku"""
    
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        return {"can_review": False, "reason": "Pošiljka nije pronađena"}
    
    # Za klijenta - ocena vozača
    if current_user.user_type == UserType.CLIENT:
        if shipment.client_id != current_user.id:
            return {"can_review": False, "reason": "Niste vlasnik pošiljke"}
        if shipment.status != ShipmentStatus.DELIVERED:
            return {"can_review": False, "reason": "Pošiljka nije dostavljena"}
        existing = db.query(Review).filter(
            Review.shipment_id == shipment_id,
            Review.review_type == "driver"
        ).first()
        if existing:
            return {"can_review": False, "reason": "Već ste ocenili vozača"}
        return {"can_review": True, "type": "driver", "reason": ""}
    
    # Za vozača - ocena klijenta
    elif current_user.user_type == UserType.DRIVER:
        if shipment.driver_id != current_user.id:
            return {"can_review": False, "reason": "Niste dodeljeni ovoj pošiljci"}
        if shipment.status != ShipmentStatus.DELIVERED:
            return {"can_review": False, "reason": "Pošiljka nije dostavljena"}
        existing = db.query(Review).filter(
            Review.shipment_id == shipment_id,
            Review.review_type == "client"
        ).first()
        if existing:
            return {"can_review": False, "reason": "Već ste ocenili klijenta"}
        return {"can_review": True, "type": "client", "reason": ""}
    
    return {"can_review": False, "reason": "Niste klijent ni vozač"}