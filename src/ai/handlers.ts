import type { WebSocket } from 'ws';
import type { RedisMessage, WSMessage } from '../types/index.ts';
import storage from '../storage.ts';
import {
  getOpenAiClient,
  sessionManager,
  startInactivityTimer,
} from './helpers.ts';
import { tools } from './tools.ts';
import { instructions } from './constants.ts';
import { logger } from '../utils/logger.ts';
import {
  getWeatherData,
  sendEmail,
  performWebSearch,
} from '../functions/index.ts';
import {
  cancelMeeting,
  getUpcomingMeetings,
  scheduleMeeting,
} from '../functions/scheduleMeeting.ts';
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

    // Check for authentication if needed
    if (
      !sessionManager.isAuthenticated() &&
      !messageData.content.toLowerCase().includes('248142')
    ) {
      // If not authenticated and message doesn't contain password
      if (messageData.content.toLowerCase().includes('hey lisa')) {
        // If greeting is correct, ask for password
        ws.send(
          JSON.stringify({
            role: 'assistant',
            content:
              'Hello! For security purposes, please provide your password.',
            sessionActive: true,
          }),
        );
        return;
      } else {
        // If no greeting, prompt for correct greeting
        ws.send(
          JSON.stringify({
            role: 'assistant',
            content: "I'm waiting for you to greet me properly.",
            sessionActive: true,
          }),
        );
        return;
      }
    } else if (
      !sessionManager.isAuthenticated() &&
      messageData.content.includes('248142')
    ) {
      // Password provided, authenticate
      sessionManager.authenticate();
      ws.send(
        JSON.stringify({
          role: 'assistant',
          content:
            "Hey Robin! I'm now ready to assist you. What can I help you with today?",
          sessionActive: true,
        }),
      );
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
      // Handle tool calls
      const toolCalls = response.choices[0].message.tool_calls || [];
      const assistantMessage = response.choices[0].message;

      // Store user message and assistant's initial response (not the tool call details)
      await storage.addMessage(currentSession, [
        {
          role: 'user',
          content: messageData.content,
        },
        {
          role: 'assistant',
          content:
            assistantMessage.content || 'Let me take care of that for you.',
        },
      ]);

      // Send an immediate response to the user that we're processing their request
      ws.send(
        JSON.stringify({
          role: 'assistant',
          content:
            assistantMessage.content || "I'm working on that for you now...",
          sessionActive: true,
        }),
      );

      // extend type ChatCompletionToolMessageParam to include name and create a new type
      type ToolCallParam = ChatCompletionToolMessageParam & {
        name: string;
      };

      ws.send(
        JSON.stringify({
          role: 'assistant',
          content:
            assistantMessage.content || "I'm working on that for you now...",
          sessionActive: true,
        }),
      );

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
          } else if (functionName === 'schedule_meeting') {
            content = await scheduleMeeting(
              functionArgs.clientName,
              functionArgs.clientEmail,
              functionArgs.date,
              functionArgs.startTime,
              functionArgs.duration,
              functionArgs.projectName,
              functionArgs.notes,
              functionArgs.location,
              functionArgs.timeZone,
            );
          } else if (functionName === 'cancel_meeting') {
            content = await cancelMeeting(
              functionArgs.meetingId,
              functionArgs.reason,
              functionArgs.sendNotification,
            );
          } else if (functionName === 'get_upcoming_meetings') {
            content = await getUpcomingMeetings(
              functionArgs.days,
              functionArgs.maxResults,
            );
          } else if (functionName === 'web_search') {
            console.log("Web searched triggered\n");
            content = await performWebSearch(functionArgs.query);
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
            content:
              instructions +
              "\n\nIMPORTANT: The user has already been informed that you're processing their request. Now provide a friendly, natural response about what you've done. DO NOT include technical details or JSON in your response. Speak as if you've already completed the task.",
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

      // Send the final response to the client
      ws.send(
        JSON.stringify({
          role: 'assistant',
          content:
            toolResponseMessage.choices[0].message.content ||
            "I've completed that task for you!",
          sessionActive: true,
        }),
      );
    } else {
      // Regular response handling (no tool calls)
      await storage.addMessage(currentSession, [
        {
          role: 'user',
          content: messageData.content,
        },
        {
          role: 'assistant',
          content: response.choices[0].message.content || '',
        },
      ]);

      ws.send(
        JSON.stringify({
          role: 'assistant',
          content: response.choices[0].message.content || '',
          sessionActive: true,
        }),
      );
    }

    startInactivityTimer(ws);
  } catch (error) {
    ws.send(
      JSON.stringify({
        role: 'assistant',
        content:
          "I'm having trouble processing your request. Could you try again?",
        sessionActive: true,
      }),
    );
    logger.error('Error:', error);
  }
};
