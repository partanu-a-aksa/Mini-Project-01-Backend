import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(1, "Fields required."),
});

export const registerSchema = z.object({
  fullName: z.string().min(3, "Name must be at least 2 characters."),
  email: z.email("Invalid email format."),
  password: z.string().min(6),
  role: z.enum(["ATTENDEE", "ORGANIZER"], {
    error: "Role is required or invalid role.",
  }),
  referralCode: z.string().optional(),
});
