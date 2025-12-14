import { Router } from "express";
import { ChangeUserRole } from "../controllers/DataControllers/RoleController";
import CreateUserProfile from "../controllers/Users/createUser";
import { inviteUser } from "../controllers/Users/inviteUser";
import { updateUser } from "../controllers/Users/updateUser";
import {
  addUserOrganization,
  removeUserOrganization,
} from "../controllers/Users/associateOrganization";
import { getAllUsers, getUserById } from "../controllers/Users/getUsers";
import { deleteUser } from "../controllers/Users/deleteUser";
import { importUsers } from "../controllers/Users/importUsers";

const router = Router();

router.get("/", getAllUsers);
router.get("/:userId", getUserById);
router.post("/invite", inviteUser);
router.post("/profile", CreateUserProfile);
router.post("/org/add", addUserOrganization);
router.delete("/org/remove", removeUserOrganization);
router.post("/import", importUsers);
router.put("/:userId", updateUser);
router.delete("/:userId", deleteUser);
router.post("/role/:userId", ChangeUserRole);

export default router;
