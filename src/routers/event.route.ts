import { Router } from "express";
import { getAllEvents } from "../controller/organizer.controller.js";
import {
  getEventById,
  getEventsByOrganizer,
  updateEvent,
} from "../controller/event.controller.js";

const router = Router();

router.route("/all").get(getAllEvents);
router.route("/organizer/:organizerId").get(getEventsByOrganizer);
router.route("/:eventId").get(getEventById).patch(updateEvent);

export default router;
