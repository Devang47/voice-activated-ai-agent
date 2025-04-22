import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { RedisStorage } from './storage.js';
import { handleWSConnection } from './ai/index.js';
import dotenv from 'dotenv';
import { logger } from './utils/logger.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (_: Request, res: Response) => {
  res.send('Voice Activated AI Agent Server is running');
});

const server = http.createServer(app);
const storage = new RedisStorage();

const wss = new WebSocketServer({ server });

wss.on('connection', handleWSConnection);

server.listen(PORT, async () => {
  await storage.connect();

  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`WebSocket server running on ws://localhost:${PORT}`);
});
