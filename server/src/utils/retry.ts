/**
 * Bounded retry with exponential backoff for transient failures (a DB blip,
 * a momentary network hiccup) — not a substitute for Inngest's durable
 * retries, which handle multi-minute outages across process restarts. This
 * is for calls that must complete synchronously within the current request
 * (e.g. persisting a chat message before the response the user is already
 * watching can be considered done) where deferring to a background job isn't
 * appropriate, but silently accepting the first transient failure isn't
 * either.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
