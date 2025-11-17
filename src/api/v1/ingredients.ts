import express from "express";
import cors from "cors";
import { type Response, type Request } from "express";
import { verifyAuthToken } from "../../middlewares/user";
import { prisma } from "../../../lib/db";

const app = express();

app.use(express.json());
app.use(cors());

app.post("/vegetable", verifyAuthToken, async (req: Request, res: Response) => {
  const vegetableIngredients = req.body;
  const ingredient = await prisma.vegetable.create({
    data: vegetableIngredients,
  });
  if (!ingredient) {
    return res.status(400).json({ message: "Failed to create ingredient" });
  }
  res.status(201).json({
    status: "success",
    message: "vegetable added successfully!",
  });
});

app.post(
  "/vegetables",
  verifyAuthToken,
  async (req: Request, res: Response) => {
    const vegetableIngredients = req.body;
    const ingredients = await prisma.vegetable.createMany({
      data: vegetableIngredients,
    });
    if (!ingredients) {
      return res.status(400).json({ message: "Failed to create ingredient" });
    }
    res.status(201).json({
      status: "success",
      message: "veggies added successfully!",
    });
  },
);

app.get("/vegetables", async (req: Request, res: Response) => {
  const vegetables = await prisma.vegetable.findMany({
    where: {
      userIngredientId: req.body.userIngredientId,
    },
  });
  if (!vegetables) {
    return res.status(400).json({ message: "Failed to get ingredients" });
  }
  res.status(200).json({
    vegetables,
  });
});

app.post("");

export default app;
