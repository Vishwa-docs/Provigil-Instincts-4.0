"""DLMS/COSEM OBIS code ↔ internal field-name mapper.

Provides bidirectional translation between the standardised OBIS code
representation used by DLMS-capable smart meters and the flat internal
field names used by the Pro-Vigil platform.
"""

from typing import Any, Dict

# ── OBIS → internal mapping ──────────────────────────────────────────────────
OBIS_TO_INTERNAL: Dict[str, str] = {
    "1-0:32.7.0": "voltage",         # Voltage – phase A (instantaneous)
    "1-0:52.7.0": "voltage_b",       # Voltage – phase B
    "1-0:72.7.0": "voltage_c",       # Voltage – phase C
    "1-0:31.7.0": "current",         # Current – phase A (instantaneous)
    "1-0:51.7.0": "current_b",       # Current – phase B
    "1-0:71.7.0": "current_c",       # Current – phase C
    "1-0:1.7.0":  "power",           # Active power+ (instantaneous)
    "1-0:1.8.0":  "energy_import",   # Active energy+ (cumulative)
    "1-0:2.8.0":  "energy_export",   # Active energy− (cumulative)
    "1-0:14.7.0": "frequency",       # Supply frequency
    "1-0:13.7.0": "power_factor",    # Power factor
    "0-0:96.8.0": "operating_time",  # Operating time counter
    "0-0:96.7.0": "event_code",      # Event / error code register
    "0-0:1.0.0":  "timestamp",       # Clock / date-time
    "0-0:96.1.0": "meter_serial",    # Meter serial number
    "1-0:31.4.0": "temperature",     # Internal temperature (some meters)
}

# ── Reverse mapping (internal → OBIS) ────────────────────────────────────────
INTERNAL_TO_OBIS: Dict[str, str] = {v: k for k, v in OBIS_TO_INTERNAL.items()}


def translate_dlms_to_internal(dlms_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a dict keyed by OBIS codes to one keyed by internal names.

    Keys that do not appear in the mapping are kept as-is so that no
    information is silently dropped.

    Parameters
    ----------
    dlms_data:
        Dictionary whose keys are OBIS code strings (e.g. ``"1-0:32.7.0"``)
        and whose values are the associated register readings.

    Returns
    -------
    dict
        A new dictionary with human-readable internal field names.
    """
    translated: Dict[str, Any] = {}
    for obis_code, value in dlms_data.items():
        internal_name = OBIS_TO_INTERNAL.get(obis_code, obis_code)
        translated[internal_name] = value
    return translated


def translate_internal_to_dlms(internal_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a dict keyed by internal names back to OBIS codes.

    Keys that do not have a known OBIS mapping are kept as-is.

    Parameters
    ----------
    internal_data:
        Dictionary whose keys are internal field names (e.g. ``"voltage"``).

    Returns
    -------
    dict
        A new dictionary keyed by OBIS code strings.
    """
    translated: Dict[str, Any] = {}
    for field_name, value in internal_data.items():
        obis_code = INTERNAL_TO_OBIS.get(field_name, field_name)
        translated[obis_code] = value
    return translated
