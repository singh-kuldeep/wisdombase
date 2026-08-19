"""Email service for sending transactional emails.

Uses Resend API for transactional delivery.
"""

import os
import base64
import config
import json
from datetime import datetime, timezone
from email.utils import parseaddr
from typing import Optional, Tuple
from urllib import error, request


def _normalize_recipients(raw: object) -> list[str]:
    """Convert raw env/config recipient values into clean email strings."""
    items: list[str] = []
    if isinstance(raw, list):
        items = [str(v).strip() for v in raw if str(v).strip()]
    elif isinstance(raw, str):
        text = raw.strip()
        if not text:
            items = []
        elif text.startswith("["):
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    items = [str(v).strip() for v in parsed if str(v).strip()]
            except Exception:
                items = []
        else:
            items = [p.strip() for p in text.split(",") if p.strip()]

    normalized: list[str] = []
    for item in items:
        _, addr = parseaddr(item)
        email = (addr or item).strip().strip('"').strip("'")
        if email.startswith("[") and email.endswith("]"):
            email = email[1:-1].strip().strip('"').strip("'")
        if "@" in email and " " not in email:
            normalized.append(email)
    return normalized


def send_account_deletion_email(email: str) -> bool:
    """Send account deletion confirmation email.

    Args:
        email: User's email address

    Returns:
        True if email was sent successfully, False otherwise
    """
    subject = "Your WisdomBase Account Has Been Deleted"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background-color: #F8F9F5;
                padding: 30px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 30px;
            }}
            .header h1 {{
                color: #2D3E27;
                margin: 0;
                font-size: 24px;
            }}
            .content {{
                background-color: #fff;
                padding: 30px;
                border: 1px solid #E8E8E8;
                border-radius: 8px;
                margin-bottom: 20px;
            }}
            .alert {{
                background-color: #FFF3CD;
                border-left: 4px solid #FFC107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }}
            .data-list {{
                background-color: #F8F9F5;
                padding: 15px 20px;
                border-radius: 4px;
                margin: 15px 0;
            }}
            .data-list li {{
                margin: 8px 0;
            }}
            .footer {{
                text-align: center;
                color: #666;
                font-size: 14px;
                padding: 20px;
            }}
            .support {{
                background-color: #F0F0F0;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                text-align: center;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>WisdomBase</h1>
        </div>

        <div class="content">
            <h2>Account Deletion Confirmed</h2>

            <p>Hello,</p>

            <p>This email confirms that your WisdomBase account (<strong>{email}</strong>) has been permanently deleted.</p>

            <div class="data-list">
                <p><strong>The following data has been permanently removed:</strong></p>
                <ul>
                    <li>Personal entries and notes</li>
                    <li>Knowledge chunks and embeddings</li>
                    <li>Memory profile</li>
                    <li>Account settings and preferences</li>
                    <li>All associated metadata</li>
                </ul>
            </div>

            <p>This action is <strong>permanent and cannot be undone</strong>.</p>

            <div class="alert">
                <strong>⚠️ Important:</strong> If you did not request this deletion, please contact our support team immediately.
            </div>

            <div class="support">
                <p><strong>Need help?</strong></p>
                <p>Contact us at <a href="mailto:support@wisdombase.com">support@wisdombase.com</a></p>
            </div>

            <p>Thank you for using WisdomBase.</p>
        </div>

        <div class="footer">
            <p>© 2026 WisdomBase. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </body>
    </html>
    """

    text_body = f"""
WisdomBase - Account Deletion Confirmed

Hello,

This email confirms that your WisdomBase account ({email}) has been permanently deleted.

The following data has been permanently removed:
• Personal entries and notes
• Knowledge chunks and embeddings
• Memory profile
• Account settings and preferences
• All associated metadata

This action is permanent and cannot be undone.

⚠️ IMPORTANT: If you did not request this deletion, please contact our support team immediately at support@wisdombase.com.

Thank you for using WisdomBase.

---
© 2026 WisdomBase. All rights reserved.
This is an automated message. Please do not reply to this email.
    """

    resend_api_key = config.RESEND_API_KEY
    to_email = [email]
    from_email = config.FROM_EMAIL or "onboarding@resend.dev"

    # Option 1: Use Resend API
    if resend_api_key:
        try:
            result = _send_via_resend(
                to_emails=to_email,
                from_email=from_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                api_key=resend_api_key,
            )
            if result:
                return True
        except Exception as e:
            print(f"Resend error (falling back): {e}")

    # Option 3: Log to console (development/fallback only).
    # This is not an actual email send.
    try:
        print(f"\n{'='*60}")
        print("ACCOUNT DELETION EMAIL (not sent, console fallback)")
        print(f"{'='*60}")
        print(f"To: {email}")
        print(f"Subject: {subject}")
        print(f"\n{text_body}")
        print(f"{'='*60}\n")
        return False
    except Exception as e:
        print(f"Failed to send account deletion email: {e}")
        return False


def _send_via_resend(
    *,
    to_emails: list[str],
    from_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    api_key: str,
    attachments: Optional[list] = None,
) -> bool:
    fallback_from_email = "onboarding@resend.dev"

    def _post(payload: dict) -> bool:
        req = request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "wisdombase-backend/1.0",
            },
        )
        with request.urlopen(req, timeout=20) as response:
            return response.status in (200, 201, 202)

    payload = {
        "from": from_email,
        "to": to_emails,
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }

    resend_attachments = []
    for item in attachments or []:
        resend_attachments.append(
            {
                "filename": item.get("filename", "attachment"),
                "content": base64.b64encode(item.get("data", b"")).decode("utf-8"),
                "content_type": item.get("content_type", "application/octet-stream"),
            }
        )
    if resend_attachments:
        payload["attachments"] = resend_attachments

    try:
        return _post(payload)
    except error.HTTPError as e:
        details = e.read().decode("utf-8", errors="ignore")
        if e.code == 403 and "domain is not verified" in details.lower() and from_email != fallback_from_email:
            # Dev-safe fallback: try Resend onboarding sender if custom domain/sender is not verified yet.
            retry_payload = {**payload, "from": fallback_from_email}
            try:
                return _post(retry_payload)
            except error.HTTPError as retry_err:
                retry_details = retry_err.read().decode("utf-8", errors="ignore")
                raise Exception(
                    "Resend rejected FROM_EMAIL domain. Verify your sender domain in Resend, "
                    "or use FROM_EMAIL=onboarding@resend.dev for testing (recipient must usually be your Resend account email). "
                    f"Retry details: {retry_details}"
                )
            except Exception as retry_err:
                raise Exception(
                    "Resend rejected FROM_EMAIL domain and onboarding fallback failed. "
                    f"Retry error: {retry_err}"
                )
        if e.code == 403 and "1010" in details:
            raise Exception(
                "Resend denied the request (403/1010). Check that RESEND_API_KEY is active, "
                "FROM_EMAIL is a verified sender/domain in Resend, and if using onboarding@resend.dev "
                "you are sending only to your Resend account email."
            )
        raise Exception(f"Resend HTTP {e.code}: {details}")
    except Exception as e:
        raise Exception(f"Resend send failed: {e}")


def send_critical_feedback_email(
    *,
    user_id: str,
    user_email: Optional[str],
    message: str,
    attachments: list[dict],
) -> Tuple[bool, str]:
    """Send critical feedback email to the configured support inbox."""

    resend_api_key = config.RESEND_API_KEY
    to_email = _normalize_recipients(config.TO_EMAIL)
    from_email = config.FROM_EMAIL or "onboarding@resend.dev"
    sent_at = datetime.now(timezone.utc).isoformat()
    safe_user_email = user_email or "unknown"

    subject = f"[Critical Feedback] User {safe_user_email}"
    attach_names = ", ".join(a.get("filename", "attachment") for a in attachments) or "None"

    html_body = f"""
    <h2>Critical Feedback Received</h2>
    <p><strong>User ID:</strong> {user_id}</p>
    <p><strong>User Email:</strong> {safe_user_email}</p>
    <p><strong>Submitted At (UTC):</strong> {sent_at}</p>
    <p><strong>Attachments:</strong> {attach_names}</p>
    <hr />
    <p style=\"white-space: pre-wrap;\">{message}</p>
    """

    text_body = (
        "Critical Feedback Received\n\n"
        f"User ID: {user_id}\n"
        f"User Email: {safe_user_email}\n"
        f"Submitted At (UTC): {sent_at}\n"
        f"Attachments: {attach_names}\n\n"
        "Message:\n"
        f"Description:\n{message}\n"
    )

    if not to_email:
        return False, "Feedback recipient missing/invalid. Set FEEDBACK_TO_EMAIL (e.g. you@example.com) or TO_EMAIL."

    if resend_api_key:
        try:
            if _send_via_resend(
                to_emails=to_email,
                from_email=from_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                api_key=resend_api_key,
                attachments=attachments,
            ):
                return True, "sent via Resend"
        except Exception as e:
            print(f"Resend feedback error (falling back): {e}")
            return False, f"Resend: {e}"

    if not resend_api_key:
        return False, "Resend API key missing. Set RESEND_API_KEY."

    # Option 4: Console fallback
    print("\n" + "=" * 60)
    print("CRITICAL FEEDBACK EMAIL (not sent, console fallback)")
    print("=" * 60)
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print(text_body)
    print("=" * 60 + "\n")
    return False, "Resend email failed"
