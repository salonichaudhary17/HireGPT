const API_URL = import.meta.env.VITE_API_URL;
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Recruiter.css";

function Recruiter() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalApplicants, setTotalApplicants] = useState(0);

  const [analytics, setAnalytics] = useState({
  applied: 0,
  shortlisted: 0,
  interview: 0,
  selected: 0,
  rejected: 0,
  jobStats: [],
});

  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState("");

  const [deletingId, setDeletingId] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    company: "",
    description: "",
    location: "",
    salary: "",
    skills: "",
  });

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  // Fetch jobs posted by this recruiter
  const fetchMyJobs = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/jobs/my-jobs`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch your jobs");
      }

      const myJobs = data.jobs || [];
      setJobs(myJobs);

      // Fetch applications and build analytics
const applicationData = await Promise.all(
  myJobs.map(async (job) => {
    try {
      const res = await fetch(
        `${API_URL}/api/applications/job/${job._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        return {
          job,
          applications: [],
        };
      }

      const jobData = await res.json();

      return {
        job,
        applications: jobData.applications || [],
      };
    } catch {
      return {
        job,
        applications: [],
      };
    }
  })
);

// Count applicants
const total = applicationData.reduce(
  (sum, item) => sum + item.applications.length,
  0
);

setTotalApplicants(total);

// Count application statuses
const statusCounts = {
  applied: 0,
  shortlisted: 0,
  interview: 0,
  selected: 0,
  rejected: 0,
};

applicationData.forEach((item) => {
  item.applications.forEach((application) => {
    const status = application.status;

    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
  });
});

// Applicant count for each job
const jobStats = applicationData.map((item) => ({
  title: item.job.title,
  applicants: item.applications.length,
}));

setAnalytics({
  ...statusCounts,
  jobStats,
});
      

      
    } catch (error) {
      console.error("Recruiter jobs error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyJobs();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Open modal in "create" mode
  const openCreateForm = () => {
    setEditingJobId(null);
    setFormError("");
    setFormData({
      title: "",
      company: "",
      description: "",
      location: "",
      salary: "",
      skills: "",
    });
    setShowForm(true);
  };

  // Open modal in "edit" mode, pre-filled with the job's data
  const openEditForm = (e, job) => {
    e.preventDefault();
    e.stopPropagation();

    setEditingJobId(job._id);
    setFormError("");
    setFormData({
      title: job.title || "",
      company: job.company || "",
      description: job.description || "",
      location: job.location || "",
      salary: job.salary || "",
      skills: (job.skills || []).join(", "),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingJobId(null);
    setFormError("");
  };

  // Create or update a job depending on editingJobId
  const handleSubmitJob = async (e) => {
    e.preventDefault();

    setFormError("");
    setPosting(true);

    try {
      const skillsArray = formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const isEditing = Boolean(editingJobId);

      const url = isEditing
  ? `${API_URL}/api/jobs/${editingJobId}`
  : `${API_URL}/api/jobs`;

      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          company: formData.company,
          description: formData.description,
          location: formData.location,
          salary: formData.salary,
          skills: skillsArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to ${isEditing ? "update" : "post"} job`
        );
      }

      closeForm();
      fetchMyJobs();
    } catch (error) {
      console.error("Save job error:", error);
      setFormError(error.message);
    } finally {
      setPosting(false);
    }
  };

  // Delete a job
  const handleDeleteJob = async (e, jobId) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      "Delete this job? This cannot be undone."
    );

    if (!confirmed) return;

    setDeletingId(jobId);

    try {
      const response = await fetch(
        `${API_URL}/api/jobs/${jobId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete job");
      }

      fetchMyJobs();
    } catch (error) {
      console.error("Delete job error:", error);
      alert(error.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="recruiter-page">

      {/* ================= NAVBAR ================= */}
      <nav className="recruiter-navbar">

        <Link to="/recruiter" className="recruiter-logo">
          Hire<span>GPT</span>
        </Link>

        <div className="recruiter-nav-links">

          <Link to="/recruiter" className="active">
            My Jobs
          </Link>

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
      <main className="recruiter-content">

        <section className="recruiter-header">
          <p className="recruiter-badge">
            RECRUITER DASHBOARD
          </p>

          <h1>
            Welcome, <span>{user?.name}</span> 👋
          </h1>

          <p className="recruiter-subtitle">
            Manage your job postings and review candidates.
          </p>
        </section>

        {/* ================= STATS ================= */}
        <section className="recruiter-stats">

          <div className="recruiter-stat-card">
            <div className="recruiter-stat-icon">💼</div>
            <div>
              <h3>{jobs.length}</h3>
              <p>Jobs Posted</p>
            </div>
          </div>

          <Link
            to="/recruiter/applicants"
            className="recruiter-stat-card clickable"
          >
            <div className="recruiter-stat-icon">👥</div>
            <div>
              <h3>{totalApplicants}</h3>
              <p>Total Applicants</p>
            </div>
          </Link>

        </section>

        {/* ================= ANALYTICS ================= */}
<section className="analytics-section">

  <div className="analytics-header">
    <div>
      <h2>Application Analytics</h2>
      <p>Track your candidate pipeline and hiring activity.</p>
    </div>
  </div>

  {/* Status cards */}
  <div className="analytics-status-grid">

    <div className="analytics-status-card">
      <span className="analytics-status-icon">📨</span>
      <div>
        <strong>{analytics.applied}</strong>
        <span>Applied</span>
      </div>
    </div>

    <div className="analytics-status-card">
      <span className="analytics-status-icon">⭐</span>
      <div>
        <strong>{analytics.shortlisted}</strong>
        <span>Shortlisted</span>
      </div>
    </div>

    <div className="analytics-status-card">
      <span className="analytics-status-icon">🎤</span>
      <div>
        <strong>{analytics.interview}</strong>
        <span>Interview</span>
      </div>
    </div>

    <div className="analytics-status-card">
      <span className="analytics-status-icon">✅</span>
      <div>
        <strong>{analytics.selected}</strong>
        <span>Selected</span>
      </div>
    </div>

    <div className="analytics-status-card">
      <span className="analytics-status-icon">❌</span>
      <div>
        <strong>{analytics.rejected}</strong>
        <span>Rejected</span>
      </div>
    </div>

  </div>

  {/* Charts */}
  <div className="analytics-charts">

    {/* Applicants per job */}
    <div className="analytics-card">

      <div className="analytics-card-header">
        <h3>Applicants per Job</h3>
        <span>{totalApplicants} total</span>
      </div>

      {analytics.jobStats.length === 0 ? (
        <div className="analytics-empty">
          No applicant data yet.
        </div>
      ) : (
        <div className="bar-chart">

          {analytics.jobStats.map((job, index) => {

            const maxApplicants = Math.max(
              ...analytics.jobStats.map(
                (item) => item.applicants
              ),
              1
            );

            const width =
              (job.applicants / maxApplicants) * 100;

            return (
              <div
                className="bar-row"
                key={index}
              >

                <div className="bar-label">
                  {job.title}
                </div>

                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${width}%`,
                    }}
                  />
                </div>

                <div className="bar-value">
                  {job.applicants}
                </div>

              </div>
            );
          })}

        </div>
      )}

    </div>

    {/* Application pipeline */}
    <div className="analytics-card">

      <div className="analytics-card-header">
        <h3>Application Pipeline</h3>
      </div>

      <div className="pipeline-chart">

        <div className="pipeline-row">
          <span>Applied</span>

          <div className="pipeline-track">
            <div
              className="pipeline-fill"
              style={{
                width: `${
                  totalApplicants
                    ? (analytics.applied / totalApplicants) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <strong>{analytics.applied}</strong>
        </div>

        <div className="pipeline-row">
          <span>Shortlisted</span>

          <div className="pipeline-track">
            <div
              className="pipeline-fill"
              style={{
                width: `${
                  totalApplicants
                    ? (analytics.shortlisted / totalApplicants) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <strong>{analytics.shortlisted}</strong>
        </div>

        <div className="pipeline-row">
          <span>Interview</span>

          <div className="pipeline-track">
            <div
              className="pipeline-fill"
              style={{
                width: `${
                  totalApplicants
                    ? (analytics.interview / totalApplicants) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <strong>{analytics.interview}</strong>
        </div>

        <div className="pipeline-row">
          <span>Selected</span>

          <div className="pipeline-track">
            <div
              className="pipeline-fill"
              style={{
                width: `${
                  totalApplicants
                    ? (analytics.selected / totalApplicants) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <strong>{analytics.selected}</strong>
        </div>

        <div className="pipeline-row">
          <span>Rejected</span>

          <div className="pipeline-track">
            <div
              className="pipeline-fill"
              style={{
                width: `${
                  totalApplicants
                    ? (analytics.rejected / totalApplicants) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <strong>{analytics.rejected}</strong>
        </div>

      </div>

    </div>

  </div>

</section>

        {/* ================= JOBS ================= */}
        <section className="recruiter-jobs-section">

          <div className="section-header">
            <div>
              <h2>Your Posted Jobs</h2>
              <p>Click a job to see who applied</p>
            </div>

            <div className="section-header-actions">
              <span className="recruiter-job-count">
                {jobs.length} jobs
              </span>

              <button
                className="post-job-button"
                onClick={openCreateForm}
              >
                + Post a Job
              </button>
            </div>
          </div>

          {loading ? (
            <div className="recruiter-loading">
              Loading your jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="recruiter-empty">
              <h3>No jobs posted yet</h3>
              <p>Jobs you post will show up here.</p>
            </div>
          ) : (
            <div className="recruiter-jobs-grid">

              {jobs.map((job) => (
                <Link
                  to={`/recruiter/jobs/${job._id}`}
                  className="recruiter-job-card"
                  key={job._id}
                >
                  <div className="recruiter-job-header">
                    <div className="company-logo">
                      {job.company?.charAt(0).toUpperCase()}
                    </div>

                    <div className="recruiter-job-title-container">
                      <h3>{job.title}</h3>
                      <p className="company-name">{job.company}</p>
                    </div>

                    <div className="recruiter-job-actions">
                      <button
                        className="job-action-btn edit-btn"
                        onClick={(e) => openEditForm(e, job)}
                        title="Edit job"
                      >
                        ✎
                      </button>

                      <button
                        className="job-action-btn delete-btn"
                        onClick={(e) => handleDeleteJob(e, job._id)}
                        disabled={deletingId === job._id}
                        title="Delete job"
                      >
                        {deletingId === job._id ? "…" : "🗑"}
                      </button>
                    </div>
                  </div>

                  <p className="recruiter-job-description">
                    {job.description}
                  </p>

                  <div className="recruiter-job-details">
                    <span>📍 {job.location}</span>
                    <span>💰 {job.salary}</span>
                  </div>

                  <div className="view-applicants-link">
                    View Applicants <span>→</span>
                  </div>
                </Link>
              ))}

            </div>
          )}

        </section>

      </main>

      {/* ================= POST / EDIT JOB MODAL ================= */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editingJobId ? "Edit Job" : "Post a New Job"}</h2>
              <button
                className="modal-close"
                onClick={closeForm}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitJob}>

              <div className="form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Frontend Developer Intern"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  placeholder="e.g. TechCorp"
                  value={formData.company}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  placeholder="Describe the role..."
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={4}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g. Remote"
                    value={formData.location}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Salary</label>
                  <input
                    type="text"
                    name="salary"
                    placeholder="e.g. ₹30,000/month"
                    value={formData.salary}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Skills (comma separated)</label>
                <input
                  type="text"
                  name="skills"
                  placeholder="e.g. React, Node.js, MongoDB"
                  value={formData.skills}
                  onChange={handleFormChange}
                />
              </div>

              {formError && (
                <div className="form-error">{formError}</div>
              )}

              <button
                type="submit"
                className="post-job-submit"
                disabled={posting}
              >
                {posting
                  ? editingJobId
                    ? "Saving..."
                    : "Posting..."
                  : editingJobId
                  ? "Save Changes"
                  : "Post Job"}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Recruiter;