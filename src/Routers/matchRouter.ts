import { Router } from "express";
import { createMatchmakingRequest } from "../controllers/AIMatchmaking/AIMatchmaking";

const matchRouter = Router();

matchRouter.post("/ai", createMatchmakingRequest);

export default matchRouter;
