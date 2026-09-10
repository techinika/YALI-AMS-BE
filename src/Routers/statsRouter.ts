import { Router } from "express";
import { numbersController, activityTrendController } from "../controllers/dashboardStats";

const statsRouter = Router();

statsRouter.get("/", numbersController);
statsRouter.get("/activity-trend", activityTrendController);

export default statsRouter;
