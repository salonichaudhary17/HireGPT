import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import connectDB from "./config/db.js";
import User from "./models/User.js";
import Job from "./models/Job.js";

import { users, jobs } from "./data/data.js";

// Load environment variables
dotenv.config();

// Seed database
const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    console.log("Connected to MongoDB");

    // Clear existing users and jobs
    await User.deleteMany({});
    await Job.deleteMany({});

    console.log("Old data cleared");

    // Hash passwords
    const usersWithHashedPasswords = await Promise.all(
      users.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10),
      }))
    );

    // Create users
    const createdUsers = await User.insertMany(
      usersWithHashedPasswords
    );

    console.log(`${createdUsers.length} users created`);

    // Find recruiter
    const recruiter = createdUsers.find(
      (user) => user.role === "recruiter"
    );

    if (!recruiter) {
      throw new Error("Recruiter not found in seed data");
    }

    // Attach recruiter ID to every job
    const jobsWithRecruiter = jobs.map((job) => ({
      ...job,
      postedBy: recruiter._id,
    }));

    // Create jobs
    const createdJobs = await Job.insertMany(
      jobsWithRecruiter
    );

    console.log(`${createdJobs.length} jobs created`);

    console.log("Database seeded successfully 🚀");

    // Close database connection
    await mongoose.connection.close();

    process.exit(0);

  } catch (error) {
    console.error("Seeding error:", error);

    process.exit(1);
  }
};

// Run seed function
seedDatabase();