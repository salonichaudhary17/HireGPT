import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./RecruiterJobApplicants.css";

const STATUS_OPTIONS = [
  "applied",
  "shortlisted",
  "interview",
  "selected",
  "rejected",
];

function RecruiterJobApplicants() {
  const { jobId } = useParams();

  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const fetchApplicants = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/applications/job/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch applicants");
      }

      setJob(data.job);
      setApplications(data.applications || []);
    } catch (error) {
      console.error("Fetch applicants error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [jobId]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

  // Update a candidate's application status
  const handleStatusChange = async (applicationId, newStatus) => {
    setUpdatingId(applicationId);

    try {
      const response = await fetch(
        `http://localhost:8000/api/applications/${applicationId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to update status");
        return;
      }

      // Update local state so the UI reflects the change immediately
      setApplications((prev) =>
        prev.map((app) =>
          app._id === applicationId
            ? { ...app, status: newStatus }
            : app
        )
      );
    } catch (error) {
      console.error("Status update error:", error);
      alert("Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "shortlisted":
        return "status-shortlisted";
      case "interview":
        return "status-interview";
      case "selected":
        return "status-selected";
      case "rejected":
        return "status-rejected";
      default:
        return "status-applied";
    }
  };

  return (
    <div className="rjob-page">

      {/* ================= NAVBAR ================= */}
      <nav className="rjob-navbar">

        <Link to="/recruiter" className="rjob-logo">
          Hire<span>GPT</span>
        </Link>

        <div className="rjob-nav-links">
          <Link to="/recruiter">My Jobs</Link>

          <div className="user-profile">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span>{user?.name}</span>
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
      <main className="rjob-content">

        <Link to="/recruiter" className="rjob-back-link">
          ← Back to My Jobs
        </Link>

        {loading ? (
          <div className="rjob-loading">Loading applicants...</div>
        ) : (
          <>
            <section className="rjob-header">
              <p className="rjob-badge">APPLICANTS</p>
              <h1>{job?.title}</h1>
              <p className="rjob-subtitle">{job?.company}</p>
            </section>

            <section className="rjob-applicants-section">

              <div className="section-header">
                <div>
                  <h2>Candidates</h2>
                  <p>Review and update each candidate's status</p>
                </div>

                <span className="rjob-applicant-count">
                  {applications.length} applicants
                </span>
              </div>

              {applications.length === 0 ? (
                <div className="rjob-empty">
                  <h3>No applicants yet</h3>
                  <p>Candidates who apply will show up here.</p>
                </div>
              ) : (
                <div className="rjob-applicants-list">
                  {applications.map((application) => {
                    const candidate = application.candidate;

                    return (
                      <div
                        className="rjob-applicant-card"
                        key={application._id}
                      >
                        <div className="rjob-applicant-info">
                          <div className="user-avatar">
                            {candidate?.name?.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <h3>{candidate?.name}</h3>
                            <p className="rjob-applicant-email">
                              {candidate?.email}
                            </p>
                            <p className="rjob-applicant-date">
                              Applied{" "}
                              {new Date(
                                application.createdAt
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="rjob-applicant-status">
                          <span
                            className={`status-badge ${getStatusClass(
                              application.status
                            )}`}
                          >
                            {application.status}
                          </span>

                          <select
                            value={application.status}
                            disabled={updatingId === application._id}
                            onChange={(e) =>
                              handleStatusChange(
                                application._id,
                                e.target.value
                              )
                            }
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option.charAt(0).toUpperCase() +
                                  option.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </section>
          </>
        )}

      </main>

    </div>
  );
}

export default RecruiterJobApplicants;