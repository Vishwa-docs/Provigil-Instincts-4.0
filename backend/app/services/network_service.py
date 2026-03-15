"""Network topology service for feeder → transformer → meter hierarchy."""

import logging
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.schemas import Meter, NetworkNode

logger = logging.getLogger(__name__)


def _status_from_meters(meters: List[Meter]) -> str:
    if any(m.status == "critical" for m in meters):
        return "critical"
    if any(m.status == "warning" for m in meters):
        return "warning"
    return "healthy"


def _aggregate_node_metrics(
    nodes: List[NetworkNode],
    meter_map: Dict[str, Meter],
) -> Dict[str, Dict[str, Any]]:
    """Roll up health and status for feeder/transformer nodes from child meters."""
    metrics: Dict[str, Dict[str, Any]] = {}
    children_by_parent: Dict[str, List[NetworkNode]] = {}
    for node in nodes:
        if node.parent_id:
            children_by_parent.setdefault(node.parent_id, []).append(node)

    for node in nodes:
        related_meters: List[Meter] = []
        if node.node_type == "meter":
            meter = meter_map.get(node.id)
            if meter:
                related_meters = [meter]
        elif node.node_type == "transformer":
            related_meters = [
                meter_map[child.id]
                for child in children_by_parent.get(node.id, [])
                if child.node_type == "meter" and child.id in meter_map
            ]
        elif node.node_type == "feeder":
            transformer_ids = [
                child.id
                for child in children_by_parent.get(node.id, [])
                if child.node_type == "transformer"
            ]
            for transformer_id in transformer_ids:
                related_meters.extend(
                    meter_map[child.id]
                    for child in children_by_parent.get(transformer_id, [])
                    if child.node_type == "meter" and child.id in meter_map
                )

        if related_meters:
            avg_health = round(
                sum(m.health_score for m in related_meters) / len(related_meters),
                4,
            )
            metrics[node.id] = {
                "health_score": avg_health,
                "status": _status_from_meters(related_meters),
            }
        else:
            metrics[node.id] = {
                "health_score": round(node.health_score, 4),
                "status": node.status,
            }

    return metrics


def get_topology(db: Session) -> Dict[str, Any]:
    """Return the full network topology as a tree structure."""
    nodes = db.query(NetworkNode).all()
    meters = db.query(Meter).all()
    meter_map = {m.id: m for m in meters}
    aggregate_metrics = _aggregate_node_metrics(nodes, meter_map)

    node_dict = {}
    for n in nodes:
        metrics = aggregate_metrics.get(
            n.id,
            {"health_score": n.health_score, "status": n.status},
        )
        node_dict[n.id] = {
            "id": n.id,
            "type": n.node_type,
            "name": n.name,
            "parent_id": n.parent_id,
            "lat": n.location_lat,
            "lng": n.location_lng,
            "health_score": metrics["health_score"],
            "health": metrics["health_score"],
            "status": metrics["status"],
            "children": [],
        }

    for m in meters:
        existing = node_dict.get(m.id, {})
        node_dict[m.id] = {
            "id": m.id,
            "type": "meter",
            "name": m.name,
            "parent_id": existing.get("parent_id"),
            "lat": m.location_lat,
            "lng": m.location_lng,
            "health_score": m.health_score,
            "health": m.health_score,
            "status": m.status,
            "children": [],
            "suspected_issue": m.suspected_issue,
        }

    edges = []
    for n in nodes:
        if n.parent_id and n.parent_id in node_dict and n.id in node_dict:
            edges.append(
                {
                    "source": n.parent_id,
                    "target": n.id,
                    "from": n.parent_id,
                    "to": n.id,
                    "source_type": node_dict[n.parent_id]["type"],
                    "target_type": node_dict[n.id]["type"],
                }
            )
            node_dict[n.parent_id]["children"].append(n.id)

    all_nodes = list(node_dict.values())

    return {
        "nodes": all_nodes,
        "edges": edges,
    }


def get_network_health(db: Session) -> List[Dict[str, Any]]:
    """Return health aggregation per feeder/transformer."""
    nodes = db.query(NetworkNode).filter(
        NetworkNode.node_type.in_(["feeder", "transformer"])
    ).all()

    result = []
    for n in nodes:
        # Get child meters
        child_nodes = db.query(NetworkNode).filter(NetworkNode.parent_id == n.id).all()
        child_meter_ids = [c.id for c in child_nodes if c.node_type == "meter"]

        if n.node_type == "transformer":
            meters = db.query(Meter).filter(Meter.id.in_(child_meter_ids)).all() if child_meter_ids else []
        else:
            # feeder — get all transformers underneath, then their meters
            transformer_ids = [c.id for c in child_nodes if c.node_type == "transformer"]
            sub_meter_nodes = db.query(NetworkNode).filter(
                NetworkNode.parent_id.in_(transformer_ids),
                NetworkNode.node_type == "meter"
            ).all() if transformer_ids else []
            sub_meter_ids = [sm.id for sm in sub_meter_nodes]
            meters = db.query(Meter).filter(Meter.id.in_(sub_meter_ids)).all() if sub_meter_ids else []

        avg_health = sum(m.health_score for m in meters) / len(meters) if meters else 1.0
        status_counts = {"healthy": 0, "warning": 0, "critical": 0}
        for m in meters:
            status_counts[m.status] = status_counts.get(m.status, 0) + 1

        result.append({
            "id": n.id,
            "type": n.node_type,
            "name": n.name,
            "lat": n.location_lat,
            "lng": n.location_lng,
            "avg_health": round(avg_health, 4),
            "health_score": round(avg_health, 4),
            "health": round(avg_health, 4),
            "meter_count": len(meters),
            "status_counts": status_counts,
        })

    return result


def get_neighbors(meter_id: str, db: Session) -> Dict[str, Any]:
    """Get neighbor meters on the same transformer and perform consensus analysis."""
    # Find this meter's network node
    meter_node = db.query(NetworkNode).filter(
        NetworkNode.id == meter_id,
        NetworkNode.node_type == "meter",
    ).first()

    if not meter_node or not meter_node.parent_id:
        return {"meter_id": meter_id, "neighbors": [], "consensus": "no_network_data"}

    # Get siblings on same transformer
    sibling_nodes = db.query(NetworkNode).filter(
        NetworkNode.parent_id == meter_node.parent_id,
        NetworkNode.node_type == "meter",
        NetworkNode.id != meter_id,
    ).all()

    sibling_ids = [s.id for s in sibling_nodes]
    target = db.query(Meter).filter(Meter.id == meter_id).first()
    siblings = db.query(Meter).filter(Meter.id.in_(sibling_ids)).all() if sibling_ids else []

    neighbors = []
    for s in siblings:
        neighbors.append({
            "id": s.id,
            "meter_id": s.id,
            "name": s.name,
            "health_score": s.health_score,
            "health": s.health_score,
            "status": s.status,
            "suspected_issue": s.suspected_issue,
        })

    # Consensus: if target is warning/critical but neighbors are healthy,
    # the issue is likely local (loose connection, not grid-wide)
    if target:
        healthy_neighbors = sum(1 for s in siblings if s.status == "healthy")
        total = len(siblings)
        if target.status in ("warning", "critical") and total > 0 and healthy_neighbors / total > 0.7:
            consensus = "local_issue"
            consensus_detail = f"Meter has anomaly but {healthy_neighbors}/{total} neighbors are healthy — likely local issue (loose connection, faulty meter)"
        elif target.status in ("warning", "critical") and total > 0 and healthy_neighbors / total < 0.3:
            consensus = "grid_wide_issue"
            consensus_detail = f"Multiple meters affected ({total - healthy_neighbors}/{total}) — likely grid/feeder issue"
        else:
            consensus = "normal"
            consensus_detail = "No consensus anomaly detected"
    else:
        consensus = "meter_not_found"
        consensus_detail = ""

    return {
        "meter_id": meter_id,
        "transformer_id": meter_node.parent_id,
        "neighbors": neighbors,
        "consensus": consensus,
        "consensus_detail": consensus_detail,
        "analysis": consensus,
        "explanation": consensus_detail,
    }
