"""Router for model retraining endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.retraining_service import (
    evaluate_data_sufficiency,
    trigger_retrain,
    get_model_status,
)

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("/status")
def model_status():
    """Return current model version, type, and training info."""
    return get_model_status()


@router.get("/evaluate-data")
def evaluate_data(
    location_id: Optional[str] = Query(None, description="Transformer or feeder ID"),
    db: Session = Depends(get_db),
):
    """Check if enough data exists for retraining at a location."""
    return evaluate_data_sufficiency(db, location_id)


@router.post("/retrain")
def retrain_model(
    location_id: Optional[str] = Query(None, description="Transformer or feeder ID"),
    db: Session = Depends(get_db),
):
    """Trigger model retraining for a specific location or globally."""
    return trigger_retrain(db, location_id)
