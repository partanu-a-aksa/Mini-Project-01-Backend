import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function getAllUsers(req: Request, res: Response) {
  try {
    const allUsers = await prisma.user.findMany();

    res.status(200).json({ allUsers });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log("Error.");
      res
        .status(500)
        .json({ message: "Error on get All user data.", error: error.message });
    }
  }
}

//ini utk ambil current login session, pke di dasbor
export async function getMe(req: Request, res: Response) {
  try {
    const token = req.cookies.authToken;
    if (!req.cookies.authToken) {
      return res.status(200).json({ user: null });
    }
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized. No token provided." });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      email: string;
      fullName: string;
      role: string;
    };
    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        profilePicture: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res
      .status(200)
      .json({ message: "Succesfully fetching user.", user });
  } catch (error) {
    console.error("Error fetching current user: ", error);
    res.status(500).json({ message: "Server Error.", error });
  }
}

export async function updateUserProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { fullName, email, oldPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    //ganti pasword
    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect old password" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    }

    //update data user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName && fullName.trim() !== "" ? fullName : user.fullName,
        email: email && email.trim() !== "" ? email : user.email,
      },
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        // profilePicture: updatedUser.profilePicture,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getUserPoints(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = new Date();

    // Get all non-expired points
    const points = await prisma.point.findMany({
      where: {
        userId,
        isExpired: false,
        expiredAt: {
          gt: now,
        },
      },
      orderBy: {
        expiredAt: "asc", // Closest to expiry
      },
    });

    // Calculate total points
    const totalPoints = points.reduce((sum, point) => sum + point.amount, 0);

    res.status(200).json({
      totalPoints,
      points: points.map((p) => ({
        id: p.id,
        amount: p.amount,
        source: p.source,
        expiredAt: p.expiredAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching user points:", error);
    res.status(500).json({ message: "Failed to fetch points" });
  }
}

export async function getUserCoupons(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = new Date();

    // Get all non-expired and unused coupons
    const coupons = await prisma.coupon.findMany({
      where: {
        userId,
        isUsed: false,
        expiredAt: {
          gt: now, // Not expired yet
        },
      },
      orderBy: {
        expiredAt: "asc", // Closest to expiry first
      },
    });

    res.status(200).json(
      coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discountAmount: c.discountAmount,
        expiredAt: c.expiredAt,
        createdAt: c.createdAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching user coupons:", error);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
}

export async function getEventVouchers(req: Request, res: Response) {
  try {
    const { eventId } = req.params;

    const now = new Date();

    // Get all active vouchers for the event
    const vouchers = await prisma.voucher.findMany({
      where: {
        eventId: Number(eventId),
        isActive: true,
        startDate: {
          lte: now, // Start date is before or equal to now
        },
        endDate: {
          gte: now, // End date is after or equal to now
        },
      },
    });

    res.status(200).json(
      vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        discountAmount: v.discountAmount,
        discountType: v.discountType,
        startDate: v.startDate,
        endDate: v.endDate,
      }))
    );
  } catch (error) {
    console.error("Error fetching event vouchers:", error);
    res.status(500).json({ message: "Failed to fetch vouchers" });
  }
}
