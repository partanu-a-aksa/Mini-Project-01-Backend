import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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

export async function getMe(req: Request, res: Response) {
  try {
    const token = req.cookies.authToken;
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
        profilePic: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching current user: ", error);
    res.status(500).json({ message: "Server Error.", error });
  }
}
