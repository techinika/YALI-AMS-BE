import { Router } from "express";
import userRouter from "./userRouter";
import DataRouter from "./DataRouters";
import authRouter from "./authRouter";
import chatRouter from "./ChatRouter";
import notificationRouter from "./notificationRouter";
import statsRouter from "./statsRouter";
import uploadRouter from "./uploadRouter";
import orgRouter from "./orgRouter";
import { requireAuth } from "../middleware/auth";
import activityRouter from "./activityRouter";
import matchRouter from "./matchRouter";

const route = Router();

route.use("/users", requireAuth, userRouter);
route.use("/organizations", requireAuth, orgRouter);
route.use("/data", requireAuth, DataRouter);
route.use("/auth", authRouter);
route.use("/chat", requireAuth, chatRouter);
route.use("/notification", requireAuth, notificationRouter);
route.use("/stats", requireAuth, statsRouter);
route.use("/upload", requireAuth, uploadRouter);
route.use("/activity", requireAuth, activityRouter);
route.use("/matchmaking", requireAuth, matchRouter);

export default route;
