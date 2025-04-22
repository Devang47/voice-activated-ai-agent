import { WebSocket } from 'ws';
import { WSMessage } from '../types/index.ts';
import storage from '../storage.ts';
import {
  getOpenAiClient,
  sessionManager,
  startInactivityTimer,
} from './helpers.ts';
import { tools } from './tools.ts';
import { instructions } from './constants.ts';
import { logger } from '../utils/logger.ts';

export const handleNewMessage = async (
  message: WebSocket.RawData,
  ws: WebSocket,
) => {
  startInactivityTimer(ws);

  const currentSession = sessionManager.get();
  const aiClient = getOpenAiClient();

  const prevMessages = await storage.getMessages(currentSession);

  try {
    const messageData: WSMessage = JSON.parse(message.toString());

    const response = await aiClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      tools,
      messages: [
        {
          role: 'system',
          content: instructions,
        },
        ...(prevMessages ?? []),
        {
          role: 'user',
          content: messageData.content,
        },
      ],
      temperature: 1,
      max_completion_tokens: 1024,
    });

    if (response.choices[0].finish_reason === 'tool_calls') {
      // TODO: Handle tool calls
    } else {
      await storage.addMessage(currentSession, [
        {
          role: 'user',
          content: messageData.content,
        },
        response.choices[0].message,
      ]);
    }

    ws.send(JSON.stringify(response.choices[0].message));
    startInactivityTimer(ws);
  } catch (error) {
    ws.send('Error processing your request');
    logger.error('Error:', error);
  }
};
