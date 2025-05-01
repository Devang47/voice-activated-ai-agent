import { WebSocket } from 'ws';
import { handleNewMessage } from './handlers.ts';
import { sessionManager } from './helpers.ts';
import { logger } from '../utils/logger.ts';
// import { startRecording } from '../utils/stt.ts';
import { WSMessage } from '../types/index.ts';
// import { createRecognizeStream } from '../utils/stt.ts';
import speech from '@google-cloud/speech';

let flag = false;

const client = new speech.SpeechClient();

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

  // const recognizeStream = createRecognizeStream((msg) => {
  //   console.log(msg);
  // });

  // Add the new connection to our map
  connections.set(sId, ws);
  logger.info(
    `Added new connection with session ID: ${sId}. Total connections: ${connections.size}`,
  );

  if (connections.size == 0) flag = false;
  if (flag) return;
  else flag = true;

  // ws.on('message', (message) =>
  //   handleRawWSMessage(recognizeStream, message, ws),
  // );

  const requestConfig: any = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
    },
    interimResults: true,
  };

  // Create recognition stream
  const recognizeStream = client
    .streamingRecognize(requestConfig)
    .on('data', (response) => {
      const result = response.results[0];
      if (result && result.alternatives[0]) {
        const transcript = result.alternatives[0].transcript;
        console.log('Transcript:', transcript);
        // Add your text processing logic here
      }
    })
    .on('error', (err) => {
      console.error('Speech-to-Text Error:', err);
    })
    .on('end', () => {
      console.log('Speech-to-Text stream ended');
    });

  // Handle incoming audio data
  ws.on('message', (audioData) => {
    console.log('message');
    recognizeStream.write(audioData);
  });

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

const handleRawWSMessage = (
  recognizeStream,
  message: WebSocket.RawData,
  ws: WebSocket,
) => {
  console.log(`Received message`);
  if (
    message instanceof ArrayBuffer ||
    (message as any).buffer instanceof ArrayBuffer
  ) {
    console.log('processing');
    const audioData =
      message instanceof ArrayBuffer ? message : (message as any).buffer;

    recognizeStream.write(audioData);
  } else handleNewMessage(message, ws);
};
