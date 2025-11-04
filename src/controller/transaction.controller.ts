import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import type { Request, Response } from "express";
import path from "path";
import multer from "multer";
import { cloudinary } from "../config/cloudinary.config.js";
import fs from "fs";
import { success } from "zod";

const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/payment-proofs";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({ storage });

export async function createTransaction(req: Request, res: Response) {
  try {
    const { eventId, ticketQuantity, price, totalPrice } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!eventId || !ticketQuantity || !price || !totalPrice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.remainingSeats < ticketQuantity)
      return res.status(400).json({ message: "Not enough seats left" });

    const newTransaction = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.event.update({
          where: { id: event.id },
          data: { remainingSeats: { decrement: ticketQuantity } },
        });

        const transaction = await tx.transaction.create({
          data: {
            userId,
            eventId: event.id,
            ticketQuantity,
            price,
            totalPrice,
            status: "WAITING_FOR_PAYMENT",
          },
        });

        return transaction;
      }
    );

    res.status(201).json(newTransaction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create transaction" });
  }
}

export async function getMyTransactions(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get transactions" });
  }
}

export async function uploadPaymentProof(req: Request, res: Response) {
  try {
    const { transactionId } = req.body;
    const paymentProof = req.file;

    if (!paymentProof) {
      return res.status(400).json({ message: "File not found." });
    }

    const uploadResult = await cloudinary.uploader.upload(paymentProof?.path);
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentProof: uploadResult.secure_url,
        status: "WAITING_FOR_ADMIN_CONFIRMATION",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Payment proof uploaded successfully",
    });
  } catch (err) {
    console.error("Upload failed:", err);
    return res.status(500).json({ message: "Failed to upload payment proof" });
  }
}
