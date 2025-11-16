import express from "express";
import cors from "cors";
import { type Response, type Request } from "express";
import { verifyAuthToken } from "../../middlewares/user";
import { prisma } from "../../../lib/db";

const app = express();

app.use(express.json());
app.use(cors());

app.post("/vegetable", verifyAuthToken, async (req: Request, res: Response) => {
  const ingredient = await prisma.vegetable.create({
    data: req.body,
  });
});

export default app;
