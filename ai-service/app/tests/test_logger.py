import logging
import pytest
from utils.logger import get_logger, setup_logging


def test_logger_factory() -> None:
    logger = get_logger("test_module")
    assert isinstance(logger, logging.Logger)
    assert logger.name == "test_module"


def test_setup_logging_formatting_and_suppression() -> None:
    setup_logging(level="DEBUG")
    root_logger = logging.getLogger()
    assert root_logger.level == logging.DEBUG

    # Verify noisy third-party loggers are set to WARNING
    for noisy in ("httpx", "httpcore", "urllib3", "asyncio"):
        assert logging.getLogger(noisy).level == logging.WARNING

    # Verify stream handlers have correct format
    stream_handlers = [h for h in root_logger.handlers if isinstance(h, logging.StreamHandler)]
    assert len(stream_handlers) >= 1
    formatter = stream_handlers[0].formatter
    assert formatter is not None
    assert "%(asctime)s" in formatter._fmt
    assert "%(levelname)s" in formatter._fmt
    assert "%(name)s" in formatter._fmt
