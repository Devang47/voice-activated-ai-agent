import speech from '@google-cloud/speech';
import { logger } from './logger.ts';
import recorder from 'node-record-lpcm16';
import fs from 'fs';
import path from 'path';

const client = new speech.SpeechClient();

const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US';

let recordingInstance = null;
let recognizeStream = null;
let finalTranscript = '';

// let inputStarted = false;

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
};

export const startRecording = (
  handleEndStream: (transcript: string) => void,
) => {
  stopRecording();
  // inputStarted = true;

  logger.info('Start speaking...');

  if (recognizeStream) {
    recognizeStream.removeAllListeners();
    recognizeStream.end();
  }

  finalTranscript = '';

  recognizeStream = client
    .streamingRecognize(createRequest)
    .on('error', (error) => {
      logger.error('Recognition error:', error);
      stopRecording();
    })
    .on('data', (data) => {
      if (
        data.results[0] &&
        data.results[0].alternatives[0] &&
        data.results[0].isFinal
      ) {
        const transcript = data.results[0].alternatives[0].transcript;
        if (transcript.toLowerCase().includes('lisa')) {
          logger.info('Keyword detected, starting recording...');
          // inputStarted = true;
          finalTranscript = '';
        }

        console.log(`Transcription: ${transcript}`);
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
          logger.info('Thank you detected, stopping recording...');
          handleEndStream(finalTranscript.trim());
          // inputStarted = false;
          finalTranscript = '';
          logger.info('Recording stopped');

          // stopRecording();
        }
      }
    });

  recordingInstance = recorder
    .record({
      sampleRateHertz: sampleRateHertz,
      threshold: 0,
      verbose: false,
      recordProgram: 'arecord',
      silence: '1.0',
    })
    .stream()
    .on('error', (error) => {
      logger.error('Recording error:', error);
      stopRecording();
    })
    .pipe(recognizeStream);

  return recordingInstance;
};

export const stopRecording = () => {
  // Cleanup recording instance
  if (recordingInstance) {
    recordingInstance.unpipe();
    recordingInstance.destroy();
    recordingInstance = null;
  }

  // Cleanup recognize stream
  if (recognizeStream) {
    recognizeStream.end();
    recognizeStream.removeAllListeners();
    recognizeStream = null;
  }

  logger.info('Recording stopped');
};

export const handleRecordVoice = () =>
  new Promise((resolve, reject) => {
    try {
      // Create wav directory if it doesn't exist
      const wavDir = path.join(process.cwd(), 'wav');
      if (!fs.existsSync(wavDir)) {
        fs.mkdirSync(wavDir, { recursive: true });
      }

      // Generate random filename
      const filename = `recording_${Date.now()}_${Math.floor(Math.random() * 1000)}.wav`;
      const outputPath = path.join(wavDir, filename);

      logger.info(`Starting 5-second recording to ${filename}`);

      // Start recording
      const recording = recorder.record({
        sampleRateHertz: sampleRateHertz,
        threshold: 0,
        verbose: false,
        recordProgram: 'arecord',
        silence: '0.0',
      });

      // Write to file
      const fileStream = fs.createWriteStream(outputPath);
      recording.stream().pipe(fileStream);

      // Record for 5 seconds then stop
      setTimeout(() => {
        recording.stop();
        logger.info(`Recording completed and saved to ${filename}`);
        resolve(outputPath);
      }, 5000);
    } catch (error) {
      logger.error('Error recording voice:', error);
      reject(error);
    }
  });
