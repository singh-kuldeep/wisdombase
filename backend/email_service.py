"""Email service for sending transactional emails.

Uses Supabase Auth's built-in email service or can be configured to use
SendGrid, AWS SES, or other email providers.
"""

import os
import base64
import smtplib
import ssl
from datetime import datetime, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Tuple


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

    # Option 1: Use SendGrid
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if sendgrid_key:
        try:
            result = _send_via_sendgrid(email, subject, html_body, text_body, sendgrid_key)
            if result:
                return True
        except Exception as e:
            print(f"SendGrid error (falling back): {e}")

    # Option 2: Use AWS SES
    aws_region = os.environ.get("AWS_REGION")
    if aws_region:
        try:
            result = _send_via_ses(email, subject, html_body, text_body, aws_region)
            if result:
                return True
        except Exception as e:
            print(f"AWS SES error (falling back): {e}")

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


def _send_via_sendgrid(to_email: str, subject: str, html_body: str, text_body: str, api_key: str) -> bool:
    """Send email via SendGrid."""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content

        message = Mail(
            from_email=Email(os.environ.get("FROM_EMAIL", "noreply@wisdombase.com")),
            to_emails=To(to_email),
            subject=subject,
            plain_text_content=Content("text/plain", text_body),
            html_content=Content("text/html", html_body)
        )

        sg = SendGridAPIClient(api_key)
        response = sg.send(message)

        return response.status_code in [200, 201, 202]
    except Exception as e:
        print(f"SendGrid error: {e}")
        return False


def _send_via_ses(to_email: str, subject: str, html_body: str, text_body: str, region: str) -> bool:
    """Send email via AWS SES."""
    try:
        try:
            import boto3
        except ImportError:
            raise Exception("boto3 not installed. Install with: pip install boto3")

        ses_client = boto3.client('ses', region_name=region)

        response = ses_client.send_email(
            Source=os.environ.get("FROM_EMAIL", "noreply@wisdombase.com"),
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                }
            }
        )

        return response['ResponseMetadata']['HTTPStatusCode'] == 200
    except Exception as e:
        print(f"AWS SES error: {e}")
        return False


def send_critical_feedback_email(
    *,
    user_id: str,
    user_email: Optional[str],
    message: str,
    attachments: list,
) -> Tuple[bool, str]:
    """Send critical feedback email to the configured support inbox."""
    smtp_user = (
        os.environ.get("GMAIL_SMTP_USER", "surajjaiswal97@gmail.com").strip()
        or os.environ.get("SMTP_EMAIL", "").strip()
        or os.environ.get("EMAIL_USER", "").strip()
    )
    smtp_password = (
        os.environ.get("GMAIL_SMTP_APP_PASSWORD", "iure adhf fkhi xyxv").strip()
        or os.environ.get("SMTP_PASSWORD", "").strip()
        or os.environ.get("EMAIL_PASSWORD", "").strip()
    )

    to_email = os.environ.get("FEEDBACK_TO_EMAIL", "").strip() or smtp_user or "support@wisdombase.in"
    from_email = os.environ.get("FROM_EMAIL", "noreply@wisdombase.in")
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
        f"{message}\n"
    )

    errors = []

    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    if sendgrid_key:
        try:
            if _send_feedback_via_sendgrid(
                to_email=to_email,
                from_email=from_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                attachments=attachments,
                api_key=sendgrid_key,
            ):
                return True, "sent via SendGrid"
        except Exception as e:
            print(f"SendGrid feedback error (falling back): {e}")
            errors.append(f"SendGrid: {e}")

    aws_region = os.environ.get("AWS_REGION")
    if aws_region:
        try:
            if _send_feedback_via_ses(
                to_email=to_email,
                from_email=from_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                attachments=attachments,
                region=aws_region,
            ):
                return True, "sent via AWS SES"
        except Exception as e:
            print(f"SES feedback error (falling back): {e}")
            errors.append(f"AWS SES: {e}")

    # Option 3: Gmail SMTP (App Password)
    if smtp_user and smtp_password:
        try:
            if _send_feedback_via_gmail_smtp(
                to_email=to_email,
                from_email=from_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                attachments=attachments,
                smtp_user=smtp_user,
                smtp_password=smtp_password,
            ):
                return True, "sent via Gmail SMTP"
        except Exception as e:
            print(f"Gmail SMTP feedback error (falling back): {e}")
            errors.append(f"Gmail SMTP: {e}")
    else:
        errors.append("Gmail SMTP credentials missing. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD.")

    # Option 4: Console fallback
    print("\n" + "=" * 60)
    print("CRITICAL FEEDBACK EMAIL (not sent, console fallback)")
    print("=" * 60)
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print(text_body)
    print("=" * 60 + "\n")
    return False, " | ".join(errors) if errors else "No email provider configured"


def _send_feedback_via_sendgrid(
    *,
    to_email: str,
    from_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    attachments: list,
    api_key: str,
) -> bool:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import (
        Mail,
        Email,
        To,
        Content,
        Attachment,
        FileContent,
        FileName,
        FileType,
        Disposition,
    )

    message = Mail(
        from_email=Email(from_email),
        to_emails=To(to_email),
        subject=subject,
        plain_text_content=Content("text/plain", text_body),
        html_content=Content("text/html", html_body),
    )

    sg_attachments = []
    for item in attachments:
        encoded = base64.b64encode(item.get("data", b"")).decode("utf-8")
        att = Attachment()
        att.file_content = FileContent(encoded)
        att.file_name = FileName(item.get("filename", "attachment"))
        att.file_type = FileType(item.get("content_type", "application/octet-stream"))
        att.disposition = Disposition("attachment")
        sg_attachments.append(att)

    if sg_attachments:
        message.attachment = sg_attachments

    sg = SendGridAPIClient(api_key)
    response = sg.send(message)
    return response.status_code in [200, 201, 202]


def _send_feedback_via_ses(
    *,
    to_email: str,
    from_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    attachments: list,
    region: str,
) -> bool:
    try:
        import boto3
    except ImportError:
        raise Exception("boto3 not installed. Install with: pip install boto3")

    ses_client = boto3.client("ses", region_name=region)

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))

    body_part = MIMEMultipart("related")
    body_part.attach(alt)
    msg.attach(body_part)

    for item in attachments:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(item.get("data", b""))
        encoders.encode_base64(part)
        filename = item.get("filename", "attachment")
        part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
        content_type = item.get("content_type")
        if content_type:
            part.add_header("Content-Type", content_type)
        msg.attach(part)

    response = ses_client.send_raw_email(
        Source=from_email,
        Destinations=[to_email],
        RawMessage={"Data": msg.as_string()},
    )
    return response["ResponseMetadata"]["HTTPStatusCode"] == 200


def _send_feedback_via_gmail_smtp(
    *,
    to_email: str,
    from_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    attachments: list,
    smtp_user: str,
    smtp_password: str,
) -> bool:
    """Send feedback email via Gmail SMTP using an App Password."""
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    # Gmail requires From to be the authenticated mailbox in most setups.
    msg["From"] = smtp_user
    msg["To"] = to_email

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))

    body_part = MIMEMultipart("related")
    body_part.attach(alt)
    msg.attach(body_part)

    for item in attachments:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(item.get("data", b""))
        encoders.encode_base64(part)
        filename = item.get("filename", "attachment")
        part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
        content_type = item.get("content_type")
        if content_type:
            part.add_header("Content-Type", content_type)
        msg.attach(part)

    context = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as server:
        server.starttls(context=context)
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, [to_email], msg.as_string())

    return True
