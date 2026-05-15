import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Uzmite DATABASE_URL iz environment promenljive (Render će je postaviti)
DATABASE_URL = os.getenv("DATABASE_URL")

# Ako promenljiva ne postoji, znači da ste u LOKALNOM okruženju
if not DATABASE_URL:
    print("⚠️  DATABASE_URL not found. Falling back to local MySQL configuration.")
    DATABASE_URL = "mysql+pymysql://cargo_user:David17Dora21@localhost:3306/cargo_db"
    # Za lokalni MySQL, potrebna je ova opcija
    connect_args = {"pool_pre_ping": True}
else:
    # Za produkciju na Render-u, koristimo PostgreSQL
    print("✅ DATABASE_URL found. Using PostgreSQL for production.")
    # PostgreSQL ne zahteva posebne argumente za konekciju
    connect_args = {}

# Kreiramo engine. SQLAlchemy će sam prepoznati drajver na osnovu URL-a
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()