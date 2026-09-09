import { Router } from "express";
import {
  getAllNotificationSetups,
  getOneNotificationSetups,
  getUnopenedNotifications,
  getUsersNotifications,
  openNotification,
  updateNotificationDetails,
} from "../controllers/notificationController";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/unopened/:userId", requireAuth, getUnopenedNotifications);
router.get("/update/setup/one/:usage", requireAuth, getOneNotificationSetups);
router.get("/update/setup", requireAdmin, getAllNotificationSetups);
router.put("/update/setup", requireAdmin, updateNotificationDetails);
router.get("/:userId", requireAuth, getUsersNotifications);
router.post("/", requireAuth, openNotification);

export default router;
