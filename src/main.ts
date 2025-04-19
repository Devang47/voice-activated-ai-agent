import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { RedisStorage } from './storage.ts';

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

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', (message: Buffer) => {
    console.log('Received:', message.toString());

    ws.send(`Server received: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.send('Connected to Voice AI Agent WebSocket Server');
});

server.listen(PORT, async () => {
  await storage.connect();

  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
