import express from "express";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  sendNewApplicationEmail,
  sendStatusUpdateEmail,
} from "../services/emailService.js";

const router = express.Router();

// Candidate applies for a job
router.post("/", authMiddleware, async (req, res) => {
  try {
    // Only candidates can apply
    if (req.user.role !== "candidate") {
      return res.status(403).json({
        message: "Only candidates can apply for jobs",
      });
    }

    const { jobId } = req.body;

    // Check if jobId was provided
    if (!jobId) {
      return res.status(400).json({
        message: "Job ID is required",
      });
    }

    // Check whether the job exists (populate postedBy for the email)
    const job = await Job.findById(jobId).populate(
      "postedBy",
      "name email"
    );

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    // Check if candidate already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      candidate: req.user.userId,
    });

    if (existingApplication) {
      return res.status(409).json({
        message: "You have already applied for this job",
      });
    }

    // Create application
    const application = await Application.create({
      job: jobId,
      candidate: req.user.userId,
    });

    res.status(201).json({
      message: "Application submitted successfully",
      application,
    });

    // Notify the recruiter by email (fire-and-forget, never blocks the response)
    if (job.postedBy?.email) {
      const candidate = await User.findById(req.user.userId).select("name");

      sendNewApplicationEmail({
        recruiterEmail: job.postedBy.email,
        recruiterName: job.postedBy.name,
        candidateName: candidate?.name || "A candidate",
        jobTitle: job.title,
        company: job.company,
      });
    }

  } catch (error) {
    console.error("Application error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// Recruiter views applicants for their job
router.get("/job/:jobId", authMiddleware, async (req, res) => {
  try {
    // Only recruiters can view applicants
    if (req.user.role !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiters can view applicants",
      });
    }

    const { jobId } = req.params;

    // Check if job exists
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    // Make sure this recruiter owns the job
    if (job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not authorized to view these applicants",
      });
    }

    // Find applications for this job
    const applications = await Application.find({
      job: jobId,
    })
      .populate("candidate", "name email role")
      .populate("job", "title company")
      .sort({ createdAt: -1 });

    res.status(200).json({
      job: {
        id: job._id,
        title: job.title,
        company: job.company,
      },
      applications,
    });

  } catch (error) {
    console.error("Fetch applicants error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// Candidate views their own applications
router.get("/my-applications", authMiddleware, async (req, res) => {
  try {
    // Only candidates can view their applications
    if (req.user.role !== "candidate") {
      return res.status(403).json({
        message: "Only candidates can view their applications",
      });
    }

    // Find applications submitted by this candidate
    const applications = await Application.find({
      candidate: req.user.userId,
    })
      .populate("job", "title company description location salary skills")
      .sort({ createdAt: -1 });

    res.status(200).json({
      applications,
    });

  } catch (error) {
    console.error("Fetch my applications error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// Recruiter updates application status
router.patch("/:applicationId/status", authMiddleware, async (req, res) => {
  try {
    // Only recruiters can update application status
    if (req.user.role !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiters can update application status",
      });
    }

    const { applicationId } = req.params;
    const { status } = req.body;

    // Allowed statuses
    const allowedStatuses = [
      "applied",
      "shortlisted",
      "interview",
      "selected",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid application status",
      });
    }

    // Find application (populate job + candidate for the email)
    const application = await Application.findById(applicationId)
      .populate("job")
      .populate("candidate", "name email");

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    // Make sure recruiter owns the job
    if (application.job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not authorized to update this application",
      });
    }

    // Update status
    application.status = status;

    await application.save();

    res.status(200).json({
      message: "Application status updated successfully",
      application,
    });

    // Notify the candidate by email (fire-and-forget, never blocks the response)
    if (application.candidate?.email) {
      sendStatusUpdateEmail({
        candidateEmail: application.candidate.email,
        candidateName: application.candidate.name,
        jobTitle: application.job.title,
        company: application.job.company,
        status,
      });
    }

  } catch (error) {
    console.error("Update application status error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

export default router;