import type { Request, Response, NextFunction } from "express";
import prisma from "../prisma.js";

export const registerUser = async (req: Request, res: Response) => {
  try {
    await prisma.customer.create({
      data: {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
      },
    });

    res.status(200).send({
      message: "Registration Success",
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};
