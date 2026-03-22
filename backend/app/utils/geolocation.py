"""IP-based geolocation utility for meter location enrichment."""

import logging
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)

# Delhi NCR defaults when geolocation is unavailable
_DEFAULT_LOCATION = {
    "lat": 28.6139,
    "lng": 77.2090,
    "city": "New Delhi",
    "region": "Delhi",
    "country": "IN",
}

_CACHE: Dict[str, Dict[str, Any]] = {}


def get_location_from_ip(ip: str) -> Optional[Dict[str, Any]]:
    """Resolve geographic location from an IP address.

    Uses the free ip-api.com service (45 req/min, no key required).
    Returns dict with lat, lng, city, region, country or defaults on failure.
    """
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return None

    if ip in _CACHE:
        return _CACHE[ip]

    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,lat,lon,city,regionName,country"},
            )
            data = resp.json()

        if data.get("status") == "success":
            result = {
                "lat": data.get("lat"),
                "lng": data.get("lon"),
                "city": data.get("city", ""),
                "region": data.get("regionName", ""),
                "country": data.get("country", ""),
            }
            _CACHE[ip] = result
            return result
    except Exception:
        logger.debug("IP geolocation lookup failed for %s", ip)

    return _DEFAULT_LOCATION
