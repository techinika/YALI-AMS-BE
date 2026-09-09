import { Router } from "express";
import AuthController from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";

const authRouter = Router();

authRouter.post("/login", authLimiter, AuthController.login);
authRouter.post("/me/extend", AuthController.extendSession);
authRouter.post("/logout", requireAuth, AuthController.logout);
authRouter.post("/change-pass", requireAuth, AuthController.changePassword);
authRouter.post("/request-link", authLimiter, AuthController.requestLink);
authRouter.post("/reset-password", authLimiter, AuthController.resetPassword);

export default authRouter;
