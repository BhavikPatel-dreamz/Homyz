class AppException(Exception):
    """Base application domain exception."""

    def __init__(self, detail: str, code: str = "INTERNAL_ERROR") -> None:
        self.detail = detail
        self.code = code
        super().__init__(detail)


class BadRequestError(AppException):
    """Raised when client input fails business or validation checks."""

    def __init__(self, detail: str = "Bad request") -> None:
        super().__init__(detail=detail, code="BAD_REQUEST")


class AuthenticationError(AppException):
    """Raised when authentication credentials are missing or invalid."""

    def __init__(self, detail: str = "Invalid or missing API key") -> None:
        super().__init__(detail=detail, code="UNAUTHORIZED")


class NotFoundError(AppException):
    """Raised when a requested resource is not found."""

    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(detail=detail, code="NOT_FOUND")


class AIProviderError(AppException):
    """Raised when an upstream AI service or vector DB fails."""

    def __init__(self, detail: str = "Upstream AI provider error") -> None:
        super().__init__(detail=detail, code="AI_PROVIDER_ERROR")


class InternalServerError(AppException):
    """Raised when an unexpected server error occurs."""

    def __init__(self, detail: str = "Internal server error") -> None:
        super().__init__(detail=detail, code="INTERNAL_SERVER_ERROR")
