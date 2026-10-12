"""Create an administrator explicitly; never seed privileged accounts on startup."""

from getpass import getpass

from passlib.context import CryptContext

from app.database import Base, SessionLocal, engine
from app.models import User, UserType


def main():
    email = input("Administrator email: ").strip()
    full_name = input("Full name: ").strip()
    phone = input("Phone: ").strip()
    password = getpass("New password (at least 12 characters): ")
    confirmation = getpass("Confirm password: ")
    if not all((email, full_name, phone)):
        raise SystemExit("Email, full name and phone are required.")
    if password != confirmation or len(password) < 12 or len(password.encode("utf-8")) > 72:
        raise SystemExit("Passwords must match, have at least 12 characters, and fit in 72 UTF-8 bytes.")

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.query(User).filter(User.email == email).first():
            raise SystemExit("An account with that email already exists; no changes made.")
        db.add(User(
            email=email,
            full_name=full_name,
            phone=phone,
            hashed_password=CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password),
            user_type=UserType.ADMIN,
            is_active=1,
        ))
        db.commit()
    print("Administrator created. The password has not been logged.")


if __name__ == "__main__":
    main()
