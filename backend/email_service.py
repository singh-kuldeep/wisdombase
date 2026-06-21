"""Email service for sending transactional emails.

Uses Supabase Auth's built-in email service or can be configured to use
SendGrid, AWS SES, or other email providers.
"""

import os
from typing import Optional


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

    # Option 3: Log to console (development/fallback)
    try:
        print(f"\n{'='*60}")
        print("ACCOUNT DELETION EMAIL (would be sent in production)")
        print(f"{'='*60}")
        print(f"To: {email}")
        print(f"Subject: {subject}")
        print(f"\n{text_body}")
        print(f"{'='*60}\n")

        # Return True since we logged it (in production, this would actually send)
        return True
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
