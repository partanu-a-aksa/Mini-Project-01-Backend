import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export async function getAllEvents(req: Request, res: Response) {
  try {
    const organizerId = req.user?.id;
    const allEvents = await prisma.event.findMany({
      where: { organizerId },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        location: true,
        paid: true,
        price: true,
        startDate: true,
        endDate: true,
        totalSeats: true,
        remainingSeats: true,
      },
    });

    res.status(200).json({ message: "All events listed." });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log("Error.");
      res.status(500).json({
        message: "Error on get All Events data.",
        error: error.message,
      });
    }
  }
}
