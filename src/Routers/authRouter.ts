import { Router } from "express";
import AuthController from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const authRouter = Router();

authRouter.post("/login", AuthController.login);
authRouter.post("/logout", requireAuth, AuthController.logout);
authRouter.post("/change-pass", requireAuth, AuthController.changePassword);
authRouter.post("/request-link", AuthController.requestLink);
authRouter.post("/reset-password", AuthController.resetPassword);

export default authRouter;
