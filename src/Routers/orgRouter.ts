import { Router } from "express";
import {
  getOrganizationById,
  getOrganizations,
  getOrganizationsForUser,
} from "../controllers/Organization/listOrgs";
import { createNewOrganization } from "../controllers/Organization/createOrganization";
import {
  addWStoOrganization,
  removeWSfromOrganization,
} from "../controllers/Organization/workingSector";
import { updateOrganization } from "../controllers/Organization/updateOrganization";

const router = Router();

router.get("/", getOrganizations);
router.get("/:id", getOrganizationById);
router.get("/user/:id", getOrganizationsForUser);
router.post("/new", createNewOrganization);
router.put("/update", updateOrganization);
router.post("/ws/add", addWStoOrganization);
router.delete("/ws/remove", removeWSfromOrganization);

export default router;
