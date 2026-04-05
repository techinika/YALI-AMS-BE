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
const HTTP_PORT = process.env.HTTP_PORT || 4500;

const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 200,
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

app.use("/api", apiLimiter, route);

app.use((req: Request, res, next) => {
  prismaContext.run({ userId: req?.user?.id }, () => {
    next();
  });
});

app.listen(PORT, () => console.log("Server is running on port " + PORT));

const server = http.createServer(app);

initSockets(server);

server.listen(HTTP_PORT, () => {
  console.log(`HTTP Server running on port ${HTTP_PORT}`);
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
