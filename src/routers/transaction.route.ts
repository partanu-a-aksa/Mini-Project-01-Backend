import express from "express";
import {
  createTransaction,
  getMyTransactions,
  upload,
  uploadPaymentProof,
} from "../controller/transaction.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/buy", verifyToken, createTransaction);
router.get("/user", verifyToken, getMyTransactions);
router.post(
  "/upload/:id",
  verifyToken,
  upload.single("paymentProof"),
  uploadPaymentProof
);
export default router;
