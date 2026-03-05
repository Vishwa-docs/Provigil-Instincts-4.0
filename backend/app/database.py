"""Synchronous SQLAlchemy database setup for SQLite."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker, declarative_base

from app.config import settings

# Ensure the data directory exists so SQLite can create the file.
_db_path = settings.DATABASE_URL.replace("sqlite:///", "")
os.makedirs(os.path.dirname(_db_path) or ".", exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables defined by ORM models.

    Imports the schemas module so that every model is registered on
    ``Base.metadata`` before ``create_all`` is called.
    """
    import app.models.schemas  # noqa: F401 – registers models
    Base.metadata.create_all(bind=engine)
