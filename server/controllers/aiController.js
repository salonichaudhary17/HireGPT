import Resume from "../models/Resume.js";
import {
  generateInterviewQuestions,
  evaluateInterview,
} from "../services/geminiService.js";

export const generateQuestions = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      user: req.user.userId,
    });

    if (!resume) {
      return res.status(404).json({
        message: "Resume not found",
      });
    }

    if (!resume.extractedText) {
      return res.status(400).json({
        message: "Resume text not available",
      });
    }

    const questions = await generateInterviewQuestions(
      resume.extractedText
    );

    res.status(200).json({
      message: "Interview questions generated successfully",
      questions,
    });
  } catch (error) {
    console.error("AI error:", error);

    res.status(500).json({
      message: error.message || "Failed to generate questions",
    });
  }
};

export const evaluateInterviewAnswers = async (req, res) => {
  try {
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        message: "Interview answers are required",
      });
    }

    if (answers.length !== 5) {
      return res.status(400).json({
        message: "Exactly 5 answers are required",
      });
    }

    const evaluation = await evaluateInterview(answers);

    res.status(200).json({
      message: "Interview evaluated successfully",
      evaluation,
    });
  } catch (error) {
    console.error("Interview evaluation error:", error);

    res.status(500).json({
      message:
        error.message || "Failed to evaluate interview",
    });
  }
};