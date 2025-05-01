import type { ChatCompletionTool } from 'openai/resources.mjs';
import { AI_MODAL } from '../ai/constants.ts';
import { getOpenAiClient, sessionManager } from '../ai/helpers.ts';
import storage from '../storage.ts';
import { WSMessage } from '../types/index.ts';
import WebSocket from 'ws';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';

export const handleInterviewMessage = async (
  message: WSMessage,
  ws: WebSocket,
) => {
  const prevMessages = await storage.getMessages(
    sessionManager.get() + '-interview',
  );
  const aiClient = getOpenAiClient();

  const response = await aiClient.chat.completions.create({
    model: AI_MODAL,
    messages: [
      ...prevMessages,
      {
        role: 'user',
        content: message.content,
      },
    ],
    max_completion_tokens: 1024,
    tools,
  });

  if (response.choices[0].finish_reason === 'tool_calls') {
    console.log('Assistant is calling a tool...');

    const toolCall = response.choices[0].message.tool_calls[0];

    if (toolCall.type !== 'function') return null;

    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);

    if (functionName === 'save_results_end_interview') {
      await handleSaveResultsEndInterview(functionArgs.result);
    }

    sessionManager.toggleInterviewMode();

    ws.send(
      JSON.stringify({
        role: 'assistant',
        content:
          'Interview completed! Your responses have been saved successfully. Thank you for participating in the interview process.',
        sessionActive: false,
      }),
    );
  } else {
    console.log('Assistant:', response.choices[0].message.content);

    await storage.addMessage(sessionManager.get() + '-interview', [
      {
        role: 'user',
        content: message.content,
      },
      {
        role: 'assistant',
        content: response.choices[0].message.content || '',
      },
    ]);

    ws.send(
      JSON.stringify({
        role: 'assistant',
        content: response.choices[0].message.content,
        sessionActive: true,
      }),
    );
  }
};

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'save_results_end_interview',
      description:
        'Save the results of the interview and end the interview mode',
      parameters: {
        type: 'object',
        properties: {
          result: {
            type: 'string',
            description:
              "The result of the interview, including the candidate's performance and any other relevant information.",
          },
        },
        required: ['result'],
      },
    },
  },
];

const handleSaveResultsEndInterview = async (result: string) => {
  const uuid = 'result' + new Date().getTime();

  await setDoc(doc(db, 'results', uuid), { result });

  console.log({ result });
};
