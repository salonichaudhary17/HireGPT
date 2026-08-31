import { GoogleGenAI } from "@google/genai";
import Resume from "../models/Resume.js";
import { callGeminiWithRetry } from "../utils/geminiErrorHandler.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
=========================================================
COSINE SIMILARITY
=========================================================
*/

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
}

/*
=========================================================
GENERATE QUERY EMBEDDING
=========================================================
*/

async function generateQueryEmbedding(query) {
  const response = await callGeminiWithRetry(
    () =>
      ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: query,
        config: {
          outputDimensionality: 768,
        },
      }),
    "searching your resume"
  );

  return response.embeddings?.[0]?.values || [];
}

/*
=========================================================
RETRIEVE RELEVANT RESUME CHUNKS
=========================================================
*/

export async function retrieveRelevantChunks(
  userId,
  query,
  topK = 5
) {
  if (!userId) {
    throw new Error("User ID is required for RAG retrieval.");
  }

  if (!query || !query.trim()) {
    throw new Error("Query is required for RAG retrieval.");
  }

  /*
  -------------------------------------------------------
  Find user's latest resume
  -------------------------------------------------------
  */

  const resume = await Resume.findOne({
    user: userId,
  }).sort({ createdAt: -1 });

  if (!resume) {
    throw new Error("No resume found. Please upload a resume first.");
  }

  /*
  -------------------------------------------------------
  Generate embedding for the query
  -------------------------------------------------------
  */

  console.log("\n==============================");
  console.log("RAG RETRIEVAL STARTED");
  console.log("==============================");

  console.log("Query:", query);

  const queryEmbedding = await generateQueryEmbedding(
    query
  );

  if (!queryEmbedding.length) {
    throw new Error("Failed to generate query embedding.");
  }

  console.log(
    "Query embedding dimensions:",
    queryEmbedding.length
  );

  /*
  -------------------------------------------------------
  Get stored resume chunks
  -------------------------------------------------------
  */

  const chunks = resume.chunks || [];

  if (!chunks.length) {
    throw new Error(
      "No resume chunks found. Please upload your resume again."
    );
  }

  /*
  -------------------------------------------------------
  Calculate similarity
  -------------------------------------------------------
  */

  const scoredChunks = chunks
    .filter(
      (chunk) =>
        Array.isArray(chunk.embedding) &&
        chunk.embedding.length > 0
    )
    .map((chunk) => {
      const similarity = cosineSimilarity(
        queryEmbedding,
        chunk.embedding
      );

      return {
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        similarity,
      };
    });

  /*
  -------------------------------------------------------
  Sort highest similarity first
  -------------------------------------------------------
  */

  scoredChunks.sort(
    (a, b) => b.similarity - a.similarity
  );

  /*
  -------------------------------------------------------
  Return top K chunks
  -------------------------------------------------------
  */

  const results = scoredChunks.slice(0, topK);

  console.log(
    `Retrieved ${results.length} relevant chunks`
  );

  results.forEach((result, index) => {
    console.log(
      `Chunk ${index + 1}: index=${result.chunkIndex}, similarity=${result.similarity.toFixed(
        4
      )}`
    );
  });

  console.log("==============================");
  console.log("RAG RETRIEVAL COMPLETED");
  console.log("==============================\n");

  return results;
}