// Import JWT library
import jwt from "jsonwebtoken";

// =========================================================
// Authentication Middleware
// =========================================================

const authMiddleware = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Expected format:
    // Authorization: Bearer TOKEN
    const token = authHeader.split(" ")[1];

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        message: "Invalid authorization format",
      });
    }

    // Verify token using our secret
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Store decoded user information in request
    req.user = decoded;

    // Continue to the actual route
    next();

  } catch (error) {
    console.log("JWT ERROR:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};


// =========================================================
// Role-Based Access Control Middleware
// =========================================================

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {

    // Authentication must happen first
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Check user's role
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    // User has the required role
    next();
  };
};


// =========================================================
// Exports
// =========================================================

export {
  requireRole,
};

export default authMiddleware;