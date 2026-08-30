import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

import authMiddleware from "./middleware/authMiddleware.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/ai", aiRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "HireGPT server is running 🚀",
  });
});

// Protected test route
app.get(
  "/api/auth/profile",
  authMiddleware,
  (req, res) => {
    res.json({
      message: "You accessed a protected route!",
      user: req.user,
    });
  }
);

// Port
const PORT = process.env.PORT || 8000;

// Start server after database connection
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `HireGPT server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();