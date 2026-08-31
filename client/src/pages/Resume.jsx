import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import "./Resume.css";

function Resume() {
  /*
  =========================================================
  STATE
  =========================================================
  */

  const [navOpen, setNavOpen] = useState(false);

  const [file, setFile] = useState(null);

  /*
  The resume object represents the resume stored
  for the currently logged-in account.

  This is the SOURCE OF TRUTH.

  It is NOT dependent on the current browser session.
  */
  const [resume, setResume] = useState(null);

  const [uploading, setUploading] = useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [loadingResume, setLoadingResume] =
    useState(true);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [questions, setQuestions] =
    useState([]);

  const [interviewStarted, setInterviewStarted] =
    useState(false);

  const [currentQuestion, setCurrentQuestion] =
    useState(0);

  const [answer, setAnswer] =
    useState("");

  const [answers, setAnswers] =
    useState([]);

  const [evaluation, setEvaluation] =
    useState(null);

  /*
  =========================================================
  USER
  =========================================================
  */

  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem("user")
    );
  } catch {
    user = null;
  }

  /*
  =========================================================
  API URL
  =========================================================
  */

  const apiUrl =
    import.meta.env.VITE_API_URL;

  /*
  =========================================================
  LOAD EXISTING RESUME
  =========================================================

  This is extremely important.

  When the user logs into the same account on another
  device, React starts with empty state.

  Therefore we ask the backend whether this account
  already has a resume.
  */

  useEffect(() => {
    const loadExistingResume = async () => {
      const token =
        localStorage.getItem("token");

      if (!token) {
        setLoadingResume(false);
        return;
      }

      if (!apiUrl) {
        console.error(
          "VITE_API_URL is not configured."
        );

        setError(
          "API URL is not configured."
        );

        setLoadingResume(false);
        return;
      }

      try {
        console.log(
          "Loading existing resume..."
        );

        const response =
          await fetch(
            `${apiUrl}/api/resumes/me`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const rawText =
          await response.text();

        let data = {};

        try {
          data = rawText
            ? JSON.parse(rawText)
            : {};
        } catch {
          throw new Error(
            "The server returned an invalid response while loading your resume."
          );
        }

        console.log(
          "Existing resume response:",
          data
        );

        /*
        -------------------------------------------------------
        RESUME FOUND
        -------------------------------------------------------
        */

        if (
          response.ok &&
          data?.resume
        ) {
          setResume(
            data.resume
          );

          console.log(
            "Existing resume loaded:",
            data.resume
          );

          return;
        }

        /*
        -------------------------------------------------------
        NO RESUME
        -------------------------------------------------------
        */

        if (
          response.status === 404
        ) {
          setResume(null);
          return;
        }

        /*
        -------------------------------------------------------
        OTHER ERROR
        -------------------------------------------------------
        */

        if (!response.ok) {
          throw new Error(
            data.message ||
            `Failed to load resume (${response.status}).`
          );
        }

      } catch (error) {
        console.error(
          "Load existing resume error:",
          error
        );

        /*
        Do not show an error just because the user
        does not have a resume.

        Only show actual connection/server errors.
        */

        if (
          error?.message &&
          !error.message.includes(
            "Resume not found"
          )
        ) {
          setError(
            error.message
          );
        }

      } finally {
        setLoadingResume(false);
      }
    };

    loadExistingResume();
  }, [apiUrl]);

  /*
  =========================================================
  LOGOUT
  =========================================================
  */

  const handleLogout = () => {
    localStorage.removeItem("token");

    localStorage.removeItem("user");

    window.location.href = "/";
  };

  /*
  =========================================================
  FILE CHANGE
  =========================================================
  */

  const handleFileChange = (e) => {
    const selectedFile =
      e.target.files?.[0];

    setMessage("");

    setError("");

    /*
    IMPORTANT:

    DO NOT clear the existing resume here.

    If the user already has a resume and simply selects
    a new PDF, the old resume remains valid until the
    new upload succeeds.
    */

    setQuestions([]);

    setEvaluation(null);

    setInterviewStarted(false);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    /*
    -------------------------------------------------------
    CHECK PDF
    -------------------------------------------------------

    Mobile browsers/file providers can sometimes return
    an empty MIME type.

    Therefore check BOTH MIME type and extension.
    */

    const fileName =
      selectedFile.name?.toLowerCase() || "";

    const isPdf =
      selectedFile.type ===
        "application/pdf" ||
      fileName.endsWith(".pdf");

    if (!isPdf) {
      setError(
        "Please select a PDF resume."
      );

      setFile(null);

      return;
    }

    /*
    -------------------------------------------------------
    CHECK FILE SIZE
    -------------------------------------------------------
    */

    if (
      selectedFile.size >
      5 * 1024 * 1024
    ) {
      setError(
        "PDF must be smaller than 5 MB."
      );

      setFile(null);

      return;
    }

    /*
    -------------------------------------------------------
    STORE FILE
    -------------------------------------------------------
    */

    setFile(selectedFile);

    setMessage(
      "Resume selected. Click Upload Resume to continue."
    );
  };

  /*
  =========================================================
  REMOVE SELECTED FILE
  =========================================================
  */

  const handleRemoveFile = () => {
    setFile(null);

    setError("");

    setMessage("");

    /*
    Do NOT remove `resume`.

    The existing uploaded resume belongs to the account.
    */
  };

  /*
  =========================================================
  UPLOAD RESUME
  =========================================================
  */

  const handleUpload = async (e) => {
    e.preventDefault();

    /*
    -------------------------------------------------------
    CHECK FILE
    -------------------------------------------------------
    */

    if (!file) {
      setError(
        "Please select a PDF resume first."
      );

      return;
    }

    /*
    -------------------------------------------------------
    CHECK TOKEN
    -------------------------------------------------------
    */

    const token =
      localStorage.getItem("token");

    if (!token) {
      setError(
        "You are not logged in. Please login again."
      );

      return;
    }

    /*
    -------------------------------------------------------
    CHECK API
    -------------------------------------------------------
    */

    if (!apiUrl) {
      setError(
        "API URL is not configured."
      );

      return;
    }

    /*
    -------------------------------------------------------
    START UPLOAD
    -------------------------------------------------------
    */

    setUploading(true);

    setMessage("");

    setError("");

    /*
    Only clear generated questions.

    DO NOT clear the existing resume here.

    If the upload fails, the previous resume should still
    remain available.
    */

    setQuestions([]);

    setEvaluation(null);

    setInterviewStarted(false);

    try {
      const formData =
        new FormData();

      formData.append(
        "resume",
        file,
        file.name
      );

      console.log(
        "================================"
      );

      console.log(
        "RESUME UPLOAD STARTED"
      );

      console.log(
        "Upload URL:",
        `${apiUrl}/api/resumes/upload`
      );

      console.log(
        "File:",
        file.name
      );

      console.log(
        "File type:",
        file.type
      );

      console.log(
        "File size:",
        file.size
      );

      console.log(
        "================================"
      );

      /*
      -------------------------------------------------------
      UPLOAD
      -------------------------------------------------------
      */

      const response =
        await fetch(
          `${apiUrl}/api/resumes/upload`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body: formData,
          }
        );

      /*
      -------------------------------------------------------
      READ RESPONSE
      -------------------------------------------------------
      */

      const rawText =
        await response.text();

      let data = {};

      try {
        data = rawText
          ? JSON.parse(rawText)
          : {};
      } catch {
        throw new Error(
          "The server returned an invalid response. Please try again."
        );
      }

      console.log(
        "Upload response:",
        data
      );

      /*
      -------------------------------------------------------
      CHECK RESPONSE
      -------------------------------------------------------
      */

      if (!response.ok) {
        throw new Error(
          data.message ||
          `Upload failed (${response.status}).`
        );
      }

      /*
      -------------------------------------------------------
      CHECK RETURNED RESUME
      -------------------------------------------------------
      */

      if (!data?.resume?.id) {
        throw new Error(
          "Resume uploaded, but the server did not return a resume ID."
        );
      }

      /*
      -------------------------------------------------------
      STORE RESUME
      -------------------------------------------------------

      THIS IS THE IMPORTANT FIX.

      React now knows that the account has a resume.
      */

      setResume(
        data.resume
      );

      /*
      -------------------------------------------------------
      SUCCESS
      -------------------------------------------------------
      */

      setMessage(
        "Resume uploaded successfully! You can now generate interview questions."
      );

      setError("");

      console.log(
        "Resume stored in frontend state:",
        data.resume
      );

    } catch (error) {
      console.error(
        "================================"
      );

      console.error(
        "RESUME UPLOAD ERROR"
      );

      console.error(
        error
      );

      console.error(
        "================================"
      );

      /*
      IMPORTANT:

      We DO NOT set resume to null here.

      If an old resume existed and the replacement upload
      fails, the old resume is still valid.
      */

      setError(
        error?.message ||
        "Failed to upload resume. Please try again."
      );

    } finally {
      setUploading(false);
    }
  };

  /*
  =========================================================
  GENERATE QUESTIONS
  =========================================================
  */

  const handleGenerateQuestions =
    async () => {
      /*
      -------------------------------------------------------
      CHECK RESUME
      -------------------------------------------------------

      We only use this as a frontend convenience check.

      The backend independently finds the resume using
      the authenticated user's ID.
      */

      if (!resume) {
        setError(
          "Please upload your resume first."
        );

        setMessage("");

        return;
      }

      /*
      -------------------------------------------------------
      CHECK TOKEN
      -------------------------------------------------------
      */

      const token =
        localStorage.getItem("token");

      if (!token) {
        setError(
          "You are not logged in. Please login again."
        );

        return;
      }

      /*
      -------------------------------------------------------
      CHECK API
      -------------------------------------------------------
      */

      if (!apiUrl) {
        setError(
          "API URL is not configured."
        );

        return;
      }

      /*
      -------------------------------------------------------
      START
      -------------------------------------------------------
      */

      setGenerating(true);

      setMessage("");

      setError("");

      setQuestions([]);

      setEvaluation(null);

      try {
        console.log(
          "================================"
        );

        console.log(
          "GENERATING AI INTERVIEW QUESTIONS"
        );

        console.log(
          "Resume:",
          resume
        );

        console.log(
          "================================"
        );

        /*
        -------------------------------------------------------
        NO RESUME ID IS REQUIRED.

        Backend identifies the resume from the logged-in
        user's account.
        -------------------------------------------------------
        */

        const response =
          await fetch(
            `${apiUrl}/api/ai/generate-questions`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({}),
            }
          );

        /*
        -------------------------------------------------------
        READ RESPONSE
        -------------------------------------------------------
        */

        const rawText =
          await response.text();

        let data = {};

        try {
          data = rawText
            ? JSON.parse(rawText)
            : {};
        } catch {
          throw new Error(
            "The server returned an invalid response. Please try again."
          );
        }

        console.log(
          "Generate questions response:",
          data
        );

        /*
        -------------------------------------------------------
        CHECK RESPONSE
        -------------------------------------------------------
        */

        if (!response.ok) {
          throw new Error(
            data.message ||
            `Failed to generate questions (${response.status}).`
          );
        }

        /*
        -------------------------------------------------------
        VALIDATE QUESTIONS
        -------------------------------------------------------
        */

        if (
          !Array.isArray(
            data.questions
          ) ||
          data.questions.length === 0
        ) {
          throw new Error(
            "The AI did not return any interview questions."
          );
        }

        /*
        -------------------------------------------------------
        STORE QUESTIONS
        -------------------------------------------------------
        */

        setQuestions(
          data.questions
        );

        /*
        -------------------------------------------------------
        SUCCESS
        -------------------------------------------------------
        */

        setMessage(
          "Interview questions generated successfully!"
        );

      } catch (error) {
        console.error(
          "Question generation error:",
          error
        );

        setQuestions([]);

        setError(
          error?.message ||
          "Failed to generate interview questions."
        );

      } finally {
        setGenerating(false);
      }
    };

  /*
  =========================================================
  START INTERVIEW
  =========================================================
  */

  const handleStartInterview = () => {
    if (!questions.length) {
      setError(
        "Please generate questions first."
      );

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

  /*
  =========================================================
  NEXT QUESTION / EVALUATE
  =========================================================
  */

  const handleNextQuestion =
    async () => {
      if (!answer.trim()) {
        setError(
          "Please write an answer before continuing."
        );

        return;
      }

      const updatedAnswers = [
        ...answers,
        {
          question:
            questions[currentQuestion],

          answer:
            answer.trim(),
        },
      ];

      setAnswers(
        updatedAnswers
      );

      setError("");

      setAnswer("");

      /*
      -------------------------------------------------------
      MORE QUESTIONS
      -------------------------------------------------------
      */

      if (
        currentQuestion <
        questions.length - 1
      ) {
        setCurrentQuestion(
          currentQuestion + 1
        );

        return;
      }

      /*
      -------------------------------------------------------
      CHECK TOKEN
      -------------------------------------------------------
      */

      const token =
        localStorage.getItem("token");

      if (!token) {
        setError(
          "You are not logged in."
        );

        return;
      }

      /*
      -------------------------------------------------------
      CHECK API
      -------------------------------------------------------
      */

      if (!apiUrl) {
        setError(
          "API URL is not configured."
        );

        return;
      }

      /*
      -------------------------------------------------------
      EVALUATE
      -------------------------------------------------------
      */

      setGenerating(true);

      setMessage(
        "Gemini is evaluating your interview..."
      );

      setError("");

      try {
        const response =
          await fetch(
            `${apiUrl}/api/ai/evaluate`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                answers:
                  updatedAnswers,
              }),
            }
          );

        const rawText =
          await response.text();

        let data = {};

        try {
          data = rawText
            ? JSON.parse(rawText)
            : {};
        } catch {
          throw new Error(
            "The server returned an invalid evaluation response."
          );
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
            "Failed to evaluate interview."
          );
        }

        if (!data.evaluation) {
          throw new Error(
            "Interview evaluation was not returned."
          );
        }

        setEvaluation(
          data.evaluation
        );

        setInterviewStarted(false);

        setMessage("");

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });

      } catch (error) {
        console.error(
          "Evaluation error:",
          error
        );

        setError(
          error?.message ||
          "Failed to evaluate interview."
        );

      } finally {
        setGenerating(false);
      }
    };

  /*
  =========================================================
  RETAKE INTERVIEW
  =========================================================
  */

  const handleRestartInterview = () => {
    if (!questions.length) {
      setError(
        "No interview questions are available."
      );

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

  /*
  =========================================================
  NEW INTERVIEW
  =========================================================
  */

  const handleNewInterview = () => {
    setInterviewStarted(false);

    setCurrentQuestion(0);

    setAnswer("");

    setAnswers([]);

    setEvaluation(null);

    setQuestions([]);

    setMessage("");

    setError("");

    /*
    IMPORTANT:

    We keep the resume.

    The user can generate another interview from the
    same uploaded resume.
    */

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /*
  =========================================================
  SCORE HELPERS
  =========================================================
  */

  const getMiniScoreTone =
    (score) => {
      if (score >= 16) {
        return "score-great";
      }

      if (score >= 12) {
        return "score-good";
      }

      if (score >= 8) {
        return "score-mid";
      }

      return "score-low";
    };

  const getScoreVerdict =
    (score) => {
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

  /*
  =========================================================
  FEEDBACK PARSER
  =========================================================
  */

  const splitQuestionFeedback =
    (feedback) => {
      if (!feedback) {
        return null;
      }

      const text =
        feedback.trim();

      const match =
        text.match(
          /what was good:\s*(.*?)\s*what could be improved:\s*(.*)/is
        );

      if (match) {
        return {
          good:
            match[1].trim(),

          improve:
            match[2].trim(),
        };
      }

      return {
        plain: text,
      };
    };

  /*
  =========================================================
  DOWNLOAD PDF REPORT
  =========================================================
  */

  const handleDownloadReport =
    () => {
      if (!evaluation) {
        setError(
          "Interview evaluation is not available."
        );

        return;
      }

      const doc =
        new jsPDF();

      const candidateName =
        user?.name ||
        "Candidate";

      const currentDate =
        new Date().toLocaleDateString();

      const score =
        Number(
          evaluation.totalScore || 0
        );

      const verdict =
        getScoreVerdict(
          score
        );

      let y = 20;

      /*
      -------------------------------------------------------
      TITLE
      -------------------------------------------------------
      */

      doc.setFontSize(24);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "HireGPT",
        20,
        y
      );

      y += 10;

      doc.setFontSize(18);

      doc.text(
        "AI Interview Report",
        20,
        y
      );

      y += 12;

      /*
      -------------------------------------------------------
      CANDIDATE
      -------------------------------------------------------
      */

      doc.setFontSize(11);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `Candidate: ${candidateName}`,
        20,
        y
      );

      y += 7;

      doc.text(
        `Date: ${currentDate}`,
        20,
        y
      );

      y += 15;

      /*
      -------------------------------------------------------
      SCORE
      -------------------------------------------------------
      */

      doc.setFontSize(16);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "Overall Performance",
        20,
        y
      );

      y += 10;

      doc.setFontSize(28);

      doc.text(
        `${score}/100`,
        20,
        y
      );

      y += 10;

      doc.setFontSize(12);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `Result: ${verdict.label}`,
        20,
        y
      );

      y += 15;

      /*
      -------------------------------------------------------
      SUMMARY
      -------------------------------------------------------
      */

      if (
        evaluation.overallPerformance
      ) {
        doc.setFontSize(12);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "Summary",
          20,
          y
        );

        y += 7;

        doc.setFont(
          "helvetica",
          "normal"
        );

        const summaryLines =
          doc.splitTextToSize(
            evaluation.overallPerformance,
            170
          );

        doc.text(
          summaryLines,
          20,
          y
        );

        y +=
          summaryLines.length * 6 +
          10;
      }

      /*
      -------------------------------------------------------
      STRENGTHS
      -------------------------------------------------------
      */

      if (
        evaluation.strengths?.length >
        0
      ) {
        doc.setFontSize(14);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "Strengths",
          20,
          y
        );

        y += 8;

        doc.setFontSize(11);

        doc.setFont(
          "helvetica",
          "normal"
        );

        evaluation.strengths.forEach(
          (strength) => {
            const lines =
              doc.splitTextToSize(
                `• ${strength}`,
                170
              );

            if (
              y +
                lines.length * 6 >
              270
            ) {
              doc.addPage();

              y = 20;
            }

            doc.text(
              lines,
              20,
              y
            );

            y +=
              lines.length * 6 +
              2;
          }
        );

        y += 5;
      }

      /*
      -------------------------------------------------------
      AREAS TO IMPROVE
      -------------------------------------------------------
      */

      if (
        evaluation.areasToImprove
          ?.length > 0
      ) {
        if (y > 250) {
          doc.addPage();

          y = 20;
        }

        doc.setFontSize(14);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "Areas to Improve",
          20,
          y
        );

        y += 8;

        doc.setFontSize(11);

        doc.setFont(
          "helvetica",
          "normal"
        );

        evaluation.areasToImprove.forEach(
          (area) => {
            const lines =
              doc.splitTextToSize(
                `• ${area}`,
                170
              );

            if (
              y +
                lines.length * 6 >
              270
            ) {
              doc.addPage();

              y = 20;
            }

            doc.text(
              lines,
              20,
              y
            );

            y +=
              lines.length * 6 +
              2;
          }
        );

        y += 5;
      }

      /*
      -------------------------------------------------------
      OVERALL FEEDBACK
      -------------------------------------------------------
      */

      if (
        evaluation.feedback
      ) {
        if (y > 245) {
          doc.addPage();

          y = 20;
        }

        doc.setFontSize(14);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "Overall AI Feedback",
          20,
          y
        );

        y += 8;

        doc.setFontSize(11);

        doc.setFont(
          "helvetica",
          "normal"
        );

        const feedbackLines =
          doc.splitTextToSize(
            evaluation.feedback,
            170
          );

        doc.text(
          feedbackLines,
          20,
          y
        );

        y +=
          feedbackLines.length * 6 +
          12;
      }

      /*
      -------------------------------------------------------
      QUESTION RESULTS
      -------------------------------------------------------
      */

      if (
        evaluation.results?.length >
        0
      ) {
        doc.addPage();

        y = 20;

        doc.setFontSize(18);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "Question-wise Results",
          20,
          y
        );

        y += 12;

        evaluation.results.forEach(
          (result, index) => {
            if (y > 250) {
              doc.addPage();

              y = 20;
            }

            doc.setFontSize(12);

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.text(
              `Question ${index + 1} — ${result.score}/20`,
              20,
              y
            );

            y += 7;

            doc.setFont(
              "helvetica",
              "normal"
            );

            const questionLines =
              doc.splitTextToSize(
                result.question ||
                  "",
                170
              );

            doc.text(
              questionLines,
              20,
              y
            );

            y +=
              questionLines.length *
                6 +
              5;

            const userAnswer =
              answers[index]
                ?.answer;

            if (userAnswer) {
              doc.setFont(
                "helvetica",
                "bold"
              );

              doc.text(
                "Your Answer:",
                20,
                y
              );

              y += 6;

              doc.setFont(
                "helvetica",
                "normal"
              );

              const answerLines =
                doc.splitTextToSize(
                  userAnswer,
                  170
                );

              doc.text(
                answerLines,
                20,
                y
              );

              y +=
                answerLines.length *
                  6 +
                5;
            }

            if (result.feedback) {
              doc.setFont(
                "helvetica",
                "bold"
              );

              doc.text(
                "AI Feedback:",
                20,
                y
              );

              y += 6;

              doc.setFont(
                "helvetica",
                "normal"
              );

              const feedbackLines =
                doc.splitTextToSize(
                  result.feedback,
                  170
                );

              doc.text(
                feedbackLines,
                20,
                y
              );

              y +=
                feedbackLines.length *
                  6 +
                10;
            }
          }
        );
      }

      /*
      -------------------------------------------------------
      FOOTER
      -------------------------------------------------------
      */

      const pageCount =
        doc.getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {
        doc.setPage(page);

        doc.setFontSize(9);

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.text(
          `HireGPT • AI Interview Report • Page ${page} of ${pageCount}`,
          20,
          290
        );
      }

      /*
      -------------------------------------------------------
      SAVE
      -------------------------------------------------------
      */

      const fileName =
        `${candidateName.replace(
          /\s+/g,
          "_"
        )}_AI_Interview_Report.pdf`;

      doc.save(fileName);
    };

  /*
  =========================================================
  SCORE
  =========================================================
  */

  const score =
    Number(
      evaluation?.totalScore || 0
    );

  const verdict =
    getScoreVerdict(score);

  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <div className="resume-page">

      {/* =================================================
          NAVBAR
      ================================================= */}

      <nav className="resume-navbar">

        <Link
          to="/dashboard"
          className="resume-logo"
        >
          Hire<span>GPT</span>
        </Link>

        <button
          className={`mobile-menu-btn ${
            navOpen ? "open" : ""
          }`}
          onClick={() =>
            setNavOpen(!navOpen)
          }
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div
          className={`resume-nav-links ${
            navOpen
              ? "nav-open"
              : ""
          }`}
        >

          <Link
            to="/dashboard"
            onClick={() =>
              setNavOpen(false)
            }
          >
            Jobs
          </Link>

          <Link
            to="/applications"
            onClick={() =>
              setNavOpen(false)
            }
          >
            Applications
          </Link>

          <Link
            to="/resume"
            className="active"
            onClick={() =>
              setNavOpen(false)
            }
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
              {user?.name ||
                "User"}
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

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="resume-content">

        {/* =================================================
            UPLOAD / QUESTIONS PAGE
        ================================================= */}

        {!interviewStarted &&
          !evaluation && (
            <>

              <section className="resume-header">

                <div className="resume-badge">
                  AI INTERVIEW PREP
                </div>

                <h1>
                  Upload your resume
                </h1>

                <p className="resume-subtitle">
                  Upload your resume as a
                  PDF, then generate
                  personalized interview
                  questions powered by
                  Gemini.
                </p>

              </section>

              {/* =================================================
                  UPLOAD CARD
              ================================================= */}

              <form
                onSubmit={
                  handleUpload
                }
                className="resume-card upload-card"
              >

                <label className="resume-label">
                  Resume PDF
                </label>

                {/* =================================================
                    FILE PICKER
                ================================================= */}

                <label className="custom-file-upload">

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={
                      handleFileChange
                    }
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

                {/* =================================================
                    EXISTING RESUME STATUS
                ================================================= */}

                {loadingResume && (
                  <div className="resume-alert success">
                    <span>✓</span>
                    Checking your existing resume...
                  </div>
                )}

                {!loadingResume &&
                  resume &&
                  !file && (
                    <div className="resume-alert success">
                      <span>✓</span>
                      Resume already uploaded:
                      {" "}
                      {resume.fileName}
                    </div>
                  )}

                {/* =================================================
                    SELECTED FILE
                ================================================= */}

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
                        {(
                          file.size /
                          1024 /
                          1024
                        ).toFixed(2)}
                        {" "}
                        MB
                      </span>

                    </div>

                    <button
                      type="button"
                      className="remove-file"
                      onClick={
                        handleRemoveFile
                      }
                    >
                      ×
                    </button>

                  </div>
                )}

                {/* =================================================
                    ERRORS
                ================================================= */}

                {error && (
                  <div className="resume-alert error">
                    <span>!</span>
                    {error}
                  </div>
                )}

                {/* =================================================
                    SUCCESS MESSAGE
                ================================================= */}

                {message && (
                  <div className="resume-alert success">
                    <span>✓</span>
                    {message}
                  </div>
                )}

                {/* =================================================
                    UPLOAD BUTTON
                ================================================= */}

                <button
                  type="submit"
                  disabled={
                    uploading ||
                    generating ||
                    !file
                  }
                  className="resume-btn primary"
                >
                  {uploading
                    ? "Uploading..."
                    : "Upload Resume"}
                </button>

                {/* =================================================
                    GENERATE BUTTON
                ================================================= */}

                <button
                  type="button"
                  onClick={
                    handleGenerateQuestions
                  }
                  disabled={
                    generating ||
                    uploading ||
                    loadingResume ||
                    !resume
                  }
                  className="resume-btn outline"
                >
                  {generating
                    ? "Generating Questions..."
                    : loadingResume
                    ? "Checking Resume..."
                    : !resume
                    ? "Upload Resume First"
                    : "Generate Interview Questions"}
                </button>

              </form>

              {/* =================================================
                  GENERATED QUESTIONS
              ================================================= */}

              {questions.length >
                0 && (
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
                        generated from your
                        resume.
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
                      (
                        question,
                        index
                      ) => (
                        <div
                          className="question-preview"
                          key={index}
                        >

                          <div className="question-number">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
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
                    (
                      (currentQuestion + 1) /
                      questions.length
                    ) * 100
                  }%`,
                }}
              />

            </div>

            <div className="interview-question-block">

              <div className="interview-question-tag">
                QUESTION{" "}
                {String(
                  currentQuestion + 1
                ).padStart(
                  2,
                  "0"
                )}
              </div>

              <h2 className="interview-question-text">
                {
                  questions[
                    currentQuestion
                  ]
                }
              </h2>

            </div>

            <div className="interview-answer-block">

              <div className="answer-header">

                <label className="resume-label">
                  Your Answer
                </label>

                <span>
                  {answer.length}
                  {" "}
                  characters
                </span>

              </div>

              <textarea
                value={answer}
                onChange={(e) =>
                  setAnswer(
                    e.target.value
                  )
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
              disabled={
                generating
              }
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

        {!interviewStarted &&
          evaluation && (
            <section className="results-page">

              {/* HEADER */}

              <div className="results-header">

                <span className="resume-badge">
                  INTERVIEW COMPLETE
                </span>

                <h1>
                  Interview Results
                </h1>

                <p>
                  Here's how you performed
                  in your AI-powered
                  interview.
                </p>

              </div>

              {/* SCORE */}

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
                    Your score is based on
                    the quality, relevance
                    and completeness of
                    your answers.
                  </p>

                </div>

              </div>

              {/* QUICK STATS */}

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
                      {evaluation.areasToImprove?.length ||
                        0}
                    </strong>

                    <span>
                      Areas to Improve
                    </span>

                  </div>

                </div>

              </div>

              {/* STRENGTHS / IMPROVEMENTS */}

              <div className="results-two-column">

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
                        (
                          strength,
                          index
                        ) => (
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

                {evaluation.areasToImprove?.length >
                  0 && (
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
                        (
                          area,
                          index
                        ) => (
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

              {/* OVERALL FEEDBACK */}

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

              {/* QUESTION RESULTS */}

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
                        Review your performance
                        on every interview
                        question.
                      </p>

                    </div>

                  </div>

                  <div className="qwise-list">

                    {evaluation.results.map(
                      (
                        result,
                        index
                      ) => {

                        const feedbackParts =
                          splitQuestionFeedback(
                            result.feedback
                          );

                        return (
                          <div
                            className="qwise-card"
                            key={index}
                          >

                            <div className="qwise-top-row">

                              <div className="qwise-number">
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
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

                            <div className="qwise-question">

                              <p>
                                {result.question?.trim()}
                              </p>

                            </div>

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

              {/* ACTIONS */}

              <div className="results-actions">

                <button
                  type="button"
                  onClick={
                    handleDownloadReport
                  }
                  className="resume-btn primary large"
                >
                  Download PDF Report
                  <span>↓</span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleRestartInterview
                  }
                  className="resume-btn outline large"
                >
                  Retake Interview
                  <span>↻</span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleNewInterview
                  }
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