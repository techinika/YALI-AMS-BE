import express, { Request, Response, NextFunction } from "express";
import route from "./Routers";
import http from "http";
import bodyParser from "body-parser";
const fileUpload = require("express-fileupload");
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import { generateProfileUpdateNotifications } from "./controllers/notificationController";
import path from "path";
import { initSockets } from "./sockets";
import { prismaContext } from "./helpers/prisma-context";
import { apiLimiter } from "./middleware/rateLimit";
import { createAiMatchmakingWorker } from "./helpers/queue";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./helpers/swagger";
import prisma from "./helpers/prismaClient";
import { connectCache } from "./helpers/cache";
import "dotenv/config";

connectCache();

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

const app = express();
const PORT = process.env.PORT || 7000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));

app.use(
  fileUpload({
    limits: {
      fileSize: 10000000,
    },
    abortOnLimit: true,
    useTempFiles: true,
    tempFileDir: "tmp/",
  })
);

app.use(express.static(path.join(__dirname, "../public")));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "1mb" }));

app.use((req: Request, res, next) => {
  prismaContext.run({ userId: req?.user?.id }, () => {
    next();
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", apiLimiter, route);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const server = http.createServer(app);

initSockets(server);

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

createAiMatchmakingWorker();

cron.schedule("0 * * * *", async () => {
  console.log("Cron Ready!");
  await generateProfileUpdateNotifications();
  console.log(
    "Scheduled task executed: Profile update notifications created for users who have not updated their profiles in over a month."
  );
});

export default app;
