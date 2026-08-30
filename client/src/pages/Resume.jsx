import { useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import "./Resume.css";

function Resume() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState([]);

  const [interviewStarted, setInterviewStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);

  const [evaluation, setEvaluation] = useState(null);

  const user = JSON.parse(localStorage.getItem("user"));

  /* =========================
     LOGOUT
  ========================= */

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

  /* =========================
     FILE CHANGE
  ========================= */

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    setMessage("");
    setError("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("PDF must be smaller than 5 MB.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  /* =========================
     UPLOAD RESUME
  ========================= */

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a PDF resume first.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/resumes/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to upload resume"
        );
      }

      setMessage("Resume uploaded successfully!");
    } catch (error) {
      console.error("Resume upload error:", error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  /* =========================
     GENERATE QUESTIONS
  ========================= */

  const handleGenerateQuestions = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setGenerating(true);
    setMessage("");
    setError("");
    setQuestions([]);
    setEvaluation(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/resumes/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to generate questions"
        );
      }

      setQuestions(data.questions);

      setMessage(
        "Interview questions generated successfully!"
      );
    } catch (error) {
      console.error(
        "Question generation error:",
        error
      );

      setError(error.message);
    } finally {
      setGenerating(false);
    }
  };

  /* =========================
     START INTERVIEW
  ========================= */

  const handleStartInterview = () => {
    if (!questions.length) {
      setError("Please generate questions first.");
      return;
    }

    setInterviewStarted(true);
    setCurrentQuestion(0);
    setAnswer("");
    setAnswers([]);
    setEvaluation(null);
    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     NEXT QUESTION / EVALUATE
  ========================= */

  const handleNextQuestion = async () => {
    if (!answer.trim()) {
      setError("Please write an answer before continuing.");
      return;
    }

    const updatedAnswers = [
      ...answers,
      {
        question: questions[currentQuestion],
        answer: answer.trim(),
      },
    ];

    setAnswers(updatedAnswers);
    setError("");
    setAnswer("");

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setGenerating(true);
    setMessage("Gemini is evaluating your interview...");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/ai/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers: updatedAnswers,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to evaluate interview"
        );
      }

      setEvaluation(data.evaluation);
      setInterviewStarted(false);
      setMessage("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Evaluation error:", error);
      setError(error.message);
    } finally {
      setGenerating(false);
    }
  };

  /* =========================
     RETAKE
  ========================= */

  const handleRestartInterview = () => {
    setInterviewStarted(true);
    setCurrentQuestion(0);
    setAnswer("");
    setAnswers([]);
    setEvaluation(null);
    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     NEW INTERVIEW
  ========================= */

  const handleNewInterview = () => {
    setInterviewStarted(false);
    setCurrentQuestion(0);
    setAnswer("");
    setAnswers([]);
    setEvaluation(null);
    setQuestions([]);
    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     SCORE HELPERS
  ========================= */

  const getMiniScoreTone = (score) => {
    if (score >= 16) return "score-great";
    if (score >= 12) return "score-good";
    if (score >= 8) return "score-mid";

    return "score-low";
  };

  const getScoreVerdict = (score) => {
    if (score >= 80) {
      return {
        label: "Excellent",
        className: "excellent",
      };
    }

    if (score >= 60) {
      return {
        label: "Good",
        className: "good",
      };
    }

    if (score >= 40) {
      return {
        label: "Needs Improvement",
        className: "average",
      };
    }

    return {
      label: "Needs More Practice",
      className: "poor",
    };
  };
   /* =========================
   GENERATE PDF REPORT
========================= */

const handleDownloadReport = () => {
  if (!evaluation) {
    setError("Interview evaluation is not available.");
    return;
  }

  const doc = new jsPDF();

  const candidateName = user?.name || "Candidate";
  const currentDate = new Date().toLocaleDateString();

  const score = Number(evaluation.totalScore || 0);

  const verdict = getScoreVerdict(score);

  let y = 20;

  /* =========================
     TITLE
  ========================= */

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("HireGPT", 20, y);

  y += 10;

  doc.setFontSize(18);
  doc.text("AI Interview Report", 20, y);

  y += 12;

  /* =========================
     CANDIDATE INFORMATION
  ========================= */

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  doc.text(`Candidate: ${candidateName}`, 20, y);

  y += 7;

  doc.text(`Date: ${currentDate}`, 20, y);

  y += 15;

  /* =========================
     SCORE
  ========================= */

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");

  doc.text("Overall Performance", 20, y);

  y += 10;

  doc.setFontSize(28);
  doc.text(`${score}/100`, 20, y);

  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  doc.text(`Result: ${verdict.label}`, 20, y);

  y += 15;

  /* =========================
     OVERALL PERFORMANCE
  ========================= */

  if (evaluation.overallPerformance) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");

    doc.text("Summary", 20, y);

    y += 7;

    doc.setFont("helvetica", "normal");

    const summaryLines = doc.splitTextToSize(
      evaluation.overallPerformance,
      170
    );

    doc.text(summaryLines, 20, y);

    y += summaryLines.length * 6 + 10;
  }

  /* =========================
     STRENGTHS
  ========================= */

  if (evaluation.strengths?.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");

    doc.text("Strengths", 20, y);

    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    evaluation.strengths.forEach((strength) => {
      const lines = doc.splitTextToSize(
        `• ${strength}`,
        170
      );

      doc.text(lines, 20, y);

      y += lines.length * 6 + 2;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 5;
  }

  /* =========================
     AREAS TO IMPROVE
  ========================= */

  if (evaluation.areasToImprove?.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");

    doc.text("Areas to Improve", 20, y);

    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    evaluation.areasToImprove.forEach((area) => {
      const lines = doc.splitTextToSize(
        `• ${area}`,
        170
      );

      doc.text(lines, 20, y);

      y += lines.length * 6 + 2;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 5;
  }

  /* =========================
     AI FEEDBACK
  ========================= */

  if (evaluation.feedback) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");

    doc.text("Overall AI Feedback", 20, y);

    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const feedbackLines = doc.splitTextToSize(
      evaluation.feedback,
      170
    );

    doc.text(feedbackLines, 20, y);

    y += feedbackLines.length * 6 + 12;
  }

  /* =========================
     QUESTION-WISE RESULTS
  ========================= */

  if (evaluation.results?.length > 0) {
    doc.addPage();

    y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");

    doc.text("Question-wise Results", 20, y);

    y += 12;

    evaluation.results.forEach((result, index) => {

      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      /* QUESTION NUMBER */

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");

      doc.text(
        `Question ${index + 1} — ${result.score}/20`,
        20,
        y
      );

      y += 7;

      /* QUESTION */

      doc.setFont("helvetica", "normal");

      const questionLines = doc.splitTextToSize(
        result.question || "",
        170
      );

      doc.text(questionLines, 20, y);

      y += questionLines.length * 6 + 5;

      /* USER ANSWER */

      const userAnswer = answers[index]?.answer;

      if (userAnswer) {
        doc.setFont("helvetica", "bold");

        doc.text("Your Answer:", 20, y);

        y += 6;

        doc.setFont("helvetica", "normal");

        const answerLines = doc.splitTextToSize(
          userAnswer,
          170
        );

        doc.text(answerLines, 20, y);

        y += answerLines.length * 6 + 5;
      }

      /* AI FEEDBACK */

      if (result.feedback) {
        doc.setFont("helvetica", "bold");

        doc.text("AI Feedback:", 20, y);

        y += 6;

        doc.setFont("helvetica", "normal");

        const feedbackLines = doc.splitTextToSize(
          result.feedback,
          170
        );

        doc.text(feedbackLines, 20, y);

        y += feedbackLines.length * 6 + 10;
      }
    });
  }

  /* =========================
     FOOTER
  ========================= */

  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    doc.text(
      `HireGPT • AI Interview Report • Page ${page} of ${pageCount}`,
      20,
      290
    );
  }

  /* =========================
     DOWNLOAD
  ========================= */

  const fileName =
    `${candidateName.replace(/\s+/g, "_")}_AI_Interview_Report.pdf`;

  doc.save(fileName);
};

  /* =========================
     FEEDBACK PARSER
  ========================= */

  const splitQuestionFeedback = (feedback) => {
    if (!feedback) return null;

    const text = feedback.trim();

    const match = text.match(
      /what was good:\s*(.*?)\s*what could be improved:\s*(.*)/is
    );

    if (match) {
      return {
        good: match[1].trim(),
        improve: match[2].trim(),
      };
    }

    return {
      plain: text,
    };
  };

  const score = Number(evaluation?.totalScore || 0);

  const verdict = getScoreVerdict(score);

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="resume-page">

      {/* ================= NAVBAR ================= */}

      <nav className="resume-navbar">

        <Link
          to="/dashboard"
          className="resume-logo"
        >
          Hire<span>GPT</span>
        </Link>

        <div className="resume-nav-links">

          <Link to="/dashboard">
            Jobs
          </Link>

          <Link to="/applications">
            Applications
          </Link>

          <Link
            to="/resume"
            className="active"
          >
            AI Interview
          </Link>

          <div className="user-profile">

            <div className="user-avatar">
              {user?.name
                ?.charAt(0)
                .toUpperCase()}
            </div>

            <span>
              {user?.name || "User"}
            </span>

          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </nav>

      {/* ================= MAIN ================= */}

      <main className="resume-content">

        {/* =================================================
            UPLOAD PAGE
        ================================================= */}

        {!interviewStarted && !evaluation && (
          <>

            <section className="resume-header">

              <div className="resume-badge">
                AI INTERVIEW PREP
              </div>

              <h1>
                Upload your resume
              </h1>

              <p className="resume-subtitle">
                Upload your resume as a PDF, then
                generate personalized interview
                questions powered by Gemini.
              </p>

            </section>

            {/* UPLOAD CARD */}

            <form
              onSubmit={handleUpload}
              className="resume-card upload-card"
            >

              <label className="resume-label">
                Resume PDF
              </label>

              {/* CUSTOM FILE UPLOAD */}

              <label className="custom-file-upload">

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                />

                <div className="upload-icon">
                  ↑
                </div>

                <div className="upload-main-text">
                  {file
                    ? file.name
                    : "Choose your resume"}
                </div>

                <div className="upload-sub-text">
                  {file
                    ? "PDF selected successfully"
                    : "PDF format • Maximum 5 MB"}
                </div>

              </label>

              {/* SELECTED FILE */}

              {file && (
                <div className="selected-file">

                  <div className="selected-file-icon">
                    PDF
                  </div>

                  <div className="selected-file-info">
                    <strong>
                      {file.name}
                    </strong>

                    <span>
                      {(file.size / 1024 / 1024).toFixed(
                        2
                      )}{" "}
                      MB
                    </span>
                  </div>

                  <button
                    type="button"
                    className="remove-file"
                    onClick={() =>
                      setFile(null)
                    }
                  >
                    ×
                  </button>

                </div>
              )}

              {/* ALERTS */}

              {error && (
                <div className="resume-alert error">
                  <span>!</span>
                  {error}
                </div>
              )}

              {message && (
                <div className="resume-alert success">
                  <span>✓</span>
                  {message}
                </div>
              )}

              {/* UPLOAD */}

              <button
                type="submit"
                disabled={
                  uploading || !file
                }
                className="resume-btn primary"
              >
                {uploading
                  ? "Uploading..."
                  : "Upload Resume"}
              </button>

              {/* GENERATE */}

              <button
                type="button"
                onClick={
                  handleGenerateQuestions
                }
                disabled={generating}
                className="resume-btn outline"
              >
                {generating
                  ? "Generating Questions..."
                  : "Generate Interview Questions"}
              </button>

            </form>

            {/* =================================================
                GENERATED QUESTIONS
            ================================================= */}

            {questions.length > 0 && (
              <section className="resume-card questions-card">

                <div className="questions-card-header">

                  <div>
                    <span className="section-eyebrow">
                      GEMINI
                    </span>

                    <h2>
                      Your Interview Questions
                    </h2>

                    <p>
                      Personalized questions
                      generated from your resume.
                    </p>
                  </div>

                  <div className="question-count">
                    {questions.length}
                    <span>
                      Questions
                    </span>
                  </div>

                </div>

                <div className="questions-list">

                  {questions.map(
                    (question, index) => (
                      <div
                        className="question-preview"
                        key={index}
                      >

                        <div className="question-number">
                          {String(
                            index + 1
                          ).padStart(2, "0")}
                        </div>

                        <div>
                          <div className="question-preview-label">
                            QUESTION{" "}
                            {index + 1}
                          </div>

                          <div className="question-preview-text">
                            {question}
                          </div>
                        </div>

                      </div>
                    )
                  )}

                </div>

                <button
                  type="button"
                  onClick={
                    handleStartInterview
                  }
                  className="resume-btn primary large"
                >
                  Start Interview
                  <span>→</span>
                </button>

              </section>
            )}

          </>
        )}

        {/* =================================================
            LIVE INTERVIEW
        ================================================= */}

        {interviewStarted && (
          <section className="resume-card interview-card">

            <div className="interview-top-row">

              <div>
                <span className="section-eyebrow">
                  AI INTERVIEW
                </span>

                <h1>
                  Technical Interview
                </h1>
              </div>

              <div className="interview-progress-text">
                <strong>
                  {currentQuestion + 1}
                </strong>
                <span>
                  / {questions.length}
                </span>
              </div>

            </div>

            <div className="interview-progress-bar">

              <div
                className="interview-progress-fill"
                style={{
                  width: `${
                    ((currentQuestion + 1) /
                      questions.length) *
                    100
                  }%`,
                }}
              />

            </div>

            <div className="interview-question-block">

              <div className="interview-question-tag">
                QUESTION{" "}
                {String(
                  currentQuestion + 1
                ).padStart(2, "0")}
              </div>

              <h2 className="interview-question-text">
                {questions[currentQuestion]}
              </h2>

            </div>

            <div className="interview-answer-block">

              <div className="answer-header">

                <label className="resume-label">
                  Your Answer
                </label>

                <span>
                  {answer.length} characters
                </span>

              </div>

              <textarea
                value={answer}
                onChange={(e) =>
                  setAnswer(e.target.value)
                }
                placeholder="Type your answer here. Explain your approach clearly and include examples where relevant..."
                rows={9}
                className="interview-answer-box"
              />

            </div>

            {error && (
              <div className="resume-alert error">
                <span>!</span>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={
                handleNextQuestion
              }
              disabled={generating}
              className="resume-btn primary large"
            >
              {generating
                ? "Gemini is evaluating..."
                : currentQuestion ===
                  questions.length - 1
                ? "Finish Interview"
                : "Next Question →"}
            </button>

          </section>
        )}

        {/* =================================================
            RESULTS
        ================================================= */}

        {!interviewStarted && evaluation && (
          <section className="results-page">

            {/* RESULTS HEADER */}

            <div className="results-header">

              <span className="resume-badge">
                INTERVIEW COMPLETE
              </span>

              <h1>
                Interview Results
              </h1>

              <p>
                Here's how you performed in your
                AI-powered interview.
              </p>

            </div>

            {/* =================================================
                SCORE HERO
            ================================================= */}

            <div className="results-hero">

              <div className="score-circle">

                <svg
                  className="score-svg"
                  viewBox="0 0 120 120"
                >

                  <circle
                    className="score-bg"
                    cx="60"
                    cy="60"
                    r="52"
                  />

                  <circle
                    className={`score-progress ${verdict.className}`}
                    cx="60"
                    cy="60"
                    r="52"
                    strokeDasharray="326.7"
                    strokeDashoffset={
                      326.7 -
                      (score / 100) *
                        326.7
                    }
                  />

                </svg>

                <div className="score-inside">

                  <strong>
                    {score}
                  </strong>

                  <span>
                    /100
                  </span>

                </div>

              </div>

              <div className="results-hero-content">

                <span
                  className={`verdict-badge ${verdict.className}`}
                >
                  {verdict.label}
                </span>

                <h2>
                  {evaluation.overallPerformance ||
                    "Interview completed successfully."}
                </h2>

                <p>
                  Your score is based on the
                  quality, relevance and
                  completeness of your answers.
                </p>

              </div>

            </div>

            {/* =================================================
                QUICK STATS
            ================================================= */}

            <div className="results-stats">

              <div className="stat-card">

                <div className="stat-icon purple">
                  Q
                </div>

                <div>
                  <strong>
                    {evaluation.results?.length ||
                      questions.length}
                  </strong>

                  <span>
                    Questions
                  </span>
                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon green">
                  ✓
                </div>

                <div>
                  <strong>
                    {evaluation.strengths?.length ||
                      0}
                  </strong>

                  <span>
                    Strengths
                  </span>
                </div>

              </div>

              <div className="stat-card">

                <div className="stat-icon orange">
                  !
                </div>

                <div>
                  <strong>
                    {evaluation
                      .areasToImprove
                      ?.length || 0}
                  </strong>

                  <span>
                    Areas to Improve
                  </span>
                </div>

              </div>

            </div>

            {/* =================================================
                STRENGTHS + IMPROVEMENTS
            ================================================= */}

            <div className="results-two-column">

              {/* STRENGTHS */}

              {evaluation.strengths?.length >
                0 && (
                <div className="result-panel">

                  <div className="panel-heading">

                    <div className="panel-icon strengths-icon">
                      ✓
                    </div>

                    <div>
                      <h2>
                        Strengths
                      </h2>

                      <p>
                        What you did well
                      </p>
                    </div>

                  </div>

                  <div className="result-items">

                    {evaluation.strengths.map(
                      (strength, index) => (
                        <div
                          className="result-item strength-item"
                          key={index}
                        >

                          <span className="item-check">
                            ✓
                          </span>

                          <span>
                            {strength?.trim()}
                          </span>

                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

              {/* AREAS TO IMPROVE */}

              {evaluation.areasToImprove
                ?.length > 0 && (
                <div className="result-panel">

                  <div className="panel-heading">

                    <div className="panel-icon improve-icon">
                      ↑
                    </div>

                    <div>
                      <h2>
                        Areas to Improve
                      </h2>

                      <p>
                        Focus on these next
                      </p>
                    </div>

                  </div>

                  <div className="result-items">

                    {evaluation.areasToImprove.map(
                      (area, index) => (
                        <div
                          className="result-item improve-item"
                          key={index}
                        >

                          <span className="item-arrow">
                            →
                          </span>

                          <span>
                            {area?.trim()}
                          </span>

                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

            </div>

            {/* =================================================
                OVERALL FEEDBACK
            ================================================= */}

            {evaluation.feedback && (
              <div className="overall-feedback">

                <div className="feedback-heading">

                  <div className="feedback-icon">
                    ✦
                  </div>

                  <div>
                    <span>
                      AI FEEDBACK
                    </span>

                    <h2>
                      Overall Feedback
                    </h2>
                  </div>

                </div>

                <p>
                  {evaluation.feedback.trim()}
                </p>

              </div>
            )}

            {/* =================================================
                QUESTION-WISE RESULTS
            ================================================= */}

            {evaluation.results?.length >
              0 && (
              <div className="question-results-section">

                <div className="question-results-heading">

                  <div>
                    <span className="section-eyebrow">
                      DETAILED BREAKDOWN
                    </span>

                    <h2>
                      Question-wise Results
                    </h2>

                    <p>
                      Review your performance on
                      every interview question.
                    </p>
                  </div>

                </div>

                <div className="qwise-list">

                  {evaluation.results.map(
                    (result, index) => {

                      const feedbackParts =
                        splitQuestionFeedback(
                          result.feedback
                        );

                      return (
                        <div
                          className="qwise-card"
                          key={index}
                        >

                          {/* TOP */}

                          <div className="qwise-top-row">

                            <div className="qwise-number">
                              {String(
                                index + 1
                              ).padStart(2, "0")}
                            </div>

                            <div className="qwise-meta">

                              <span>
                                QUESTION{" "}
                                {index + 1}
                              </span>

                              <div
                                className={`qwise-score ${getMiniScoreTone(
                                  result.score
                                )}`}
                              >
                                {result.score}
                                <small>
                                  /20
                                </small>
                              </div>

                            </div>

                          </div>

                          {/* QUESTION */}

                          <div className="qwise-question">

                            <p>
                              {result.question?.trim()}
                            </p>

                          </div>

                          {/* SCORE BAR */}

                          <div className="mini-score-bar">

                            <div
                              className={`mini-score-fill ${getMiniScoreTone(
                                result.score
                              )}`}
                              style={{
                                width: `${
                                  (result.score /
                                    20) *
                                  100
                                }%`,
                              }}
                            />

                          </div>

                          {/* FEEDBACK */}

                          <div className="qwise-feedback">

                            {feedbackParts?.plain && (
                              <p>
                                {
                                  feedbackParts.plain
                                }
                              </p>
                            )}

                            {feedbackParts?.good && (
                              <div className="feedback-row">

                                <span className="feedback-label good">
                                  ✓ What went well
                                </span>

                                <p>
                                  {
                                    feedbackParts.good
                                  }
                                </p>

                              </div>
                            )}

                            {feedbackParts?.improve && (
                              <div className="feedback-row">

                                <span className="feedback-label improve">
                                  ↑ To improve
                                </span>

                                <p>
                                  {
                                    feedbackParts.improve
                                  }
                                </p>

                              </div>
                            )}

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>
            )}

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="results-actions">

               <button

    type="button"

    onClick={handleDownloadReport}

    className="resume-btn primary large"

  >

    Download PDF Report

    <span>↓</span>

  </button>

  <button

    type="button"

    onClick={handleRestartInterview}

    className="resume-btn outline large"

  >

    Retake Interview

    <span>↻</span>

  </button>

  <button

    type="button"

    onClick={handleNewInterview}

    className="resume-btn outline large"

  >

    Start New Interview

  </button>


            </div>

          </section>
        )}

      </main>

    </div>
  );
}

export default Resume;