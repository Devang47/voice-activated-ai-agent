import dotenv from 'dotenv';

import { logger } from '../utils/logger.ts';
import { connectToWebSocketServer, handleServerMessage } from './ws.ts';
import { stopRecording } from './stt.ts';
import { playAudio } from './tts.ts';

dotenv.config();

if (!process.env.WS_SERVER_URL) {
  logger.error(
    'WebSocket server URL is not defined in the environment variables (WS_SERVER_URL)',
  );
  throw new Error('WebSocket server URL is not defined');
}

// export const wsConnection = connectToWebSocketServer(
//   process.env.WS_SERVER_URL,
//   {
//     onMessage: handleServerMessage,
//     reconnectAttempts: 3,
//     reconnectInterval: 2000,
//     // onOpen: () => startRecording(wsConnection),
//     onClose: () => stopRecording(),
//   },
// );

playAudio('PI is working fine and you can start using it now');
