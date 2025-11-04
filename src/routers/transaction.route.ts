import express from "express";
import { createTransaction } from "../controller/transaction.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/buy", verifyToken, createTransaction);

export default router;
