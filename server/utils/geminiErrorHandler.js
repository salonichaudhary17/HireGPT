// Shared error handling for any Gemini API call (generateContent,
// embedContent, etc). Two jobs:
//
// 1. Retry transient failures (503 "model overloaded") a couple of
//    times with backoff, since those usually resolve themselves.
// 2. Convert whatever the Gemini SDK throws into a short, human
//    message — never leak the raw JSON error blob to the client.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pull a Google API status code out of whatever shape the SDK throws.
// The SDK sometimes throws an Error whose .message is itself a JSON
// string like {"error":{"code":503,"message":"...","status":"..."}}.
const getErrorStatusCode = (error) => {
  if (error?.status) return error.status;

  try {
    const parsed = JSON.parse(error.message);
    return parsed?.error?.code || null;
  } catch {
    return null;
  }
};

// Detect quota-exhausted specifically (429 + RESOURCE_EXHAUSTED) so we
// can give a message that doesn't falsely suggest "just try again".
const isQuotaExhausted = (error) => {
  try {
    const parsed = JSON.parse(error.message);
    return parsed?.error?.status === "RESOURCE_EXHAUSTED";
  } catch {
    return false;
  }
};

// Turn any Gemini error into a short, human-readable message.
const toFriendlyGeminiError = (error, action) => {
  const code = getErrorStatusCode(error);

  if (code === 429 && isQuotaExhausted(error)) {
    return new Error(
      "The AI service has hit its daily request limit. Please try again later, or contact the site owner to raise the API quota."
    );
  }

  if (code === 429) {
    return new Error(
      "Too many requests right now. Please wait a few seconds and try again."
    );
  }

  if (code === 503) {
    return new Error(
      `The AI is currently experiencing high demand. Please try ${action} again in a moment.`
    );
  }

  if (code === 400 || code === 401 || code === 403) {
    return new Error(
      "There's a problem with the AI service configuration. Please contact support."
    );
  }

  return new Error(
    `Something went wrong while ${action}. Please try again.`
  );
};

// Retry a Gemini call a few times, but ONLY for transient errors
// (503). A 429 quota-exhausted error will not be fixed by retrying,
// so it fails immediately instead of wasting time and further calls.
const callGeminiWithRetry = async (
  fn,
  action,
  { retries = 2, baseDelayMs = 1000 } = {}
) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const code = getErrorStatusCode(error);
      const isTransient = code === 503;

      if (!isTransient || attempt === retries) {
        throw toFriendlyGeminiError(error, action);
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(
        `Gemini call failed (attempt ${attempt + 1}/${retries + 1}, code ${code}) during ${action}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw toFriendlyGeminiError(lastError, action);
};

export { callGeminiWithRetry, toFriendlyGeminiError };