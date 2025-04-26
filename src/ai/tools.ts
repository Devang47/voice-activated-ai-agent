import { ChatCompletionTool } from 'openai/resources.mjs';

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
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
            description: 'The unit of temperature to use. Default is celsius.',
          },
        },
        required: ['location'],
        additionalProperties: false,
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
      description: 'Schedule a meeting on the calendar and send invitations',
      parameters: {
        type: 'object',
        properties: {
          clientName: {
            type: 'string',
            description: 'Name of the client or attendee',
          },
          clientEmail: {
            type: 'string',
            description: 'Email address of the client for invitation',
          },
          date: {
            type: 'string',
            description: 'Meeting date in YYYY-MM-DD format',
          },
          startTime: {
            type: 'string',
            description: 'Meeting start time (HH:MM in 24-hour format)',
          },
          duration: {
            type: 'number',
            description: 'Meeting duration in minutes (default: 60)',
          },
          projectName: {
            type: 'string',
            description: 'Name of the project being discussed (optional)',
          },
          notes: {
            type: 'string',
            description:
              'Additional notes or agenda for the meeting (optional)',
          },
          location: {
            type: 'string',
            description:
              'Meeting location or "Google Meet" for video conference (default: Google Meet)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone (default: America/Los_Angeles)',
          },
        },
        required: ['clientName', 'clientEmail', 'date', 'startTime'],
        additionalProperties: false,
      },
      strict: true,
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
            description: 'ID of the meeting to cancel',
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
        required: ['meetingId'],
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
      description: 'Perform a live web search for the user query.',
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
        },
        required: ['subject', 'body'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];
