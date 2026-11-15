import { z } from "zod";

export const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "undisclosed", label: "Prefer not to say" },
] as const;

export const registrationSchema = z.object({
  displayName: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Enter your name").max(60, "Keep it under 60 characters")),
  age: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.trim())) : v),
    z
    .number({ error: "Enter your age" })
    .int("Whole years only")
    .min(13, "Members must be 13 or older")
    .max(100, "Enter a valid age"),
  ),
  sex: z.enum(["male", "female", "undisclosed"], { error: "Choose an option" }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const profileUpdateSchema = registrationSchema;
