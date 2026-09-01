/*
=========================================================
apiFetch

A drop-in replacement for `fetch()` that:

1. Adds a timeout, so a hung request fails with a clear
   message instead of the tab just sitting there.

2. Retries automatically on a pure network failure
   ("Failed to fetch" / TypeError). This is what you hit
   most often on Render's free tier: the backend spins
   down after ~15 minutes of no traffic, and the very
   first request that wakes it back up sometimes drops
   instead of just being slow. A short retry with backoff
   fixes that without the user having to click twice.

3. Never retries on a real HTTP error response (400, 401,
   500, etc) — those are the server actually responding,
   so retrying won't change anything and we want the real
   error message to reach the UI immediately.
=========================================================
*/

export async function apiFetch(
  url,
  options = {},
  { retries = 2, retryDelayMs = 3000, timeoutMs = 45000 } = {}
) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // We got a real response from the server (even if it's
      // an error status) — stop retrying, hand it back.
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      const isLastAttempt = attempt === retries;

      const isNetworkFailure =
        error?.name === "AbortError" ||
        (error instanceof TypeError &&
          /fetch/i.test(error.message || ""));

      if (!isNetworkFailure || isLastAttempt) {
        break;
      }

      console.warn(
        `Network request failed (attempt ${attempt + 1}/${
          retries + 1
        }). The server may be waking up. Retrying in ${retryDelayMs}ms...`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs)
      );
    }
  }

  // Every attempt failed at the network level.
  if (lastError?.name === "AbortError") {
    throw new Error(
      "The server took too long to respond. It may be waking up from sleep — please try again in a moment."
    );
  }

  throw new Error(
    "Could not reach the server. It may be waking up (this can take up to a minute on the first try) — please try again."
  );
}