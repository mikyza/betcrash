export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
export const TOKEN_KEY = "aviator_token";

export const getToken = (): string =>
  typeof window === "undefined" ? "" : localStorage.getItem(TOKEN_KEY) || "";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Calls /api/v1/<path>. The server wraps replies as { success, data }; this returns `data` or throws ApiError with a readable message. */
export async function apiRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.data?.message || json?.message || "Something went wrong. Try again.", res.status);
  }
  return (json?.data ?? json) as T;
}
