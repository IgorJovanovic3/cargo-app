import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Render će postaviti DATABASE_URL env promenljivu (kasnije)
# Za sada koristimo lokalnu bazu, posle ćemo zameniti sa PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://cargo_user:David17Dora21@localhost:3306/cargo_db")

# Ako je PostgreSQL (Render), koristi ga, inače MySQL
if "postgres" in DATABASE_URL or "postgresql" in DATABASE_URL:
    engine = create_engine(DATABASE_URL)
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()