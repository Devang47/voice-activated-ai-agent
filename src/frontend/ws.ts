import { WSMessage } from '../types/index.ts';
import { logger } from '../utils/logger.ts';

export const connectToWebSocketServer = (
  url: string,
  options: {
    onOpen?: (event: Event) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    reconnectAttempts?: number;
    reconnectInterval?: number;
  } = {},
): WebSocket => {
  const ws = new WebSocket(url);
  let reconnectCount = 0;
  const maxReconnectAttempts = options.reconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;

  ws.addEventListener('open', (event) => {
    console.log('Connected to WebSocket server');
    reconnectCount = 0;
    if (options.onOpen) options.onOpen(event);
  });

  ws.addEventListener('message', (event) => {
    if (options.onMessage) options.onMessage(event);
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

export const handleServerMessage = (msg: MessageEvent) => {
  let serverMessage: WSMessage;
  try {
    serverMessage = JSON.parse(msg.data) as WSMessage;
  } catch (error) {
    logger.error('Failed to parse server message:', error);
    return;
  }

  console.log('Assistant: ' + serverMessage.content);
};
