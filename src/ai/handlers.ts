import type { WebSocket } from 'ws';
import type { RedisMessage, WSMessage } from '../types/index.ts';
import storage from '../storage.ts';
import { getOpenAiClient, sessionManager } from './helpers.ts';
import { tools } from './tools.ts';
import { instructions } from './constants.ts';
import { logger } from '../utils/logger.ts';
import {
  getWeatherData,
  sendEmail,
  performWebSearch,
  sendMailToAll,
  createTodo,
  markTodoAsComplete,
  getTodos,
  deleteTodo,
  updateTodo,
  getWeatherForecast,
  getLatestNews,
  setReminder,
  getReminders,
  completeReminder,
  deleteReminder,
} from '../functions/index.ts';
import {
  cancelMeeting,
  getUpcomingMeetings,
  scheduleMeeting,
} from '../functions/scheduleMeeting.ts';
import { ChatCompletionToolMessageParam } from 'groq-sdk/src/resources/chat.js';
import { giveIntro } from '../functions/giveIntro.ts';
import { compareWithAlexa } from '../functions/compareWithAlexa.ts';
import { maydayCall } from '../functions/mayday.ts';
// import { fetchContacts } from '../functions/contacts.ts';
// import { messageRequiresTool } from './tmp.ts';

export interface Contact {
  id: string;
  email: string;
  phone: string;
  timestamp: number;
  name: string;
}

// let contacts: Contact[] = [];

export const handleNewMessage = async (
  message: WebSocket.RawData | string,
  ws: WebSocket,
) => {
  const currentSession = sessionManager.get();
  const aiClient = getOpenAiClient();
  const prevMessages = (await storage.getMessages(currentSession)) ?? [];

  // contacts = await fetchContacts();

  try {
    const messageData: WSMessage = JSON.parse(message.toString());
    if (!messageData.content) {
      logger.error('Empty content in message:', messageData);
      console.log('[assistant]: Error: Message content cannot be empty');
      ws.send('Error: Message content cannot be empty');
      return;
    }

    console.log('User:', messageData.content);

    // const pass = 'wake up';
    // Check for authentication if needed
    // if (
    //   !sessionManager.isAuthenticated() &&
    //   !messageData.content.toLowerCase().includes(pass)
    // ) {
    //   // If not authenticated and message doesn't contain password
    //   if (messageData.content.toLowerCase().includes('lisa')) {
    //     // If greeting is correct, ask for password
    //     ws.send(
    //       JSON.stringify({
    //         role: 'assistant',
    //         content:
    //           'Hello! For security purposes, please provide your password.',
    //         sessionActive: true,
    //       }),
    //     );
    //     return;
    //   } else {
    //     // If no greeting, prompt for correct greeting
    //     ws.send(
    //       JSON.stringify({
    //         role: 'assistant',
    //         content: "I'm waiting for you to greet me properly.",
    //         sessionActive: true,
    //       }),
    //     );
    //     return;
    //   }
    // } else if (
    //   !sessionManager.isAuthenticated() &&
    //   messageData.content.includes(pass)
    // ) {
    //   // Password provided, authenticate
    //   sessionManager.authenticate();
    //   ws.send(
    //     JSON.stringify({
    //       role: 'assistant',
    //       content:
    //         "Hey Robin! I'm now ready to assist you. What can I help you with today?",
    //       sessionActive: true,
    //     }),
    //   );
    //   return;
    // }

    // // Enhance instructions based on message content
    // const enhancedInstructions = getEnhancedInstructions(
    //   instructions,
    //   messageData.content,
    // );

    // Determine if we should use a lower temperature based on tool detection
    // const { requiresTool } = messageRequiresTool(messageData.content);
    // const temperatureValue = requiresTool ? 0.2 : 0.7; // Lower temperature for tool usage

    const response = await aiClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: instructions,
        },
        ...prevMessages.slice(1).slice(-5),
        {
          role: 'user',
          content: messageData.content,
        },
      ],
      max_completion_tokens: 1024,
      tools,
    });

    if (response.choices[0].finish_reason === 'tool_calls') {
      const toolCalls = response.choices[0].message.tool_calls;
      const assistantMessage = response.choices[0].message;
      console.log('Tool Calls: ' + JSON.stringify(toolCalls));

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
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            content = await getWeatherData(
              functionArgs.location,
              functionArgs.unit,
            );
            console.log('Get Weather called\n');
          } else if (functionName === 'send_email') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            content = await sendEmail(
              functionArgs.to,
              functionArgs.subject,
              functionArgs.body,
            );
          } else if (functionName === 'schedule_meeting') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            console.log('Meeting Scheduled funtion called');
            content = await scheduleMeeting(
              functionArgs.name,
              functionArgs.email,
              functionArgs.date,
              functionArgs.time,
            );
            console.log('Meeting Scheduled : ' + content);
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
            console.log('Meeting Retrieved : ' + content);
          } else if (functionName === 'web_search') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            console.log('Web search triggered\n');
            content = await performWebSearch(functionArgs.query);
          } else if (functionName === '`mark_todo_as_complete`') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            content = await markTodoAsComplete(functionArgs.id);
          } else if (functionName === 'create_todo') {
            content = await createTodo(
              functionArgs.title,
              functionArgs.description,
            );
          } else if (functionName === 'get_todos') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            content = JSON.stringify(await getTodos());
            console.log('Content' + content);
          } else if (functionName === 'delete_todo') {
            content = await deleteTodo(functionArgs.id);
            console.log('Content' + content);
          } else if (functionName === 'update_todo') {
            content = await updateTodo(
              functionArgs.id,
              functionArgs.title,
              functionArgs.description,
            );
          } else if (functionName === 'get_weather_forecast') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            content = await getWeatherForecast(
              functionArgs.location,
              functionArgs.days,
              functionArgs.unit,
            );
          } else if (functionName === 'get_latest_news') {
            console.log(
              '[assistant]: ' +
                (assistantMessage.content ||
                  "I'm working on that for you now..."),
            );
            ws.send(
              JSON.stringify({
                role: 'assistant',
                content:
                  assistantMessage.content ||
                  "I'm working on that for you now...",
                sessionActive: true,
              }),
            );

            content = await getLatestNews(
              functionArgs.topic,
              functionArgs.count,
            );
          } else if (functionName === 'set_reminder') {
            content = await setReminder(
              functionArgs.title,
              functionArgs.description,
              functionArgs.dueDate,
              functionArgs.dueTime,
              functionArgs.priority,
            );
          } else if (functionName === 'complete_reminder') {
            content = await completeReminder(functionArgs.id);
          } else if (functionName === 'delete_reminder') {
            content = await deleteReminder(functionArgs.id);
          } else if (functionName === 'get_reminders') {
            content = await getReminders(functionArgs.id);
          } else if (functionName === 'send_mail_to_users') {
            content = await sendMailToAll(
              functionArgs.subject,
              functionArgs.body,
            );
          } else if (functionName === 'give_introduction') {
            content = await giveIntro(ws);
          } else if (functionName === 'compare_with_alexa') {
            content = await compareWithAlexa(ws);
          } else if (functionName === 'mayday_call') {
            content = await maydayCall();
          }

          return {
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: content,
          };
        }),
      );

      const validToolResults = toolResults.filter((result) => result !== null);

      if (
        validToolResults.length === 1 &&
        (validToolResults[0].name === 'give_introduction' ||
          validToolResults[0].name === 'compare_with_alexa' ||
          validToolResults[0].name === 'mayday_call')
      ) {
        console.log('returning');
        return;
      }

      const toolResponseMessage = await aiClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              instructions +
              "\n\nIMPORTANT: The user has already been informed that you're processing their request. Now provide a friendly, natural response about what you've done. DO NOT include technical details or JSON in your response. Speak as if you've already completed the task.",
          },
          ...prevMessages.slice(1).slice(-5),
          {
            role: 'user',
            content: messageData.content,
          },
          assistantMessage,
          ...validToolResults,
        ],
        temperature: 0.7,
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

      console.log(
        '[assistant]: ' +
          (toolResponseMessage.choices[0].message.content ||
            "I've completed that task for you!"),
      );

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
      console.log('Assistant:', response.choices[0].message.content);

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
  } catch (error) {
    console.log('Error:', error);

    console.log(
      "[assistant]: I'm having trouble processing your request. Could you try again?",
    );

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
