import type { ChatCompletionTool } from 'openai/resources.mjs';
import { AI_MODAL } from '../ai/constants.ts';
import { getOpenAiClient, sessionManager } from '../ai/helpers.ts';
import storage from '../storage.ts';
import type { WSMessage } from '../types/index.ts';
import type WebSocket from 'ws';
import { doc, setDoc } from 'firebase/firestore';
import { logger } from '../utils/logger.ts';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadString,
} from 'firebase/storage';
import app, { db } from '../utils/firebase.ts';

const storageref = getStorage(app);

// String data to upload
const storageRef = ref(storageref, `interviews/result.txt`);

export const handleInterviewMessage = async (
  message: WSMessage,
  ws: WebSocket,
) => {
  const sessionId = sessionManager.get() + '-interview';
  const prevMessages = await storage.getMessages(sessionId);
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

    if (functionName === 'end_interview') {
      try {
        let pdfUrl = null;
        let reportId = null;
        try {
          const result = functionArgs.result;
          pdfUrl = result.pdfUrl;
          reportId = result.reportId;
          logger.info(`Interview PDF report generated and uploaded: ${pdfUrl}`);
        } catch (error) {
          logger.error(
            `Error generating PDF report: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // 3. Save all results to Firestore
        const resultData = {
          result: functionArgs.result ?? 'Result is empty',
          pdfReportUrl: pdfUrl ?? '',
          reportId: reportId ?? '',
          reportAvailable: !!pdfUrl,
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
        };

        uploadString(storageRef, functionArgs.result)
          .then((snapshot) => {
            console.log('Uploaded interviewResult as a raw string!');
            return getDownloadURL(snapshot.ref);
          })
          .then((downloadURL) => {
            console.log('File available at', downloadURL);
            // Store this URL in Firestore if needed
            // resultData.resultFileUrl = downloadURL;
          })
          .catch((error) => {
            console.error('Error uploading interview result:', error);
          });

        await handleSaveResultsEndInterview(resultData);

        // 4. Notify the user about the results
        let responseMessage =
          'Interview completed! Your responses have been saved successfully.';

        if (pdfUrl) {
          responseMessage += ' A detailed PDF report is available for review.';
        }

        responseMessage +=
          ' Thank you for participating in the interview process.';

        ws.send(
          JSON.stringify({
            role: 'assistant',
            content: responseMessage,
            sessionActive: false,
          }),
        );
      } catch (error) {
        logger.error(
          `Error in interview completion process: ${error instanceof Error ? error.message : String(error)}`,
        );

        ws.send(
          JSON.stringify({
            role: 'assistant',
            content:
              'Interview completed! There was an issue saving some of the results, but your responses have been recorded. Thank you for participating.',
            sessionActive: false,
          }),
        );
      }
    } else {
      await handleSaveResultsEndInterview({ result: functionArgs.result });

      ws.send(
        JSON.stringify({
          role: 'assistant',
          content:
            'Interview completed! Your responses have been saved successfully. Thank you for participating in the interview process.',
          sessionActive: false,
        }),
      );
    }

    sessionManager.toggleInterviewMode();
  } else {
    console.log('Assistant:', response.choices[0].message.content);

    await storage.addMessage(sessionId, [
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
      name: 'end_interview',
      description: 'Ends the interview and saves the results of the interview',
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

const handleSaveResultsEndInterview = async (resultData: any) => {
  const uuid = 'result' + Date.now();

  await setDoc(doc(db, 'results', uuid), resultData);

  console.log('Interview results saved:', resultData);
};
