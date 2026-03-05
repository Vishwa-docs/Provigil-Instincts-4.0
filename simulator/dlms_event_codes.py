"""
Indian smart meter event codes per IS 15959 / DLMS COSEM standards.

Provides the canonical event-code table used across:
- The DLMS meter simulator (``dlms_adapter.py``)
- The backend event-log parser
- Alert-rule evaluation

Each entry contains a human-readable name, severity level, and
category for grouping in dashboards and analytics.
"""

from typing import Dict, List, Optional

# ── Event code table (IS 15959 aligned) ──────────────────────────────────────

EVENT_CODES: Dict[int, Dict[str, str]] = {
    # Critical events
    1:  {"name": "Power Failure",                "severity": "critical", "category": "power"},
    2:  {"name": "Power Restore",                "severity": "info",     "category": "power"},
    3:  {"name": "Tamper - Terminal Cover Open",  "severity": "critical", "category": "tamper"},
    4:  {"name": "Tamper - Current Bypass",       "severity": "critical", "category": "tamper"},
    5:  {"name": "Tamper - Current Reverse",      "severity": "warning",  "category": "tamper"},
    6:  {"name": "Tamper - Magnetic Influence",   "severity": "critical", "category": "tamper"},
    7:  {"name": "Over Voltage",                  "severity": "warning",  "category": "power_quality"},
    8:  {"name": "Under Voltage",                 "severity": "warning",  "category": "power_quality"},
    9:  {"name": "Over Current",                  "severity": "warning",  "category": "power_quality"},
    10: {"name": "Over Load",                     "severity": "warning",  "category": "power_quality"},
    11: {"name": "Earth Fault",                   "severity": "critical", "category": "safety"},
    12: {"name": "Neutral Disturbance",           "severity": "warning",  "category": "power_quality"},
    13: {"name": "RTC Battery Low",               "severity": "warning",  "category": "hardware"},
    14: {"name": "RTC Battery Fail",              "severity": "critical", "category": "hardware"},
    15: {"name": "Communication Failure",         "severity": "warning",  "category": "communication"},
    16: {"name": "Communication Restore",         "severity": "info",     "category": "communication"},
    17: {"name": "Memory Fault",                  "severity": "critical", "category": "hardware"},
    18: {"name": "Display Fault",                 "severity": "warning",  "category": "hardware"},
    19: {"name": "Firmware Update",               "severity": "info",     "category": "maintenance"},
    20: {"name": "Load Disconnect",               "severity": "info",     "category": "control"},
    21: {"name": "Load Reconnect",                "severity": "info",     "category": "control"},
    22: {"name": "Last Gasp",                     "severity": "critical", "category": "power"},
    23: {"name": "First Breath",                  "severity": "info",     "category": "power"},
    24: {"name": "Temperature Alarm",             "severity": "warning",  "category": "environmental"},
    25: {"name": "CT Open",                       "severity": "critical", "category": "hardware"},
}


# ── Helper functions ─────────────────────────────────────────────────────────

def get_event_by_code(code: int) -> Optional[Dict[str, str]]:
    """Return the event descriptor dict for a given numeric code.

    Parameters
    ----------
    code:
        Integer event code (1-25 for standard IS 15959 events).

    Returns
    -------
    dict or None
        ``{"name": ..., "severity": ..., "category": ...}`` if found, else
        ``None``.
    """
    return EVENT_CODES.get(code)


def get_events_by_category(category: str) -> Dict[int, Dict[str, str]]:
    """Return all events belonging to *category*.

    Parameters
    ----------
    category:
        One of ``"power"``, ``"tamper"``, ``"power_quality"``, ``"safety"``,
        ``"hardware"``, ``"communication"``, ``"maintenance"``, ``"control"``,
        ``"environmental"``.

    Returns
    -------
    dict
        ``{code: event_dict, ...}`` for matching events.
    """
    return {
        code: ev
        for code, ev in EVENT_CODES.items()
        if ev["category"] == category
    }


def get_events_by_severity(severity: str) -> Dict[int, Dict[str, str]]:
    """Return all events with the given *severity*.

    Parameters
    ----------
    severity:
        One of ``"info"``, ``"warning"``, ``"critical"``.

    Returns
    -------
    dict
        ``{code: event_dict, ...}`` for matching events.
    """
    return {
        code: ev
        for code, ev in EVENT_CODES.items()
        if ev["severity"] == severity
    }


def get_all_categories() -> List[str]:
    """Return a sorted list of unique event categories."""
    return sorted({ev["category"] for ev in EVENT_CODES.values()})


def get_all_severities() -> List[str]:
    """Return a list of severity levels in ascending order."""
    return ["info", "warning", "critical"]


def format_event(code: int) -> str:
    """Return a one-line human-readable description of an event code.

    Example::

        >>> format_event(3)
        '[CRITICAL] #03 Tamper - Terminal Cover Open (tamper)'

    Returns ``'Unknown event code <N>'`` for unrecognised codes.
    """
    ev = EVENT_CODES.get(code)
    if ev is None:
        return f"Unknown event code {code}"
    return (
        f"[{ev['severity'].upper()}] "
        f"#{code:02d} {ev['name']} ({ev['category']})"
    )
