import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.code = body.error.code;
    this.requestId = body.error.request_id;
    this.status = status;
  }
}

/** Direct API URL for desktop (port 5174 UI → port 8010 API). Vite proxy is dev fallback only. */
function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return "http://127.0.0.1:8010";
    }
  }
  return "";
}

const API_BASE = resolveApiBase();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 6): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof Error && err.name === "AbortError") throw err;
      if (i < attempts - 1) await sleep(3000);
    }
  }
  throw lastErr;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  // FormData must not force application/json — browser sets multipart boundary.
  if (isFormData) {
    delete headers["Content-Type"];
  }
  try {
    response = await fetchWithRetry(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof TypeError || (err instanceof Error && err.message === "Failed to fetch")) {
      throw new Error(
        "Analysis is still warming up. Wait a moment, then click Analyze again.",
      );
    }
    throw err;
  }

  if (!response.ok) {
    try {
      const body = await parseJson<ApiErrorBody>(response);
      if (body.error?.code) {
        throw new ApiError(response.status, body);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
    }
    throw new Error(`Request failed with status ${response.status}`);
  }

  return parseJson<T>(response);
}
