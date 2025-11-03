import { Router } from "express";
import {
  getEventById,
  getEventsByOrganizer,
  getOngoingEvents,
  updateEvent,
} from "../controller/event.controller.js";

const router = Router();

router.route("/ongoing").get(getOngoingEvents);
router.route("/organizer/:organizerId").get(getEventsByOrganizer);
router.route("/:eventId").get(getEventById).patch(updateEvent);

export default router;
