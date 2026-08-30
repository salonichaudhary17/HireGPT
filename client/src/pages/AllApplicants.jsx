import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./AllApplicants.css";

const STATUS_OPTIONS = [
  "applied",
  "shortlisted",
  "interview",
  "selected",
  "rejected",
];

function AllApplicants() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("all");

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  // Fetch every job posted by this recruiter, then every application
  // for each of those jobs, and flatten it into one list.
  const fetchAllApplicants = async () => {
    try {
      const jobsResponse = await fetch(
        "http://localhost:8000/api/jobs/my-jobs",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const jobsData = await jobsResponse.json();

      if (!jobsResponse.ok) {
        throw new Error(jobsData.message || "Failed to fetch your jobs");
      }

      const myJobs = jobsData.jobs || [];

      const results = await Promise.all(
        myJobs.map(async (job) => {
          try {
            const res = await fetch(
              `http://localhost:8000/api/applications/job/${job._id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!res.ok) return [];

            const data = await res.json();
            return data.applications || [];
          } catch {
            return [];
          }
        })
      );

      const flattened = results.flat();

      flattened.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setApplications(flattened);
    } catch (error) {
      console.error("Fetch all applicants error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllApplicants();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

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

      setApplications((prev) =>
        prev.map((app) =>
          app._id === applicationId ? { ...app, status: newStatus } : app
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

  const filteredApplications =
    filter === "all"
      ? applications
      : applications.filter((app) => app.status === filter);

  return (
    <div className="allapp-page">

      {/* ================= NAVBAR ================= */}
      <nav className="allapp-navbar">

        <Link to="/recruiter" className="allapp-logo">
          Hire<span>GPT</span>
        </Link>

        <div className="allapp-nav-links">
          <Link to="/recruiter">My Jobs</Link>

          <div className="user-profile">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span>{user?.name}</span>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

      </nav>

      {/* ================= MAIN ================= */}
      <main className="allapp-content">

        <Link to="/recruiter" className="allapp-back-link">
          ← Back to My Jobs
        </Link>

        <section className="allapp-header">
          <p className="allapp-badge">ALL APPLICANTS</p>
          <h1>Every candidate, across all your jobs</h1>
          <p className="allapp-subtitle">
            {applications.length} total applicant
            {applications.length !== 1 ? "s" : ""}
          </p>
        </section>

        {/* Filter tabs */}
        <div className="allapp-filters">
          {["all", ...STATUS_OPTIONS].map((status) => (
            <button
              key={status}
              className={`filter-tab ${
                filter === status ? "filter-tab-active" : ""
              }`}
              onClick={() => setFilter(status)}
            >
              {status === "all"
                ? "All"
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="allapp-loading">Loading applicants...</div>
        ) : filteredApplications.length === 0 ? (
          <div className="allapp-empty">
            <h3>No applicants here</h3>
            <p>
              {filter === "all"
                ? "No one has applied to your jobs yet."
                : `No applicants with status "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="allapp-list">
            {filteredApplications.map((application) => {
              const candidate = application.candidate;
              const job = application.job;

              return (
                <div className="allapp-card" key={application._id}>

                  <div className="allapp-candidate">
                    <div className="user-avatar">
                      {candidate?.name?.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3>{candidate?.name}</h3>
                      <p className="allapp-email">{candidate?.email}</p>
                    </div>
                  </div>

                  <div className="allapp-job-info">
                    <span className="allapp-job-title">
                      {job?.title}
                    </span>
                    <span className="allapp-job-company">
                      {job?.company}
                    </span>
                  </div>

                  <div className="allapp-date">
                    {new Date(application.createdAt).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </div>

                  <div className="allapp-status">
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
                        handleStatusChange(application._id, e.target.value)
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

    </div>
  );
}

export default AllApplicants;