
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI!;

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected successfully!");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("❌ MongoDB connection error:", err.message);
    } else {
      console.error("❌ MongoDB connection error:", err);
    }
    process.exit(1); // اگه اتصال برقرار نشه، سرور هم استارت نخوره
  }
};
