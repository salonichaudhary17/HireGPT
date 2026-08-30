const fs = require("fs");
const path = require("path");
const Resume = require("../models/Resume");
const parseResume = require("../services/resumeParser");

const uploadResume = async (req, res) => {
  try {
    // Make sure a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a resume PDF",
      });
    }

    // Only allow PDF files
    if (req.file.mimetype !== "application/pdf") {
      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        message: "Only PDF resumes are allowed",
      });
    }

    // Extract text from the uploaded PDF
    const extractedText = await parseResume(req.file.path);

    if (!extractedText) {
      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        message: "Could not extract text from this resume",
      });
    }

    // Check if this candidate already has a resume
    const existingResume = await Resume.findOne({
      user: req.user.userId,
    });

    // If an old resume exists, delete its PDF
    if (existingResume) {
      if (
        existingResume.filePath &&
        fs.existsSync(existingResume.filePath)
      ) {
        fs.unlinkSync(existingResume.filePath);
      }

      existingResume.fileName = req.file.originalname;
      existingResume.filePath = req.file.path;
      existingResume.extractedText = extractedText;

      await existingResume.save();

      return res.status(200).json({
        message: "Resume updated successfully",
        resume: existingResume,
      });
    }

    // Create a new resume
    const resume = await Resume.create({
      user: req.user.userId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      extractedText,
    });

    res.status(201).json({
      message: "Resume uploaded successfully",
      resume,
    });
  } catch (error) {
    console.error("Resume upload error:", error);

    // Delete uploaded file if something fails
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: "Failed to upload resume",
    });
  }
};

module.exports = {
  uploadResume,
};