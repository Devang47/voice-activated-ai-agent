import readline from 'readline';
import { WSMessage } from '../types/index.ts';
import { logger } from '../utils/logger.ts';

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
  if (ws.readyState === WebSocket.OPEN) {
    const wsMessage: WSMessage = {
      role: 'user',
      content: message,
      sessionActive: true,
    };

    try {
      console.log('Sending message:', message);
      ws.send(JSON.stringify(wsMessage));
      logger.info(message);
    } catch (error) {
      logger.error('Failed to send message:', error);
    }
  } else {
    logger.warn('WebSocket is not connected. Message not sent:', message);
  }
};
