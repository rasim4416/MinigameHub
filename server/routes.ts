import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupPresence } from "./presence";
import { setupWebSocket } from "./ws";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const httpServer = createServer(app);
  setupWebSocket(httpServer);
  setupPresence(httpServer);

  return httpServer;
}
