"""WhatsApp alert notification with delivery tracking, retry, and opt-in/out.

Sends alerts via Twilio WhatsApp API when configured.
Falls back to simulated log-only mode when env vars are absent.
Creates alert_recipient records in Supabase for delivery tracking.
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("bahuraksha")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "+14155238886")
DEMO_WHATSAPP_NUMBER = os.getenv("DEMO_WHATSAPP_NUMBER", "+977000000000")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

BASE_URL = os.getenv("BAHURAKSHA_BASE_URL", "http://localhost:8000")

_has_twilio = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)

if _has_twilio:
    from twilio.rest import Client
    _twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    log.info("Twilio WhatsApp client initialized")
else:
    _twilio_client = None
    log.info("Twilio not configured — WhatsApp alerts will be simulated")

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client
    _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    log.info("Supabase client initialized for alert tracking")
else:
    _supabase = None
    log.warning("Supabase not configured — alert tracking disabled")


def _get_opted_in_recipients() -> list[dict[str, Any]]:
    """Query Supabase for opted-in profiles with phone numbers."""
    if not _supabase:
        log.info("No Supabase client — using demo recipient")
        return [{"id": None, "phone": DEMO_WHATSAPP_NUMBER}]

    try:
        resp = _supabase.table("profiles") \
            .select("id, phone") \
            .eq("whatsapp_opt_in", True) \
            .not_.is_("phone", "null") \
            .execute()
        recipients = resp.data if resp.data else []
        if not recipients:
            log.info("No opted-in recipients found — falling back to demo number")
            return [{"id": None, "phone": DEMO_WHATSAPP_NUMBER}]
        return recipients
    except Exception as e:
        log.warning("Failed to query opted-in recipients: %s — using demo", e)
        return [{"id": None, "phone": DEMO_WHATSAPP_NUMBER}]


def _create_recipient_record(
    alert_id: str,
    user_id: str | None,
    phone_number: str,
    delivery_status: str = "pending",
    twilio_message_sid: str | None = None,
    error_message: str | None = None,
    next_retry_at: str | None = None,
) -> dict | None:
    """Insert an alert_recipient row in Supabase."""
    if not _supabase:
        return None
    try:
        record = {
            "alert_id": alert_id,
            "user_id": user_id,
            "phone_number": phone_number,
            "delivery_status": delivery_status,
            "twilio_message_sid": twilio_message_sid,
            "error_message": error_message,
            "retry_count": 0,
            "max_retries": 3,
            "next_retry_at": next_retry_at,
            "sent_at": datetime.now(timezone.utc).isoformat() if delivery_status == "sent" else None,
        }
        resp = _supabase.table("alert_recipients").insert(record).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        log.warning("Failed to create recipient record: %s", e)
        return None


def _update_recipient_status(recipient_id: str, status: str, twilio_sid: str | None = None, error: str | None = None) -> bool:
    """Update delivery status for a recipient record."""
    if not _supabase:
        return False
    try:
        update = {"delivery_status": status}
        now_iso = datetime.now(timezone.utc).isoformat()
        if twilio_sid:
            update["twilio_message_sid"] = twilio_sid
        if error:
            update["error_message"] = error
        if status == "sent":
            update["sent_at"] = now_iso
        elif status == "delivered":
            update["delivered_at"] = now_iso
        elif status == "read":
            update["read_at"] = now_iso
        _supabase.table("alert_recipients").update(update).eq("id", recipient_id).execute()
        return True
    except Exception as e:
        log.warning("Failed to update recipient status: %s", e)
        return False


def _send_via_twilio(
    phone_number: str,
    title: str,
    message: str,
    zone: str,
    severity: str,
    status_callback_url: str | None = None,
) -> tuple[bool, str | None, str | None]:
    """Send a WhatsApp message via Twilio. Returns (success, message_sid, error_message)."""
    body = (
        f"\u26a0\ufe0f {severity.upper()} ALERT: {title}\n"
        f"{message}\n"
        f"Zone: {zone}"
    )

    if _twilio_client:
        try:
            kwargs = {
                "body": body,
                "from_": f"whatsapp:{TWILIO_WHATSAPP_FROM}",
                "to": f"whatsapp:{phone_number}",
            }
            if status_callback_url:
                kwargs["status_callback"] = status_callback_url
            msg = _twilio_client.messages.create(**kwargs)
            log.info("WhatsApp sent to %s (SID: %s): %s — %s", phone_number, msg.sid, zone, title[:40])
            return True, msg.sid, None
        except Exception as e:
            err = str(e)
            log.warning("Twilio send failed for %s: %s", phone_number, err)
            return False, None, err

    return False, None, None


def broadcast_alert(alert_id: str, title: str, message: str, zone: str, severity: str) -> dict[str, Any]:
    """Send alert to all opted-in users with delivery tracking.

    Creates alert_recipient records in Supabase and sends to each recipient.
    Returns summary dict with counts and status.
    """
    recipients = _get_opted_in_recipients()
    sent_count = 0
    failed_count = 0
    simulated = not _has_twilio
    results = []

    callback_base = f"{BASE_URL}/notify/whatsapp/callback" if _has_twilio else None

    for recipient in recipients:
        phone = recipient["phone"]
        user_id = recipient.get("id")

        if simulated:
            recipient_record = _create_recipient_record(alert_id, user_id, phone, delivery_status="pending")
            log.info("[SIMULATED] WhatsApp alert to %s: %s — %s", phone, zone, title[:40])
            log.info("[SIMULATED] Message: %s", f"\u26a0\ufe0f {severity.upper()} ALERT: {title}\n{message}\nZone: {zone}"[:200])
            sent_count += 1
            if recipient_record:
                _update_recipient_status(recipient_record["id"], "sent")
            results.append({"phone": phone, "status": "simulated", "user_id": user_id})
        else:
            success, msg_sid, error = _send_via_twilio(phone, title, message, zone, severity, callback_base)
            recipient_record = _create_recipient_record(
                alert_id, user_id, phone,
                delivery_status="sent" if success else "failed",
                twilio_message_sid=msg_sid,
                error_message=error,
            )
            if success:
                sent_count += 1
                if recipient_record:
                    _update_recipient_status(recipient_record["id"], "sent", twilio_sid=msg_sid)
            else:
                failed_count += 1

            results.append({
                "phone": phone,
                "status": "sent" if success else "failed",
                "error": error,
                "twilio_sid": msg_sid,
                "user_id": user_id,
            })

    status = "sent" if sent_count > 0 else "failed"
    if simulated:
        status = "simulated"

    log.info("Alert %s broadcast complete: %d sent, %d failed, simulated=%s",
             alert_id, sent_count, failed_count, simulated)

    return {
        "status": status,
        "total": len(recipients),
        "sent": sent_count,
        "failed": failed_count,
        "simulated": simulated,
        "alert_id": alert_id,
        "results": results,
    }


def send_direct_alert(
    alert_id: str,
    title: str,
    message: str,
    zone: str,
    severity: str,
    to_number: str,
) -> dict[str, Any]:
    """Send alert to a specific phone number with tracking."""
    simulated = not _has_twilio

    if simulated:
        recipient_record = _create_recipient_record(alert_id, None, to_number, delivery_status="pending")
        log.info("[SIMULATED] WhatsApp alert to %s: %s — %s", to_number, zone, title[:40])
        if recipient_record:
            _update_recipient_status(recipient_record["id"], "sent")
        return {
            "status": "simulated",
            "recipients": 1,
            "alert_id": alert_id,
            "note": "Twilio not configured — alert logged",
        }

    callback_url = f"{BASE_URL}/notify/whatsapp/callback"
    success, msg_sid, error = _send_via_twilio(to_number, title, message, zone, severity, callback_url)
    recipient_record = _create_recipient_record(
        alert_id, None, to_number,
        delivery_status="sent" if success else "failed",
        twilio_message_sid=msg_sid,
        error_message=error,
    )

    if success and recipient_record:
        _update_recipient_status(recipient_record["id"], "sent", twilio_sid=msg_sid)

    return {
        "status": "sent" if success else "failed",
        "recipients": 1,
        "alert_id": alert_id,
        "twilio_sid": msg_sid,
        "error": error,
    }


def process_status_callback(
    twilio_message_sid: str,
    message_status: str,
    error_code: str | None = None,
    error_message: str | None = None,
) -> bool:
    """Process a Twilio status callback and update delivery tracking.

    Maps Twilio statuses: queued→pending, sent→sent, delivered→delivered, read→read, failed→failed.
    Returns True if the recipient record was found and updated.
    """
    if not _supabase or not twilio_message_sid:
        return False

    status_map = {
        "queued": "pending",
        "sending": "pending",
        "sent": "sent",
        "delivered": "delivered",
        "read": "read",
        "failed": "failed",
        "undelivered": "failed",
    }

    mapped_status = status_map.get(message_status, "pending")

    try:
        resp = _supabase.table("alert_recipients") \
            .select("id") \
            .eq("twilio_message_sid", twilio_message_sid) \
            .limit(1) \
            .execute()

        if not resp.data or len(resp.data) == 0:
            log.warning("No recipient record found for Twilio SID: %s", twilio_message_sid)
            return False

        recipient_id = resp.data[0]["id"]
        update = {"delivery_status": mapped_status}
        now_iso = datetime.now(timezone.utc).isoformat()

        if mapped_status == "sent":
            update["sent_at"] = now_iso
        elif mapped_status == "delivered":
            update["delivered_at"] = now_iso
        elif mapped_status == "read":
            update["read_at"] = now_iso
        elif mapped_status == "failed":
            update["error_message"] = error_message or error_code or "Unknown error"
            update["retry_count"] = _supabase.table("alert_recipients") \
                .select("retry_count").eq("id", recipient_id).execute().data[0].get("retry_count", 0)

        _supabase.table("alert_recipients").update(update).eq("id", recipient_id).execute()
        log.info("Recipient %s status updated to %s (Twilio SID: %s)", recipient_id, mapped_status, twilio_message_sid)
        return True
    except Exception as e:
        log.warning("Failed to process Twilio callback: %s", e)
        return False


def retry_failed_recipients() -> dict[str, Any]:
    """Retry failed or pending deliveries that haven't exceeded max_retries.

    Returns summary of retry attempts.
    """
    if not _supabase:
        return {"status": "skipped", "reason": "Supabase not configured"}

    try:
        resp = _supabase.table("alert_recipients") \
            .select("*") \
            .in_("delivery_status", ["pending", "failed"]) \
            .lt("retry_count", 3) \
            .execute()

        recipients = resp.data if resp.data else []
    except Exception as e:
        log.warning("Failed to query recipients for retry: %s", e)
        return {"status": "error", "error": str(e)}

    if not recipients:
        return {"status": "ok", "retried": 0, "message": "No recipients need retry"}

    retried = 0
    results = []
    callback_base = f"{BASE_URL}/notify/whatsapp/callback" if _has_twilio else None

    for rec in recipients:
        if not _has_twilio:
            _update_recipient_status(rec["id"], "sent")
            retried += 1
            results.append({"id": rec["id"], "status": "simulated_retry"})
            continue

        phone = rec["phone_number"]
        alert_id = rec["alert_id"]

        msg_title = "Alert Retry"
        msg_body = f"This is a retry of a previous alert (attempt {rec['retry_count'] + 1}/3)"

        success, msg_sid, error = _send_via_twilio(phone, msg_title, msg_body, "N/A", "watch", callback_base)

        new_count = rec["retry_count"] + 1
        update = {
            "retry_count": new_count,
            "delivery_status": "sent" if success else "failed",
            "next_retry_at": (datetime.now(timezone.utc) + timedelta(minutes=5 * new_count)).isoformat()
                if not success and new_count < 3 else None,
        }
        if success:
            update["twilio_message_sid"] = msg_sid
            update["sent_at"] = datetime.now(timezone.utc).isoformat()
        else:
            update["error_message"] = error

        try:
            _supabase.table("alert_recipients").update(update).eq("id", rec["id"]).execute()
        except Exception as e:
            log.warning("Failed to update recipient %s during retry: %s", rec["id"], e)

        if success:
            retried += 1
        results.append({"id": rec["id"], "status": "retried" if success else "failed", "attempt": new_count})

    log.info("Retry complete: %d/%d retried", retried, len(recipients))
    return {"status": "ok", "retried": retried, "total": len(recipients), "results": results}


def get_alert_recipients(alert_id: str) -> list[dict[str, Any]]:
    """Get delivery status for all recipients of an alert."""
    if not _supabase:
        return []
    try:
        resp = _supabase.table("alert_recipients") \
            .select("id, phone_number, delivery_status, retry_count, sent_at, delivered_at, read_at, error_message") \
            .eq("alert_id", alert_id) \
            .order("created_at") \
            .execute()
        return resp.data if resp.data else []
    except Exception as e:
        log.warning("Failed to get alert recipients: %s", e)
        return []
