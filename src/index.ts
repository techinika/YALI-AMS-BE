import express, { Request } from "express";
import route from "./Routers";
import http from "http";
import bodyParser from "body-parser";
const fileUpload = require("express-fileupload");
import cors from "cors";
import cron from "node-cron";
import { generateProfileUpdateNotifications } from "./controllers/notificationController";
import path from "path";
import { initSockets } from "./sockets";
import { prismaContext } from "./helpers/prisma-context";
import { apiLimiter } from "./middleware/rateLimit";
import { createAiMatchmakingWorker } from "./helpers/queue";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./helpers/swagger";
import "dotenv/config";

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
app.use(bodyParser.json());

app.use((req: Request, res, next) => {
  prismaContext.run({ userId: req?.user?.id }, () => {
    next();
  });
});

app.use("/api", apiLimiter, route);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const server = http.createServer(app);

initSockets(server);

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
