import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);

  // ================= SEARCH + FILTER STATES =================

  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  // =========================================================

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  // ================= FETCH JOBS =================

  const fetchJobs = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/jobs", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch jobs");
      }

      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Jobs error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ================= FETCH APPLICATIONS =================

  const fetchApplications = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/applications/my-applications",
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
      setApplicationsLoading(false);
    }
  };

  // ================= INITIAL LOAD =================

  useEffect(() => {
    fetchJobs();
    fetchApplications();
  }, []);

  // ================= LOGOUT =================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

  // ================= APPLY FOR JOB =================

  const handleApply = async (jobId) => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/applications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jobId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to apply");
        return;
      }

      alert("Application submitted successfully!");

      // Refresh application stats
      fetchApplications();
    } catch (error) {
      console.error("Application error:", error);
      alert("Something went wrong");
    }
  };

  // ================= APPLICATION STATS =================

  const shortlistedCount = applications.filter(
    (app) => app.status === "shortlisted"
  ).length;

  // =========================================================
  // SEARCH + FILTER LOGIC
  // =========================================================

  // Get unique locations from jobs
  const locations = useMemo(() => {
    const uniqueLocations = jobs
      .map((job) => job.location)
      .filter(Boolean);

    return [...new Set(uniqueLocations)].sort();
  }, [jobs]);

  // Get unique skills from all jobs
  const skills = useMemo(() => {
    const allSkills = jobs.flatMap((job) => job.skills || []);

    const uniqueSkills = allSkills
      .filter(Boolean)
      .map((skill) => skill.trim());

    return [...new Set(uniqueSkills)].sort();
  }, [jobs]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return jobs.filter((job) => {
      // ---------------- SEARCH ----------------

      const matchesSearch =
        search === "" ||
        job.title?.toLowerCase().includes(search) ||
        job.company?.toLowerCase().includes(search) ||
        job.description?.toLowerCase().includes(search) ||
        job.location?.toLowerCase().includes(search) ||
        job.skills?.some((skill) =>
          skill.toLowerCase().includes(search)
        );

      // ---------------- LOCATION FILTER ----------------

      const matchesLocation =
        locationFilter === "" ||
        job.location?.toLowerCase() ===
          locationFilter.toLowerCase();

      // ---------------- SKILL FILTER ----------------

      const matchesSkill =
        skillFilter === "" ||
        job.skills?.some(
          (skill) =>
            skill.toLowerCase() === skillFilter.toLowerCase()
        );

      return (
        matchesSearch &&
        matchesLocation &&
        matchesSkill
      );
    });
  }, [jobs, searchTerm, locationFilter, skillFilter]);

  // ================= CLEAR FILTERS =================

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("");
    setSkillFilter("");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    locationFilter !== "" ||
    skillFilter !== "";

  // =========================================================

  return (
    <div className="dashboard">

      {/* ================= NAVBAR ================= */}

      <nav className="dashboard-navbar">

        <Link to="/dashboard" className="dashboard-logo">
          Hire<span>GPT</span>
        </Link>

        <div className="dashboard-nav-links">

          <Link to="/dashboard" className="active">
            Jobs
          </Link>

          <Link to="/applications">
            Applications
          </Link>

          <Link to="/resume">
            AI Interview
          </Link>

<div className="user-profile"></div>
    
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


      {/* ================= MAIN CONTENT ================= */}

      <main className="dashboard-content">

        {/* ================= WELCOME ================= */}

        <section className="welcome-section">

          <div>

            <p className="dashboard-badge">
              CANDIDATE DASHBOARD
            </p>

            <h1>
              Welcome back,{" "}
              <span>{user?.name}</span> 👋
            </h1>

            <p className="welcome-subtitle">
              Discover opportunities that match your skills.
            </p>

          </div>

        </section>


        {/* ================= STATS ================= */}

        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon">
              💼
            </div>

            <div>

              <h3>{jobs.length}</h3>

              <p>
                Available Jobs
              </p>

            </div>

          </div>


          <div
            className="stat-card"
            onClick={() => navigate("/applications")}
            style={{ cursor: "pointer" }}
          >

            <div className="stat-icon">
              📄
            </div>

            <div>

              <h3>
                {applicationsLoading
                  ? "…"
                  : applications.length}
              </h3>

              <p>
                Applications
              </p>

            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon">
              ⭐
            </div>

            <div>

              <h3>
                {applicationsLoading
                  ? "…"
                  : shortlistedCount}
              </h3>

              <p>
                Shortlisted
              </p>

            </div>

          </div>

        </section>


        {/* ================= JOBS ================= */}

        <section className="jobs-section">

          {/* ================= SECTION HEADER ================= */}

          <div className="section-header">

            <div>

              <h2>
                Available Jobs
              </h2>

              <p>
                Find your next opportunity
              </p>

            </div>

            <span className="job-count">
              {filteredJobs.length} jobs
            </span>

          </div>


          {/* =================================================
              SEARCH + FILTERS
          ================================================= */}

          {!loading && jobs.length > 0 && (

            <div className="job-filters">

              {/* SEARCH */}

              <div className="search-box">

                <span className="search-icon">
                  🔍
                </span>

                <input
                  type="text"
                  placeholder="Search jobs, companies, skills..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                />

              </div>


              {/* LOCATION */}

              <select
                value={locationFilter}
                onChange={(e) =>
                  setLocationFilter(e.target.value)
                }
                className="filter-select"
              >

                <option value="">
                  All Locations
                </option>

                {locations.map((location) => (
                  <option
                    key={location}
                    value={location}
                  >
                    {location}
                  </option>
                ))}

              </select>


              {/* SKILL */}

              <select
                value={skillFilter}
                onChange={(e) =>
                  setSkillFilter(e.target.value)
                }
                className="filter-select"
              >

                <option value="">
                  All Skills
                </option>

                {skills.map((skill) => (
                  <option
                    key={skill}
                    value={skill}
                  >
                    {skill}
                  </option>
                ))}

              </select>


              {/* CLEAR */}

              {hasActiveFilters && (

                <button
                  className="clear-filters-button"
                  onClick={clearFilters}
                >
                  Clear
                </button>

              )}

            </div>

          )}


          {/* ================= LOADING ================= */}

          {loading ? (

            <div className="loading">
              Loading jobs...
            </div>

          ) : jobs.length === 0 ? (

            <div className="empty-state">

              <h3>
                No jobs available
              </h3>

              <p>
                Check back later for new opportunities.
              </p>

            </div>

          ) : filteredJobs.length === 0 ? (

            /* ================= NO SEARCH RESULTS ================= */

            <div className="empty-state">

              <h3>
                No jobs found
              </h3>

              <p>
                Try changing your search or filters.
              </p>

              <button
                className="empty-clear-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>

            </div>

          ) : (

            /* ================= JOB GRID ================= */

            <div className="jobs-grid">

              {filteredJobs.map((job) => (

                <div
                  className="job-card"
                  key={job._id}
                >

                  {/* ================= JOB HEADER ================= */}

                  <div className="job-header">

                    <div className="company-logo">
                      {job.company
                        ?.charAt(0)
                        .toUpperCase()}
                    </div>


                    <div className="job-title-container">

                      <h3>
                        {job.title}
                      </h3>

                      <p className="company-name">
                        {job.company}
                      </p>

                    </div>


                    <span className="job-type">
                      Internship
                    </span>

                  </div>


                  {/* ================= DESCRIPTION ================= */}

                  <p className="job-description">
                    {job.description}
                  </p>


                  {/* ================= DETAILS ================= */}

                  <div className="job-details">

                    <span>
                      📍 {job.location}
                    </span>

                    <span>
                      💰 {job.salary}
                    </span>

                  </div>


                  {/* ================= SKILLS ================= */}

                  <div className="skills">

                    {job.skills?.map(
                      (skill, index) => (

                        <span key={index}>
                          {skill}
                        </span>

                      )
                    )}

                  </div>


                  {/* ================= APPLY ================= */}

                  <button
                    className="apply-button"
                    onClick={() =>
                      handleApply(job._id)
                    }
                  >
                    Apply Now
                    <span>→</span>
                  </button>

                </div>

              ))}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default Dashboard;