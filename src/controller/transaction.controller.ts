import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import type { Request, Response } from "express";

const prisma = new PrismaClient();

export const createTransaction = async (req: Request, res: Response) => {
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
};
