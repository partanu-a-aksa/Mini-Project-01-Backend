import { Router } from "express";
import { roleGuard, verifyToken } from "../middleware/auth.middleware.js";
import { getAllUsers, getMe } from "../controller/user.controller.js";

const router = Router();

router.route("/").get(verifyToken, roleGuard("ORGANIZER"), getAllUsers);
router.route("/me").get(getMe);

export default router;
