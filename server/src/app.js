const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const topicRoutes = require("./routes/topicRoutes");
const commentRoutes = require("./routes/commentRoutes");
const voteRoutes = require("./routes/voteRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const feedRoutes = require("./routes/feedRoutes");
const reportRoutes = require("./routes/reportRoutes");
const moderationRoutes = require("./routes/moderationRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const { errorHandler } = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));

const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "") || null;
const allowedOrigins = new Set(
  [process.env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"]
    .map(normalizeOrigin)
    .filter(Boolean),
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;

  if (allowedOrigins.has(normalized)) return true;

  return (
    /^https?:\/\/localhost(?::\d+)?$/i.test(normalized) ||
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(normalized) ||
    /^https:\/\/[-a-z0-9]+\.onrender\.com$/i.test(normalized) ||
    /^https:\/\/[-a-z0-9]+\.vercel\.app$/i.test(normalized)
  );
};

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    skip: (req) => req.method === "GET" || req.method === "HEAD",
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { status: "ok", database: "connected" } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Database connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/moderation", moderationRoutes);
app.use("/api/categories", categoryRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => {
    console.log(`Debate platform API listening on http://localhost:${port}`);
  });
}

module.exports = { app, prisma };
