import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./config/passport";
import commentsRouter from "./routes/comments";
import userRoutes from "./routes/usersRoutes";
import authRouter from "./routes/authRouter";
import marketsRouter from "./routes/marketRouter";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // یا هر دامنه‌ای که فرانت رویشه
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "matin@#!384@#$%",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, 
      sameSite: "none", 
      httpOnly: true,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// 🧭 Routes
app.use("/api/comments", commentsRouter);
app.use("/api/users", userRoutes);
app.use("/api", marketsRouter); // تمام مسیرهای مارکت
app.use("/api/auth", authRouter);
app.get("/", (req, res) => {
  res.send('<a href="/api/auth/google">Login with Google</a>');
});
// Route سلامت سرور
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "سرور فعال است",
    timestamp: new Date().toISOString(),
  });
});

export default app;
