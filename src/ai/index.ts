import { WebSocket } from 'ws';
import { handleNewMessage } from './handlers.ts';
import { sessionManager } from './helpers.ts';
import { logger } from '../utils/logger.ts';
// import { startRecording } from '../utils/stt.ts';
import { WSMessage } from '../types/index.ts';

let flag = false;

// Map to store all active WebSocket connections
// Using Map with sessionId as key and WebSocket as value
const connections = new Map<string, WebSocket>();

// Function to broadcast a message to all connected clients
export const broadcastMessage = (message: WSMessage): void => {
  logger.info(`Broadcasting message to ${connections.size} clients`);
  const messageString = JSON.stringify(message);

  connections.forEach((ws, sessionId) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageString);
        logger.debug(`Message sent to session ${sessionId}`);
      } else {
        logger.warn(`Cannot send to session ${sessionId}: connection not open`);
      }
    } catch (error) {
      logger.error(`Error sending to session ${sessionId}:`, error);
    }
  });
};

export const handleWSConnection = (ws: WebSocket) => {
  logger.info('New WS connection established');

  // startInactivityTimer(ws);
  const sId = sessionManager.create();

  // Add the new connection to our map
  connections.set(sId, ws);
  logger.info(
    `Added new connection with session ID: ${sId}. Total connections: ${connections.size}`,
  );

  if (connections.size == 0) flag = false;
  if (flag) return;
  else flag = true;

  ws.on('message', (message) => handleNewMessage(message, ws));

  ws.on('close', () => {
    logger.info(`Client disconnected: ${sId}`);
    // Remove the connection from our map
    connections.delete(sId);
    logger.info(
      `Removed connection. Remaining connections: ${connections.size}`,
    );
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
};
