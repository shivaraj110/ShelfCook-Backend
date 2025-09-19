import express from "express";
import cors from "cors";
import { type Response, type Request } from "express";
import { verifyAuthToken } from "../../middlewares/user";
import { prisma } from "../../../lib/db";
import {
  verifyAuthor,
  verifyRecipe,
  verifyUpdateRecipe,
} from "../../middlewares/recipe";

const app = express();

app.use(express.json());
app.use(cors());

app.post(
  "/",
  verifyAuthToken,
  verifyRecipe,
  async (req: Request, res: Response) => {
    try {
      const recipe = await prisma.userRecipes.create({
        data: req.body,
      });
      if (!recipe) {
        return res.status(400).json({ message: "error creating recipe" });
      }
      res.status(201).json({ message: "recipe created successfully" });
    } catch (err) {
      console.log("error ", err);
    }
  },
);

app.put(
  "/",
  verifyAuthToken,
  verifyUpdateRecipe,
  verifyAuthor,
  async (req: Request, res: Response) => {
    const { id, userId, ...update } = req.body;
    try {
      const updatedRecipe = await prisma.userRecipes.update({
        where: {
          id: req.body.id,
        },
        data: update,
      });
      if (!updatedRecipe) {
        return res.status(400).json({ message: "error updating recipe" });
      }
      res.status(200).json({ message: "recipe updated successfully" });
    } catch (err) {
      console.log("error", err);
    }
  },
);
export default app;
