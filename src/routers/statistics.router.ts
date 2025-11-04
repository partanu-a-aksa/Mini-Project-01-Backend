import express from "express";
import { getStatistics } from "../controller/statistics.controller.js";

const router = express.Router();

router.get("/data", getStatistics);

export default router;
