import { z } from "zod";
import interests from "../data/interests.json";
export const cities = [
  "Tokyo",
  "Kyoto",
  "Osaka",
  "Dubai",
  "Abu Dhabi",
] as const;
const date = z
  .string()
  .refine(
    (value) =>
      /^2027-04-\d{2}$/.test(value) &&
      value >= "2027-04-01" &&
      value <= "2027-04-20",
    "Choose a date between 1 and 20 April 2027",
  );
const interestIds = new Set(interests.map((i) => i.interest));
export const searchSchema = z
  .object({
    city: z.enum(cities),
    check_in: date,
    check_out: date,
    budget_inr: z
      .number()
      .int()
      .min(1, "Enter a budget greater than ₹0")
      .max(10000000, "Enter a budget below ₹1 crore"),
    interests: z
      .array(z.string().refine((value) => interestIds.has(value)))
      .min(2, "Choose at least two interests"),
    gender_preference: z.enum(["ANY", "SAME_GENDER"]),
  })
  .refine((value) => value.check_out > value.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });
