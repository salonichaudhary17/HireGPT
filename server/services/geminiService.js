import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Sleep helper for retry backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pull a Google API status code out of whatever shape the SDK throws.
// The SDK sometimes throws an Error whose .message is itself a JSON string
// like {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}.
const getErrorStatusCode = (error) => {
  if (error?.status) return error.status;

  try {
    const parsed = JSON.parse(error.message);
    return parsed?.error?.code || null;
  } catch {
    return null;
  }
};

// Turn any Gemini error into a short, human-readable message.
// Never leaks raw JSON or stack traces to the client.
const toFriendlyError = (error, action) => {
  const code = getErrorStatusCode(error);

  if (code === 503) {
    return new Error(
      `The AI is currently experiencing high demand. Please try ${action} again in a moment.`
    );
  }

  if (code === 429) {
    return new Error(
      "Too many requests right now. Please wait a few seconds and try again."
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

// Retry a Gemini call a few times on transient errors (503/429),
// with a short exponential backoff between attempts.
const callWithRetry = async (fn, { retries = 2, baseDelayMs = 1000 } = {}) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const code = getErrorStatusCode(error);
      const isTransient = code === 503 || code === 429;

      if (!isTransient || attempt === retries) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(
        `Gemini call failed (attempt ${attempt + 1}/${retries + 1}, code ${code}). Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
};

export const generateInterviewQuestions = async (resumeText) => {
  console.log("Gemini request started");
  console.log("Resume characters:", resumeText.length);

  const prompt = `
You are an expert technical interviewer.

Based ONLY on the candidate's resume below, generate exactly 5
high-quality technical interview questions.

Requirements:
- Questions must be directly related to the candidate's resume.
- Focus on projects, technologies, technical decisions, and fundamentals.
- Avoid generic questions.
- Questions should progressively test technical depth.
- Return ONLY a valid JSON array of 5 strings.
- Do not use markdown.
- Do not include numbering outside the JSON.

Resume:
${resumeText}
`;

  try {
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      })
    );

    console.log("Gemini response received");

    let text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const questions = JSON.parse(text);

    if (!Array.isArray(questions)) {
      throw new Error("Gemini response is not an array");
    }

    if (questions.length !== 5) {
      throw new Error(`Expected 5 questions, received ${questions.length}`);
    }

    return questions;
  } catch (error) {
    console.error("Gemini error:", error);
    throw toFriendlyError(error, "generating your questions");
  }
};

export const evaluateInterview = async (questionsAndAnswers) => {
  console.log("Interview evaluation started");

  const prompt = `
You are an expert technical interviewer.

Evaluate the candidate's interview answers.

For each question:
- Give a score out of 20.
- Explain what was good.
- Explain what could be improved.

Then provide:
- Total score out of 100
- Overall performance
- Strengths
- Areas for improvement
- Final feedback

Return ONLY valid JSON in exactly this format:

{
  "totalScore": 0,
  "overallPerformance": "",
  "strengths": [],
  "areasToImprove": [],
  "feedback": "",
  "results": [
    {
      "question": "",
      "answer": "",
      "score": 0,
      "feedback": ""
    }
  ]
}

Interview:

${questionsAndAnswers
  .map(
    (item, index) => `
Question ${index + 1}:
${item.question}

Candidate Answer:
${item.answer}
`
  )
  .join("\n")}
`;

  try {
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      })
    );

    console.log("Gemini evaluation received");

    let text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty evaluation");
    }

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const evaluation = JSON.parse(text);

    return evaluation;
  } catch (error) {
    console.error("Gemini evaluation error:", error);
    throw toFriendlyError(error, "evaluating your interview");
  }
};