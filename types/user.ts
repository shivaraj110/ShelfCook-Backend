import z from "zod";
export const signUpSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  userId: z.string(),
  email: z.email(),
  password: z.string().min(8),
});
