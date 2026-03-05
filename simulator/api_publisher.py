"""
HTTP/REST publisher for ProVigil meter telemetry.

Sends data to the FastAPI backend's ingest endpoints.
"""

import json
import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


class APIPublisher:
    """Sends telemetry payloads to the ProVigil FastAPI backend over HTTP."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        timeout: float = 10.0,
        api_key: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()

        if api_key:
            self._session.headers["X-API-Key"] = api_key

        self._session.headers["Content-Type"] = "application/json"

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def send_telemetry(self, data: Dict[str, Any]) -> bool:
        """
        POST a single telemetry reading to /api/ingest/telemetry.

        Returns True on success, False otherwise.
        """
        url = f"{self.base_url}/api/ingest/telemetry"
        try:
            resp = self._session.post(
                url,
                data=json.dumps(data, default=str),
                timeout=self.timeout,
            )
            if resp.status_code in (200, 201):
                return True
            else:
                logger.warning(
                    "API POST %s returned %s: %s",
                    url,
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        except requests.ConnectionError:
            logger.error("API connection refused (%s) – is the backend running?", url)
            return False
        except requests.Timeout:
            logger.error("API request timed out (%s)", url)
            return False
        except Exception as exc:
            logger.error("API unexpected error: %s", exc)
            return False

    def send_batch(self, data_list: List[Dict[str, Any]]) -> bool:
        """
        POST a batch of telemetry readings to /api/ingest/telemetry/batch.

        Falls back to individual POSTs if the batch endpoint returns 404.
        """
        url = f"{self.base_url}/api/ingest/telemetry/batch"
        try:
            resp = self._session.post(
                url,
                data=json.dumps(data_list, default=str),
                timeout=self.timeout,
            )
            if resp.status_code in (200, 201):
                return True
            elif resp.status_code == 404:
                logger.info("Batch endpoint not available, falling back to individual POSTs")
                ok = True
                for item in data_list:
                    if not self.send_telemetry(item):
                        ok = False
                return ok
            else:
                logger.warning(
                    "API batch POST %s returned %s: %s",
                    url,
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        except requests.ConnectionError:
            logger.error("API connection refused (%s) – is the backend running?", url)
            return False
        except requests.Timeout:
            logger.error("API batch request timed out (%s)", url)
            return False
        except Exception as exc:
            logger.error("API batch unexpected error: %s", exc)
            return False

    def close(self) -> None:
        """Close the underlying HTTP session."""
        self._session.close()
