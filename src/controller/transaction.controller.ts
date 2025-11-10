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

// Fungsi checkout baru dengan validasi lengkap
export async function checkout(req: Request, res: Response) {
  try {
    const {
      eventId,
      ticketQuantity,
      usedPoint = 0,
      voucherCode,
      couponCode,
    } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!eventId || !ticketQuantity) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validasi event
    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.remainingSeats < ticketQuantity) {
      return res.status(400).json({ message: "Not enough seats available" });
    }

    let basePrice = event.price * ticketQuantity;
    let discount = 0;
    let voucherId: number | null = null;
    let couponId: number | null = null;

    // Validasi dan aplikasi voucher
    if (voucherCode) {
      const voucher = await prisma.voucher.findFirst({
        where: {
          code: voucherCode,
          eventId: event.id,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });

      if (!voucher) {
        return res.status(400).json({ message: "Invalid or expired voucher" });
      }

      voucherId = voucher.id;
      if (voucher.discountType === "PERCENTAGE") {
        discount += (basePrice * voucher.discountAmount) / 100;
      } else {
        discount += voucher.discountAmount;
      }
    }

    // Validasi dan aplikasi coupon
    if (couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode,
          userId,
          isUsed: false,
          expiredAt: { gte: new Date() },
        },
      });

      if (!coupon) {
        return res.status(400).json({ message: "Invalid or expired coupon" });
      }

      couponId = coupon.id;
      discount += coupon.discountAmount;
    }

    // Validasi point
    let pointsToUse = 0;
    if (usedPoint > 0) {
      const userPoints = await prisma.point.findMany({
        where: {
          userId,
          isExpired: false,
          expiredAt: { gte: new Date() },
        },
        orderBy: { expiredAt: "asc" },
      });

      const totalAvailablePoints = userPoints.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      if (usedPoint > totalAvailablePoints) {
        return res.status(400).json({ message: "Insufficient points" });
      }

      pointsToUse = Math.min(usedPoint, basePrice - discount);
    }

    const totalPrice = Math.max(0, basePrice - discount - pointsToUse);

    // Buat transaksi
    const newTransaction = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Update remaining seats
        await tx.event.update({
          where: { id: event.id },
          data: { remainingSeats: { decrement: ticketQuantity } },
        });

        // Buat transaksi
        const transaction = await tx.transaction.create({
          data: {
            userId,
            eventId: event.id,
            ticketQuantity,
            price: event.price,
            totalPrice,
            status: "WAITING_FOR_PAYMENT",
            usedPoint: pointsToUse,
            usedVoucherId: voucherId,
            usedCouponId: couponId,
          },
          include: {
            event: { select: { name: true } },
          },
        });

        // Kurangi points yang digunakan
        if (pointsToUse > 0) {
          let remainingPoints = pointsToUse;
          const userPoints = await tx.point.findMany({
            where: {
              userId,
              isExpired: false,
              expiredAt: { gte: new Date() },
            },
            orderBy: { expiredAt: "asc" },
          });

          for (const point of userPoints) {
            if (remainingPoints <= 0) break;

            const deduction = Math.min(remainingPoints, point.amount);
            await tx.point.update({
              where: { id: point.id },
              data: { amount: { decrement: deduction } },
            });

            remainingPoints -= deduction;
          }
        }

        // Mark coupon as used
        if (couponId) {
          await tx.coupon.update({
            where: { id: couponId },
            data: { isUsed: true },
          });
        }

        return transaction;
      }
    );

    res.status(201).json(newTransaction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to process checkout" });
  }
}

// Endpoint untuk mendapatkan informasi user (points, coupons) untuk checkout
export async function getCheckoutInfo(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { eventId } = req.query;

    // Get user's available points
    const points = await prisma.point.findMany({
      where: {
        userId,
        isExpired: false,
        expiredAt: { gte: new Date() },
      },
    });

    const totalPoints = points.reduce((sum, p) => sum + p.amount, 0);

    // Get user's available coupons
    const coupons = await prisma.coupon.findMany({
      where: {
        userId,
        isUsed: false,
        expiredAt: { gte: new Date() },
      },
    });

    // Get event vouchers if eventId is provided
    let vouchers = [];
    if (eventId) {
      vouchers = await prisma.voucher.findMany({
        where: {
          eventId: Number(eventId),
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });
    }

    res.json({
      totalPoints,
      coupons,
      vouchers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get checkout info" });
  }
}

export async function createTransaction(req: Request, res: Response) {
  try {
    const {
      eventId,
      ticketQuantity,
      price,
      totalPrice,
      usedPoint,
      usedCouponId,
    } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!eventId || !ticketQuantity || !price || totalPrice === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.remainingSeats < ticketQuantity)
      return res.status(400).json({ message: "Not enough seats left" });

    // Validate points if used
    if (usedPoint && usedPoint > 0) {
      const userPoints = await prisma.point.findMany({
        where: {
          userId,
          isExpired: false,
          expiredAt: { gt: new Date() },
        },
      });

      const totalAvailablePoints = userPoints.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      if (usedPoint > totalAvailablePoints) {
        return res.status(400).json({ message: "Insufficient points" });
      }
    }

    // Validate coupon if used
    if (usedCouponId) {
      const coupon = await prisma.coupon.findFirst({
        where: {
          id: Number(usedCouponId),
          userId,
          isUsed: false,
          expiredAt: { gt: new Date() },
        },
      });

      if (!coupon) {
        return res.status(400).json({ message: "Invalid or expired coupon" });
      }
    }

    const newTransaction = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Decrement event seats
        await tx.event.update({
          where: { id: event.id },
          data: { remainingSeats: { decrement: ticketQuantity } },
        });

        // Deduct points if used (FIFO - First In First Out, oldest expiry first)
        if (usedPoint && usedPoint > 0) {
          let remainingToDeduct = usedPoint;

          const pointRecords = await tx.point.findMany({
            where: {
              userId,
              isExpired: false,
              expiredAt: { gt: new Date() },
            },
            orderBy: { expiredAt: "asc" }, // Oldest expiry first
          });

          for (const pointRecord of pointRecords) {
            if (remainingToDeduct <= 0) break;

            const deductAmount = Math.min(
              pointRecord.amount,
              remainingToDeduct
            );

            await tx.point.update({
              where: { id: pointRecord.id },
              data: { amount: { decrement: deductAmount } },
            });

            remainingToDeduct -= deductAmount;

            // Delete point record if amount becomes 0
            if (pointRecord.amount - deductAmount === 0) {
              await tx.point.delete({ where: { id: pointRecord.id } });
            }
          }
        }

        // Mark coupon as used
        if (usedCouponId) {
          await tx.coupon.update({
            where: { id: Number(usedCouponId) },
            data: { isUsed: true },
          });
        }

        // Create transaction
        const transaction = await tx.transaction.create({
          data: {
            userId,
            eventId: event.id,
            ticketQuantity,
            price,
            totalPrice,
            status: "WAITING_FOR_PAYMENT",
            usedPoint: usedPoint || 0,
            usedCouponId: usedCouponId ? Number(usedCouponId) : null,
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
      where: {
        status: "WAITING_FOR_ADMIN_CONFIRMATION",
        // Filter supaya hanya transaksi event milik organizer yang login
        // event: { organizerId: req.user.id },
      },
      select: {
        id: true,
        ticketQuantity: true,
        totalPrice: true,
        status: true,
        paymentProof: true,
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
      },
      orderBy: { createdAt: "desc" },
    });

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
