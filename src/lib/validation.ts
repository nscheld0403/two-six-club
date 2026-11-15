import { z } from "zod";
import { ageOn } from "@/lib/birthday";

export const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "undisclosed", label: "Prefer not to say" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

export const birthDateSchema = z
  .string({ error: "Enter your birthday" })
  .trim()
  .min(1, "Enter your birthday")
  .pipe(z.iso.date({ error: "Enter a valid date" }))
  .refine((d) => d <= today(), "Birthday can't be in the future")
  .refine((d) => ageOn(d, today()) >= 13, "Members must be 13 or older")
  .refine((d) => ageOn(d, today()) <= 100, "Enter a valid birthday");

export const registrationSchema = z.object({
  displayName: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Enter your name").max(60, "Keep it under 60 characters")),
  birthDate: birthDateSchema,
  sex: z.enum(["male", "female", "undisclosed"], { error: "Choose an option" }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const profileUpdateSchema = registrationSchema;
