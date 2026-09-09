import { Router } from "express";
import {
  getOrganizationById,
  getOrganizations,
  getOrganizationsForUser,
  getOrganizationsForUserById,
} from "../controllers/Organization/listOrgs";
import { createNewOrganization } from "../controllers/Organization/createOrganization";
import {
  addWStoOrganization,
  removeWSfromOrganization,
} from "../controllers/Organization/workingSector";
import { updateOrganization } from "../controllers/Organization/updateOrganization";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/", getOrganizations);
router.get("/user/:id/:orgId", getOrganizationsForUserById);
router.get("/user/:id", getOrganizationsForUser);
router.get("/:id", getOrganizationById);
router.post("/new", requireAdmin, createNewOrganization);
router.put("/update", requireAdmin, updateOrganization);
router.post("/ws/add", requireAdmin, addWStoOrganization);
router.delete("/ws/remove", requireAdmin, removeWSfromOrganization);

export default router;