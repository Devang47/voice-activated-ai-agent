import { Annotation, StateGraph, MessagesAnnotation } from "@langchain/langgraph"
import { ToolMessage } from "@langchain/core/messages"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import dotenv from "dotenv"
import { RedisStorage } from "./storage.js"

// Import our tools
import { sendEmail, resetEmailFlag } from "./tools/email/sendEmail.js"
import calendarTools from "./tools/calendar/calendarTools.js"
import { detectVoiceCommand, isClosingStatement } from "./helpers/voiceHelpers.js"

dotenv.config()

// Initialize Redis storage
const storage = new RedisStorage()

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-pro-001",
  temperature: 0,
  maxRetries: 2,
})

// Define our state annotation
const AssistantStateAnnotation = Annotation.Root({
  request: Annotation,
  response: Annotation,
  status: Annotation,
  sessionActive: Annotation,
  awaitingConfirmation: Annotation,
  pendingAction: Annotation,
  sessionId: Annotation,
})

// Define all tools
const tools = [sendEmail, ...calendarTools]
const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))

// LLM with tools
const llmWithTools = llm.bindTools(tools)

// System prompt for the assistant
const systemPrompt = `You are Lisa, a voice-activated personal assistant designed to help with scheduling meetings and sending emails.

IMPORTANT BEHAVIOR GUIDELINES:
1. Your name is Lisa. Only respond to the first message if it contains your name "Lisa".
2. After the initial activation, continue the conversation normally without requiring your name.
3. If you hear "okay thanks bye" or similar closing phrases, end the conversation politely.
4. When given minimal information, ask clarifying questions to gather all necessary details.
5. Always confirm before taking actions like sending emails or scheduling meetings.
6. Be concise in your responses since you're primarily voice-activated.
7. You can send emails to any recipient specified by the user.

COMMUNICATION STYLE:
- Speak naturally like a helpful assistant, not a robot
- Be concise but thorough, focusing on relevant information
- For emails, confirm the subject, recipient, and general content before sending

Your primary functions:
- Schedule, reschedule, and manage calendar appointments for meetings
- Send emails to any specified recipient
- Check calendar availability
- List upcoming meetings

For meeting scheduling:
- If given minimal information, ask for: attendee name, email, date, time, and purpose
- Recommend available time slots for meetings when dates are vague
- Set appropriate meeting durations based on meeting type
- Include relevant details in meeting invitations

For email sending:
- If given minimal information, ask for: recipient email, subject and content details
- Confirm the email content before sending

Always maintain a professional, helpful tone.`

// LLM node
async function llmNode(state) {
  // Check if we have a session ID
  const sessionId = state.sessionId || `session_${Date.now()}`

  // Get conversation history from Redis if available
  let conversationHistory = []
  try {
    const storedMessages = await storage.getMessages(sessionId)
    if (storedMessages && storedMessages.length > 0) {
      conversationHistory = storedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      }))
    }
  } catch (error) {
    console.error("Error retrieving conversation history:", error)
  }

  // Combine stored history with current messages
  const allMessages = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...conversationHistory,
    ...state.messages,
  ]

  // Check if this is the first message and if it contains the wake word "Lisa"
  const isFirstMessage = conversationHistory.length === 0
  const lastUserMessage = state.messages[state.messages.length - 1]

  // If it's the first message and doesn't contain "Lisa", don't respond
  if (isFirstMessage && lastUserMessage && lastUserMessage.role === "user") {
    const containsWakeWord = detectVoiceCommand(lastUserMessage.content)
    if (!containsWakeWord) {
      return {
        messages: [],
        sessionActive: false,
        sessionId: sessionId,
      }
    }
  }

  // Check if the message is a closing statement
  if (lastUserMessage && lastUserMessage.role === "user" && isClosingStatement(lastUserMessage.content)) {
    // Store the final message in Redis
    try {
      await storage.addMessage(sessionId, {
        role: "user",
        content: lastUserMessage.content,
        timestamp: new Date().toISOString(),
      })

      // Add a goodbye message
      await storage.addMessage(sessionId, {
        role: "assistant",
        content: "Goodbye! Have a great day.",
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error storing closing message:", error)
    }

    return {
      messages: [
        {
          role: "assistant",
          content: "Goodbye! Have a great day.",
        },
      ],
      sessionActive: false,
      sessionId: sessionId,
    }
  }

  // Check if we're awaiting confirmation for an action
  if (state.awaitingConfirmation && state.pendingAction) {
    // Check if the user confirmed the action
    const userConfirmed =
      lastUserMessage &&
      lastUserMessage.role === "user" &&
      (lastUserMessage.content.toLowerCase().includes("yes") ||
        lastUserMessage.content.toLowerCase().includes("confirm") ||
        lastUserMessage.content.toLowerCase().includes("go ahead") ||
        lastUserMessage.content.toLowerCase().includes("sure") ||
        lastUserMessage.content.toLowerCase().includes("okay"))

    if (userConfirmed) {
      // Execute the pending action
      const pendingAction = state.pendingAction

      // Clear the pending action and confirmation state
      state.awaitingConfirmation = false
      state.pendingAction = null

      // Execute the appropriate tool based on the pending action
      if (pendingAction.type === "email") {
        const result = await sendEmail.invoke(pendingAction.params)

        // Store the result in Redis
        try {
          await storage.addMessage(sessionId, {
            role: "assistant",
            content: `Email sent: ${result}`,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("Error storing email result:", error)
        }

        return {
          messages: [
            {
              role: "assistant",
              content: `Email sent: ${result}`,
            },
          ],
          sessionActive: true,
          awaitingConfirmation: false,
          pendingAction: null,
          sessionId: sessionId,
        }
      } else if (pendingAction.type === "meeting") {
        const result = await toolsByName.scheduleMeeting.invoke(pendingAction.params)

        // Store the result in Redis
        try {
          await storage.addMessage(sessionId, {
            role: "assistant",
            content: `Meeting scheduled: ${result}`,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("Error storing meeting result:", error)
        }

        return {
          messages: [
            {
              role: "assistant",
              content: `Meeting scheduled: ${result}`,
            },
          ],
          sessionActive: true,
          awaitingConfirmation: false,
          pendingAction: null,
          sessionId: sessionId,
        }
      }
    } else {
      // User didn't confirm, clear the pending action
      state.awaitingConfirmation = false
      state.pendingAction = null

      // Store the cancellation in Redis
      try {
        await storage.addMessage(sessionId, {
          role: "assistant",
          content: "Action cancelled. How else can I help you?",
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        console.error("Error storing cancellation:", error)
      }

      return {
        messages: [
          {
            role: "assistant",
            content: "Action cancelled. How else can I help you?",
          },
        ],
        sessionActive: true,
        awaitingConfirmation: false,
        pendingAction: null,
        sessionId: sessionId,
      }
    }
  }

  // Normal LLM processing
  const result = await llmWithTools.invoke(allMessages)

  // Store the new message in Redis
  try {
    if (lastUserMessage) {
      await storage.addMessage(sessionId, {
        role: lastUserMessage.role,
        content: lastUserMessage.content,
        timestamp: new Date().toISOString(),
      })
    }

    await storage.addMessage(sessionId, {
      role: "assistant",
      content: result.content,
      tool_calls: result.tool_calls,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error storing message:", error)
  }

  return {
    messages: [result],
    sessionActive: true,
    sessionId: sessionId,
  }
}

// Tool execution node
async function toolExecutionNode(state) {
  const results = []
  const lastMessage = state.messages.at(-1)
  const sessionId = state.sessionId || `session_${Date.now()}`

  if (lastMessage?.tool_calls && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    for (const toolCall of lastMessage.tool_calls) {
      if (toolCall && toolCall.name && toolsByName[toolCall.name]) {
        const tool = toolsByName[toolCall.name]

        // For email and meeting scheduling, we want to confirm before executing
        if (toolCall.name === "sendEmail") {
          // Store the pending action for confirmation
          return {
            messages: [
              {
                role: "assistant",
                content: `I'm about to send an email to ${toolCall.args.to} with subject "${toolCall.args.subject}". Would you like me to proceed?`,
              },
            ],
            awaitingConfirmation: true,
            pendingAction: {
              type: "email",
              params: toolCall.args,
            },
            sessionActive: true,
            sessionId: sessionId,
          }
        } else if (toolCall.name === "scheduleMeeting") {
          // Store the pending action for confirmation
          return {
            messages: [
              {
                role: "assistant",
                content: `I'm about to schedule a meeting with ${toolCall.args.clientName} on ${toolCall.args.date} at ${toolCall.args.startTime}. Would you like me to proceed?`,
              },
            ],
            awaitingConfirmation: true,
            pendingAction: {
              type: "meeting",
              params: toolCall.args,
            },
            sessionActive: true,
            sessionId: sessionId,
          }
        } else {
          // For other tools, execute normally
          try {
            const observation = await tool.invoke(toolCall.args || {})

            // Store the tool result in Redis
            try {
              await storage.addMessage(sessionId, {
                role: "tool",
                tool_call_id: toolCall.id,
                content: observation,
                timestamp: new Date().toISOString(),
              })
            } catch (error) {
              console.error("Error storing tool result:", error)
            }

            results.push(
              new ToolMessage({
                content: observation,
                tool_call_id: toolCall.id,
              }),
            )
          } catch (error) {
            results.push(
              new ToolMessage({
                content: `Error executing tool ${toolCall.name}: ${error.message}`,
                tool_call_id: toolCall.id,
              }),
            )
          }
        }
      } else {
        if (toolCall && toolCall.id) {
          results.push(
            new ToolMessage({
              content: `Error: Invalid tool request for '${toolCall?.name || "unknown tool"}'`,
              tool_call_id: toolCall.id,
            }),
          )
        }
      }
    }
  }

  if (results.length === 0 && lastMessage?.tool_calls) {
    return {
      messages: [
        new ToolMessage({
          content: "Error processing tool calls. Please try a different request.",
          tool_call_id: "error",
        }),
      ],
      sessionActive: true,
      sessionId: sessionId,
    }
  }

  return {
    messages: results,
    sessionActive: true,
    sessionId: sessionId,
  }
}

// Decision function to determine next step
function determineNextStep(state) {
  // If session is not active, end the conversation
  if (state.sessionActive === false) {
    return "__end__"
  }

  const lastMessage = state.messages.at(-1)

  if (lastMessage?.tool_calls && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "ExecuteTool"
  }

  return "__end__"
}

// Build the assistant workflow
const assistant = new StateGraph(MessagesAnnotation)
  .addNode("llmNode", llmNode)
  .addNode("toolExecutionNode", toolExecutionNode)
  .addEdge("__start__", "llmNode")
  .addConditionalEdges("llmNode", determineNextStep, {
    ExecuteTool: "toolExecutionNode",
    __end__: "__end__",
  })
  .addEdge("toolExecutionNode", "llmNode")
  .compile()

// Function to handle WebSocket connections
function handleWebSocketConnection(ws) {
  console.log("Client connected")
  let sessionId = `session_${Date.now()}`
  let sessionActive = false
  let inactivityTimer = null

  // Function to handle inactivity timeout
  // const startInactivityTimer = () => {
  //   // Clear any existing timer
  //   if (inactivityTimer) {
  //     clearTimeout(inactivityTimer)
  //   }
    
  //   // Only start timer if session is active
  //   if (sessionActive) {
  //     // Set new timer for 15 seconds
  //     inactivityTimer = setTimeout(() => {
  //       if (sessionActive) {
  //         sessionActive = false
  //         ws.send(
  //           JSON.stringify({
  //             role: "assistant",
  //             content: "I haven't heard from you in a while. Goodbye for now!",
  //             sessionActive: false,
  //           })
  //         )
          
  //         setTimeout(() => {
  //           ws.close()
  //         }, 10000)
  //       }
  //     }, 100000) // 15 seconds inactivity timeout
  //   }
  // }

  ws.on("message", async (message) => {
    try {
      const messageData = JSON.parse(message.toString())
      console.log("Received:", messageData)

      // First message check - only respond if it contains "Lisa"
      // if (!sessionActive) {
      //   const containsWakeWord = detectVoiceCommand(messageData.content)
      //   if (!containsWakeWord) {
      //     console.log("Wake word 'Lisa' not detected in first message")
      //     return
      //   }
      //   // If we reach here, wake word was detected in first message
      //   console.log("Wake word 'Lisa' detected, activating session")
      //   sessionActive = true
      // }

      // Reset the inactivity timer since we received a message
      // startInactivityTimer()

      // Process the message through the assistant
      const result = await assistant.invoke({
        messages: [
          {
            role: "user",
            content: messageData.content,
            sessionId: sessionId,
          },
        ],
        // sessionId: sessionId,
      })

      // Extract messages and session state
      const assistantMessages = result.messages || []
      
      // Update sessionActive from the result
    //   if (result.sessionActive !== undefined) {
    //     sessionActive = result.sessionActive
    //   }
      
      // If we got a new sessionId from the result, update it
    //   if (result.sessionId) {
    //     sessionId = result.sessionId
    //   }

      // Check if assistantMessages has content
      if (assistantMessages.length > 0) {
        // Send the response back to the client
        ws.send(
          JSON.stringify({
            role: "assistant",
            content: assistantMessages,
            sessionActive: sessionActive,
          })
        )
      }

      // If session is no longer active (due to bye command), clear timer and close connection
      if (!sessionActive) {
        if (inactivityTimer) {
          clearTimeout(inactivityTimer)
        }
        setTimeout(() => {
          ws.close()
        }, 1000) // Give the client time to receive the goodbye message
      }
    } catch (error) {
      console.error("Error processing message:", error)
      ws.send(
        JSON.stringify({
          role: "assistant",
          content: "I'm sorry, I encountered an error processing your request.",
          error: error.message,
        })
      )
    }
  })

  ws.on("close", () => {
    console.log("Client disconnected")
    // Clean up resources
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }
    resetEmailFlag()
  })

  // Send initial connection message
  ws.send(
    JSON.stringify({
      role: "system",
      content: "Connected to Lisa, your voice-activated assistant. Say 'Lisa' to begin.",
    })
  )
}

// Example usage for non-WebSocket environments
async function runAssistant(userMessage, sessionId = null) {
  // Reset email flag for new conversations
  if (!sessionId) {
    resetEmailFlag()
    sessionId = `session_${Date.now()}`
  }

  const result = await assistant.invoke({
    messages: [
      {
        role: "user",
        content: userMessage,
        sessionId: sessionId,
      },
    ],
    // sessionId: sessionId,
  })

  return result
}

// Export the main functionality
export { assistant, runAssistant, tools, AssistantStateAnnotation, handleWebSocketConnection }