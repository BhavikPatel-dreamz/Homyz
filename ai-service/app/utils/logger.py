"""
Centralized logging configuration and logger factory.
Provides structured timestamp formatting, Uvicorn sync, and noise suppression.
"""
import logging
import os
import sys
from typing import Optional

_LOG_FORMAT = "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: Optional[str] = None) -> None:
    """Initialize root and application loggers with formatted console output."""
    # Read from parameter -> environment variable -> fallback to INFO
    log_level_str = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Ensure stdout line buffering (vital for Docker, Linux CLI, Windows)
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)

    # Reconfigure existing StreamHandlers to avoid duplicate logs
    has_stream_handler = False
    for handler in list(root_logger.handlers):
        if isinstance(handler, logging.StreamHandler):
            handler.setLevel(log_level)
            handler.setFormatter(formatter)
            has_stream_handler = True

    if not has_stream_handler:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    # Synchronize web server loggers (Uvicorn / Gunicorn)
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "gunicorn.error"):
        u_logger = logging.getLogger(logger_name)
        u_logger.setLevel(log_level)
        for h in u_logger.handlers:
            h.setLevel(log_level)
            h.setFormatter(formatter)

    # Mute noisy third-party libraries
    for noisy in ("httpx", "httpcore", "urllib3", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a logger instance configured within the application hierarchy."""
    return logging.getLogger(name)
