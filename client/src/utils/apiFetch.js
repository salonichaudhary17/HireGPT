/*
=========================================================
apiFetch

A drop-in replacement for `fetch()` that:

1. Adds a timeout per attempt, so a hung request fails with
   a clear message instead of the tab just sitting there.

2. Retries automatically on a pure network failure
   ("Failed to fetch" / TypeError / timeout). This is what
   you hit on Render's free tier: the backend spins down
   after ~15 minutes of no traffic, and waking it back up
   can take 30-60 seconds. A short retry isn't enough to
   cover that, so this backs off across several attempts
   before giving up.

3. Never retries on a real HTTP error response (400, 401,
   500, etc) — those mean the server IS awake and actually
   answered, so retrying won't help; we want that error to
   reach the UI immediately.

4. Accepts an onRetry callback so the UI can show
   "Waking up the server..." instead of just spinning.
=========================================================
*/

export async function apiFetch(
  url,
  options = {},
  {
    retries = 4,
    retryDelayMs = 4000,
    timeoutMs = 20000,
    onRetry,
  } = {}
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

      // Got a real response from the server (even an error
      // status) — stop retrying, hand it back as-is.
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

      if (typeof onRetry === "function") {
        onRetry(attempt + 1, retries + 1);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs)
      );
    }
  }

  // Every attempt failed at the network level.
  throw new Error(
    "Could not reach the server after several tries. It may still be waking up from sleep — please wait ~30 seconds and try again."
  );
}

/*
=========================================================
wakeServer

Fire-and-forget ping to the health endpoint. Call this the
moment the Resume page mounts (before the user even picks
a file), so the free-tier instance is already spinning up
in the background by the time they hit Upload.
=========================================================
*/

export function wakeServer(apiUrl) {
  if (!apiUrl) return;

  fetch(`${apiUrl}/api/health`).catch(() => {
    // Ignore — this is just a best-effort warm-up ping.
  });
}