import type { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export async function getStatistics(req: Request, res: Response) {
  try {
    const organizerId = (req as any).user?.id;

    if (!organizerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 1. Total Attendees & Total Sales (sudah ada)
    const salesData = await prisma.transaction.aggregate({
      _sum: {
        ticketQuantity: true,
        totalPrice: true,
      },
      where: {
        status: "DONE",
        event: { organizerId },
      },
    });

    // 2. Total Events
    const totalEvents = await prisma.event.count({
      where: { organizerId },
    });

    // 3. Active Events (event yang belum selesai)
    const activeEvents = await prisma.event.count({
      where: {
        organizerId,
        endDate: { gte: new Date() },
      },
    });

    // 4. Pending Transactions
    const pendingTransactions = await prisma.transaction.count({
      where: {
        event: { organizerId },
        status: "WAITING_FOR_ADMIN_CONFIRMATION",
      },
    });

    // 5. Event List dengan Statistik
    const eventStats = await prisma.event.findMany({
      where: { organizerId },
      select: {
        id: true,
        name: true,
        totalSeats: true,
        remainingSeats: true,
        price: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            transactions: {
              where: { status: "DONE" },
            },
          },
        },
        transactions: {
          where: { status: "DONE" },
          select: {
            totalPrice: true,
            ticketQuantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10, // ambil 10 event terakhir
    });

    // Hitung revenue dan attendees per event
    const eventsWithStats = eventStats.map((event) => {
      const revenue = event.transactions.reduce(
        (sum, t) => sum + t.totalPrice,
        0
      );
      const attendees = event.transactions.reduce(
        (sum, t) => sum + t.ticketQuantity,
        0
      );

      return {
        id: event.id,
        name: event.name,
        totalSeats: event.totalSeats,
        remainingSeats: event.remainingSeats,
        soldSeats: event.totalSeats - event.remainingSeats,
        attendees,
        revenue,
        startDate: event.startDate,
        endDate: event.endDate,
      };
    });

    res.json({
      overview: {
        totalEvents,
        activeEvents,
        totalAttendees: salesData._sum.ticketQuantity || 0,
        totalRevenue: salesData._sum.totalPrice || 0,
        pendingTransactions,
      },
      eventStats: eventsWithStats,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
