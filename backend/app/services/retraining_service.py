"""Localized model retraining service.

Provides data sufficiency checks and simulated retraining for different
locations/feeders. In production, this would trigger actual model training
on location-specific data.
"""

import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.schemas import Meter, Reading, NetworkNode

logger = logging.getLogger(__name__)

_MIN_READINGS_FOR_RETRAIN = 500
_retraining_history: list = []
_model_version = "v1.0-threshold"
_last_trained = datetime(2026, 3, 1, tzinfo=timezone.utc)


def evaluate_data_sufficiency(db: Session, location_id: str = None) -> Dict[str, Any]:
    """Check if sufficient data exists for retraining."""
    if location_id:
        # Check for a specific transformer/feeder
        child_nodes = db.query(NetworkNode).filter(
            NetworkNode.parent_id == location_id,
            NetworkNode.node_type == "meter",
        ).all()
        meter_ids = [c.id for c in child_nodes]
        if not meter_ids:
            meter_ids = [location_id]

        total = db.query(Reading).filter(Reading.meter_id.in_(meter_ids)).count()
        meter_count = len(meter_ids)
    else:
        total = db.query(Reading).count()
        meter_count = db.query(Meter).count()

    sufficient = total >= _MIN_READINGS_FOR_RETRAIN
    readings_per_meter = total / meter_count if meter_count > 0 else 0

    return {
        "location_id": location_id or "global",
        "total_readings": total,
        "meter_count": meter_count,
        "readings_per_meter": round(readings_per_meter, 1),
        "minimum_required": _MIN_READINGS_FOR_RETRAIN,
        "sufficient": sufficient,
        "recommendation": (
            "Sufficient data available for localized retraining."
            if sufficient
            else f"Need {_MIN_READINGS_FOR_RETRAIN - total} more readings before retraining is recommended."
        ),
    }


def trigger_retrain(db: Session, location_id: str = None) -> Dict[str, Any]:
    """Simulate model retraining for a location.

    In production, this would:
    1. Extract location-specific training data
    2. Run feature engineering
    3. Train a localized model
    4. Evaluate and compare metrics
    5. Deploy if metrics improve
    """
    global _model_version, _last_trained

    # Check data sufficiency first
    sufficiency = evaluate_data_sufficiency(db, location_id)
    if not sufficiency["sufficient"]:
        return {
            "status": "rejected",
            "reason": "Insufficient data for retraining",
            "details": sufficiency,
        }

    # Simulate retraining (sleep briefly)
    logger.info("Simulating model retraining for location: %s", location_id or "global")
    time.sleep(2)

    # Generate simulated metrics
    old_metrics = {
        "precision": round(random.uniform(0.82, 0.88), 3),
        "recall": round(random.uniform(0.78, 0.85), 3),
        "f1_score": round(random.uniform(0.80, 0.86), 3),
        "auc_roc": round(random.uniform(0.88, 0.92), 3),
    }
    improvement = random.uniform(0.02, 0.06)
    new_metrics = {
        "precision": round(old_metrics["precision"] + improvement, 3),
        "recall": round(old_metrics["recall"] + improvement, 3),
        "f1_score": round(old_metrics["f1_score"] + improvement, 3),
        "auc_roc": round(old_metrics["auc_roc"] + improvement, 3),
    }

    version_num = len(_retraining_history) + 2
    _model_version = f"v{version_num}.0-localized-{(location_id or 'global')[:8]}"
    _last_trained = datetime.now(timezone.utc)

    result = {
        "status": "completed",
        "location_id": location_id or "global",
        "model_version": _model_version,
        "trained_at": _last_trained.isoformat(),
        "data_used": sufficiency,
        "old_metrics": old_metrics,
        "new_metrics": new_metrics,
        "improvement": {k: round(new_metrics[k] - old_metrics[k], 3) for k in old_metrics},
        "deployed": True,
    }

    _retraining_history.append(result)
    logger.info("Retraining complete: %s", _model_version)

    return result


def get_model_status() -> Dict[str, Any]:
    """Return current model version and training info."""
    return {
        "model_version": "Delhi-NCR localized profile v1",
        "version": "Delhi-NCR localized profile v1",
        "model_type": "Localized anomaly intelligence",
        "last_trained": _last_trained.isoformat(),
        "total_retrains": len(_retraining_history),
        "recent_history": _retraining_history[-5:] if _retraining_history else [],
        "thresholds": {
            "warning": 0.15,
            "critical": 0.35,
            "loose_terminal_temp": "48°C",
            "voltage_range": "200-260V",
            "power_factor_min": 0.8,
        },
    }
