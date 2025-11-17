import z from "zod";

export const ingredientsSchema = z.object({
  name: z.string(),
  slug: z.string(),
  defaultUnit: z.string(),
  userIngredientId: z.number(),
});
