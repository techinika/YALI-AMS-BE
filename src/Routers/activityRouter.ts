import { Router } from "express";
import { getRecentActivityLogs } from "../controllers/Admin/ActivityLog";
import { requireAuth, requireAdmin } from "../middleware/auth";

const activityRouter = Router();

activityRouter.get("/recent", requireAdmin, getRecentActivityLogs);

export default activityRouter;
