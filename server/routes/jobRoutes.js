import express from "express";

import {
  getJobs,
  getMyJobs,
  createJob,
  getJobById,
  updateJob,
  deleteJob,
} from "../controllers/jobController.js";

import authMiddleware, {
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();


// =========================================================
// Get all jobs
// Candidate + Recruiter
// =========================================================

router.get(
  "/",
  authMiddleware,
  getJobs
);


// =========================================================
// Get jobs posted by logged-in recruiter
// Recruiter only
// =========================================================

router.get(
  "/my-jobs",
  authMiddleware,
  requireRole("recruiter"),
  getMyJobs
);


// =========================================================
// Get single job
// Candidate + Recruiter
// =========================================================

router.get(
  "/:id",
  authMiddleware,
  getJobById
);


// =========================================================
// Create a job
// Recruiter only
// =========================================================

router.post(
  "/",
  authMiddleware,
  requireRole("recruiter"),
  createJob
);


// =========================================================
// Update a job
// Recruiter only
// =========================================================

router.put(
  "/:id",
  authMiddleware,
  requireRole("recruiter"),
  updateJob
);


// =========================================================
// Delete a job
// Recruiter only
// =========================================================

router.delete(
  "/:id",
  authMiddleware,
  requireRole("recruiter"),
  deleteJob
);


export default router;