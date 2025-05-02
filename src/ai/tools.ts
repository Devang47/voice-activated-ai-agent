import type { ChatCompletionTool } from 'openai/resources.mjs';

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'mayday_call',
      description:
        'Sends a emergency message to the users family members or friends',
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a "location"',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description:
              'The city and state or country, e.g., "San Francisco, CA" or "Paris, France"',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description:
              'The "unit" of temperature to use. Default is celsius.',
          },
        },
        required: ['"location"'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather_forecast',
      description: 'Get a multi-day weather forecast for a "location"',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description:
              'The city and state or country, e.g., "San Francisco, CA" or "Paris, France"',
          },
          days: {
            type: 'number',
            description: 'Number of days to forecast (1-5). Default is 3.',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description:
              'The "unit" of temperature to use. Default is celsius.',
          },
        },
        required: ['"location"'],
        additionalPoperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description:
        'Send an email to a given recipient with a email, subject and message.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'The recipient email address.',
          },
          subject: {
            type: 'string',
            description: 'Email subject line.',
          },
          body: {
            type: 'string',
            description: 'Body of the email message.',
          },
        },
        required: ['to', 'subject', 'body'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_meeting',
      description:
        'Schedule a meeting with the user on the calendar and send invitations',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '"name" of the client or attendee',
          },
          email: {
            type: 'string',
            description: 'Email address of the client for invitation',
          },
          date: {
            type: 'string',
            description: 'Meeting date',
          },
          time: {
            type: 'string',
            description: 'Meeting time',
          },
          duration: {
            type: 'number',
            description: 'Meeting duration in minutes (default: 60)',
          },
          meetingtype: {
            type: 'string',
            description:
              '"type" of meeting (initial consultation, proposal review, status update, etc.)',
          },
          projectName: {
            type: 'string',
            description: '"name" of the project being discussed (optional)',
          },
          notes: {
            type: 'string',
            description:
              'Additional notes or agenda for the meeting (optional)',
          },
          location: {
            type: 'string',
            description:
              'Meeting "location" or "Google Meet" for v"id"eo conference (default: Google Meet)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone (default: America/Los_Angeles)',
          },
        },
        required: ['name', 'email'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_meeting',
      description: 'Reschedule an existing meeting to a new date and time',
      parameters: {
        type: 'object',
        properties: {
          meetingId: {
            type: 'string',
            description: '"id" of the existing meeting to reschedule',
          },
          newDate: {
            type: 'string',
            description: 'New meeting date (YYYY-MM-DD)',
          },
          newStartTime: {
            type: 'string',
            description: 'New meeting start time (HH:MM in 24-hour format)',
          },
          reason: {
            type: 'string',
            description: 'Reason for rescheduling (optional)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone (default: America/Los_Angeles)',
          },
        },
        required: ['meeting"id"', 'newDate', 'newStartTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_meeting',
      description: 'Cancel an existing meeting and notify attendees',
      parameters: {
        type: 'object',
        properties: {
          meetingId: {
            type: 'string',
            description: '"id" of the meeting to cancel',
          },
          reason: {
            type: 'string',
            description: 'Reason for cancellation (optional)',
          },
          sendNotification: {
            type: 'boolean',
            description:
              'Whether to send cancellation notifications (default: true)',
          },
        },
        required: ['meeting"id"'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_meetings',
      description: 'Retrieve upcoming meetings for the specified time period',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to look ahead (default: 7)',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of meetings to return (default: 10)',
          },
        },
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Performs a web search for the user query.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What the user wants to search.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_latest_news',
      description: 'Get the latest news articles on a specific topic',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description:
              "The topic to get news about (e.g., 'technology', 'sports', 'business')",
          },
          count: {
            type: 'number',
            description: 'Number of news articles to return (default: 5)',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_todos',
      description:
        'Retrieve all to-dos or todos or to-do and tasks saved by the user',
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_todo_as_complete',
      description: 'Mark a todo as complete using the todo "id"',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '"id" of the todo to mark as complete',
          },
        },
        required: ['"id"'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_todo',
      description: 'Delete a todo using the todo "id"',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '"id" of the todo to delete',
          },
        },
        required: ['"id"'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_todo',
      description:
        'Create and save a new to-do or todo or to-dos of the user using title & description, "description" is not mandatory',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the todo',
          },
          description: {
            type: 'string',
            description: '"description" for the todo',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_todo',
      description: 'Update a todo title & "description" using the todo "id"',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '"id" of the todo to update',
          },
          title: {
            type: 'string',
            description: 'Title of the todo',
          },
          description: {
            type: 'string',
            description: '"description" for the todo',
          },
        },
        required: ['"id"'],
      },
    },
  },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'set_reminder',
  //     description: 'Set a reminder for a specific date and time',
  //     parameters: {
  //       type: 'object',
  //       properties: {
  //         title: {
  //           type: 'string',
  //           description: 'Title of the reminder',
  //         },
  //         description: {
  //           type: 'string',
  //           description: '"description" of what to be reminded about',
  //         },
  //         dueDate: {
  //           type: 'string',
  //           description: 'Due date in YYYY-MM-DD format',
  //         },
  //         dueTime: {
  //           type: 'string',
  //           description: 'Due time in HH:MM format (24-hour)',
  //         },
  //         priority: {
  //           type: 'string',
  //           enum: ['low', 'medium', 'high'],
  //           description: '"priority" level of the reminder (default: medium)',
  //         },
  //       },
  //       required: ['title', '"dueDate"', '"dueTime"'],
  //     },
  //   },
  // },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'get_reminders',
  //     description: 'Get all reminders set by the user',
  //     parameters: {
  //       type: 'object',
  //       properties: {
  //         includeCompleted: {
  //           type: 'boolean',
  //           description:
  //             'Whether to include completed reminders (default: false)',
  //         },
  //       },
  //       required: [],
  //     },
  //   },
  // },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'complete_reminder',
  //     description: 'Mark a reminder as completed',
  //     parameters: {
  //       type: 'object',
  //       properties: {
  //         id: {
  //           type: 'string',
  //           description: '"id" of the reminder to complete',
  //         },
  //       },
  //       required: ['"id"'],
  //     },
  //   },
  // },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'delete_reminder',
  //     description: 'Delete a reminder',
  //     parameters: {
  //       type: 'object',
  //       properties: {
  //         id: {
  //           type: 'string',
  //           description: '"id" of the reminder to delete',
  //         },
  //       },
  //       required: ['"id"'],
  //     },
  //   },
  // },
  {
    type: 'function',
    function: {
      name: 'send_mail_to_users',
      description:
        'read all email addresses from a txt or csv file and send an email to every email that is listed in the file.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'The subject line of the email.',
          },
          body: {
            type: 'string',
            description: 'The main content of the email.',
          },
          fileName: {
            type: 'string',
            description: 'The name of the file.',
          },
        },
        required: ['subject', 'body', 'fileName'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_interview_mode',
      description:
        "starts the mock interview mode for the user using the user's resume and job description",
      strict: true,
    },
  },
];
