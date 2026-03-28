# database.py
# ─────────────────────────────────────────────────────────────
# SQLite database setup using SQLAlchemy.
# SQLite requires zero configuration — the DB file is created
# automatically at first run. Perfect for a hackathon / MVP.
#
# For production, swap the DATABASE_URL to PostgreSQL:
#   DATABASE_URL = "postgresql://user:pass@localhost/finmentor"
# ─────────────────────────────────────────────────────────────

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finmentor.db")

# connect_args only needed for SQLite (multi-thread safety)
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency — yields a DB session per request.
    Always closes the session after the request finishes.

    Usage in route:
        @app.post("/something")
        def my_route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
