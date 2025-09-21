import { GraphQLError } from "graphql";
import { prisma } from "../db";
import { Prisma, RecipeWhereInput } from "@prisma/client";

// A helper function to extract simplified ingredient names for matching logic.
function extractIngredientNames(ingredients: string[]): string[] {
  return ingredients
    .map((ingredient) => {
      const cleaned = ingredient
        .toLowerCase()
        .replace(
          /^\d+(\.\d+)?\s*(g|kg|ml|l|oz|lb|tbsp|tsp|cup|cups|pinch|handful|clove|large|medium|small)?\s*/i,
          "",
        )
        .replace(/\(.*?\)/g, "")
        .split(",")[0]
        .trim();
      return cleaned;
    })
    .filter(Boolean); // Filter out any empty strings
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
// A NEW, SIMPLIFIED, AND RELIABLE RESOLVER IMPLEMENTATION
//
// ==================================================================

export const resolvers = {
  Query: {
    findRecipesByCategories: async (
      _: any,
      {
        categories,
        filters,
      }: { categories: string[]; filters?: RecipeFilters },
    ) => {
      try {
        // Handle empty categories array
        if (!categories || categories.length === 0) {
          return [];
        }

        const baseWhere = buildPrismaWhereClause(filters);
        const finalWhere: RecipeWhereInput = {
          AND: [
            ...(Array.isArray(baseWhere.AND)
              ? baseWhere.AND
              : baseWhere.AND
                ? [baseWhere.AND]
                : []),
            { categories: { hasSome: categories } },
          ],
        };

        const recipes = await prisma.recipe.findMany({ where: finalWhere });
        return recipes || []; // Ensure we always return an array
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
        // Handle empty ingredients array
        if (!availableIngredients || availableIngredients.length === 0) {
          return [];
        }

        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        // Perform the final, complex logic in memory for reliability.
        const result = candidateRecipes.filter((recipe) =>
          recipe.ingredients.every((recipeIngredient) =>
            availableIngredients.some((available) =>
              recipeIngredient.toLowerCase().includes(available.toLowerCase()),
            ),
          ),
        );

        return result || [];
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
        // Handle empty ingredients array
        if (!availableIngredients || availableIngredients.length === 0) {
          return [];
        }

        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        const recipesWithScores = candidateRecipes.map((recipe) => {
          const required = extractIngredientNames(recipe.ingredients);
          if (required.length === 0) {
            return {
              recipe,
              matchPercentage: 0,
              matchingIngredientsCount: 0,
              totalIngredientsCount: 0,
              missingIngredients: [],
            };
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

        const result = recipesWithScores
          .filter((r) => r.matchPercentage >= minMatchPercentage)
          .sort((a, b) => b.matchPercentage - a.matchPercentage);

        return result || [];
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
        // Handle empty ingredient names array
        if (!ingredientNames || ingredientNames.length === 0) {
          return [];
        }

        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        // Perform the final, complex logic in memory for reliability.
        const result = candidateRecipes.filter((recipe) =>
          ingredientNames.every((name) =>
            recipe.ingredients.some((ing) =>
              ing.toLowerCase().includes(name.toLowerCase()),
            ),
          ),
        );

        return result || [];
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
        if (!availableIngredients || availableIngredients.length === 0)
          return [];

        // NOTE: Full-text search is a special case and MUST be done in the DB.
        // Filtering is applied after, as it's hard to combine with raw SQL.
        const searchTerms = availableIngredients.join(" | ");
        const results: any[] = await prisma.$queryRaw`
					SELECT * FROM "Recipe"
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

        const result = filteredResults.map((r) => ({
          recipe: r,
          relevanceScore: 0,
        })); // score would need to be passed
        return result || [];
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
        // Handle empty ingredients array
        if (!availableIngredients || availableIngredients.length === 0) {
          return [];
        }

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
            return { recipe, matchPercentage: 0, missingIngredients: [] };
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

        const result = recipesWithScores
          .filter((r) => r.matchPercentage >= minMatchPercentage)
          .sort((a, b) => b.matchPercentage - a.matchPercentage);

        return result || [];
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
        // Handle empty ingredients array
        if (!availableIngredients || availableIngredients.length === 0) {
          return [];
        }

        const baseWhere = buildPrismaWhereClause(filters);
        const candidateRecipes = await prisma.recipe.findMany({
          where: baseWhere,
        });

        const result = candidateRecipes
          .filter((recipe) =>
            recipe.ingredients.some((ing) =>
              availableIngredients.some((avail) =>
                ing.toLowerCase().includes(avail.toLowerCase()),
              ),
            ),
          )
          .slice(0, limit || 10);

        return result || [];
      } catch (error: any) {
        console.error("ERROR in quickRecipeSuggestions:", error);
        throw new GraphQLError(`Database query failed: ${error.message}`);
      }
    },
  },

  Mutation: {
    createRecipe: async (_: any, { input }: { input: any }) => {
      try {
        const recipe = await prisma.recipe.create({ data: { ...input } });
        return recipe;
      } catch (error: any) {
        console.error("ERROR in createRecipe:", error);
        throw new GraphQLError(`Failed to create recipe: ${error.message}`);
      }
    },
    updateRecipe: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        const recipe = await prisma.recipe.update({
          where: { id: parseInt(id) },
          data: { ...input },
        });
        return recipe;
      } catch (error: any) {
        console.error("ERROR in updateRecipe:", error);
        throw new GraphQLError(
          `Recipe with ID ${id} not found or update failed: ${error.message}`,
        );
      }
    },
    deleteRecipe: async (_: any, { id }: { id: string }) => {
      try {
        const recipe = await prisma.recipe.delete({
          where: { id: parseInt(id) },
        });
        return recipe;
      } catch (error: any) {
        console.error("ERROR in deleteRecipe:", error);
        throw new GraphQLError(
          `Recipe with ID ${id} not found or delete failed: ${error.message}`,
        );
      }
    },
  },
};
