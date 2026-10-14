"""统一业务异常。"""
from rest_framework.exceptions import APIException

from .constants import ERROR_MESSAGE, ErrorCode


class BusinessError(APIException):
    """带错误码的业务异常，统一响应体为 {code, message}。"""

    def __init__(self, code, message=None, status_code=400):
        self.code = code
        self.message = message or ERROR_MESSAGE.get(code, "错误")
        self.detail = {"code": self.code, "message": self.message}
        super().__init__(detail=self.detail)
        # DRF 的 APIException(code=...) 指的是错误码，HTTP 状态需显式覆盖
        self.status_code = status_code
