// Function to detect if a message likely requires tools
export function messageRequiresTool(message) {
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
export function getEnhancedInstructions(baseInstructions, message) {
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

/**
 * - **Reminders**: ALWAYS use set_reminder, get_reminders, complete_reminder, or delete_reminder tools

 */
