import logging

logger = logging.getLogger(__name__)


def send_email(to_address: str, subject: str, body: str) -> None:
    """Stub email sender – logs to stdout.
    Replace with real SMTP / third-party provider in production.
    """
    logger.info("=" * 60)
    logger.info(f"TO: {to_address}")
    logger.info(f"SUBJECT: {subject}")
    logger.info(f"BODY:\n{body}")
    logger.info("=" * 60)


def send_verification_email(to_address: str, token: str) -> None:
    subject = "Verify your email – Emergency Info System"
    body = (
        f"Hello,\n\n"
        f"Please verify your email by visiting the link below:\n\n"
        f"http://localhost:8000/api/v1/auth/verify-email?token={token}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you did not register, ignore this email."
    )
    send_email(to_address, subject, body)
