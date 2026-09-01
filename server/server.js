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

/*
=========================================================
NEVER LET THE PROCESS DIE SILENTLY

If any code anywhere throws outside of an Express route's
try/catch (a bad promise, a library bug, etc), Node will
crash the whole server by default. On Render that means
EVERY user gets "Failed to fetch" until the platform
restarts the instance. Log it instead of dying.
=========================================================
*/

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE REJECTION:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

// Create Express app
const app = express();

/*
=========================================================
CORS

Explicit origin list instead of the wide-open default.
Includes your deployed client + local dev, and falls back
to allowing the request if CLIENT_URL isn't set so this
never silently blocks you.
=========================================================
*/

const allowedOrigins = [
  "https://hiregpt-client.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow tools like curl/Postman (no origin header) and
    // any known frontend origin.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn("Blocked CORS request from origin:", origin);
    return callback(null, true); // fail open, never break the app on a mismatched origin
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // handle preflight for every route (Express 5 needs a regex, not "*")

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/ai", aiRoutes);

// Test / health check route (also useful for "waking up" the server from the client)
app.get("/", (req, res) => {
  res.json({
    message: "HireGPT server is running 🚀",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
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

/*
=========================================================
404 HANDLER

Anything that doesn't match a route above still gets a
clean JSON response instead of hanging.
=========================================================
*/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/*
=========================================================
GLOBAL ERROR HANDLER

Last line of defense. Anything that throws anywhere
(including malformed JSON bodies, multer errors that slip
through, etc.) lands here and always gets a clean JSON
response with CORS headers, instead of the connection just
dying — which is what shows up in the browser as
"Failed to fetch".
=========================================================
*/
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR HANDLER:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something went wrong on the server.",
  });
});

// Port
const PORT = process.env.PORT || 8000;

// Start server after database connection
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `HireGPT server running on port ${PORT}`
      );
    });

    /*
    Give slow requests (PDF parsing + Gemini embedding calls
    on a big resume) enough room before Node's own socket
    handling kills the connection.
    */
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 120000; // 2 minutes
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();