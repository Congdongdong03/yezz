export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function success<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function apiError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}
