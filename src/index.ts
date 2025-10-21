import dotenv from "dotenv";
dotenv.config();
import express, { response, type Application } from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRouter from "./routers/auth.router.js";

const PORT = process.env.PORT;
const app: Application = express();

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.status(200).send("<h1>API Running.</h1>");
});

app.use("/auth", authRouter);

app.listen(PORT, () => {
  console.log(`API Running at http://localhost:${PORT} `);
});
