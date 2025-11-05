const mongoose  = require("mongoose");

const MONGO_URI = "mongodb://localhost:27017/crypto-tracker";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully!");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("MongoDB connection error:", err.message);
    } else {
      console.error("MongoDB connection error:", err);
    }
  }
};
