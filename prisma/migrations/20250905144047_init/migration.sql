/*
  Warnings:

  - You are about to drop the `Ingredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeIngredient` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `vegan` to the `Recipe` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_recipeId_fkey";

-- AlterTable
ALTER TABLE "public"."Recipe" ADD COLUMN     "ingredients" TEXT[],
ADD COLUMN     "vegan" BOOLEAN NOT NULL;

-- DropTable
DROP TABLE "public"."Ingredient";

-- DropTable
DROP TABLE "public"."RecipeIngredient";
