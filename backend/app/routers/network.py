"""Router for network topology endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.network_service import get_topology, get_network_health, get_neighbors

router = APIRouter(prefix="/api/network", tags=["network"])


@router.get("/topology")
def network_topology(db: Session = Depends(get_db)):
    """Return the full network graph (feeders → transformers → meters)."""
    return get_topology(db)


@router.get("/health")
def network_health(db: Session = Depends(get_db)):
    """Return health aggregation per feeder/transformer."""
    return get_network_health(db)


@router.get("/{meter_id}/neighbors")
def meter_neighbors(meter_id: str, db: Session = Depends(get_db)):
    """Get neighbor meters and consensus analysis."""
    return get_neighbors(meter_id, db)
