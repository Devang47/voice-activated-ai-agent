import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { RedisStorage } from './storage.js';
import { handleWSConnection } from './ai/test.ts';
import dotenv from 'dotenv';
import { logger } from './utils/logger.ts';
import os from 'os';

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

// Function to get local IP address
const getLocalIpAddress = (): string => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Default to localhost if no interface is found
};

server.listen(PORT, async () => {
  await storage.connect();

  const localIp = getLocalIpAddress();

  logger.info(
    `Server running on \n http://localhost:${PORT} \n http://${localIp}:${PORT}`,
  );
  logger.info(
    `WebSocket server running on \n ws://localhost:${PORT} \n ws://${localIp}:${PORT}`,
  );
});
