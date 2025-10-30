import { type Request, type Response, type NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { ExtendedJWTPayload } from "../types/index.js";

//cek token
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authToken =
      req.cookies.authToken || req.headers.authorization?.split(" ")[1];
    console.log(authToken); //cek

    if (!authToken) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." });
    }

    const user = jwt.verify(
      authToken,
      process.env.JWT_SECRET as string
    ) as ExtendedJWTPayload;

    req.user = user;
    next();
  } catch (error) {
    console.log(`JWT verification failed ${error}`);
    res.status(403).json({ message: "Invalid or Expired token." });
  }
}

export function roleGuard(...allowedRoles: string[]) {
  return (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(401).json({ message: "Unauthenticated Access." });
      }

      if (!allowedRoles) {
        return res.status(403).json({ message: "Unauthorized Access" });
      }
    } catch (error) {
      console.log(`Role Guard failed: ${error}`);
    }
  };
}
