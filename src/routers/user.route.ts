import { Router } from "express";
import { roleGuard, verifyToken } from "../middleware/auth.middleware.js";
import {
  getAllUsers,
  getMe,
  updateUserProfile,
} from "../controller/user.controller.js";

const router = Router();

router.route("/").get(verifyToken, roleGuard("ORGANIZER"), getAllUsers);

router.route("/me").get(verifyToken, getMe);
router.route("/me").put(verifyToken, updateUserProfile);

export default router;
