import type { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export async function getOngoingEvents(req: Request, res: Response) {
  try {
    const { search, category, page = "1", limit = "10" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const whereConditions: any = {
      AND: [],
    };

    if (search && search !== "") {
      whereConditions.AND.push({
        OR: [
          { name: { contains: search as string, mode: "insensitive" } },
          { location: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ],
      });
    }

    if (category && category !== "") {
      whereConditions.AND.push({
        category: category as any, // FESTIVAL, MUSIC, ART, EDUCATION
      });
    }

    const where = whereConditions.AND.length > 0 ? whereConditions : {};

    // Get total count for pagination
    const total = await prisma.event.count({ where });

    // Fetch events with pagination
    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
      skip,
      take: limitNum,
    });

    res.json({
      success: true,
      data: events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching events.",
    });
  }
}

export async function getEventsByOrganizer(req: Request, res: Response) {
  try {
    const { organizerId } = req.params;

    if (!organizerId) {
      return res.status(400).json({ message: "Organizer ID is required" });
    }

    const organizer = await prisma.user.findUnique({
      where: { id: organizerId },
      select: { id: true, role: true },
    });

    if (!organizer || organizer.role !== "ORGANIZER") {
      return res.status(404).json({ message: "Organizer not found" });
    }

    const events = await prisma.event.findMany({
      where: { organizerId },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      message: "Success get events by organizer",
      organizerId,
      organizerEvents: events,
    });
  } catch (error) {
    console.error("Error fetching events by organizer:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: (error as Error).message,
    });
  }
}

export async function getEventById(req: Request, res: Response) {
  try {
    const { eventId } = req.params;

    if (!eventId || isNaN(Number(eventId))) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      include: {
        organizer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profilePicture: true,
          },
        },
        reviews: {
          include: {
            transaction: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    profilePicture: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Hitung average rating
    const averageRating =
      event.reviews.length > 0
        ? event.reviews.reduce((sum, review) => sum + review.rating, 0) /
          event.reviews.length
        : 0;

    return res.status(200).json({
      message: "Success get event by ID",
      event: {
        ...event,
        averageRating: Number(averageRating.toFixed(1)),
        totalReviews: event.reviews.length,
      },
    });
  } catch (error) {
    console.error("Error fetching event by ID:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: (error as Error).message,
    });
  }
}

export async function updateEvent(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const data = req.body;

    if (!eventId || isNaN(Number(eventId))) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await prisma.event.update({
      where: { id: Number(eventId) },
      data,
    });

    res.status(200).json({ message: "Event updated.", event });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({
      message: "Internal server error",
      error: (error as Error).message,
    });
  }
}
