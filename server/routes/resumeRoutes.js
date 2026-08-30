import express from "express";
import multer from "multer";
import fs from "fs";
import { PDFParse } from "pdf-parse";

import Resume from "../models/Resume.js";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createChunks,
  generateEmbeddings,
  retrieveRelevantChunks,
} from "../services/embeddingService.js";

const router = express.Router();

// =====================================================
// UPLOAD DIRECTORY
// =====================================================

const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// =====================================================
// MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      `${Date.now()}-${file.originalname}`;

    cb(null, uniqueName);
  },
});

// =====================================================
// PDF FILTER
// =====================================================

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(
      new Error("Only PDF files are allowed"),
      false
    );
  }
};

// =====================================================
// MULTER
// =====================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// =====================================================
// UPLOAD RESUME
// =====================================================

router.post(
  "/upload",
  authMiddleware,
  upload.single("resume"),

  async (req, res) => {
    try {
      // -------------------------------------------------
      // CHECK FILE
      // -------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          message: "Please upload a PDF resume",
        });
      }

      console.log("\n==============================");
      console.log("RESUME PROCESSING STARTED");
      console.log("==============================");

      // -------------------------------------------------
      // READ PDF
      // -------------------------------------------------

      const pdfBuffer = fs.readFileSync(
        req.file.path
      );

      const parser = new PDFParse({
        data: pdfBuffer,
      });

      const pdfData = await parser.getText();

      await parser.destroy();

      const extractedText =
        pdfData.text.trim();

      console.log(
        "Resume text extracted successfully"
      );

      console.log(
        "Characters:",
        extractedText.length
      );

      if (!extractedText) {
        throw new Error(
          "Could not extract text from this PDF"
        );
      }

      // -------------------------------------------------
      // CREATE CHUNKS
      // -------------------------------------------------

      const chunks =
        createChunks(extractedText);

      console.log(
        "Chunks created:",
        chunks.length
      );

      // -------------------------------------------------
      // GENERATE EMBEDDINGS
      // -------------------------------------------------

      const embeddings =
        await generateEmbeddings(chunks);

      console.log(
        "Embeddings generated:",
        embeddings.length
      );

      // -------------------------------------------------
      // PREPARE RAG CHUNKS
      // -------------------------------------------------

      const ragChunks = chunks.map(
        (text, index) => ({
          text,
          embedding: embeddings[index],
          chunkIndex: index,
        })
      );

      // -------------------------------------------------
      // FIND EXISTING RESUME
      // -------------------------------------------------

      const existingResume =
        await Resume.findOne({
          user: req.user.userId,
        });

      // -------------------------------------------------
      // DELETE OLD PDF
      // -------------------------------------------------

      if (
        existingResume &&
        existingResume.filePath
      ) {
        if (
          fs.existsSync(
            existingResume.filePath
          )
        ) {
          fs.unlinkSync(
            existingResume.filePath
          );
        }
      }

      // -------------------------------------------------
      // UPDATE EXISTING RESUME
      // -------------------------------------------------

      let resume;

      if (existingResume) {
        existingResume.fileName =
          req.file.originalname;

        existingResume.filePath =
          req.file.path;

        existingResume.extractedText =
          extractedText;

        existingResume.chunks =
          ragChunks;

        resume =
          await existingResume.save();
      }

      // -------------------------------------------------
      // CREATE NEW RESUME
      // -------------------------------------------------

      else {
        resume =
          await Resume.create({
            user: req.user.userId,

            fileName:
              req.file.originalname,

            filePath:
              req.file.path,

            extractedText:
              extractedText,

            chunks:
              ragChunks,
          });
      }

      // -------------------------------------------------
      // SUCCESS
      // -------------------------------------------------

      console.log(
        "Resume + RAG data saved successfully"
      );

      console.log(
        "Resume ID:",
        resume._id
      );

      console.log(
        "Stored chunks:",
        resume.chunks.length
      );

      console.log("\n==============================");
      console.log(
        "RESUME PROCESSING COMPLETED"
      );
      console.log("==============================\n");

      res.status(201).json({
        message:
          "Resume uploaded, parsed and embedded successfully",

        resume: {
          id: resume._id,

          fileName:
            resume.fileName,

          extractedTextLength:
            extractedText.length,

          chunks:
            resume.chunks.length,

          embeddings:
            resume.chunks.length,
        },
      });
    } catch (error) {
      console.error(
        "Resume upload error:",
        error
      );

      // -------------------------------------------------
      // DELETE UPLOADED FILE ON FAILURE
      // -------------------------------------------------

      if (
        req.file &&
        req.file.path
      ) {
        if (
          fs.existsSync(
            req.file.path
          )
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }
      }

      res.status(500).json({
        message:
          error.message ||
          "Failed to upload resume",
      });
    }
  }
);

// =====================================================
// RAG RETRIEVAL
// =====================================================

router.post(
  "/retrieve",
  authMiddleware,
  async (req, res) => {
    try {
      const { query, topK = 3 } = req.body;

      // -------------------------------------------------
      // VALIDATE QUERY
      // -------------------------------------------------

      if (!query || typeof query !== "string") {
        return res.status(400).json({
          message: "Query is required",
        });
      }

      // -------------------------------------------------
      // FIND USER'S RESUME
      // -------------------------------------------------

      const resume = await Resume.findOne({
        user: req.user.userId,
      });

      if (!resume) {
        return res.status(404).json({
          message: "Resume not found. Please upload a resume first.",
        });
      }

      // -------------------------------------------------
      // RETRIEVE RELEVANT CHUNKS
      // -------------------------------------------------

      const relevantChunks =
        await retrieveRelevantChunks(
          resume,
          query,
          topK
        );

      // -------------------------------------------------
      // RETURN RESULTS
      // -------------------------------------------------

      return res.status(200).json({
        message: "Relevant resume chunks retrieved successfully",

        query,

        results: relevantChunks.map((chunk) => ({
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          similarity: Number(
            chunk.similarity.toFixed(4)
          ),
        })),
      });

    } catch (error) {
      console.error(
        "RAG retrieval error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Failed to retrieve relevant resume chunks",
      });
    }
  }
);

export default router;