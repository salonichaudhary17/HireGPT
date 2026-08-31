import express from "express";
import { GoogleGenAI } from "@google/genai";

import authMiddleware from "../middleware/authMiddleware.js";

import Resume from "../models/Resume.js";

import {
  evaluateInterview,
} from "../services/geminiService.js";

import {
  retrieveRelevantChunks,
} from "../services/embeddingService.js";

import {
  callGeminiWithRetry,
} from "../utils/geminiErrorHandler.js";

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey:
    process.env.GEMINI_API_KEY,
});

/*
=========================================================
GENERATE INTERVIEW QUESTIONS
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

      const userId =
        req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,

          message:
            "User authentication required.",
        });
      }

      console.log(
        "\n================================"
      );

      console.log(
        "INTERVIEW QUESTION GENERATION STARTED"
      );

      console.log(
        "================================"
      );

      console.log(
        "Authenticated user:",
        userId
      );

      /*
      -------------------------------------------------------
      FIND USER'S RESUME
      -------------------------------------------------------

      IMPORTANT:

      We DO NOT require resumeId from the frontend.

      This makes the system work across:

      - laptop
      - phone
      - different browsers
      - existing accounts
      - fresh React sessions
      */

      const resume =
        await Resume.findOne({
          user: userId,
        }).sort({
          updatedAt: -1,
        });

      /*
      -------------------------------------------------------
      RESUME NOT FOUND
      -------------------------------------------------------
      */

      if (!resume) {
        return res.status(404).json({
          success: false,

          message:
            "Please upload your resume before generating interview questions.",
        });
      }

      /*
      -------------------------------------------------------
      RESUME ID
      -------------------------------------------------------
      */

      const resumeId =
        resume._id.toString();

      console.log(
        "Resume ID:",
        resumeId
      );

      console.log(
        "Resume:",
        resume.fileName
      );

      /*
      -------------------------------------------------------
      VALIDATE RESUME TEXT
      -------------------------------------------------------
      */

      if (
        !resume.extractedText ||
        !resume.extractedText.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Resume text is not available. Please upload your resume again.",
        });
      }

      /*
      -------------------------------------------------------
      VALIDATE CHUNKS
      -------------------------------------------------------
      */

      if (
        !Array.isArray(
          resume.chunks
        ) ||
        resume.chunks.length === 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Resume processing is incomplete. Please upload your resume again.",
        });
      }

      /*
      -------------------------------------------------------
      VALIDATE EMBEDDINGS
      -------------------------------------------------------
      */

      const validChunks =
        resume.chunks.filter(
          (chunk) =>
            typeof chunk.text ===
              "string" &&
            chunk.text.trim() &&
            Array.isArray(
              chunk.embedding
            ) &&
            chunk.embedding.length >
              0
        );

      if (
        !validChunks.length
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Resume embeddings are missing. Please upload your resume again.",
        });
      }

      console.log(
        "Resume characters:",
        resume.extractedText.length
      );

      console.log(
        "Resume chunks:",
        validChunks.length
      );

      /*
      -------------------------------------------------------
      RAG QUERY
      -------------------------------------------------------
      */

      const ragQuery = `
Generate personalized technical interview questions
for this software engineering candidate.

Use the candidate's resume.

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

Only use information that is actually present in
the candidate's resume.

Do not invent any skills, technologies, projects,
companies or experience.
`;

      /*
      -------------------------------------------------------
      RETRIEVE RESUME CHUNKS
      -------------------------------------------------------
      */

      console.log(
        "Retrieving relevant resume chunks..."
      );

      const relevantChunks =
        await retrieveRelevantChunks(
          resume,
          ragQuery,
          8
        );

      /*
      -------------------------------------------------------
      VALIDATE RETRIEVAL
      -------------------------------------------------------
      */

      if (
        !relevantChunks ||
        !relevantChunks.length
      ) {
        return res.status(404).json({
          success: false,

          message:
            "No relevant information was found in your resume. Please upload your resume again.",
        });
      }

      /*
      -------------------------------------------------------
      PREPARE CONTEXT
      -------------------------------------------------------
      */

      const resumeContext =
        relevantChunks
          .map(
            (chunk, index) =>
              `RESUME CHUNK ${
                index + 1
              }:\n${chunk.text}`
          )
          .join("\n\n");

      console.log(
        "Relevant resume chunks:",
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

The following content was retrieved directly from
the candidate's uploaded resume.

================ RESUME CONTEXT ================

${resumeContext}

=================================================

Generate exactly 10 personalized technical interview
questions.

STRICT RULES:

1. Every question MUST be based on the resume context.

2. Do NOT invent technologies.

3. Do NOT invent projects.

4. Do NOT invent companies.

5. Do NOT invent work experience.

6. Do NOT ask about a technology unless it is present
   in the resume context.

7. Ask questions about the candidate's actual projects.

8. Ask questions about implementation decisions.

9. Ask technical fundamentals related to technologies
   actually present in the resume.

10. Include questions of varying difficulty.

11. Avoid duplicate questions.

12. Questions should sound like realistic software
    engineering interview questions.

13. Do not ask generic questions such as:
    "Tell me about yourself."

14. Return exactly 10 questions.

Return ONLY a valid JSON array containing 10 strings.

Example:

[
  "How did you use React in the project mentioned in your resume?",
  "Why did you choose MongoDB for your application?"
]
`;

      /*
      -------------------------------------------------------
      CALL GEMINI
      -------------------------------------------------------
      */

      console.log(
        "Calling Gemini for interview questions..."
      );

      const response =
        await callGeminiWithRetry(
          () =>
            ai.models.generateContent({
              model:
                "gemini-3.6-flash",

              contents:
                prompt,

              config: {
                responseMimeType:
                  "application/json",
              },
            }),

          "generating your interview questions"
        );

      /*
      -------------------------------------------------------
      GET RESPONSE
      -------------------------------------------------------
      */

      let text =
        response.text ||
        response.candidates?.[0]
          ?.content
          ?.parts?.[0]
          ?.text ||
        "";

      text = text.trim();

      if (!text) {
        throw new Error(
          "Gemini returned an empty response."
        );
      }

      /*
      -------------------------------------------------------
      CLEAN JSON
      -------------------------------------------------------
      */

      text = text
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();

      /*
      -------------------------------------------------------
      PARSE JSON
      -------------------------------------------------------
      */

      let questions;

      try {
        questions =
          JSON.parse(text);

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
          "Gemini returned invalid interview question data."
        );
      }

      /*
      -------------------------------------------------------
      VALIDATE ARRAY
      -------------------------------------------------------
      */

      if (
        !Array.isArray(
          questions
        )
      ) {
        throw new Error(
          "Gemini did not return an array of questions."
        );
      }

      /*
      -------------------------------------------------------
      VALIDATE QUESTIONS
      -------------------------------------------------------
      */

      questions =
        questions
          .filter(
            (question) =>
              typeof question ===
                "string" &&
              question.trim()
                .length > 0
          )
          .map(
            (question) =>
              question.trim()
          )
          .slice(0, 10);

      if (
        questions.length !== 10
      ) {
        throw new Error(
          `Gemini returned ${questions.length} valid questions instead of exactly 10.`
        );
      }

      /*
      -------------------------------------------------------
      SUCCESS
      -------------------------------------------------------
      */

      console.log(
        `Generated ${questions.length} questions successfully.`
      );

      console.log(
        "================================"
      );

      console.log(
        "INTERVIEW QUESTION GENERATION COMPLETED"
      );

      console.log(
        "================================\n"
      );

      return res.status(200).json({
        success: true,

        message:
          "Interview questions generated successfully.",

        questions,

        resume: {
          id:
            resume._id.toString(),

          fileName:
            resume.fileName,
        },

        retrievedChunks:
          relevantChunks.map(
            (chunk) => ({
              chunkIndex:
                chunk.chunkIndex,

              similarity:
                Number(
                  chunk.similarity.toFixed(
                    4
                  )
                ),
            })
          ),
      });

    } catch (error) {
      console.error(
        "\n================================"
      );

      console.error(
        "QUESTION GENERATION ERROR"
      );

      console.error(
        "================================"
      );

      console.error(
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
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

      const userId =
        req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,

          message:
            "User authentication required.",
        });
      }

      /*
      -------------------------------------------------------
      ANSWERS
      -------------------------------------------------------
      */

      const {
        answers,
      } = req.body;

      if (
        !answers ||
        !Array.isArray(
          answers
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Interview answers are required.",
        });
      }

      /*
      -------------------------------------------------------
      EXACTLY 10
      -------------------------------------------------------
      */

      if (
        answers.length !== 10
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Exactly 10 interview answers are required.",
        });
      }

      /*
      -------------------------------------------------------
      VALIDATE ANSWERS
      -------------------------------------------------------
      */

      const invalidAnswer =
        answers.some(
          (item) =>
            !item ||
            typeof item.question !==
              "string" ||
            typeof item.answer !==
              "string"
        );

      if (invalidAnswer) {
        return res.status(400).json({
          success: false,

          message:
            "Each interview answer must contain a question and answer.",
        });
      }

      /*
      -------------------------------------------------------
      LOG
      -------------------------------------------------------
      */

      console.log(
        "\n================================"
      );

      console.log(
        "INTERVIEW EVALUATION STARTED"
      );

      console.log(
        "================================"
      );

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
      EVALUATE
      -------------------------------------------------------
      */

      const evaluation =
        await evaluateInterview(
          answers
        );

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
        success: true,

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
        success: false,

        message:
          error?.message ||
          "Failed to evaluate interview.",
      });
    }
  }
);

export default router;