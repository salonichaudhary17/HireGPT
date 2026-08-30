import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import "./App.css";

import Dashboard from "./pages/Dashboard";
import Recruiter from "./pages/Recruiter";
import MyApplications from "./pages/MyApplications";
import RecruiterJobApplicants from "./pages/RecruiterJobApplicants";
import AllApplicants from "./pages/AllApplicants";
import Resume from "./pages/Resume";
import ProtectedRoute from "./components/ProtectedRoute";

function AuthPage() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "candidate",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const endpoint = isLogin
         ? "https://hiregpt-gb3b.onrender.com/api/auth/login"
        : "https://hiregpt-gb3b.onrender.com/api/auth/register";

      const body = isLogin
        ? {
            email: formData.email,
            password: formData.password,
          }
        : formData;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      console.log("Authentication successful:", data);

      if (isLogin) {
        setMessage(`Welcome back, ${data.user.name}!`);

        if (data.user.role === "candidate") {
          navigate("/dashboard");
        } else if (data.user.role === "recruiter") {
          navigate("/recruiter");
        }
      } else {
        setMessage("Registration successful! Please login.");

        setIsLogin(true);

        setFormData({
          name: "",
          email: formData.email,
          password: "",
          role: "candidate",
        });

        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">

      {/* Navbar */}
      <nav className="navbar">

        <div className="logo">
          Hire<span>GPT</span>
        </div>

        <div className="nav-text">
          AI-Powered Recruitment
        </div>

      </nav>

      {/* Main */}
      <main className="auth-container">

        {/* Left Section */}
        <div className="auth-left">

          <div className="hero-content">

            <p className="badge">
              AI-POWERED RECRUITMENT
            </p>

            <h1>
              Find the right
              <span> opportunity.</span>
            </h1>

            <p className="hero-description">
              HireGPT connects talented candidates with the right
              opportunities and helps recruiters find the best talent faster.
            </p>

            <div className="features">

              <div>
                <strong>01</strong>
                <p>Discover relevant jobs</p>
              </div>

              <div>
                <strong>02</strong>
                <p>Apply in seconds</p>
              </div>

              <div>
                <strong>03</strong>
                <p>Track your applications</p>
              </div>

            </div>

          </div>

        </div>

        {/* Login/Register Card */}
        <div className="auth-card">

          <div className="auth-header">

            <h2>
              {isLogin
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p>
              {isLogin
                ? "Login to continue to HireGPT"
                : "Join the future of recruitment"}
            </p>

          </div>

          <form onSubmit={handleSubmit}>

            {!isLogin && (
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>Account type</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="candidate">Candidate</option>
                  <option value="recruiter">Recruiter</option>
                </select>
              </div>
            )}

            <button
              className="auth-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login"
                : "Create Account"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <div className="switch-auth">
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </div>

        </div>

      </main>

    </div>
  );
}

// Main App
function App() {
  return (
    <Routes>

      {/* Login/Register */}
      <Route path="/" element={<AuthPage />} />

      {/* Candidate Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="candidate">
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Candidate Applications */}
      <Route
        path="/applications"
        element={
          <ProtectedRoute allowedRole="candidate">
            <MyApplications />
          </ProtectedRoute>
        }
      />
      {/* Candidate Resume */}
      <Route
      path="/resume"
      element={
      <ProtectedRoute allowedRole="candidate">
        <Resume />
      </ProtectedRoute>
      }
      />
      {/* Recruiter Dashboard */}
      <Route
        path="/recruiter"
        element={
          <ProtectedRoute allowedRole="recruiter">
            <Recruiter />
          </ProtectedRoute>
        }
      />

      {/* Recruiter: applicants for a specific job */}
      <Route
        path="/recruiter/jobs/:jobId"
        element={
          <ProtectedRoute allowedRole="recruiter">
            <RecruiterJobApplicants />
          </ProtectedRoute>
        }
      />

      {/* Recruiter: all applicants across all jobs */}
      <Route
        path="/recruiter/applicants"
        element={
          <ProtectedRoute allowedRole="recruiter">
            <AllApplicants />
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}

export default App;