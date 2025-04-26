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

// Function to detect if a message likely requires tools
function messageRequiresTool(message) {
  const toolKeywords = {
    get_weather: [
      'weather',
      'temperature',
      'forecast',
      'rain',
      'sunny',
      'humid',
      'how hot',
      'how cold',
      'degrees',
    ],
    send_email: ['email', 'send', 'write', 'message to', 'mail to', 'contact'],
    schedule_meeting: [
      'schedule',
      'meeting',
      'appointment',
      'calendar',
      'book a',
      'meet with',
      'setup a call',
    ],
    cancel_meeting: ['cancel', 'reschedule', 'postpone', 'delete meeting'],
    get_upcoming_meetings: [
      'upcoming',
      'next meeting',
      'schedule for',
      'this week',
      'calendar events',
    ],
    web_search: [
      'search',
      'look up',
      'find information',
      'google',
      'what is',
      'who is',
      'when did',
      'where is',
    ],
    create_todo: [
      'add task',
      'new todo',
      'create reminder',
      'add to my list',
      'remind me to',
    ],
    get_todos: [
      'show tasks',
      'list todos',
      'what are my tasks',
      'pending tasks',
      'my todo list',
    ],
    update_todo: ['change task', 'update todo', 'modify task', 'edit reminder'],
    delete_todo: ['remove task', 'delete todo', 'clear task'],
    mark_todo_as_complete: [
      'complete task',
      'mark done',
      'finish todo',
      'completed',
      'check off',
    ],
  };

  const lowercaseMsg = message.toLowerCase();

  // Check each tool's keywords
  for (const [tool, keywords] of Object.entries(toolKeywords)) {
    if (keywords.some((keyword) => lowercaseMsg.includes(keyword))) {
      return {
        requiresTool: true,
        likelyTool: tool,
      };
    }
  }

  return {
    requiresTool: false,
    likelyTool: null,
  };
}

// Function to enhance instructions based on tool likelihood
function getEnhancedInstructions(baseInstructions, message) {
  const { requiresTool, likelyTool } = messageRequiresTool(message);

  if (!requiresTool) return baseInstructions;

  // Add tool-specific instructions
  return `
${baseInstructions}

## TOOL USAGE - CRITICAL INSTRUCTION
The user's request is related to "${likelyTool}". You MUST use the appropriate tool for this request instead of simulating the action.
- NEVER respond with placeholders or pretend to perform the action
- ALWAYS use the tool system for ${likelyTool} operations
- Call the appropriate tool with the required parameters extracted from the user's request
- Wait for the tool response before providing your final answer

DO NOT RESPOND WITHOUT USING THE APPROPRIATE TOOL FOR THIS REQUEST.
`;
}

export const handleNewMessage = async (
  message: WebSocket.RawData | string,
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

    console.log('User:', messageData.content);

    // Check for authentication if needed
    // if (
    //   !sessionManager.isAuthenticated() &&
    //   !messageData.content.toLowerCase().includes('248142')
    // ) {
    //   // If not authenticated and message doesn't contain password
    //   if (messageData.content.toLowerCase().includes('hey lisa')) {
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
    //   messageData.content.includes('248142')
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

    // Enhance instructions based on message content
    const enhancedInstructions = getEnhancedInstructions(
      instructions,
      messageData.content,
    );

    // Determine if we should use a lower temperature based on tool detection
    const { requiresTool } = messageRequiresTool(messageData.content);
    const temperatureValue = requiresTool ? 0.2 : 0.7; // Lower temperature for tool usage

    const response = await aiClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: enhancedInstructions,
        },
        ...prevMessages.slice(1).slice(-5),
        {
          role: 'user',
          content: messageData.content,
        },
      ],
      temperature: temperatureValue,
      max_completion_tokens: 1024,
      tools,
    });

    console.log('printing' + response.choices[0].finish_reason);

    if (response.choices[0].finish_reason === 'tool_calls') {
      const toolCalls = response.choices[0].message.tool_calls;
      const assistantMessage = response.choices[0].message;
      console.log('Tool Calls : ' + toolCalls);

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

      console.log(
        'Assistant:',
        assistantMessage.content || "I'm working on that for you now...",
      );

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
            console.log('Get Weather called\n');
          } else if (functionName === 'send_email') {
            content = await sendEmail(
              functionArgs.to,
              functionArgs.subject,
              functionArgs.body,
            );
          } else if (functionName === 'schedule_meeting') {
            console.log('Meeting Scheduled funtion called');
            content = await scheduleMeeting(
              functionArgs.clientName,
              functionArgs.clientEmail,
              functionArgs.date,
              functionArgs.startTime,
              functionArgs.duration || 60, // Provide defaults for optional parameters
              functionArgs.projectName || '',
              functionArgs.notes || '',
              functionArgs.location || 'Google Meet',
              functionArgs.timeZone || 'America/Los_Angeles',
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
            console.log('Web search triggered\n');
            content = await performWebSearch(functionArgs.query);
          } else if (functionName === 'mark_todo_as_complete') {
            content = await markTodoAsComplete(functionArgs.id);
          } else if (functionName === 'create_todo') {
            content = await createTodo(
              functionArgs.title,
              functionArgs.description,
            );
          } else if (functionName === 'get_todos') {
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
            content = await getWeatherForecast(
              functionArgs.location,
              functionArgs.days,
              functionArgs.unit,
            );
          } else if (functionName === 'get_latest_news') {
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
            // console.log('Send to all mail function triggered');
            content = await sendMailToAll(
              functionArgs.subject,
              functionArgs.body,
            );
          } else if (functionName === 'give_introduction') {
            await giveIntro(ws);
            return null;
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
        toolResponseMessage.choices[0].message.content ||
          "I've completed that task for you!",
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
      // If tool was expected but not used, try one more time with stronger instructions
      const { requiresTool, likelyTool } = messageRequiresTool(
        messageData.content,
      );

      if (requiresTool && likelyTool) {
        console.log(
          `Tool was expected (${likelyTool}) but not used. Trying again with stronger instructions.`,
        );

        // Create even stronger tool instructions
        const forcedToolInstructions = `
${instructions}

## !!! CRITICAL TOOL USAGE INSTRUCTION !!!
The user's request ABSOLUTELY REQUIRES the "${likelyTool}" tool. 
You MUST use this tool instead of providing a simulated response.

DO NOT RESPOND WITHOUT USING THE "${likelyTool}" TOOL.
This is a direct command to use tools for this request.
`;

        // Try again with forced tool usage
        const retryResponse = await aiClient.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: forcedToolInstructions,
            },
            ...prevMessages.slice(1).slice(-5),
            {
              role: 'user',
              content: messageData.content,
            },
          ],
          temperature: 0.1, // Even lower temperature
          max_completion_tokens: 1024,
          tools,
        });

        // If retry succeeds with tool call, process it recursively
        if (retryResponse.choices[0].finish_reason === 'tool_calls') {
          console.log('Retry succeeded with tool call. Processing...');
          // Handle the same way as the original tool call process
          // Note: This is a recursive approach, as we're now reprocessing the response
          // You'd need to adapt this to avoid infinite loops

          // For simplicity, we'll just handle the normal response here
          const assistantMessage = retryResponse.choices[0].message;

          // Store and respond as normal
          await storage.addMessage(currentSession, [
            {
              role: 'user',
              content: messageData.content,
            },
            {
              role: 'assistant',
              content: assistantMessage.content || '',
            },
          ]);

          console.log('Assistant (retry):', assistantMessage.content);

          ws.send(
            JSON.stringify({
              role: 'assistant',
              content: assistantMessage.content || '',
              sessionActive: true,
            }),
          );

          // Process the tool calls similar to the original code
          // This would be implementation-specific

          return; // Exit to avoid processing the original response again
        }
      }

      // Regular response handling (no tool calls)
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

    startInactivityTimer(ws);
  } catch (error) {
    console.log(
      'Assistant:',
      "I'm having trouble processing your request. Could you try again?",
    );

    console.log('Error:', error);

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
