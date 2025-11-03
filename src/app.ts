import dotenv from "dotenv";
dotenv.config();
import express, { response, type Application } from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRoutes from "./routers/auth.router.js";
import userRoutes from "./routers/user.route.js";
import eventRoutes from "./routers/event.route.js";
import cookieParser from "cookie-parser";

const PORT = process.env.PORT;
const app: Application = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
// app.use(cors({credentials: true}));
app.use(express.json());
app.use(cookieParser());

app.get("/status", (req: Request, res: Response) => {
  res.status(200).send("<h1>API Running.</h1>");
});

app.use("/users", userRoutes);
app.use("/auth", authRoutes);
app.use("/event", eventRoutes);

app.listen(PORT, () => {
  console.log(`API Running at http://localhost:${PORT} `);
});
