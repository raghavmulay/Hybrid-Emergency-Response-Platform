import logging
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to_address: str, subject: str, body: str) -> None:
    from app.core.config import settings

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        # SMTP not configured — log to console so dev can still get the link
        logger.info("=" * 60)
        logger.info(f"[MAIL] TO: {to_address}")
        logger.info(f"[MAIL] SUBJECT: {subject}")
        logger.info(f"[MAIL] BODY:\n{body}")
        logger.info("=" * 60)
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_address

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_address], msg.as_string())
        logger.info(f"[MAIL] Sent '{subject}' to {to_address}")
    except Exception as e:
        logger.error(f"[MAIL] Failed to send email to {to_address}: {e}")


def send_verification_email(to_address: str, token: str) -> None:
    from app.core.config import settings

    link = f"{settings.BASE_URL}/api/v1/auth/verify-email?token={token}"
    subject = "Verify your email – Emergency Info System"
    body = (
        f"Hello,\n\n"
        f"Please verify your email by visiting the link below:\n\n"
        f"{link}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you did not register, ignore this email."
    )
    send_email(to_address, subject, body)
