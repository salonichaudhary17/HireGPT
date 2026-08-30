import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

try {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("Connected to MongoDB");

  await mongoose.connection.db
    .collection("users")
    .dropIndex("username_1");

  console.log("username_1 index deleted successfully");

  await mongoose.disconnect();
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}