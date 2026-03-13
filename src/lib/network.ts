function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
  retries = 3,
): Promise<T> {
  const { timeoutMs = 8000, ...requestInit } = init;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(new DOMException("Request timed out", "AbortError")), timeoutMs);
    const signal = requestInit.signal
      ? AbortSignal.any([requestInit.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(input, {
        ...requestInit,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (isAbortError(error) && requestInit.signal?.aborted) {
        throw error;
      }

      lastError = error;
      if (attempt === retries - 1) {
        throw error;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 300 * 2 ** attempt));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  baseDelayMs = 300,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Operation failed");
}
