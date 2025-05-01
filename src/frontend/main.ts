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

// Keep track of the recording instances
let recordingStream: any = null;
let recorderInstance: any = null;

export const wsConnection = connectToWebSocketServer(
  process.env.WS_SERVER_URL,
  {
    onMessage: handleServerMessage,
    reconnectAttempts: 5, // Increased from 3
    reconnectInterval: 2000,
    onOpen: () => {
      // Only start listening if not already recording
      if (!recordingStream) {
        const result = startListening(wsConnection);
        if (result) {
          recordingStream = result.stream;
          recorderInstance = result.recorder;
        }
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
    const recorderObj = recorder.record({
      sampleRateHertz: sampleRateHertz,
      threshold: 0,
      verbose: false,
      recordProgram: 'arecord',
      silence: '1.0',
      channels: 1,
      audioType: 'raw',
    });

    const stream = recorderObj
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
      });

    logger.info('Microphone input is now streaming to WebSocket');
    return { stream, recorder: recorderObj };
  } catch (recordError) {
    logger.error('Failed to start recording:', recordError);
    return null;
  }
};

// Function to stop recording
const stopListening = () => {
  if (recorderInstance) {
    logger.info('Stopping microphone recording...');
    try {
      // First close the stream if it exists
      if (recordingStream) {
        recordingStream.removeAllListeners();
        recordingStream.end();
        recordingStream = null;
      }

      // Then stop the recorder
      if (typeof recorderInstance.stop === 'function') {
        recorderInstance.stop();
      } else if (typeof recorderInstance.destroy === 'function') {
        recorderInstance.destroy();
      } else {
        logger.warn('Could not find appropriate method to stop the recorder');
      }

      recorderInstance = null;
      logger.info('Microphone recording stopped');
    } catch (error) {
      logger.error('Error stopping recording:', error);
      // Reset the instances even if there was an error
      recordingStream = null;
      recorderInstance = null;
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
