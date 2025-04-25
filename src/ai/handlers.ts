import { WebSocket } from 'ws';
import { RedisMessage, WSMessage } from '../types/index.ts';
import storage from '../storage.ts';
import {
  getOpenAiClient,
  sessionManager,
  startInactivityTimer,
} from './helpers.ts';
import { tools } from './tools.ts';
import { instructions } from './constants.ts';
import { logger } from '../utils/logger.ts';
import { getWeatherData, sendEmail } from './functions.ts';
import { ChatCompletionToolMessageParam } from 'groq-sdk/src/resources/chat.js';

export const handleNewMessage = async (
  message: WebSocket.RawData,
  ws: WebSocket,
) => {
  startInactivityTimer(ws);

  const currentSession = sessionManager.get();
  const aiClient = getOpenAiClient();
  const prevMessages = (await storage.getMessages(currentSession)) ?? [];

  try {
    const messageData: WSMessage = JSON.parse(message.toString());
    if (!messageData.content) {
      logger.error('Empty content in message:', messageData);
      ws.send('Error: Message content cannot be empty');
      return;
    }

    const response = await aiClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      tools,
      messages: [
        {
          role: 'system',
          content: instructions,
        },
        ...prevMessages,
        {
          role: 'user',
          content: messageData.content,
        },
      ],
      temperature: 1,
      max_completion_tokens: 1024,
    });

    if (response.choices[0].finish_reason === 'tool_calls') {
      const toolCalls = response.choices[0].message.tool_calls || [];
      const assistantMessage = response.choices[0].message;

      // extend type ChatCompletionToolMessageParam to include name and create a new type
      type ToolCallParam = ChatCompletionToolMessageParam & {
        name: string;
      };

      // Process each tool call
      const toolResults: ToolCallParam[] = await Promise.all(
        toolCalls.map(async (toolCall) => {
          if (toolCall.type !== 'function') return null;

          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          let content = '';

          if (functionName === 'get_weather') {
            content = await getWeatherData(
              functionArgs.location,
              functionArgs.unit,
            );
          } else if (functionName === 'send_email') {
            content = await sendEmail(
              functionArgs.to,
              functionArgs.subject,
              functionArgs.body,
            );
          }

          return {
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: content,
          };
        }),
      );

      // Filter out null results
      const validToolResults = toolResults.filter((result) => result !== null);

      // Get a new response from the AI with the tool results
      const toolResponseMessage = await aiClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: instructions,
          },
          ...prevMessages,
          {
            role: 'user',
            content: messageData.content,
          },
          assistantMessage,
          ...validToolResults,
        ],
        temperature: 1,
        max_completion_tokens: 1024,
      });

      // Store the tool results and the AI's final response
      // Convert to appropriate storage format
      // Type assertion to ensure all elements conform to RedisMessage
      const storageMessages: RedisMessage[] = [
        {
          role: 'user',
          content: messageData.content,
        },
        // Convert assistantMessage to RedisMessage
        {
          role: 'assistant',
          content:
            assistantMessage.content ||
            (assistantMessage.tool_calls
              ? `Tool calls: ${JSON.stringify(assistantMessage.tool_calls)}`
              : ''),
        },
        // Convert tool responses to RedisMessage format
        ...validToolResults.map((result) => ({
          role: 'assistant' as const,
          content: `Tool response for ${result.name}: ${result.content}`,
        })),
        {
          role: 'assistant',
          content: toolResponseMessage.choices[0].message.content || '',
        },
      ];

      await storage.addMessage(currentSession, storageMessages);

      ws.send(JSON.stringify(toolResponseMessage.choices[0].message));
    } else {
      // Regular response handling (no tool calls)
      await storage.addMessage(currentSession, [
        {
          role: 'user' as const,
          content: messageData.content,
        },
        {
          role: 'assistant' as const,
          content: response.choices[0].message.content || '',
        },
      ]);

      ws.send(JSON.stringify(response.choices[0].message));
    }

    startInactivityTimer(ws);
  } catch (error) {
    ws.send('Error processing your request');
    logger.error('Error:', error);
  }
};
