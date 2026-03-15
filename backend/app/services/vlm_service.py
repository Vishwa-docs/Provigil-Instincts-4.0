"""Simulated Vision Language Model service.

Returns canned analysis results to simulate a VLM analyzing meter
installation photos/videos for loose connections and other defects.
The interface is ready for real NVIDIA Cosmos / Azure VLM integration later.
"""

import asyncio
import logging
import random

logger = logging.getLogger(__name__)

_FINDINGS = [
    {
        "finding": "Loose connection detected",
        "detail": "The L1 phase terminal connection appears to have insufficient torque. The wire shows signs of lateral play and the terminal screw is not fully seated. This condition can lead to arcing, localized heating, and eventual terminal burning.",
        "severity": "critical",
        "confidence": 0.92,
        "component": "L1 Phase Terminal",
        "recommendation": "Immediately re-torque the L1 terminal screw to manufacturer specifications (typically 2.5 Nm). Inspect for signs of heat damage or discoloration. If arcing marks are present, replace the terminal block.",
        "tts_message": "Loose connection detected at L1 phase terminal. Immediate re-torquing required.",
    },
    {
        "finding": "Corrosion on neutral terminal",
        "detail": "Oxidation and corrosion buildup detected on the neutral terminal connection. This increases contact resistance and can cause voltage fluctuations and intermittent connectivity issues.",
        "severity": "warning",
        "confidence": 0.87,
        "component": "Neutral Terminal",
        "recommendation": "Clean the neutral terminal with contact cleaner. Apply anti-oxidant compound and re-torque. Consider upgrading to tinned copper lugs.",
        "tts_message": "Corrosion detected on neutral terminal. Cleaning and re-torquing recommended.",
    },
    {
        "finding": "Loose connection detected",
        "detail": "The incoming line connection shows visible gap between the conductor and the terminal clamp. This is a fire hazard and must be addressed immediately before energizing.",
        "severity": "critical",
        "confidence": 0.95,
        "component": "Incoming Line Terminal",
        "recommendation": "Do not energize until the connection is properly secured. Strip wire to expose fresh copper, insert fully into terminal, and torque to specifications.",
        "tts_message": "Loose connection detected on incoming line. Do not energize until secured.",
    },
]


async def analyze_image(file_bytes: bytes, filename: str) -> dict:
    """Simulate VLM analysis of a meter installation image/video.

    In production, this would call NVIDIA Cosmos Reason 2 VLM or Azure Vision API.
    For demo, returns a realistic loose-connection finding after a simulated delay.
    """
    # Simulate processing time (2-4 seconds)
    await asyncio.sleep(random.uniform(2.0, 4.0))

    # For demo, always return the first finding (loose connection)
    finding = _FINDINGS[0].copy()

    return {
        "status": "completed",
        "filename": filename,
        "file_size_kb": len(file_bytes) / 1024,
        "analysis": finding,
        "model": "provigil-vlm-v1 (simulated)",
        "processing_note": "Analysis performed using simulated VLM. Production version will use NVIDIA Cosmos Reason 2 VLM.",
    }
