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
  // Keep your existing send_email tool here
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
];
