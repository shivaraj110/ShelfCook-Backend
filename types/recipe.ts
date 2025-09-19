import z from "zod";
export const recipeSchema = z.object({
  userId: z.string(),
  recipeName: z.string(),
  servings: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  procedure: z.string(),
  estimatedTime: z.string(),
  calories: z.string(),
  nutritionalInfo: z.object({
    fat: z.string(),
    carbohydrates: z.string(),
    protein: z.string(),
  }),
  vegan: z.boolean(),
  categories: z.array(z.string()),
});

export const updateRecipeSchema = z.object({
  id: z.number(),
  recipeName: z.string().optional(),
  servings: z.string().optional(),
  description: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  procedure: z.string().optional(),
  estimatedTime: z.string().optional(),
  calories: z.string().optional(),
  nutritionalInfo: z
    .object({
      fat: z.string(),
      carbohydrates: z.string(),
      protein: z.string(),
    })
    .optional(),
  vegan: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
});
