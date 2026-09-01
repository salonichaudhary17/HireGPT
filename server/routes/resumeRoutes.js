import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

import Resume from "../models/Resume.js";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createChunks,
  generateEmbeddings,
  retrieveRelevantChunks,
} from "../services/embeddingService.js";

const router = express.Router();

/*
=========================================================
UPLOAD DIRECTORY
=========================================================
*/

const uploadDir = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

/*
=========================================================
MULTER STORAGE
=========================================================
*/

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const uniqueName =
      `${Date.now()}-${safeOriginalName}`;

    cb(null, uniqueName);
  },
});

/*
=========================================================
PDF FILTER
=========================================================
*/

const fileFilter = (req, file, cb) => {
  const isPdfMimeType =
    file.mimetype === "application/pdf";

  const isPdfExtension =
    path.extname(file.originalname).toLowerCase() ===
    ".pdf";

  if (isPdfMimeType || isPdfExtension) {
    cb(null, true);
  } else {
    cb(
      new Error("Only PDF files are allowed."),
      false
    );
  }
};

/*
=========================================================
MULTER
=========================================================
*/

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/*
=========================================================
SAFE MULTER WRAPPER

Calling upload.single(...) directly as route middleware
means any error it throws (wrong file type, file too big,
disk write failure) falls through to Express's default
error handling. On a slow connection that can abort the
socket mid-upload instead of cleanly finishing the response
— which is exactly what shows up in the browser as
"Failed to fetch" instead of a readable error message.

Wrapping it ourselves guarantees we always fully drain the
request and always send back real JSON.
=========================================================
*/

function safeUploadSingle(req, res, next) {
  upload.single("resume")(req, res, (err) => {
    if (!err) {
      return next();
    }

    console.error("MULTER ERROR:", err.message);

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "PDF must be smaller than 5 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    // Errors thrown from fileFilter (e.g. "Only PDF files are allowed.")
    return res.status(400).json({
      success: false,
      message: err.message || "Only PDF files are allowed.",
    });
  });
}

/*
=========================================================
HELPER: RUN A PROMISE WITH A HARD TIME LIMIT

If Gemini is slow/overloaded, we want to fail fast with a
clean JSON error rather than let the request hang until
Render's proxy (or the browser) kills the connection, which
shows up to the user as "Failed to fetch".
=========================================================
*/

function withTimeout(promise, ms, message) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer)
  );
}

/*
=========================================================
UPLOAD RESUME
=========================================================
*/

router.post(
  "/upload",

  authMiddleware,

  safeUploadSingle,

  async (req, res) => {
    let newFilePath = null;

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
      console.log("RESUME UPLOAD STARTED");
      console.log("================================");
      console.log("Authenticated user:", userId);

      /*
      -------------------------------------------------------
      CHECK FILE
      -------------------------------------------------------
      */

      if (!req.file) {
        return res.status(400).json({
          message: "Please select a PDF resume.",
        });
      }

      newFilePath = req.file.path;

      console.log("Uploaded file:", req.file.originalname);
      console.log("Stored file:", newFilePath);
      console.log("File size:", req.file.size);

      /*
      -------------------------------------------------------
      READ PDF
      -------------------------------------------------------
      */

      const pdfBuffer = fs.readFileSync(
        newFilePath
      );

      const parser = new PDFParse({
        data: pdfBuffer,
      });

      const pdfData = await withTimeout(
        parser.getText(),
        30000,
        "Reading the PDF took too long. Please try a smaller or simpler PDF."
      );

      await parser.destroy();

      const extractedText =
        pdfData?.text?.trim() || "";

      console.log(
        "Extracted resume characters:",
        extractedText.length
      );

      /*
      -------------------------------------------------------
      VALIDATE EXTRACTED TEXT
      -------------------------------------------------------
      */

      if (!extractedText) {
        throw new Error(
          "Could not extract text from this PDF. Please upload a text-based PDF resume."
        );
      }

      /*
      -------------------------------------------------------
      CREATE CHUNKS
      -------------------------------------------------------
      */

      const chunks = createChunks(
        extractedText
      );

      console.log(
        "Resume chunks created:",
        chunks.length
      );

      if (!chunks.length) {
        throw new Error(
          "No readable content was found in the resume."
        );
      }

      /*
      -------------------------------------------------------
      GENERATE EMBEDDINGS
      -------------------------------------------------------
      */

      console.log(
        "Generating resume embeddings..."
      );

      const embeddings = await withTimeout(
        generateEmbeddings(chunks),
        60000,
        "Generating embeddings for your resume took too long. Please try again."
      );

      console.log(
        "Embeddings generated:",
        embeddings.length
      );

      /*
      -------------------------------------------------------
      VALIDATE EMBEDDINGS
      -------------------------------------------------------
      */

      if (
        !Array.isArray(embeddings) ||
        embeddings.length !== chunks.length
      ) {
        throw new Error(
          "Failed to generate embeddings for the complete resume."
        );
      }

      const invalidEmbedding = embeddings.find(
        (embedding) =>
          !Array.isArray(embedding) ||
          embedding.length === 0
      );

      if (invalidEmbedding) {
        throw new Error(
          "One or more resume embeddings are invalid."
        );
      }

      /*
      -------------------------------------------------------
      PREPARE RAG DATA
      -------------------------------------------------------
      */

      const ragChunks = chunks.map(
        (text, index) => ({
          text,
          embedding: embeddings[index],
          chunkIndex: index,
        })
      );

      /*
      -------------------------------------------------------
      FIND EXISTING RESUME
      -------------------------------------------------------
      */

      const existingResume =
        await Resume.findOne({
          user: userId,
        });

      const oldFilePath =
        existingResume?.filePath || null;

      /*
      -------------------------------------------------------
      SAVE / UPDATE RESUME
      -------------------------------------------------------

      IMPORTANT:
      We DO NOT delete the old file before saving.

      This prevents an existing user's old resume from
      disappearing if the database update fails.
      */

      let resume;

      if (existingResume) {
        console.log(
          "Existing resume found. Updating it..."
        );

        existingResume.fileName =
          req.file.originalname;

        existingResume.filePath =
          newFilePath;

        existingResume.extractedText =
          extractedText;

        existingResume.chunks =
          ragChunks;

        resume =
          await existingResume.save();

        console.log(
          "Existing resume updated successfully."
        );
      } else {
        console.log(
          "No existing resume found. Creating new resume..."
        );

        resume =
          await Resume.create({
            user: userId,

            fileName:
              req.file.originalname,

            filePath:
              newFilePath,

            extractedText:
              extractedText,

            chunks:
              ragChunks,
          });

        console.log(
          "New resume created successfully."
        );
      }

      /*
      -------------------------------------------------------
      DELETE OLD FILE ONLY AFTER DATABASE SUCCESS
      -------------------------------------------------------
      */

      if (
        oldFilePath &&
        oldFilePath !== newFilePath &&
        fs.existsSync(oldFilePath)
      ) {
        try {
          fs.unlinkSync(oldFilePath);

          console.log(
            "Old resume file deleted successfully."
          );
        } catch (deleteError) {
          console.warn(
            "Could not delete old resume file:",
            deleteError.message
          );
        }
      }

      /*
      -------------------------------------------------------
      SUCCESS
      -------------------------------------------------------
      */

      console.log("\n================================");
      console.log("RESUME UPLOAD COMPLETED");
      console.log("================================");

      console.log("Resume ID:", resume._id);
      console.log(
        "Stored chunks:",
        resume.chunks.length
      );

      return res.status(201).json({
        success: true,

        message:
          "Resume uploaded successfully. You can now generate interview questions.",

        resume: {
          id: resume._id.toString(),

          fileName:
            resume.fileName,

          extractedTextLength:
            resume.extractedText.length,

          chunks:
            resume.chunks.length,

          embeddings:
            resume.chunks.length,
        },
      });
    } catch (error) {
      console.error(
        "\n================================"
      );
      console.error(
        "RESUME UPLOAD ERROR"
      );
      console.error(
        "================================"
      );

      console.error(
        error
      );

      /*
      -------------------------------------------------------
      DELETE ONLY THE NEW FILE IF PROCESSING FAILED
      -------------------------------------------------------
      */

      if (
        newFilePath &&
        fs.existsSync(newFilePath)
      ) {
        try {
          fs.unlinkSync(newFilePath);

          console.log(
            "Failed upload file removed."
          );
        } catch (deleteError) {
          console.error(
            "Could not remove failed upload:",
            deleteError.message
          );
        }
      }

      /*
      -------------------------------------------------------
      DUPLICATE KEY ERROR
      -------------------------------------------------------
      */

      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "A resume already exists for this account. Please try uploading again.",
        });
      }

      /*
      -------------------------------------------------------
      CLIENT-FRIENDLY ERROR
      -------------------------------------------------------
      */

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,

          message:
            error?.message ||
            "Failed to upload resume. Please try again.",
        });
      }
    }
  }
);

/*
=========================================================
GET CURRENT USER'S RESUME
=========================================================
*/

router.get(
  "/me",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          message: "User authentication required.",
        });
      }

      const resume =
        await Resume.findOne({
          user: userId,
        }).select(
          "_id fileName extractedText chunks createdAt updatedAt"
        );

      if (!resume) {
        return res.status(404).json({
          success: false,
          message:
            "Resume not found. Please upload your resume first.",
        });
      }

      return res.status(200).json({
        success: true,

        resume: {
          id: resume._id.toString(),

          fileName:
            resume.fileName,

          extractedTextLength:
            resume.extractedText?.length || 0,

          chunks:
            resume.chunks?.length || 0,

          createdAt:
            resume.createdAt,

          updatedAt:
            resume.updatedAt,
        },
      });
    } catch (error) {
      console.error(
        "Fetch resume error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch your resume.",
      });
    }
  }
);

/*
=========================================================
RAG RETRIEVAL
=========================================================
*/

router.post(
  "/retrieve",

  authMiddleware,

  async (req, res) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          message: "User authentication required.",
        });
      }

      const {
        query,
        topK = 3,
      } = req.body;

      /*
      -------------------------------------------------------
      VALIDATE QUERY
      -------------------------------------------------------
      */

      if (
        !query ||
        typeof query !== "string" ||
        !query.trim()
      ) {
        return res.status(400).json({
          message: "Query is required.",
        });
      }

      /*
      -------------------------------------------------------
      FIND USER'S RESUME
      -------------------------------------------------------
      */

      const resume =
        await Resume.findOne({
          user: userId,
        });

      if (!resume) {
        return res.status(404).json({
          message:
            "Resume not found. Please upload a resume first.",
        });
      }

      /*
      -------------------------------------------------------
      CHECK RAG DATA
      -------------------------------------------------------
      */

      if (
        !resume.chunks ||
        resume.chunks.length === 0
      ) {
        return res.status(400).json({
          message:
            "Resume RAG data is not available. Please upload your resume again.",
        });
      }

      /*
      -------------------------------------------------------
      RETRIEVE RELEVANT CHUNKS
      -------------------------------------------------------
      */

      const relevantChunks =
        await retrieveRelevantChunks(
          resume,
          query.trim(),
          topK
        );

      /*
      -------------------------------------------------------
      RETURN RESULTS
      -------------------------------------------------------
      */

      return res.status(200).json({
        success: true,

        message:
          "Relevant resume chunks retrieved successfully.",

        query,

        results:
          relevantChunks.map(
            (chunk) => ({
              text: chunk.text,

              chunkIndex:
                chunk.chunkIndex,

              similarity:
                Number(
                  chunk.similarity.toFixed(4)
                ),
            })
          ),
      });
    } catch (error) {
      console.error(
        "RAG retrieval error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          "Failed to retrieve relevant resume chunks.",
      });
    }
  }
);

export default router;