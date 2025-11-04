import type { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export async function getStatistics(req: Request, res: Response) {
  try {
    const organizerId = req.user?.id;

    if (!organizerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: organizerId },
      select: { role: true },
    });

    if (!user || user.role !== "ORGANIZER") {
      return res
        .status(403)
        .json({ message: "Only organizers can view statistics" });
    }

    const result = await prisma.transaction.aggregate({
      _sum: {
        ticketQuantity: true,
        totalPrice: true,
      },
      where: {
        status: "DONE",
        event: { organizerId: organizerId },
      },
    });

    res.json({
      totalAttendees: result._sum.ticketQuantity || 0,
      totalSales: result._sum.totalPrice || 0,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
