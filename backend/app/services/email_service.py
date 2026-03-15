"""Email notification service using Gmail SMTP."""

import logging
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Rate limiting: track last email per meter per issue
_last_email_sent: Dict[str, datetime] = {}
_RATE_LIMIT_SECONDS = 3600  # 1 hour


def send_alert_email(alert, meter) -> bool:
    """Send an HTML alert email via Gmail SMTP.

    Returns True if email was sent, False otherwise.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info("SMTP not configured — email alert skipped (meter=%s)", meter.id)
        return False

    recipients = [r.strip() for r in settings.ALERT_RECIPIENTS.split(",") if r.strip()]
    if not recipients:
        recipients = [settings.SMTP_FROM or settings.SMTP_USER]

    from_address = settings.SMTP_FROM or settings.SMTP_USER

    # Rate limiting
    rate_key = f"{meter.id}:{alert.alert_type}"
    now = datetime.now(timezone.utc)
    last_sent = _last_email_sent.get(rate_key)
    if last_sent and (now - last_sent).total_seconds() < _RATE_LIMIT_SECONDS:
        logger.debug("Rate limited email for %s", rate_key)
        return False

    severity_colors = {
        "critical": "#ef4444",
        "warning": "#f59e0b",
        "info": "#3b82f6",
    }
    color = severity_colors.get(alert.severity, "#6b7280")

    html = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #0b1022; color: #e2e8f0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #131b3a; border-radius: 12px; padding: 24px; border: 1px solid #28355d;">
        <h1 style="color: {color}; margin: 0 0 16px 0; font-size: 20px;">
          ⚠️ Pro-Vigil Alert: {alert.severity.upper()}
        </h1>
        <div style="background: #1a2347; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>Meter:</strong> {meter.name} ({meter.id})</p>
          <p style="margin: 0 0 8px 0;"><strong>Type:</strong> {alert.alert_type}</p>
          <p style="margin: 0 0 8px 0;"><strong>Severity:</strong>
            <span style="color: {color}; font-weight: bold;">{alert.severity.upper()}</span>
          </p>
          <p style="margin: 0 0 8px 0;"><strong>Message:</strong> {alert.message}</p>
          <p style="margin: 0 0 8px 0;"><strong>Location:</strong> {(meter.location_lat or 0):.4f}°N, {(meter.location_lng or 0):.4f}°E</p>
          <p style="margin: 0;"><strong>Health Score:</strong> {meter.health_score:.1%}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          Pro-Vigil Predictive Maintenance Platform • {now.strftime('%Y-%m-%d %H:%M UTC')}
        </p>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Pro-Vigil {alert.severity.upper()}] {meter.name}: {alert.alert_type}"
    msg["From"] = from_address
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_address, recipients, msg.as_string())
        _last_email_sent[rate_key] = now
        logger.info("Alert email sent for meter %s to %s", meter.id, recipients)
        return True
    except Exception:
        logger.exception("Failed to send alert email for meter %s", meter.id)
        return False
