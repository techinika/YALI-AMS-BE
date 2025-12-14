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

const router = Router();

router.get("/", getOrganizations);
router.get("/:id", getOrganizationById);
router.get("/org/user", getOrganizationsForUser);
router.post("/new", createNewOrganization);
router.post("/ws/add", addWStoOrganization);
router.delete("/ws/remove", removeWSfromOrganization);

export default router;
