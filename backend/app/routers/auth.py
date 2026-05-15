from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import get_db
from app.dependencies import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
import app.models as models
import app.schemas as schemas
from app.email_service import send_welcome_email
import secrets

router = APIRouter(prefix="/auth", tags=["authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    if len(password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Šifra je predugačka (max 72 karaktera)")
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    from jose import jwt
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email već registrovan")
    
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        phone=user.phone,
        user_type=user.user_type,
        is_company=1 if user.is_company else 0,
        company_name=user.company_name,
        company_pib=user.company_pib,
        company_mb=user.company_mb,
        company_address=user.company_address,
        company_tax_number=user.company_tax_number
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    if user.user_type == models.UserType.DRIVER:
        driver_profile = models.DriverProfile(user_id=db_user.id)
        db.add(driver_profile)
        db.commit()
    
    # Pošalji dobrodošlicu email (opciono, ako je podešeno)
    try:
        send_welcome_email(user.email, user.full_name)
    except Exception as e:
        print(f"Greška pri slanju email-a: {e}")
    
    return db_user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pogrešan email ili šifra",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "user_type": user.user_type.value,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "is_company": user.is_company,
            "company_name": user.company_name,
            "company_pib": user.company_pib,
            "company_mb": user.company_mb,
            "company_address": user.company_address,
            "company_tax_number": user.company_tax_number
        }
    }

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile")
async def update_profile(
    profile_data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ažurira profil korisnika"""
    
    if "full_name" in profile_data:
        current_user.full_name = profile_data["full_name"]
    if "phone" in profile_data:
        current_user.phone = profile_data["phone"]
    if "is_company" in profile_data:
        current_user.is_company = 1 if profile_data["is_company"] else 0
    if "company_name" in profile_data:
        current_user.company_name = profile_data["company_name"]
    if "company_pib" in profile_data:
        current_user.company_pib = profile_data["company_pib"]
    if "company_mb" in profile_data:
        current_user.company_mb = profile_data["company_mb"]
    if "company_address" in profile_data:
        current_user.company_address = profile_data["company_address"]
    if "company_tax_number" in profile_data:
        current_user.company_tax_number = profile_data["company_tax_number"]
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "message": "Profil ažuriran", 
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "phone": current_user.phone,
            "user_type": current_user.user_type.value,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at,
            "is_company": current_user.is_company,
            "company_name": current_user.company_name,
            "company_pib": current_user.company_pib,
            "company_mb": current_user.company_mb,
            "company_address": current_user.company_address,
            "company_tax_number": current_user.company_tax_number
        }
    }


# ========== RESET LOZINKE ==========

@router.post("/forgot-password")
async def forgot_password(
    email: str,
    db: Session = Depends(get_db)
):
    """Šalje link za resetovanje lozinke na email"""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return {"message": "Ako postoji nalog sa tim email-om, poslaćemo link za resetovanje lozinke"}
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    reset = models.PasswordReset(
        user_id=user.id,
        token=token,
        expires_at=expires_at
    )
    db.add(reset)
    db.commit()
    
    reset_link = f"http://localhost:5173/reset-password?token={token}"
    print(f"🔐 Reset link za {email}: {reset_link}")
    
    return {
        "message": "Link za resetovanje lozinke je poslat",
        "reset_link": reset_link
    }

@router.post("/reset-password")
async def reset_password(
    token: str,
    new_password: str,
    db: Session = Depends(get_db)
):
    """Resetuje lozinku koristeći token"""
    reset = db.query(models.PasswordReset).filter(
        models.PasswordReset.token == token,
        models.PasswordReset.is_used == 0,
        models.PasswordReset.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset:
        raise HTTPException(status_code=400, detail="Token je neispravan ili je istekao")
    
    user = db.query(models.User).filter(models.User.id == reset.user_id).first()
    user.hashed_password = get_password_hash(new_password)
    
    reset.is_used = 1
    db.commit()
    
    return {"message": "Lozinka je uspešno promenjena"}