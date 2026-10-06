import { getAuthHeaders } from "@/lib/auth/session";

/** An error the API returned. `field` names the form input the message belongs to, when known. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public field: string | null = null,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

type ValidationIssue = { loc?: (string | number)[]; msg?: string };

async function toApiError(response: Response): Promise<ApiError> {
  let body: { detail?: unknown; field?: string } = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON (e.g. proxy error page): keep the generic message below.
  }
  if (Array.isArray(body.detail)) {
    // FastAPI/Pydantic 422: [{loc: ["body", "title"], msg: "..."}]
    const fieldErrors: Record<string, string> = {};
    for (const issue of body.detail as ValidationIssue[]) {
      const field = issue.loc?.filter((p) => p !== "body").join(".") || "_";
      fieldErrors[field] ??= (issue.msg ?? "Invalid value").replace(/^Value error, /, "");
    }
    const first = Object.values(fieldErrors)[0] ?? "Some fields are invalid";
    return new ApiError(response.status, first, Object.keys(fieldErrors)[0] ?? null, fieldErrors);
  }
  if (typeof body.detail === "string") {
    const fieldErrors = body.field ? { [body.field]: body.detail } : {};
    return new ApiError(response.status, body.detail, body.field ?? null, fieldErrors);
  }
  const generic =
    response.status >= 500
      ? "The server returned an error. Please try again."
      : `Request failed (${response.status}).`;
  return new ApiError(response.status, generic);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const authHeaders = await getAuthHeaders();
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeaders, ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the PandaHat server. Is the backend running?");
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
