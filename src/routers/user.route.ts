import { Router } from "express";
import { roleGuard, verifyToken } from "../middleware/auth.middleware.js";
import {
  getAllUsers,
  getEventVouchers,
  getMe,
  getUserCoupons,
  getUserPoints,
  updateUserProfile,
} from "../controller/user.controller.js";

const router = Router();

router.route("/").get(verifyToken, roleGuard("ORGANIZER"), getAllUsers);

router.route("/me").get(verifyToken, getMe);
router.route("/me").put(verifyToken, updateUserProfile);

router.route("/points").get(verifyToken, getUserPoints);
router.route("/coupons").get(verifyToken, getUserCoupons);
router.route("/vouchers/:eventId").get(verifyToken, getEventVouchers);

export default router;
