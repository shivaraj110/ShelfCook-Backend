import { type NextFunction, type Response, type Request } from "express";
import { loginSchema, signUpSchema } from "../../types/user";
import { prisma } from "../../lib/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const isValidPassword = async (password: string, hash: string) => {
  const result = await bcrypt.compare(password, hash);
  return result;
};

export const verifySignUpPayload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsedSchema = signUpSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  req.body = parsedSchema.data;

  next();
};

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsedSchema = loginSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: parsedSchema.data.email,
    },
  });
  if (!user) {
    return res.status(400).json({ message: "user does not exist" });
  }
  if (!(await isValidPassword(parsedSchema.data.password, user.password))) {
    return res.status(400).json({ message: "invalid password" });
  }
  req.body.userId = user.id;
  next();
};

export const verifyAuthToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers?.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
    userId: string;
    password: string;
  };
  if (!decoded.userId) {
    return res.status(401).json({ message: "Unauthorized access", decoded });
  }

  const verifiedUser = await prisma.user.findFirst({
    where: {
      id: decoded.userId,
    },
  });

  if (!verifiedUser) {
    return res.status(401).json({ message: "Unauthorized access" });
  }
  req.body.userId = verifiedUser.id;
  next();
};
