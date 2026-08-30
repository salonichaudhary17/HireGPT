const API_URL = import.meta.env.VITE_API_URL;
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./MyApplications.css";

function MyApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "shortlisted" | "selected"

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  // Fetch candidate's applications
  const fetchApplications = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/applications/my-applications`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch applications"
        );
      }

      setApplications(data.applications || []);
    } catch (error) {
      console.error("Applications error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

  // Status styling
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

  // Status text
  const getStatusText = (status) => {
    switch (status) {
      case "shortlisted":
        return "Shortlisted";

      case "interview":
        return "Interview";

      case "selected":
        return "Selected";

      case "rejected":
        return "Rejected";

      default:
        return "Applied";
    }
  };

  const shortlistedCount = applications.filter(
    (app) => app.status === "shortlisted"
  ).length;

  const selectedCount = applications.filter(
    (app) => app.status === "selected"
  ).length;

  // Apply the active filter to the list shown below
  const filteredApplications =
    filter === "all"
      ? applications
      : applications.filter((app) => app.status === filter);

  // Toggle a filter on/off when a stat card is clicked
  const toggleFilter = (status) => {
    setFilter((prev) => (prev === status ? "all" : status));
  };

  return (
    <div className="applications-page">

      {/* ================= NAVBAR ================= */}

      <nav className="applications-navbar">

        <Link to="/dashboard" className="applications-logo">
          Hire<span>GPT</span>
        </Link>

        <div className="applications-nav-links">

          <Link to="/dashboard">
            Jobs
          </Link>

          <Link
            to="/applications"
            className="active"
          >
            Applications
          </Link>

          <div className="user-profile">

            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            <span>
              {user?.name}
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

      <main className="applications-content">

        {/* Header */}

        <section className="applications-header">

          <p className="applications-badge">
            CANDIDATE DASHBOARD
          </p>

          <h1>
            My Applications
          </h1>

          <p>
            Track the jobs you have applied for.
          </p>

        </section>

        {/* ================= STATS ================= */}

        <section className="application-stats">

          <div
            className={`application-stat-card clickable ${
              filter === "all" ? "stat-active" : ""
            }`}
            onClick={() => setFilter("all")}
          >

            <div className="application-stat-icon">
              📄
            </div>

            <div>
              <h3>
                {applications.length}
              </h3>

              <p>
                Total Applications
              </p>
            </div>

          </div>

          <div
            className={`application-stat-card clickable ${
              filter === "shortlisted" ? "stat-active" : ""
            }`}
            onClick={() => toggleFilter("shortlisted")}
          >

            <div className="application-stat-icon">
              ⭐
            </div>

            <div>
              <h3>
                {shortlistedCount}
              </h3>

              <p>
                Shortlisted
              </p>
            </div>

          </div>

          <div
            className={`application-stat-card clickable ${
              filter === "selected" ? "stat-active" : ""
            }`}
            onClick={() => toggleFilter("selected")}
          >

            <div className="application-stat-icon">
              🎯
            </div>

            <div>
              <h3>
                {selectedCount}
              </h3>

              <p>
                Selected
              </p>
            </div>

          </div>

        </section>

        {/* ================= APPLICATIONS ================= */}

        <section className="applications-section">

          <div className="section-header">

            <div>

              <h2>
                {filter === "all"
                  ? "Your Applications"
                  : `${getStatusText(filter)} Applications`}
              </h2>

              <p>
                Keep track of your application progress.
              </p>

            </div>

            <span className="application-count">
              {filteredApplications.length} applications
            </span>

          </div>

          {/* Loading */}

          {loading ? (

            <div className="applications-loading">
              Loading applications...
            </div>

          ) : filteredApplications.length === 0 ? (

            /* Empty */

            <div className="applications-empty">

              <div className="empty-icon">
                📄
              </div>

              <h3>
                {filter === "all"
                  ? "No applications yet"
                  : `No ${filter} applications`}
              </h3>

              <p>
                {filter === "all"
                  ? "You haven't applied for any jobs yet."
                  : `None of your applications are currently ${filter}.`}
              </p>

              {filter === "all" ? (
                <Link
                  to="/dashboard"
                  className="browse-jobs-button"
                >
                  Browse Jobs →
                </Link>
              ) : (
                <button
                  className="browse-jobs-button"
                  onClick={() => setFilter("all")}
                >
                  Show All Applications
                </button>
              )}

            </div>

          ) : (

            /* Application cards */

            <div className="applications-list">

              {filteredApplications.map((application) => {

                const job = application.job;

                return (

                  <div
                    className="application-card"
                    key={application._id}
                  >

                    {/* Job information */}

                    <div className="application-job">

                      <div className="company-logo">
                        {job?.company
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="application-job-info">

                        <h3>
                          {job?.title}
                        </h3>

                        <p className="application-company">
                          {job?.company}
                        </p>

                        <div className="application-details">

                          <span>
                            📍 {job?.location}
                          </span>

                          <span>
                            💰 {job?.salary}
                          </span>

                        </div>

                      </div>

                    </div>

                    {/* Status */}

                    <div className="application-status">

                      <span className="status-label">
                        Status
                      </span>

                      <span
                        className={`status-badge ${getStatusClass(
                          application.status
                        )}`}
                      >
                        {getStatusText(
                          application.status
                        )}
                      </span>

                    </div>

                    {/* Applied date */}

                    <div className="application-date">

                      <span className="date-label">
                        Applied
                      </span>

                      <span>
                        {new Date(
                          application.createdAt
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>

                    </div>

                  </div>

                );
              })}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default MyApplications;