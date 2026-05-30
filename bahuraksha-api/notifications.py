"""WhatsApp alert notification module.

Sends alerts via Twilio WhatsApp API when configured.
Falls back to simulated log-only mode when env vars are absent.
"""

import logging
import os

log = logging.getLogger("bahuraksha")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "+14155238886")
DEMO_WHATSAPP_NUMBER = os.getenv("DEMO_WHATSAPP_NUMBER", "+977000000000")

_has_twilio = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)

if _has_twilio:
    from twilio.rest import Client
    _twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    log.info("Twilio WhatsApp client initialized")
else:
    _twilio_client = None
    log.info("Twilio not configured — WhatsApp alerts will be simulated")


def send_whatsapp_alert(
    title: str,
    message: str,
    zone: str,
    severity: str,
    to_number: str | None = None,
) -> dict:
    """Send a single WhatsApp alert message.

    Returns dict with status and recipient count.
    """
    body = (
        f"\u26a0\ufe0f {severity.upper()} ALERT: {title}\n"
        f"{message}\n"
        f"Zone: {zone}"
    )

    if _twilio_client:
        recipient = to_number or DEMO_WHATSAPP_NUMBER
        try:
            _twilio_client.messages.create(
                body=body,
                from_=f"whatsapp:{TWILIO_WHATSAPP_FROM}",
                to=f"whatsapp:{recipient}",
            )
            log.info("WhatsApp alert sent via Twilio to %s: %s — %s", recipient, zone, title[:40])
            return {"status": "sent", "recipients": 1}
        except Exception as e:
            log.warning("Twilio send failed, falling back to simulation: %s", e)

    recipient = to_number or DEMO_WHATSAPP_NUMBER
    log.info("[SIMULATED] WhatsApp alert to %s: %s — %s", recipient, zone, title[:40])
    log.info("[SIMULATED] Message: %s", body[:200])
    return {"status": "simulated", "recipients": 45 if not to_number else 1, "note": "Twilio not configured — alert logged"}
