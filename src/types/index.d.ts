import jwt, { type JwtPayload } from "jsonwebtoken";

export interface ExtendedJWTPayload extends JwtPayload {
  name: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: ExtendedJWTPayload | null;
    }
  }
}
