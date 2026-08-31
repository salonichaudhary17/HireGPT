import express from "express";
import { GoogleGenAI } from "@google/genai";

import authMiddleware from "../middleware/authMiddleware.js";
import { evaluateInterview } from "../services/geminiService.js";
import { retrieveRelevantChunks } from "../services/ragService.js";
import { callGeminiWithRetry } from "../utils/geminiErrorHandler.js";

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
=========================================================
GENERATE INTERVIEW QUESTIONS WITH RAG
=========================================================
*/

router.post(
  "/generate-questions",
  authMiddleware,
  async (req, res) => {
    try {
      /*
      -------------------------------------------------------
      AUTHENTICATED USER
      -------------------------------------------------------
      */

      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          message: "User authentication required.",
        });
      }

      console.log("\n================================");
      console.log("RAG INTERVIEW GENERATION STARTED");
      console.log("================================");

      console.log("Authenticated user:", userId);

      /*
      -------------------------------------------------------
      RAG QUERY
      -------------------------------------------------------
      */

      const ragQuery = `
Generate personalized technical interview questions based on
the candidate's resume.

Focus on:
- Programming languages
- Technical skills
- Projects
- Work experience
- Education
- Achievements
- Tools
- Frameworks
- Databases
- Technologies

Only use information actually present in the candidate's
resume.
`;

      /*
      -------------------------------------------------------
      RETRIEVE RELEVANT RESUME CHUNKS
      -------------------------------------------------------
      */

      const relevantChunks =
        await retrieveRelevantChunks(
          userId,
          ragQuery,
          5
        );

      if (!relevantChunks.length) {
        return res.status(404).json({
          message:
            "No relevant resume information found.",
        });
      }

      /*
      -------------------------------------------------------
      PREPARE RESUME CONTEXT
      -------------------------------------------------------
      */

      const resumeContext = relevantChunks
        .map(
          (chunk, index) =>
            `RESUME CHUNK ${index + 1}:\n${chunk.text}`
        )
        .join("\n\n");

      console.log(
        "Resume context prepared for Gemini."
      );

      console.log(
        "Retrieved chunks:",
        relevantChunks.length
      );

      /*
      -------------------------------------------------------
      GEMINI PROMPT
      -------------------------------------------------------
      */

      const prompt = `
You are an expert technical interviewer.

You are interviewing a software engineering candidate.

The following information was retrieved from the
candidate's resume using a Retrieval-Augmented Generation
(RAG) system.

================ RESUME CONTEXT ================

${resumeContext}

==================================================

Generate exactly 10 personalized interview questions.

Requirements:

1. Questions MUST be based on the resume context above.

2. Ask technical questions about programming languages,
   frameworks, databases, tools and technologies mentioned
   in the resume.

3. Ask questions about the candidate's projects.

4. Ask questions that allow the candidate to explain their
   own implementation decisions.

5. Ask questions about technical fundamentals related to
   technologies actually present in the resume.

6. Include a few experience-based questions.

7. Do NOT invent technologies, projects, companies,
   experience or skills that are not present in the
   resume context.

8. Questions should range from easy to difficult.

9. Avoid duplicate questions.

10. Make the questions realistic for a software engineering
    interview.

Return ONLY a valid JSON array of strings.

Example:

[
  "Explain how you used React in your project.",
  "Why did you choose MongoDB for your application?"
]
`;

      /*
      -------------------------------------------------------
      CALL GEMINI
      -------------------------------------------------------
      */

      const response = await callGeminiWithRetry(
        () =>
          ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          }),
        "generating your interview questions"
      );

      /*
      -------------------------------------------------------
      GET RESPONSE TEXT
      -------------------------------------------------------
      */

      const text =
        response.text ||
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (!text) {
        throw new Error(
          "Gemini returned an empty response."
        );
      }

      /*
      -------------------------------------------------------
      PARSE JSON
      -------------------------------------------------------
      */

      let questions;

      try {
        questions = JSON.parse(text);
      } catch (parseError) {
        console.error(
          "Gemini JSON parsing error:",
          parseError
        );

        console.error(
          "Gemini response:",
          text
        );

        throw new Error(
          "Gemini returned invalid question data."
        );
      }

      /*
      -------------------------------------------------------
      VALIDATE QUESTIONS
      -------------------------------------------------------
      */

      if (
        !Array.isArray(questions) ||
        questions.length === 0
      ) {
        throw new Error(
          "Gemini did not return valid interview questions."
        );
      }

      questions = questions
        .filter(
          (question) =>
            typeof question === "string" &&
            question.trim().length > 0
        )
        .map((question) => question.trim())
        .slice(0, 10);

      if (!questions.length) {
        throw new Error(
          "No valid interview questions were generated."
        );
      }

      /*
      -------------------------------------------------------
      SUCCESS LOGS
      -------------------------------------------------------
      */

      console.log(
        `Generated ${questions.length} RAG-based questions.`
      );

      console.log(
        "================================"
      );

      console.log(
        "RAG INTERVIEW GENERATION COMPLETED"
      );

      console.log(
        "================================\n"
      );

      /*
      -------------------------------------------------------
      RESPONSE
      -------------------------------------------------------
      */

      return res.status(200).json({
        message:
          "Interview questions generated successfully using RAG.",

        questions,

        retrievedChunks:
          relevantChunks.map((chunk) => ({
            chunkIndex: chunk.chunkIndex,
            similarity: Number(
              chunk.similarity.toFixed(4)
            ),
          })),
      });
    } catch (error) {
      console.error(
        "RAG question generation error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Failed to generate interview questions.",
      });
    }
  }
);

/*
=========================================================
EVALUATE INTERVIEW
=========================================================
*/

router.post(
  "/evaluate",
  authMiddleware,
  async (req, res) => {
    try {
      /*
      -------------------------------------------------------
      AUTHENTICATED USER
      -------------------------------------------------------
      */

      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          message: "User authentication required.",
        });
      }

      /*
      -------------------------------------------------------
      GET ANSWERS
      -------------------------------------------------------
      */

      const { answers } = req.body;

      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({
          message: "Interview answers are required.",
        });
      }

      if (answers.length !== 10) {
        return res.status(400).json({
          message:
            "Exactly 10 interview answers are required.",
        });
      }

      /*
      -------------------------------------------------------
      LOG
      -------------------------------------------------------
      */

      console.log("\n================================");
      console.log("INTERVIEW EVALUATION STARTED");
      console.log("================================");

      console.log(
        "Authenticated user:",
        userId
      );

      console.log(
        "Answers received:",
        answers.length
      );

      /*
      -------------------------------------------------------
      EVALUATE USING GEMINI
      -------------------------------------------------------
      */

      const evaluation =
        await evaluateInterview(answers);

      /*
      -------------------------------------------------------
      SUCCESS
      -------------------------------------------------------
      */

      console.log(
        "Interview evaluation completed."
      );

      console.log(
        "================================\n"
      );

      return res.status(200).json({
        message:
          "Interview evaluated successfully.",
        evaluation,
      });
    } catch (error) {
      console.error(
        "Interview evaluation error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Failed to evaluate interview.",
      });
    }
  }
);

export default router;