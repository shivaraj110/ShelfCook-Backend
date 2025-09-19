import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import type { PrismaClient } from "@prisma/client/extension";
import { readFileSync } from "fs";
import path from "path";
import { resolvers } from "../lib/graphql/resolvers";
import { prisma } from "../lib/db";
import express from "express";
import cors from "cors";
import apiV1 from "./api/v1";

const typeDefs = readFileSync(
	path.join(__dirname, "../lib/graphql/schema.graphql"),
	{
		encoding: "utf-8",
	},
);

export interface MyContext {
	prisma: PrismaClient;
}

async function startApolloServer() {
	const server = new ApolloServer<MyContext>({ typeDefs, resolvers });

	const { url } = await startStandaloneServer(server, {
		context: async () => ({
			prisma,
		}),
		listen: { port: 4000 },
	});
	console.log(`
    🚀  Apollo server is running on port 4000!
    📭  Query at ${url}
  `);
}

const startExpressServer = async () => {
	const { graphqlHTTP } = require("express-graphql");

	const app = express();
	// allow all origins
	app.use(cors());
	app.use(
		"/graphql", // The endpoint for your GraphQL API
		graphqlHTTP({
			schema: typeDefs, // The GraphQL schema
			rootValue: resolvers, // The root value for your GraphQL API
			graphiql: true, // Enable the GraphiQL interface for in-browser testing
		}),
	);

	app.use("/api/v1", apiV1);
	// 5. Start the server
	const PORT = 4000;
	app.listen(PORT, () => {
		console.log(
			`🚀 Express-GraphQL server running at http://localhost:${PORT}/graphql\n REST API running at http://localhost:${PORT}/api/v1`,
		);
	});
};

const server = process.argv[2];

server === "express" ? startExpressServer() : startApolloServer();
