"""公共常量：错误码与文案。"""


class ErrorCode:
    OK = 0
    # 4xxxx 客户端错误
    INVALID_PARAM = 40001
    UNAUTHORIZED = 40101
    FORBIDDEN = 40301
    NOT_FOUND = 40401
    CONFLICT = 40901
    RATE_LIMITED = 42901
    # 5xxxx 服务端错误
    SERVER_ERROR = 50001
    EXTERNAL_ERROR = 50002


ERROR_MESSAGE = {
    ErrorCode.OK: "ok",
    ErrorCode.INVALID_PARAM: "参数错误",
    ErrorCode.UNAUTHORIZED: "未认证",
    ErrorCode.FORBIDDEN: "无权限",
    ErrorCode.NOT_FOUND: "资源不存在",
    ErrorCode.CONFLICT: "资源冲突",
    ErrorCode.RATE_LIMITED: "请求过于频繁",
    ErrorCode.SERVER_ERROR: "服务异常",
    ErrorCode.EXTERNAL_ERROR: "外部服务异常",
}
