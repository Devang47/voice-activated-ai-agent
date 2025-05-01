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

// Keep track of the recording instance
let recordingInstance: any = null;

export const wsConnection = connectToWebSocketServer(
  process.env.WS_SERVER_URL,
  {
    onMessage: handleServerMessage,
    reconnectAttempts: 5, // Increased from 3
    reconnectInterval: 2000,
    onOpen: () => {
      // Only start listening if not already recording
      if (!recordingInstance) {
        recordingInstance = startListening(wsConnection);
      }
    },
    onClose: () => {
      // Stop recording if WebSocket closes
      stopListening();
    },
    onError: (error) => {
      logger.error('WebSocket error:', error);
      stopListening();
    },
  },
);

const sampleRateHertz = 16000;

const startListening = (ws: WebSocket) => {
  // Check if WebSocket is actually open
  if (ws.readyState !== WebSocket.OPEN) {
    logger.warn('WebSocket not open, cannot start listening');
    return null;
  }

  logger.info('Starting microphone recording...');

  try {
    const recording = recorder
      .record({
        sampleRateHertz: sampleRateHertz,
        threshold: 0,
        verbose: false,
        recordProgram: 'arecord',
        silence: '1.0',
        // Adding additional options for stability
        channels: 1,
        audioType: 'raw',
      })
      .stream()
      .on('data', (data) => {
        try {
          // Only send if WebSocket is open and ready
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
            logger.debug(`Sent audio chunk: ${data.length} bytes`);
          } else {
            logger.warn('WebSocket not ready, cannot send audio data');
            // Attempt to reconnect if WebSocket is closed
            if (ws.readyState === WebSocket.CLOSED) {
              logger.info('Attempting to reconnect WebSocket...');
              stopListening();
              // Reconnect logic can be added here
            }
          }
        } catch (sendError) {
          logger.error('Error sending audio data:', sendError);
        }
      })
      .on('error', (error) => {
        logger.error('Recording error:', error);
        stopListening();
        // Don't automatically close the WebSocket, just log the error
      });

    logger.info('Microphone input is now streaming to WebSocket');
    return recording;
  } catch (recordError) {
    logger.error('Failed to start recording:', recordError);
    return null;
  }
};

// Function to stop recording
const stopListening = () => {
  if (recordingInstance) {
    logger.info('Stopping microphone recording...');
    try {
      recordingInstance.stop();
      recordingInstance = null;
      logger.info('Microphone recording stopped');
    } catch (error) {
      logger.error('Error stopping recording:', error);
    }
  }
};

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down...');
  stopListening();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down...');
  stopListening();
  process.exit(0);
});
