import type { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export async function getOngoingEvents(req: Request, res: Response) {
  try {
    const events = await prisma.event.findMany();

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error(error);
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

    // Validasi ID numerik (karena model Event.id adalah Int)
    if (!eventId || isNaN(Number(eventId))) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Ambil event beserta data organizer
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
      },
    });

    // Jika tidak ditemukan
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Response sukses
    return res.status(200).json({
      message: "Success get event by ID",
      event,
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
  const { eventId } = req.params;
  const data = req.body;
  const event = await prisma.event.update({
    where: { id: Number(eventId) },
    data,
  });
  res.status(200).json({ message: "Event updated.", event });
}
