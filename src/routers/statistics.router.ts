import express from "express";
import { getStatistics } from "../controller/statistics.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/data", verifyToken, getStatistics);

export default router;
