import { Router } from "express";
import { numbersController } from "../controllers/dashboardStats";

const statsRouter = Router();

statsRouter.get("/", numbersController);

export default statsRouter;
