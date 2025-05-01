import dotenv from 'dotenv';

import WebSocket from 'ws';
import { logger } from '../utils/logger.ts';
import { connectToWebSocketServer, handleServerMessage } from './ws.ts';
import { startRecording } from '../utils/stt.ts';

dotenv.config();

if (!process.env.WS_SERVER_URL) {
  logger.error(
    'WebSocket server URL is not defined in the environment variables (WS_SERVER_URL)',
  );
  throw new Error('WebSocket server URL is not defined');
}

export const wsConnection = connectToWebSocketServer(
  process.env.WS_SERVER_URL,
  {
    onMessage: handleServerMessage,
    reconnectAttempts: 3,
    reconnectInterval: 2000,
    onOpen: () => startListening(wsConnection),
    // onClose: () => stopRecording(),
  },
);

const startListening = (ws: WebSocket) => {
  startRecording((text: string) => {
    ws.send(
      JSON.stringify({
        role: 'user',
        content: text,
        sessionActive: true,
      }),
    );
  });
};
