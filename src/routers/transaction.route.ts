import express from "express";
import {
  checkout,
  createTransaction,
  getCheckoutInfo,
  getMyTransactions,
  getPendingTransactions,
  updateTransactionStatus,
  upload,
  uploadPaymentProof,
} from "../controller/transaction.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/checkout", verifyToken, checkout);
router.get("/checkout-info", verifyToken, getCheckoutInfo);

router.post("/buy", verifyToken, createTransaction);
router.get("/user", verifyToken, getMyTransactions);
router.post(
  "/:id/upload-proof",
  verifyToken,
  upload.single("paymentProof"),
  uploadPaymentProof
);
router.get("/pending", verifyToken, getPendingTransactions);
router.patch("/:id/status", verifyToken, updateTransactionStatus);

export default router;
