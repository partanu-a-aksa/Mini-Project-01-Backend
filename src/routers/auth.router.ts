import { Router } from "express";
import { registerUser } from "../controller/auth.controller.js";

const route: Router = Router();

route.post("/regis", registerUser);
// route.post("/login", login);

export default route;
