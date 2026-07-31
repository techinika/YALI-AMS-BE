import { Router } from "express";
import { createMatchmakingRequest, getMatchmakingHistory, getMatchmakingStatus } from "../controllers/AIMatchmaking/AIMatchmaking";

const matchRouter = Router();

matchRouter.post("/ai", createMatchmakingRequest);
matchRouter.get("/history", getMatchmakingHistory);
matchRouter.get("/status/:requestId", getMatchmakingStatus);

export default matchRouter;
