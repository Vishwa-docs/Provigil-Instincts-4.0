"""Azure OpenAI LLM service for work order summarization and alert analysis."""

import json
import logging
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TEMPLATE_SUMMARY = """**Alert Summary for {meter_name}**

**Issue:** {issue_type}
**Severity:** {severity}
**Health Score:** {health_score:.0%}
**Location:** {lat:.4f}°N, {lng:.4f}°E

**Analysis:** {analysis}

**Recommended Actions:**
{actions}
"""

_ISSUE_ANALYSES = {
    "thermal_stress_loose_terminal": "Elevated temperature detected at meter terminals with normal current draw. This pattern is consistent with increased contact resistance from a loose screw connection, which can lead to terminal arcing and potential fire hazard.",
    "comm_loss_or_power_outage": "Complete loss of telemetry signal. Could indicate power outage, communication module failure, or disconnected meter. Check physical connectivity and communication module status.",
    "voltage_sag_anomaly": "Sustained under-voltage condition detected. This may indicate a failing transformer tap, overloaded feeder, or degraded incoming supply connection.",
    "voltage_swell_surge": "Over-voltage condition detected. Possible causes include transformer tap issues, load shedding on adjacent feeders, or power quality disturbances.",
    "poor_power_quality": "Low power factor indicating reactive power issues. May be caused by capacitive or inductive loads, or internal meter power supply degradation.",
    "sensor_memory_fault_flatline": "Multiple sensor channels showing identical readings over time. Indicates possible ADC failure, memory corruption, or firmware fault requiring meter replacement or firmware update.",
    "battery_degradation": "Battery health event flagged. The RTC backup or relay latching battery may be failing, which can cause data loss during power outages and relay operation failures.",
    "rtc_clock_battery_issue": "Real-time clock irregularity detected. Battery backing the RTC may be depleted, causing time drift and inaccurate billing timestamps.",
    "meter_overheating": "Critical temperature exceeding safe operating limits. Immediate inspection required — check for poor ventilation, direct sun exposure, or internal component failure.",
    "overcurrent_detected": "Current draw exceeding rated capacity. Possible overload, downstream short circuit, or CT saturation.",
}

_ISSUE_ACTIONS = {
    "thermal_stress_loose_terminal": "1. Dispatch field crew for terminal inspection\n2. Thermal imaging of connection points\n3. Torque-check and retighten terminal screws\n4. Verify no signs of arcing or discoloration",
    "comm_loss_or_power_outage": "1. Verify if area-wide outage exists\n2. Ping communication module remotely\n3. Dispatch crew if isolated loss persists > 4 hours\n4. Check signal strength and antenna placement",
    "voltage_sag_anomaly": "1. Check upstream transformer tap settings\n2. Verify feeder loading levels\n3. Inspect incoming service connection\n4. Compare with neighbor meter readings",
    "voltage_swell_surge": "1. Monitor transformer secondary voltage\n2. Check for load imbalance on feeder\n3. Install surge protection if recurring\n4. Coordinate with control center",
    "sensor_memory_fault_flatline": "1. Attempt remote firmware reset via OTA\n2. Schedule replacement if reset fails\n3. Download diagnostic logs before swap\n4. Verify with reference meter",
    "battery_degradation": "1. Schedule battery replacement\n2. Check relay operation capability\n3. Order replacement battery (CR2450)\n4. Prioritize if frequent outage area",
    "meter_overheating": "1. URGENT: Dispatch crew immediately\n2. Check enclosure ventilation\n3. Inspect for internal arcing\n4. Consider relocating meter if sun-exposed",
}


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from an LLM response when present."""
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()
    return cleaned

def _call_azure_openai(prompt: str) -> Optional[str]:
    """Call Azure OpenAI API and return the response text."""
    if not settings.AZURE_OPENAI_ENDPOINT or not settings.AZURE_OPENAI_API_KEY:
        return None

    # Build the correct endpoint URL
    endpoint = settings.AZURE_OPENAI_ENDPOINT
    if "/chat/completions" not in endpoint:
        endpoint = f"{endpoint.rstrip('/')}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"

    headers = {
        "Content-Type": "application/json",
        "api-key": settings.AZURE_OPENAI_API_KEY,
    }

    payload = {
        "messages": [
            {"role": "system", "content": "You are an expert utility engineer analyzing smart meter telemetry data. Provide concise, actionable analysis."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 500,
        "temperature": 0.3,
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception:
        logger.exception("Azure OpenAI call failed")
        return None


def summarize_anomaly(meter_data: Dict[str, Any], anomaly_data: Dict[str, Any]) -> str:
    """Generate a summary for an anomaly using LLM or template fallback."""
    issue = anomaly_data.get("suspected_issue", "unknown")
    severity = anomaly_data.get("risk_level", "warning")
    factors = anomaly_data.get("contributing_factors", [])

    # Try LLM first
    prompt = f"""Analyze this smart meter anomaly and provide a brief technical summary:

Meter: {meter_data.get('name', 'Unknown')} ({meter_data.get('id', '')})
Location: {meter_data.get('location_lat', 0):.4f}°N, {meter_data.get('location_lng', 0):.4f}°E
Health Score: {meter_data.get('health_score', 1.0):.0%}
Issue Type: {issue}
Severity: {severity}
Contributing Factors: {', '.join(factors) if factors else 'None identified'}

Latest Readings:
- Voltage: {meter_data.get('voltage', 'N/A')}V
- Current: {meter_data.get('current', 'N/A')}A
- Temperature: {meter_data.get('temperature', 'N/A')}°C
- Power Factor: {meter_data.get('power_factor', 'N/A')}

Provide: 1) Root cause analysis, 2) Risk assessment, 3) Recommended actions."""

    llm_result = _call_azure_openai(prompt)
    if llm_result:
        return llm_result

    # Template fallback
    analysis = _ISSUE_ANALYSES.get(issue, f"Anomaly detected with issue type: {issue}")
    actions = _ISSUE_ACTIONS.get(issue, "1. Schedule inspection\n2. Review recent telemetry\n3. Compare with neighboring meters")

    return _TEMPLATE_SUMMARY.format(
        meter_name=meter_data.get("name", "Unknown"),
        issue_type=issue,
        severity=severity,
        health_score=meter_data.get("health_score", 1.0),
        lat=meter_data.get("location_lat", 0),
        lng=meter_data.get("location_lng", 0),
        analysis=analysis,
        actions=actions,
    )


def generate_work_order_description(alert_data: Dict[str, Any], meter_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a work order description and priority from alert data."""
    issue = alert_data.get("suspected_issue", alert_data.get("alert_type", "unknown"))
    severity = alert_data.get("severity", "warning")

    prompt = f"""Generate a maintenance work order for this smart meter alert:

Meter: {meter_data.get('name', 'Unknown')} ({meter_data.get('id', '')})
Alert: {alert_data.get('message', '')}
Severity: {severity}
Issue Type: {issue}
Health Score: {meter_data.get('health_score', 1.0):.0%}

Provide a JSON response with:
- "issue_type": short issue category
- "priority": 1-5 (1=critical)
- "description": detailed work order description
- "estimated_duration": in hours"""

    llm_result = _call_azure_openai(prompt)

    # Priority mapping
    priority_map = {"critical": 1, "warning": 2, "info": 4}
    priority = priority_map.get(severity, 3)

    analysis = _ISSUE_ANALYSES.get(issue, f"Issue detected: {issue}")
    actions = _ISSUE_ACTIONS.get(issue, "1. Inspect meter\n2. Check connections\n3. Verify readings")

    parsed_llm: Dict[str, Any] | None = None
    if llm_result:
        try:
            parsed_llm = json.loads(_strip_code_fences(llm_result))
        except json.JSONDecodeError:
            parsed_llm = None

    description = (
        parsed_llm.get("description")
        if parsed_llm and parsed_llm.get("description")
        else llm_result
        if llm_result
        else f"{analysis}\n\n**Required Actions:**\n{actions}"
    )

    return {
        "issue_type": (
            parsed_llm.get("issue_type")
            if parsed_llm and parsed_llm.get("issue_type")
            else issue.replace("_", " ").title()
        ),
        "priority": (
            parsed_llm.get("priority")
            if parsed_llm and isinstance(parsed_llm.get("priority"), int)
            else priority
        ),
        "description": description,
        "estimated_duration": (
            parsed_llm.get("estimated_duration")
            if parsed_llm and parsed_llm.get("estimated_duration")
            else "2-4 hours"
        ),
    }
