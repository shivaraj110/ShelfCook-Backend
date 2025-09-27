import { GraphQLError } from "graphql";
import { prisma } from "../db";
import { RecipeWhereInput } from "@prisma/client";

// A robust function to extract clean, searchable ingredient names from messy strings.
function extractIngredientNames(ingredients: string[]): string[] {
  return ingredients
    .map((ingredient) => {
      let cleaned = ingredient.toLowerCase();
      cleaned = cleaned.replace(/\(.*?\)/g, "").split(",")[0]!;
      cleaned = cleaned
        .replace(/[\d½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, "")
        .replace(
          /\s*(g|kg|ml|l|oz|lb|tbsp|tsp|cup|cups|pinch|handful|clove|large|medium|small|can|cans)\s*/gi,
          " ",
        )
        .replace(/[*]/g, "");
      return cleaned.trim().replace(/\s+/g, " ");
    })
    .filter(Boolean);
}

// A single, reliable helper function to build the initial database query.
interface RecipeFilters {
  vegan?: boolean;
  categories?: string[];
}

function buildPrismaWhereClause(filters?: RecipeFilters): RecipeWhereInput {
  const conditions: RecipeWhereInput[] = [];
  if (filters) {
    if (typeof filters.vegan === "boolean") {
      conditions.push({ vegan: filters.vegan });
    }
    if (filters.categories && filters.categories.length > 0) {
      conditions.push({ categories: { hasSome: filters.categories } });
    }
  }
  return conditions.length > 0 ? { AND: conditions } : {};
}

// ==================================================================
//
// RESOLVER IMPLEMENTATION
//
// ==================================================================

export const resolvers = {
  Query: {
    // --- NEW: Resolver for all home screen data ---
    getHomeScreenData: async () => {
      try {
        // --- Recipe of the Day Logic ---
        const recipeCount = await prisma.recipe.count();
        const dayOfYear = Math.floor(
          (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const recipeOfTheDayIndex = dayOfYear % recipeCount;
        const recipeOfTheDay = await prisma.recipe.findFirst({
          skip: recipeOfTheDayIndex,
        });

        // --- Featured Recipes Logic ---
        const featuredRecipes = await prisma.recipe.findMany({
          take: 5,
          orderBy: { recipeName: "asc" }, // A simple, predictable order
        });

        // --- Popular Categories Logic ---
        const allRecipes = await prisma.recipe.findMany({
          select: { categories: true },
        });
        const categoryCounts = new Map<string, number>();
        for (const recipe of allRecipes) {
          for (const category of recipe.categories) {
            categoryCounts.set(
              category,
              (categoryCounts.get(category) || 0) + 1,
            );
          }
        }
        const popularCategories = [...categoryCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Get top 10
          .map((entry) => entry[0]);

        return {
          recipeOfTheDay,
          featuredRecipes,
          popularCategories,
        };
      } catch (error: any) {
        console.error("ERROR in getHomeScreenData:", error);
        throw new GraphQLError(
          `Failed to fetch home screen data: ${error.message}`,
        );
      }
    },

    findRecipesByCategories: async (
      _: any,
      {
        categories,
        filters,
      }: { categories: string[]; filters?: RecipeFilters },
    ) => {
      try {
        const baseWhere = buildPrismaWhereClause(filters);
        const finalWhere: RecipeWhereInput = {
          AND: [
            ...(baseWhere.AND || []),
            { categories: { hasSome: categories } },
          ],
        };
        return await prisma.recipe.findMany({ where: finalWhere });
      } catch (error: any) {
        console.error("ERROR in findRecipesByCategories:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },

    recipesWithExactIngredients: async (
      _: any,
      {
        availableIngredients,
        filters,
      }: { availableIngredients: string[]; filters?: RecipeFilters },
    ) => {
      try {
        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        const availableLower = availableIngredients.map((i) => i.toLowerCase());

        return candidateRecipes.filter((recipe) => {
          const required = extractIngredientNames(recipe.ingredients);
          if (required.length === 0) return false;
          return required.every((req) =>
            availableLower.some((avail) => req.includes(avail)),
          );
        });
      } catch (error: any) {
        console.error("ERROR in recipesWithExactIngredients:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },

    recipesByIngredientMatch: async (
      _: any,
      {
        availableIngredients,
        minMatchPercentage,
        filters,
      }: {
        availableIngredients: string[];
        minMatchPercentage: number;
        filters?: RecipeFilters;
      },
    ) => {
      try {
        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        const recipesWithScores = candidateRecipes.map((recipe) => {
          const required = extractIngredientNames(recipe.ingredients);
          if (required.length === 0) {
            return { recipe, matchPercentage: 0, missingIngredients: required };
          }
          const availableLower = availableIngredients.map((i) =>
            i.toLowerCase(),
          );
          const missing = required.filter(
            (req) => !availableLower.some((avail) => req.includes(avail)),
          );
          const matchingCount = required.length - missing.length;
          const matchPercentage = (matchingCount / required.length) * 100;

          return {
            recipe,
            matchPercentage: Math.round(matchPercentage),
            matchingIngredientsCount: matchingCount,
            totalIngredientsCount: required.length,
            missingIngredients: missing,
          };
        });

        return recipesWithScores
          .filter((r) => r.matchPercentage >= minMatchPercentage)
          .sort((a, b) => b.matchPercentage - a.matchPercentage);
      } catch (error: any) {
        console.error("ERROR in recipesByIngredientMatch:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },

    findRecipesByIngredientNames: async (
      _: any,
      {
        ingredientNames,
        filters,
      }: { ingredientNames: string[]; filters?: RecipeFilters },
    ) => {
      try {
        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        return candidateRecipes.filter((recipe) =>
          ingredientNames.every((name) => {
            const nameLower = name.toLowerCase();
            return extractIngredientNames(recipe.ingredients).some((ing) =>
              ing.includes(nameLower),
            );
          }),
        );
      } catch (error: any) {
        console.error("ERROR in findRecipesByIngredientNames:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },

    recipesWithFullTextSearch: async (
      _: any,
      {
        availableIngredients,
        filters,
      }: { availableIngredients: string[]; filters?: RecipeFilters },
    ) => {
      try {
        if (availableIngredients.length === 0) return [];
        const searchTerms = availableIngredients.join(" | ");
        const results: any[] = await prisma.$queryRaw`
					SELECT *, ts_rank(to_tsvector('english', array_to_string(ingredients, ' ')), plainto_tsquery('english', ${searchTerms})) as relevance_score
					FROM "Recipe"
					WHERE to_tsvector('english', array_to_string(ingredients, ' ')) @@ plainto_tsquery('english', ${searchTerms})
					LIMIT 100;
				`;
        const filteredResults = results.filter((recipe) => {
          const veganMatch = !filters?.vegan || recipe.vegan === filters.vegan;
          const categoryMatch =
            !filters?.categories ||
            filters.categories.some((cat) => recipe.categories.includes(cat));
          return veganMatch && categoryMatch;
        });
        return filteredResults.map((r) => ({
          recipe: r,
          relevanceScore: r.relevance_score,
        }));
      } catch (error: any) {
        console.error("ERROR in recipesWithFullTextSearch:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },

    recipesWithSmartMatching: async (
      _: any,
      {
        availableIngredients,
        minMatchPercentage,
        filters,
      }: {
        availableIngredients: string[];
        minMatchPercentage: number;
        filters?: RecipeFilters;
      },
    ) => {
      try {
        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });
        const ingredientMap: { [key: string]: string[] } = {
          onion: ["onions", "red onion", "white onion"],
          garlic: ["garlic cloves", "garlic paste"],
          tomato: ["tomatoes", "canned tomatoes"],
        };
        const expandedIngredients = availableIngredients.flatMap((ing) => [
          ing.toLowerCase(),
          ...(ingredientMap[ing.toLowerCase()] || []),
        ]);
        const recipesWithScores = candidateRecipes.map((recipe) => {
          const required = extractIngredientNames(recipe.ingredients);
          if (required.length === 0)
            return { recipe, matchPercentage: 0, missingIngredients: required };
          const missing = required.filter(
            (req) => !expandedIngredients.some((avail) => req.includes(avail)),
          );
          const matchingCount = required.length - missing.length;
          const matchPercentage = (matchingCount / required.length) * 100;
          return {
            recipe,
            matchPercentage: Math.round(matchPercentage),
            missingIngredients: missing,
          };
        });
        return recipesWithScores
          .filter((r) => r.matchPercentage >= minMatchPercentage)
          .sort((a, b) => b.matchPercentage - a.matchPercentage);
      } catch (error: any) {
        console.error("ERROR in recipesWithSmartMatching:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },

    quickRecipeSuggestions: async (
      _: any,
      {
        availableIngredients,
        limit,
        filters,
      }: {
        availableIngredients: string[];
        limit: number;
        filters?: RecipeFilters;
      },
    ) => {
      try {
        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });
        const availableLower = availableIngredients.map((i) => i.toLowerCase());
        return candidateRecipes
          .filter((recipe) =>
            extractIngredientNames(recipe.ingredients).some((ing) =>
              availableLower.some((avail) => ing.includes(avail)),
            ),
          )
          .slice(0, limit || 10);
      } catch (error: any) {
        console.error("ERROR in quickRecipeSuggestions:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },
  },

  Mutation: {
    createRecipe: async (_: any, { input }: { input: any }) => {
      try {
        return await prisma.recipe.create({ data: { ...input } });
      } catch (error: any) {
        console.error("ERROR in createRecipe:", error);
        throw new GraphQLError(`Failed to create recipe: ${error.message}`);
      }
    },
    updateRecipe: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        return await prisma.recipe.update({
          where: { id: parseInt(id) },
          data: { ...input },
        });
      } catch (error: any) {
        console.error("ERROR in updateRecipe:", error);
        throw new GraphQLError(
          `Recipe with ID ${id} not found or update failed: ${error.message}`,
        );
      }
    },
    deleteRecipe: async (_: any, { id }: { id: string }) => {
      try {
        return await prisma.recipe.delete({ where: { id: parseInt(id) } });
      } catch (error: any) {
        console.error("ERROR in deleteRecipe:", error);
        throw new GraphQLError(
          `Recipe with ID ${id} not found or delete failed: ${error.message}`,
        );
      }
    },
  },
};
