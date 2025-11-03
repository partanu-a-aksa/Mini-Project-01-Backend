import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, role, referralCode } = req.body;

    const parsedData = registerSchema.parse({
      fullName,
      email,
      password,
      role,
      referralCode,
    });

    const hashedPass = await bcrypt.hash(parsedData.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const newReferralCode = crypto.randomUUID().slice(0, 8);

      let referrer = null;
      if (parsedData.referralCode?.trim()) {
        referrer = await tx.user.findUnique({
          where: { referralCode: parsedData.referralCode },
        });
        if (!referrer) throw new Error("Invalid referral code.");
      }

      const newUser = await tx.user.create({
        data: {
          fullName: parsedData.fullName,
          email: parsedData.email,
          password: hashedPass,
          role: parsedData.role,
          referralCode: newReferralCode,
        },
      });

      if (referrer) {
        await tx.referralLog.create({
          data: {
            referredById: referrer.id,
            referralUsedId: newUser.id,
          },
        });
        await tx.point.create({
          data: {
            userId: referrer?.id,
            amount: 10000,
            source: "REFERRAL",
            expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // expired poin 3 bulaneun
          },
        });
      }

      return newUser;
    });
    res.status(201).json({
      message: "User registered succesfully.",
      user: result,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to register user.",
    });
  }
};

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const parsedData = loginSchema.parse({ email, password });
    const existingUser = await prisma.user.findUnique({
      where: { email: parsedData.email },
    });

    if (!existingUser) {
      return res.status(400).json({ message: "User not found." });
    }

    // pulici passwor
    const isValidPass = await bcrypt.compare(
      parsedData.password,
      existingUser.password
    );
    if (!isValidPass) {
      return res.status(400).json({ message: "Invalid Email or Password." });
    }

    const authToken = jwt.sign(
      {
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName,
        role: existingUser.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "2h" }
    );

    res
      .status(200)
      .cookie("authToken", authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 2 * 60 * 60 * 1000,
      })
      .json({
        message: "Succesfully Logged in.",
        role: existingUser.role,
        user: {
          fullName: existingUser.fullName,
          email: existingUser.email,
          role: existingUser.role,
        },
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Login Failed" });
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  res.status(200).json({ message: "You`re Logged out." });
}

export async function switchRole(req: Request, res: Response) {
  try {
    const token = req.cookies.authToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized Access." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      email: string;
      fullName: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newRole = user.role === "ATTENDEE" ? "ORGANIZER" : "ATTENDEE";

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: newRole },
    });

    const newToken = jwt.sign(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "2h" }
    );

    res
      .cookie("authToken", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 2 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        message: `Role switched to ${updatedUser.role}`,
        role: updatedUser.role,
      });
  } catch (error) {
    res.status(500).json({ message: "Failed to update role." });
  }
}
