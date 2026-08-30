import { GoogleGenAI } from "@google/genai";

// =====================================================
// GEMINI AI
// =====================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =====================================================
// EMBEDDING CONFIG
// =====================================================

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

// =====================================================
// CHUNK CONFIG
// =====================================================

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

// =====================================================
// CREATE CHUNKS
// =====================================================

export function createChunks(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Text is required to create chunks");
  }

  const cleanedText = text.trim();

  if (!cleanedText) {
    return [];
  }

  const chunks = [];

  let start = 0;

  while (start < cleanedText.length) {
    let end = start + CHUNK_SIZE;

    // Don't go beyond the text
    if (end > cleanedText.length) {
      end = cleanedText.length;
    }

    const chunk = cleanedText.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    // Finished
    if (end >= cleanedText.length) {
      break;
    }

    // Move forward while keeping overlap
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

// =====================================================
// GENERATE ONE EMBEDDING
// =====================================================

export async function generateEmbedding(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Text is required to generate an embedding");
  }

  const cleanedText = text.trim();

  if (!cleanedText) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: cleanedText,

    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  if (
    !result ||
    !result.embeddings ||
    !result.embeddings[0] ||
    !result.embeddings[0].values
  ) {
    throw new Error(
      "Gemini returned an invalid embedding response"
    );
  }

  const embedding = result.embeddings[0].values;

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding dimension. Expected ${EMBEDDING_DIMENSIONS}, received ${embedding.length}`
    );
  }

  return embedding;
}

// =====================================================
// GENERATE EMBEDDINGS FOR ALL CHUNKS
// =====================================================

export async function generateEmbeddings(chunks) {
  if (!Array.isArray(chunks)) {
    throw new Error("Chunks must be an array");
  }

  if (chunks.length === 0) {
    return [];
  }

  console.log(
    `Generating embeddings for ${chunks.length} chunks...`
  );

  const embeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(
      `Embedding chunk ${i + 1}/${chunks.length}...`
    );

    const embedding = await generateEmbedding(chunks[i]);

    embeddings.push(embedding);
  }

  console.log(
    `Embeddings generated successfully: ${embeddings.length}`
  );

  console.log(
    `Embedding dimensions: ${embeddings[0]?.length || 0}`
  );

  return embeddings;
}

// =====================================================
// COSINE SIMILARITY
// =====================================================

export function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new Error("Both vectors must be arrays");
  }

  if (vectorA.length !== vectorB.length) {
    throw new Error(
      `Vector dimensions do not match: ${vectorA.length} vs ${vectorB.length}`
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];

    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
}

// =====================================================
// RAG RETRIEVAL
// =====================================================

export async function retrieveRelevantChunks(
  resume,
  query,
  topK = 3
) {
  if (!resume) {
    throw new Error("Resume is required for retrieval");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Query is required for retrieval");
  }

  if (!resume.chunks || resume.chunks.length === 0) {
    throw new Error("No resume chunks available");
  }

  console.log("\n==============================");
  console.log("RAG RETRIEVAL STARTED");
  console.log("==============================");

  console.log("Query:", query);
  console.log("Total chunks:", resume.chunks.length);

  // -------------------------------------------------
  // CREATE EMBEDDING FOR USER QUERY
  // -------------------------------------------------

  console.log("Generating query embedding...");

  const queryEmbedding = await generateEmbedding(query);

  console.log(
    "Query embedding dimensions:",
    queryEmbedding.length
  );

  // -------------------------------------------------
  // CALCULATE SIMILARITY
  // -------------------------------------------------

  const scoredChunks = resume.chunks.map((chunk) => {
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

  // -------------------------------------------------
  // SORT BY RELEVANCE
  // -------------------------------------------------

  scoredChunks.sort(
    (a, b) => b.similarity - a.similarity
  );

  // -------------------------------------------------
  // TOP K
  // -------------------------------------------------

  const limit = Math.max(
    1,
    Math.min(Number(topK) || 3, scoredChunks.length)
  );

  const relevantChunks = scoredChunks.slice(0, limit);

  console.log("\nRetrieved chunks:");

  relevantChunks.forEach((chunk, index) => {
    console.log(
      `${index + 1}. Chunk ${chunk.chunkIndex} - similarity: ${chunk.similarity.toFixed(4)}`
    );
  });

  console.log("\n==============================");
  console.log("RAG RETRIEVAL COMPLETED");
  console.log("==============================\n");

  return relevantChunks;
}

// =====================================================
// EXPORT CONFIG
// =====================================================

export {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};