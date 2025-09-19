import express from "express";
import cors from "cors";
import user from "./user";
import recipe from "./recipe";
const app = express();

app.use(express.json());
app.use("/user", user);
app.use("/recipe", recipe);
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from api/v1");
});

export default app;
