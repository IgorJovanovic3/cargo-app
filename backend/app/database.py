import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("⚠️ DATABASE_URL not found. Falling back to local MySQL configuration.")
    DATABASE_URL = "mysql+pymysql://cargo_user:David17Dora21@localhost:3306/cargo_db"
    connect_args = {"pool_pre_ping": True}
else:
    print("✅ DATABASE_URL found. Using PostgreSQL for production.")
    connect_args = {
        "sslmode": "require",
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()