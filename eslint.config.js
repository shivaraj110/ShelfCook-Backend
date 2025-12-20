import pluginJs from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import securityPlugin from "eslint-plugin-security";
import unicornPlugin from "eslint-plugin-unicorn";
import globals from "globals";
import tsPlugin from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Security
  securityPlugin.configs.recommended,
  {
    files: ["**/*.ts"],
  },
  {
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "func-style": ["warn", "expression"],
      "no-restricted-syntax": ["off", "ForOfStatement"],
      "no-console": ["warn"],
      "prefer-template": "warn",
      quotes: ["warn", "double", { avoidEscape: true }],
    },
  },
  // TypeScript Eslint
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn"],
      "@typescript-eslint/no-unused-expressions": ["warn"],
    },
  },
  // Prettier
  {
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": [
        1,
        {
          endOfLine: "lf",
          printWidth: 180,
          semi: true,
          singleQuote: false,
          tabWidth: 2,
          trailingComma: "es5",
        },
      ],
    },
  },
  // Unicorn
  {
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      "unicorn/empty-brace-spaces": "off",
      "unicorn/no-null": "off",
    },
  },
  pluginJs.configs.recommended,
  ...tsPlugin.configs.recommended,
];
