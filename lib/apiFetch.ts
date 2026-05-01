export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error ?? `HTTP ${res.status}: ${res.statusText}`;
    throw new HttpError(message, res.status);
  }

  return res.json() as Promise<T>;
}
