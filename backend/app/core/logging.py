"""Structured logging with per-request IDs."""
import logging
from contextvars import ContextVar
import structlog

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def _add_request_id(_, __, event_dict):
    event_dict["request_id"] = request_id_var.get()
    return event_dict


def setup_logging() -> None:
    """Configure structlog JSON output."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _add_request_id,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    )


def get_logger(name: str = "app"):
    return structlog.get_logger(name)
