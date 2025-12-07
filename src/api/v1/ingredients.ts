import express from "express";
import cors from "cors";
import { type Response, type Request } from "express";
import { verifyAuthToken } from "../../middlewares/user";
import { prisma } from "../../../lib/db";

const app = express();

app.use(express.json());
app.use(cors());

const getModel = (type: string) => {
  const models: Record<string, any> = {
    vegetable: prisma.vegetable,
    fruit: prisma.fruit,
    meat: prisma.meat,
    plantBasedProtein: prisma.plantBasedProtein,
    dairyEgg: prisma.dairyEgg,
    grainCereal: prisma.grainCereal,
    pastaNoodleBread: prisma.pastaNoodleBread,
    pulseLegume: prisma.pulseLegume,
    oilFat: prisma.oilFat,
    spiceMasala: prisma.spiceMasala,
    condimentSauce: prisma.condimentSauce,
    cannedJarGood: prisma.cannedJarGood,
    sweetener: prisma.sweetener,
    snackMisc: prisma.snackMisc,
    frozenItem: prisma.frozenItem,
    herbAromatic: prisma.herbAromatic,
  };
  return models[type];
};

app.post("/:type", verifyAuthToken, async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const model = getModel(type);

    if (!model) {
      return res.status(400).json({ message: "Invalid ingredient type" });
    }

    const ingredientData = req.body;
    const ingredient = await model.create({
      data: ingredientData,
    });

    res.status(201).json({
      status: "success",
      message: `${type} created successfully`,
      data: ingredient,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to create ingredient",
    });
  }
});

app.post("/:type/bulk", verifyAuthToken, async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const model = getModel(type);

    if (!model) {
      return res.status(400).json({ message: "Invalid ingredient type" });
    }

    const ingredientsData = req.body;

    if (!Array.isArray(ingredientsData)) {
      return res.status(400).json({ message: "Body must be an array" });
    }

    const result = await model.createMany({
      data: ingredientsData,
      skipDuplicates: true,
    });

    res.status(201).json({
      status: "success",
      message: `${type} items created successfully`,
      count: result.count,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to create ingredients",
    });
  }
});

app.get("/:type", async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const model = getModel(type);

    if (!model) {
      return res.status(400).json({ message: "Invalid ingredient type" });
    }

    const { userIngredientId, slug, search } = req.query;
    
    const where: any = {};
    
    if (userIngredientId) {
      where.userIngredientId = parseInt(userIngredientId as string);
    }
    
    if (slug) {
      where.slug = slug as string;
    }
    
    if (search) {
      where.name = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const ingredients = await model.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    res.status(200).json({
      status: "success",
      count: ingredients.length,
      data: ingredients,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch ingredients",
    });
  }
});

app.get("/:type/:id", async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const model = getModel(type);

    if (!model) {
      return res.status(400).json({ message: "Invalid ingredient type" });
    }

    const ingredient = await model.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ingredient) {
      return res.status(404).json({
        status: "error",
        message: "Ingredient not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: ingredient,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch ingredient",
    });
  }
});

app.put("/:type/:id", verifyAuthToken, async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const model = getModel(type);

    if (!model) {
      return res.status(400).json({ message: "Invalid ingredient type" });
    }

    const updateData = req.body;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const ingredient = await model.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.status(200).json({
      status: "success",
      message: `${type} updated successfully`,
      data: ingredient,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        status: "error",
        message: "Ingredient not found",
      });
    }
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to update ingredient",
    });
  }
});

app.delete("/:type/:id", verifyAuthToken, async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const model = getModel(type);

    if (!model) {
      return res.status(400).json({ message: "Invalid ingredient type" });
    }

    await model.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      status: "success",
      message: `${type} deleted successfully`,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        status: "error",
        message: "Ingredient not found",
      });
    }
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete ingredient",
    });
  }
});

app.get("/", async (req: Request, res: Response) => {
  try {
    const { userIngredientId } = req.query;
    
    const where = userIngredientId 
      ? { userIngredientId: parseInt(userIngredientId as string) }
      : {};

    const allIngredients = await Promise.all([
      prisma.vegetable.findMany({ where }),
      prisma.fruit.findMany({ where }),
      prisma.meat.findMany({ where }),
      prisma.plantBasedProtein.findMany({ where }),
      prisma.dairyEgg.findMany({ where }),
      prisma.grainCereal.findMany({ where }),
      prisma.pastaNoodleBread.findMany({ where }),
      prisma.pulseLegume.findMany({ where }),
      prisma.oilFat.findMany({ where }),
      prisma.spiceMasala.findMany({ where }),
      prisma.condimentSauce.findMany({ where }),
      prisma.cannedJarGood.findMany({ where }),
      prisma.sweetener.findMany({ where }),
      prisma.snackMisc.findMany({ where }),
      prisma.frozenItem.findMany({ where }),
      prisma.herbAromatic.findMany({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        vegetable: allIngredients[0],
        fruit: allIngredients[1],
        meat: allIngredients[2],
        plantBasedProtein: allIngredients[3],
        dairyEgg: allIngredients[4],
        grainCereal: allIngredients[5],
        pastaNoodleBread: allIngredients[6],
        pulseLegume: allIngredients[7],
        oilFat: allIngredients[8],
        spiceMasala: allIngredients[9],
        condimentSauce: allIngredients[10],
        cannedJarGood: allIngredients[11],
        sweetener: allIngredients[12],
        snackMisc: allIngredients[13],
        frozenItem: allIngredients[14],
        herbAromatic: allIngredients[15],
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch all ingredients",
    });
  }
});

export default app;
