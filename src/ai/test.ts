import type { WebSocket } from 'ws';
import { handleNewMessage } from './handlers.ts';
import { sessionManager } from './helpers.ts';
import { logger } from '../utils/logger.ts';

import readline from 'readline';
import { WSMessage } from '../types/index.ts';

export const setupCLI = (ws: WebSocket) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  console.log('CLI ready. Type your messages and press Enter to send.');
  rl.prompt();

  rl.on('line', (line) => {
    const message = line.trim();
    if (message) {
      sendMessage(ws, message);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('CLI interface closed');
    process.exit(0);
  });
};

export const sendMessage = (ws: WebSocket, message: string) => {
  const wsMessage: WSMessage = {
    role: 'user',
    content: message,
    sessionActive: true,
  };

  try {
    console.log('Sending message:', message);
    handleNewMessage(JSON.stringify(wsMessage), ws);
    logger.info(message);
  } catch (error) {
    logger.error('Failed to send message:', error);
  }
};

export const handleWSConnection = (ws: WebSocket) => {
  logger.info('New WS connection established');

  // startInactivityTimer(ws);
  const sId = sessionManager.create();

  ws.on('message', (message) => handleNewMessage(message, ws));

  ws.on('close', () => {
    logger.info('Client disconnected ', sId);
    // stopRecording();
  });

  // Send initial greeting that prompts for "Hey Lisa"
  ws.send(
    JSON.stringify({
      role: 'assistant',
      content: 'Voice assistant is ready. Please greet me to begin.',
      sessionActive: true,
    }),
  );

  setupCLI(ws);
};
