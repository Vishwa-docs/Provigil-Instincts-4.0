"""Router for work-order endpoints."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Meter, WorkOrder
from app.models.pydantic_models import (
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderUpdate,
)

router = APIRouter(prefix="/api/workorders", tags=["workorders"])


@router.get("/prioritized", response_model=list[WorkOrderResponse])
def prioritized_work_orders(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return work orders sorted by priority (ascending) then oldest first.

    Only non-completed orders are included.
    """
    orders = (
        db.query(WorkOrder)
        .filter(WorkOrder.status != "completed")
        .order_by(asc(WorkOrder.priority), asc(WorkOrder.created_at))
        .limit(limit)
        .all()
    )
    return [WorkOrderResponse.model_validate(wo) for wo in orders]


@router.get("/", response_model=list[WorkOrderResponse])
def list_work_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return work orders with optional status filter."""
    query = db.query(WorkOrder)
    if status:
        query = query.filter(WorkOrder.status == status)
    orders = query.order_by(desc(WorkOrder.created_at)).offset(skip).limit(limit).all()
    return [WorkOrderResponse.model_validate(wo) for wo in orders]


@router.post("/", response_model=WorkOrderResponse, status_code=201)
def create_work_order(body: WorkOrderCreate, db: Session = Depends(get_db)):
    """Create a new work order."""
    meter = db.query(Meter).filter(Meter.id == body.meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    wo = WorkOrder(
        meter_id=body.meter_id,
        priority=body.priority,
        issue_type=body.issue_type,
        description=body.description,
        scheduled_date=body.scheduled_date,
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return WorkOrderResponse.model_validate(wo)


@router.put("/{wo_id}", response_model=WorkOrderResponse)
def update_work_order(wo_id: int, body: WorkOrderUpdate, db: Session = Depends(get_db)):
    """Update an existing work order's status, priority, schedule, or description."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if body.status is not None:
        valid_statuses = {"pending", "scheduled", "in_progress", "completed"}
        if body.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(sorted(valid_statuses))}",
            )
        wo.status = body.status
        if body.status == "completed":
            wo.completed_date = datetime.now(timezone.utc)

    if body.priority is not None:
        wo.priority = body.priority
    if body.scheduled_date is not None:
        wo.scheduled_date = body.scheduled_date
    if body.description is not None:
        wo.description = body.description

    wo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(wo)
    return WorkOrderResponse.model_validate(wo)
