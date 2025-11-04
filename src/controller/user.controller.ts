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
    return res.status(200).json({ message: "Succesfully fetching user." });
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
