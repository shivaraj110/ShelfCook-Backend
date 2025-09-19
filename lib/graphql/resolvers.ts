import { GraphQLError } from "graphql";
import { prisma } from "../db";
//@ts-ignore
import { Prisma, RecipeWhereInput } from "@prisma/client";

// A helper function to extract clean ingredient names from database entries
function extractIngredientNames(ingredients: string[]): string[] {
	return ingredients
		.map((ingredient) => {
			const cleaned = ingredient
				.toLowerCase()
				.replace(
					/^\d+(\.\d+)?\s*(g|kg|ml|l|oz|lb|tbsp|tsp|cup|cups|pinch|handful)\s*\/?\s*\d*\s*(g|kg|ml|l|oz|lb)?\s*/i,
					"",
				)
				.replace(/^\d+\s*/, "")
				.replace(/,.*$/, "")
				.replace(/\(.*?\)/g, "")
				.trim();
			return cleaned || ingredient.toLowerCase();
		})
		.filter((ingredient) => ingredient.length > 0);
}

// Helper function to build a dynamic Prisma WHERE clause for filters
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

export const resolvers = {
	Query: {
		findRecipesByCategories: async (
			_: any,
			{
				categories,
				filters,
			}: { categories: string[]; filters?: RecipeFilters },
		) => {
			const where = buildPrismaWhereClause(filters);
			const whereClause: RecipeWhereInput = {
				AND: [...(where.AND || []), { categories: { hasSome: categories } }],
			};
			return prisma.recipe.findMany({ where: whereClause });
		},

		recipesWithExactIngredients: async (
			_: any,
			{
				availableIngredients,
				filters,
			}: { availableIngredients: string[]; filters?: RecipeFilters },
		) => {
			const where = buildPrismaWhereClause(filters);
			const allRecipes = await prisma.recipe.findMany({ where });

			// Filter recipes in memory
			return allRecipes.filter((recipe) => {
				// For EVERY ingredient the recipe requires...
				return recipe.ingredients.every((recipeIngredient) =>
					// ...do we have at least ONE available ingredient that is a substring of it?
					// This handles cases like "soda" matching "bicarbonate of soda".
					availableIngredients.some((available) =>
						recipeIngredient.toLowerCase().includes(available.toLowerCase()),
					),
				);
			});
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
			const where = buildPrismaWhereClause(filters);
			const allRecipes = await prisma.recipe.findMany({ where });

			const recipesWithScores = allRecipes.map((recipe) => {
				const recipeIngredients = extractIngredientNames(recipe.ingredients);
				const missingIngredients = recipeIngredients.filter(
					(ingredient) =>
						!availableIngredients.some(
							(available) =>
								ingredient.toLowerCase().includes(available.toLowerCase()) ||
								available.toLowerCase().includes(ingredient.toLowerCase()),
						),
				);
				const matchingCount =
					recipeIngredients.length - missingIngredients.length;
				const matchPercentage =
					recipeIngredients.length > 0
						? (matchingCount / recipeIngredients.length) * 100
						: 0;

				return {
					recipe,
					matchPercentage: Math.round(matchPercentage),
					matchingIngredientsCount: matchingCount,
					totalIngredientsCount: recipeIngredients.length,
					missingIngredients,
				};
			});
			return recipesWithScores
				.filter((r) => r.matchPercentage >= minMatchPercentage)
				.sort((a, b) => b.matchPercentage - a.matchPercentage);
		},

		// --- REWRITTEN with a more reliable SQL function ---
		findRecipesByIngredientNames: async (
			_: any,
			{
				ingredientNames,
				filters,
			}: { ingredientNames: string[]; filters?: RecipeFilters },
		) => {
			if (!ingredientNames || ingredientNames.length === 0) return [];

			let query = `SELECT * FROM "Recipe"`;
			const whereClauses: string[] = [];
			const queryParams: any[] = [];
			let paramIndex = 1;

			// Dynamically add an ILIKE clause for each ingredient name.
			// This performs a case-insensitive substring search in the database.
			ingredientNames.forEach((name) => {
				// FIX: Use the robust array_to_string function instead of a direct text cast
				whereClauses.push(
					`array_to_string(ingredients, ' ') ILIKE $${paramIndex++}`,
				);
				queryParams.push(`%${name}%`);
			});

			// Dynamically add filters to the WHERE clause
			if (filters) {
				if (typeof filters.vegan === "boolean") {
					whereClauses.push(`vegan = $${paramIndex++}`);
					queryParams.push(filters.vegan);
				}
				if (filters.categories && filters.categories.length > 0) {
					whereClauses.push(`categories && $${paramIndex++}`);
					queryParams.push(filters.categories);
				}
			}

			if (whereClauses.length > 0) {
				query += ` WHERE ${whereClauses.join(" AND ")}`;
			}

			query += ` LIMIT 50;`;

			return prisma.$queryRawUnsafe(query, ...queryParams);
		},

		recipesWithFullTextSearch: async (
			_: any,
			{
				availableIngredients,
				filters,
			}: { availableIngredients: string[]; filters?: RecipeFilters },
		) => {
			if (availableIngredients.length === 0) return [];
			const searchTerms = availableIngredients.join(" | ");
			let results: any[] = await prisma.$queryRaw`
                SELECT *, ts_rank(to_tsvector('english', array_to_string(ingredients, ' ')), plainto_tsquery('english', ${searchTerms})) as relevance_score
                FROM "Recipe"
                WHERE to_tsvector('english', array_to_string(ingredients, ' ')) @@ plainto_tsquery('english', ${searchTerms})
                ORDER BY relevance_score DESC
                LIMIT 50;
            `;

			if (filters) {
				results = results.filter((recipe) => {
					const veganMatch =
						typeof filters.vegan !== "boolean" ||
						recipe.vegan === filters.vegan;
					const categoryMatch =
						!filters.categories ||
						filters.categories.length === 0 ||
						filters.categories.some((cat) => recipe.categories.includes(cat));
					return veganMatch && categoryMatch;
				});
			}

			return results.map((r) => ({
				recipe: r,
				relevanceScore: r.relevance_score,
			}));
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
			const where = buildPrismaWhereClause(filters);
			const allRecipes = await prisma.recipe.findMany({ where });
			const ingredientMap: { [key: string]: string[] } = {
				onion: ["onions", "red onion", "white onion"],
				garlic: ["garlic cloves", "garlic paste"],
				tomato: ["tomatoes", "canned tomatoes"],
			};
			const expandedIngredients = availableIngredients.flatMap((ing) => [
				ing,
				...(ingredientMap[ing.toLowerCase()] || []),
			]);

			const recipesWithScores = allRecipes.map((recipe) => {
				const recipeIngredients = extractIngredientNames(recipe.ingredients);
				const missingIngredients = recipeIngredients.filter(
					(ingredient) =>
						!expandedIngredients.some((available) =>
							ingredient.toLowerCase().includes(available.toLowerCase()),
						),
				);
				const matchingCount =
					recipeIngredients.length - missingIngredients.length;
				const matchPercentage =
					recipeIngredients.length > 0
						? (matchingCount / recipeIngredients.length) * 100
						: 0;

				return {
					recipe,
					matchPercentage: Math.round(matchPercentage),
					matchingIngredientsCount: matchingCount,
					totalIngredientsCount: recipeIngredients.length,
					missingIngredients,
				};
			});
			return recipesWithScores
				.filter((r) => r.matchPercentage >= minMatchPercentage)
				.sort((a, b) => b.matchPercentage - a.matchPercentage);
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
			if (availableIngredients.length === 0) return [];
			const ingredientPattern = availableIngredients
				.map((ing) => `%${ing.toLowerCase()}%`)
				.join("|");
			let results: any[] = await prisma.$queryRaw`
                SELECT * FROM "Recipe"
                WHERE EXISTS (
                  SELECT 1 FROM unnest(ingredients) as ingredient
                  WHERE lower(ingredient) SIMILAR TO ${ingredientPattern}
                )
                ORDER BY array_length(ingredients, 1) ASC
                LIMIT ${limit};
            `;

			if (filters) {
				results = results.filter((recipe) => {
					const veganMatch =
						typeof filters.vegan !== "boolean" ||
						recipe.vegan === filters.vegan;
					const categoryMatch =
						!filters.categories ||
						filters.categories.length === 0 ||
						filters.categories.some((cat) => recipe.categories.includes(cat));
					return veganMatch && categoryMatch;
				});
			}

			return results;
		},
	},

	Mutation: {
		createRecipe: async (_: any, { input }: { input: any }) => {
			try {
				const newRecipe = await prisma.recipe.create({
					data: {
						...input,
					},
				});
				return newRecipe;
			} catch (error: any) {
				throw new GraphQLError(`Failed to create recipe: ${error.message}`, {
					extensions: { code: "BAD_USER_INPUT" },
				});
			}
		},

		updateRecipe: async (_: any, { id, input }: { id: string; input: any }) => {
			try {
				const updateData = Object.fromEntries(
					Object.entries(input).filter(([_, v]) => v !== undefined),
				);
				const updatedRecipe = await prisma.recipe.update({
					where: { id: parseInt(id) },
					data: updateData,
				});
				return updatedRecipe;
			} catch (error: any) {
				throw new GraphQLError(`Recipe with ID ${id} not found.`, {
					extensions: { code: "NOT_FOUND" },
				});
			}
		},

		deleteRecipe: async (_: any, { id }: { id: string }) => {
			try {
				const deletedRecipe = await prisma.recipe.delete({
					where: { id: parseInt(id) },
				});
				return deletedRecipe;
			} catch (error: any) {
				throw new GraphQLError(`Recipe with ID ${id} not found.`, {
					extensions: { code: "NOT_FOUND" },
				});
			}
		},
	},
};
