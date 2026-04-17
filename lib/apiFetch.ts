export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);

  if (!res.ok) {
    // Try to parse a structured error, fall back to status text
    const body = await res.json().catch(() => null);
    const message = body?.error ?? `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
