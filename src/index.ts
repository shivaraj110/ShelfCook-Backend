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
// The PrismaClient is used to interact with your database.

// We need to tell our server what data and operations are available.
// We do this by passing it a schema.
// The schema is loaded from the schema.graphql file.

const typeDefs = readFileSync(
  path.join(__dirname, "../lib/graphql/schema.graphql"),
  {
    encoding: "utf-8",
  },
);

// The context function is called for every request.
// It's a good place to connect to your database and
// pass the database connection to your resolvers.
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
  // server.js
  const { graphqlHTTP } = require("express-graphql");

  // 3. Initialize the Express app
  const app = express();
  // allow all origins
  app.use(cors());
  app.use("/api/v1", apiV1);
  // 5. Start the server
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(` 🚀 REST API running at http://localhost:${PORT}/api/v1`);
  });
};

const server = process.argv[2];

server === "express" ? startExpressServer() : startApolloServer();
