import { WSMessage } from '../types/index.ts';
import { logger } from '../utils/logger.ts';
import WebSocket from 'ws';
import { playAudio } from './tts.ts';

export const connectToWebSocketServer = (
  url: string,
  options: {
    onOpen?: (event: WebSocket.Event) => void;
    onMessage?: (data: WebSocket.RawData) => void;
    onError?: (event: WebSocket.ErrorEvent) => void;
    onClose?: (event: WebSocket.CloseEvent) => void;
    reconnectAttempts?: number;
    reconnectInterval?: number;
  } = {},
): WebSocket => {
  let reconnectCount = 0;
  const ws = new WebSocket(url);
  const maxReconnectAttempts = options.reconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;

  ws.on('open', (event) => {
    console.log('Connected to WebSocket server');
    reconnectCount = 0;
    if (options.onOpen) options.onOpen(event);
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    if (options.onMessage) options.onMessage(data);
  });

  ws.addEventListener('error', (event) => {
    console.error('WebSocket error:', event);
    if (options.onError) options.onError(event);
  });

  ws.addEventListener('close', (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);

    if (options.onClose) options.onClose(event);

    // Attempt to reconnect if the connection was closed unexpectedly
    if (event.code !== 1000 && reconnectCount < maxReconnectAttempts) {
      reconnectCount++;
      console.log(
        `Attempting to reconnect (${reconnectCount}/${maxReconnectAttempts})...`,
      );
      setTimeout(() => {
        connectToWebSocketServer(url, options);
      }, reconnectInterval);
    }
  });

  return ws;
};

export const handleServerMessage = (msg: WebSocket.RawData) => {
  let serverMessage: WSMessage;
  try {
    const dataString = msg.toString();
    serverMessage = JSON.parse(dataString) as WSMessage;
    if (serverMessage.role === 'assistant') {
      playAudio(serverMessage.content);
    }
  } catch (error) {
    logger.error('Failed to parse server message:', error);
    return;
  }

  console.log('Assistant: ' + serverMessage.content);
};
