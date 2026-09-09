import { Router } from "express";
import { uploadImage } from "../controllers/Upload/image";
import { requireAuth } from "../middleware/auth";
import { uploadLimiter } from "../middleware/rateLimit";

const uploadRouter = Router();

uploadRouter.post("/image", requireAuth, uploadLimiter, uploadImage);

export default uploadRouter;