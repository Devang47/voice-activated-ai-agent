import { WebSocket } from 'ws';
import { handleNewMessage } from './handlers.ts';
import { sessionManager, startInactivityTimer } from './helpers.ts';
import { logger } from '../utils/logger.ts';

export const handleWSConnection = (ws: WebSocket) => {
  logger.info('New WS connection established');

  startInactivityTimer(ws);
  const sId = sessionManager.create();

  ws.on('message', (message) => handleNewMessage(message, ws));

  ws.on('close', () => {
    logger.info('Client disconnected ', sId);
  });

  ws.send('Connected to Voice AI Agent WebSocket Server');
};
