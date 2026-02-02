"""
RAULI-ERP: Conexión a base de datos.
- DATABASE_URL presente (Render) -> PostgreSQL
- Sin DATABASE_URL (PC local) -> SQLite (panaderia.db)
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

DATABASE_URL = SQLALCHEMY_DATABASE_URL

if DATABASE_URL:
    # Render/producción: PostgreSQL (ya convertido arriba)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    # Local: SQLite
    db_path = os.path.join(os.path.dirname(__file__), "data", "panaderia.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
