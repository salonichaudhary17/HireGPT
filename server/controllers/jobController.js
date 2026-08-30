import Job from "../models/Job.js";

// GET all jobs
export const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("postedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      jobs,
    });
  } catch (error) {
    console.error("Get jobs error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// GET jobs posted by the logged-in recruiter
export const getMyJobs = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiters can view their posted jobs",
      });
    }

    const jobs = await Job.find({ postedBy: req.user.userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      jobs,
    });
  } catch (error) {
    console.error("Get my jobs error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// GET single job by id
export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findById(id).populate(
      "postedBy",
      "name email role"
    );

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    res.status(200).json({
      job,
    });
  } catch (error) {
    console.error("Get job error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// CREATE a job (recruiters only)
export const createJob = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiters can create jobs",
      });
    }

    const { title, company, description, location, salary, skills } =
      req.body;

    if (!title || !company || !description || !location) {
      return res.status(400).json({
        message: "Title, company, description and location are required",
      });
    }

    const job = await Job.create({
      title,
      company,
      description,
      location,
      salary,
      skills,
      postedBy: req.user.userId,
    });

    res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("Create job error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// UPDATE a job (only the recruiter who posted it)
export const updateJob = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiters can update jobs",
      });
    }

    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    if (job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not authorized to update this job",
      });
    }

    const { title, company, description, location, salary, skills } =
      req.body;

    if (title !== undefined) job.title = title;
    if (company !== undefined) job.company = company;
    if (description !== undefined) job.description = description;
    if (location !== undefined) job.location = location;
    if (salary !== undefined) job.salary = salary;
    if (skills !== undefined) job.skills = skills;

    await job.save();

    res.status(200).json({
      message: "Job updated successfully",
      job,
    });
  } catch (error) {
    console.error("Update job error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// DELETE a job (only the recruiter who posted it)
export const deleteJob = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiters can delete jobs",
      });
    }

    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    if (job.postedBy.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not authorized to delete this job",
      });
    }

    await job.deleteOne();

    res.status(200).json({
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};