import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import type { Request, Response } from "express";
import multer from "multer";
import { cloudinary } from "../config/cloudinary.config.js";
import fs from "fs";

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
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // upload ke Cloudinary
    const filePath = req.file.path;
    const cloudinaryUpload = await cloudinary.uploader.upload(filePath, {
      folder: "payment-proofs",
      resource_type: "auto",
    });

    // simpan URL dari Cloudinary ke database
    const transaction = await prisma.transaction.update({
      where: { id: Number(id) },
      data: {
        paymentProof: cloudinaryUpload.secure_url,
        status: "WAITING_FOR_ADMIN_CONFIRMATION",
      },
    });

    // utk hapus file lokal setelah diupload
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: "Payment proof uploaded successfully",
      transaction,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getPendingTransactions(req: Request, res: Response) {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { status: "WAITING_FOR_ADMIN_CONFIRMATION" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            location: true,
            startDate: true,
            endDate: true,
          },
        },
        usedVoucher: {
          select: { id: true, code: true },
        },
        usedCoupon: {
          select: { id: true, code: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!transactions || transactions.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(transactions);
  } catch (err) {
    console.error("Error fetching pending transactions:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateTransactionStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["DONE", "REJECTED"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existingTx = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: { event: true },
    });

    if (!existingTx) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update status transaksi
      const updatedTx = await tx.transaction.update({
        where: { id: Number(id) },
        data: { status },
      });

      if (status === "DONE") {
        await tx.event.update({
          where: { id: existingTx.eventId },
          data: {
            remainingSeats: {
              decrement: existingTx.ticketQuantity,
            },
          },
        });
      }

      // Jika transaksi ditolak maka kembalikan seat & poin
      if (status === "REJECTED") {
        // kembalikan seat
        await tx.event.update({
          where: { id: existingTx.eventId },
          data: {
            remainingSeats: {
              increment: existingTx.ticketQuantity,
            },
          },
        });

        // kembalikan poin (kalau user pakai)
        if (existingTx.usedPoint && existingTx.usedPoint > 0) {
          const expiredAt = new Date();
          expiredAt.setMonth(expiredAt.getMonth() + 3);

          await tx.point.create({
            data: {
              userId: existingTx.userId,
              amount: existingTx.usedPoint,
              source: "REFUND", // ganti sesuai enum PointSource kamu
              expiredAt,
              isExpired: false,
            },
          });
        }
      }

      return updatedTx;
    });

    return res.status(200).json({
      message: `Transaction status updated to ${status}`,
      transaction: result,
    });
  } catch (err) {
    console.error("Error updating transaction status:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
