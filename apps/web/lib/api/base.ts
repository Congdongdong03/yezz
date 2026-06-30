export type ApiSuccess<T> = { success: true; data: T };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiSuccess<T> | ApiErrorBody;

  if (!json.success) {
    throw new ApiClientError(
      json.error?.message ?? "Request failed",
      json.error?.code,
      res.status,
    );
  }

  return json.data;
}
