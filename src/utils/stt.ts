import speech from '@google-cloud/speech';
import { logger } from './logger.ts';

const client = new speech.SpeechClient();

const encoding = 'LINEAR16' as const;
const sampleRateHertz = 16000;
const languageCode = 'en-US';

// let recordingInstance = null;
let recognizeStream = null;
let finalTranscript = '';

// Create the request with proper typing
const createRequest: any = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    speechContexts: [
      {
        phrases: [
          'lisa',
          'robin',
          'devang',
          'saklani',
          'arpit',
          'sushant',
          'chamoli',
        ],
        boost: 10.0,
      },
    ],
  },
  interimResults: true,
};

/**
 * Cleanup speech recognition resources
 */
export const cleanupSpeechRecognition = () => {
  if (recognizeStream) {
    recognizeStream.end();
    recognizeStream.removeAllListeners();
    recognizeStream = null;
    logger.info('Speech recognition stream cleaned up');
  }
  finalTranscript = '';
};

/**
 * Creates or returns an existing speech recognition stream
 * @param handleSendMessage Callback function to handle the final transcript
 * @returns Speech recognition stream
 */
export const createRecognizeStream = (
  handleSendMessage: (finalTranscript: string) => void,
) => {
  if (recognizeStream && !recognizeStream.destroyed) {
    return recognizeStream;
  }

  logger.info('Initializing new Google Speech-to-Text API stream');

  // Reset transcript for new streams
  finalTranscript = '';

  recognizeStream = client
    .streamingRecognize(createRequest)
    .on('error', (error) => {
      logger.error('Recognition error:', error);
      cleanupSpeechRecognition();
    })
    .on('data', (data) => {
      if (data.results[0] && data.results[0].alternatives[0]) {
        const transcript = data.results[0].alternatives[0].transcript;

        if (transcript.toLowerCase().includes('lisa')) {
          logger.info('Keyword detected, starting recording...');
          finalTranscript = '';
        }

        console.log(`Transcription: ${transcript}`);

        if (data.results[0].isFinal) {
          finalTranscript += ' ' + transcript;

          if (
            finalTranscript.includes('thank you') ||
            finalTranscript.includes('thank u') ||
            finalTranscript.includes('thanks') ||
            finalTranscript.includes('stop') ||
            finalTranscript.includes('mayday') ||
            finalTranscript.includes('wake up') ||
            finalTranscript.includes('emergency')
          ) {
            logger.info('End command detected, sending transcript...');
            handleSendMessage(finalTranscript.trim());

            // Reset transcript and clean up for next interaction
            cleanupSpeechRecognition();
          }
        }
      }
    })
    .on('end', () => {
      logger.info('Speech recognition stream ended');
    });

  return recognizeStream;
};
