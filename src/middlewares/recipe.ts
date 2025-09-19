import { type NextFunction, type Response, type Request } from "express";
import { recipeSchema, updateRecipeSchema } from "../../types/recipe";
import { prisma } from "../../lib/db";
export const verifyRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const verifiedPayload = recipeSchema.safeParse(req.body);
  if (!verifiedPayload.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }
  req.body = verifiedPayload.data;
  next();
};

export const verifyAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { userId, id } = req.body;
  const recipe = await prisma.userRecipes.findFirst({
    where: {
      id,
      userId: userId,
    },
  });
  if (!recipe) {
    return res.status(400).json({
      message: "You can't change this recipe because you didn't create it",
    });
  }
  next();
};

export const verifyUpdateRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const verifiedPayload = updateRecipeSchema.safeParse(req.body);
  if (!verifiedPayload.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }
  req.body = verifiedPayload.data;
  next();
};
