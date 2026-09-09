import { Router } from "express";
import { ChangeUserRole } from "../controllers/DataControllers/RoleController";
import CreateUserProfile from "../controllers/Users/createUser";
import { inviteUser, reInviteUser } from "../controllers/Users/inviteUser";
import { updateUser } from "../controllers/Users/updateUser";
import {
  addUserOrganization,
  removeUserOrganization,
} from "../controllers/Users/associateOrganization";
import { getAllUsers, getUserById } from "../controllers/Users/getUsers";
import { deleteUser } from "../controllers/Users/deleteUser";
import { importUsers } from "../controllers/Users/importUsers";
import { exportMembersController } from "../controllers/Users/exportUsers";
import { exportMyData } from "../controllers/Users/exportMyData";
import { deleteOwnAccount } from "../controllers/Users/deleteOwnAccount";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/me/data", exportMyData);
router.delete("/me", deleteOwnAccount);
router.get("/", getAllUsers);
router.get("/:userId", getUserById);
router.post("/export/all", requireAdmin, exportMembersController);
router.post("/invite", requireAdmin, inviteUser);
router.put("/invite/renew/:userId", requireAdmin, reInviteUser);
router.post("/profile", CreateUserProfile);
router.post("/org/add", addUserOrganization);
router.delete("/org/remove", removeUserOrganization);
router.post("/import", requireAdmin, importUsers);
router.put("/:userId", requireAdmin, updateUser);
router.delete("/:userId", requireAdmin, deleteUser);
router.post("/role/:userId", requireAdmin, ChangeUserRole);

export default router;
