import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "applied",
        "shortlisted",
        "interview",
        "selected",
        "rejected",
      ],
      default: "applied",
    },
  },
  {
    timestamps: true,
  }
);


// Prevent the same candidate from applying
// to the same job more than once
applicationSchema.index(
  { job: 1, candidate: 1 },
  { unique: true }
);


const Application = mongoose.model(
  "Application",
  applicationSchema
);

export default Application;