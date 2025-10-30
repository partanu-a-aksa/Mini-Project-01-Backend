import express from "express";
import {
  login,
  logout,
  registerUser,
  switchRole,
} from "../controller/auth.controller.js";

const router = express.Router();

router.route("/regis").post(registerUser);
router.route("/login").post(login);
router.route("/logout").post(logout);
router.route("/switch-role").post(switchRole);

export default router;
