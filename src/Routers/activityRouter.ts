import { Router } from "express";
import { getRecentActivityLogs } from "../controllers/Admin/ActivityLog";

const activityRouter = Router();

activityRouter.get("/recent", getRecentActivityLogs);

export default activityRouter;
