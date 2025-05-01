import dotenv from 'dotenv';

import WebSocket from 'ws';
import { logger } from '../utils/logger.ts';
import { connectToWebSocketServer, handleServerMessage } from './ws.ts';
import recorder from 'node-record-lpcm16';

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
  },
);

const sampleRateHertz = 16000;

const startListening = (ws: WebSocket) => {
  logger.info('Starting microphone recording...');

  const recordingInstance = recorder
    .record({
      sampleRateHertz: sampleRateHertz,
      threshold: 0,
      verbose: false,
      recordProgram: 'arecord',
      silence: '1.0',
    })
    .stream()
    // .on('data', (data) => {
    // Optional: Log data chunks if needed for debugging
    // logger.debug(`Sending audio chunk: ${data.length} bytes`);
    // })
    .on('error', (error) => {
      logger.error('Recording error:', error);
      ws.close();
    });

  // Pipe the microphone data directly to the WebSocket
  recordingInstance.pipe(ws);

  logger.info('Microphone input is now streaming to WebSocket');

  // Return the recording instance so it can be stopped if needed
  return recordingInstance;
};
