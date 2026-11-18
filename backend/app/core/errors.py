"""Uniform error responses and domain exceptions."""
from typing import Any, Optional
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.logging import get_logger, request_id_var

log = get_logger("errors")


class AppError(Exception):
    """Domain error mapped to an HTTP status."""

    def __init__(self, message: str, status_code: int = 400, code: str = "bad_request", details: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", details: Any = None):
        super().__init__(message, status_code=404, code="not_found", details=details)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required", details: Any = None):
        super().__init__(message, status_code=401, code="unauthorized", details=details)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Permission denied", details: Any = None):
        super().__init__(message, status_code=403, code="forbidden", details=details)


class ConflictError(AppError):
    def __init__(self, message: str = "Resource conflict", details: Any = None):
        super().__init__(message, status_code=409, code="conflict", details=details)


class RateLimitError(AppError):
    def __init__(self, message: str = "Rate limit exceeded. Try again later.", details: Any = None):
        super().__init__(message, status_code=429, code="rate_limit_exceeded", details=details)


class QuotaExceededError(AppError):
    def __init__(self, message: str = "Monthly AI quota exceeded.", details: Any = None):
        super().__init__(message, status_code=429, code="quota_exceeded", details=details)


def _body(code: str, message: str, details: Any = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id_var.get()
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app(_: Request, e: AppError):
        return JSONResponse(_body(e.code, e.message, e.details), status_code=e.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        return JSONResponse(_body("http_error", str(e.detail)), status_code=e.status_code)

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, e: RequestValidationError):
        return JSONResponse(_body("validation_error", "Invalid request", e.errors()), status_code=422)

    @app.exception_handler(Exception)
    async def _any(_: Request, e: Exception):
        import traceback
        tb = traceback.format_exc()
        log.error("unhandled", error=repr(e), traceback=tb)
        # Return informative error details to client so issues can be diagnosed instantly
        err_msg = str(e).strip() or type(e).__name__
        tb_lines = [line.strip() for line in tb.splitlines()[-6:] if line.strip()]
        return JSONResponse(
            _body("internal_error", f"Server error: {err_msg}", details={"exception": type(e).__name__, "traceback": tb_lines}),
            status_code=500
        )
