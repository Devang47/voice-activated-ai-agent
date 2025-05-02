import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { logger } from '../utils/logger.ts';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';
import { handleIntruder } from './photo.ts';
import crypto from 'crypto';

// Creates a client
const client = new textToSpeech.TextToSpeechClient();
const execAsync = promisify(exec);

// Function to generate a hash from text
function generateHash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Function to play audio text using system commands
export async function playAudio(text: string, ws: WebSocket): Promise<void> {
  try {
    if (process.env.ENV && process.env.ENV === 'development') {
      logger.info('Skipping audio playback in development mode');

      if (text.toLowerCase().includes('please say the secret phrase')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        ws.send(
          JSON.stringify({
            role: 'system',
            content: 'start recording',
          }),
        );
      } else if (text.toLowerCase().includes('failed to authenticate')) {
        console.log('handling intruder');
        handleIntruder();
      }
    } else {
      // Generate a hash for the text
      const textHash = generateHash(text);
      const tempFilePath = path.join('wav', `tts-${textHash}.mp3`);

      // Check if file already exists
      let fileExists = false;
      try {
        await fs.promises.access(tempFilePath);
        fileExists = true;
        logger.info(`Found existing audio file for text: ${tempFilePath}`);
      } catch (err) {
        // console.log(err);
        fileExists = false;
      }

      // Only synthesize speech if the file doesn't exist
      if (!fileExists) {
        // Construct the request
        const request = {
          input: { text },
          voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
          audioConfig: { audioEncoding: 'MP3' },
        } as const;

        // Get the audio content
        const [response] = await client.synthesizeSpeech(request);

        // Create directory if it doesn't exist
        const wavDir = path.join('wav');
        try {
          await fs.promises.access(wavDir);
        } catch (err) {
          // console.log(err);

          await fs.promises.mkdir(wavDir, { recursive: true });
        }

        // Write to file
        await fs.promises.writeFile(
          tempFilePath,
          response.audioContent as Buffer,
          'binary',
        );

        logger.info(`Audio file generated and saved to ${tempFilePath}`);
      }

      logger.info(`Playing audio file: ${tempFilePath}`);

      // Play using system commands based on OS
      const platform = os.platform();
      if (platform === 'darwin') {
        // macOS
        await execAsync(`afplay "${tempFilePath}"`);
      } else if (platform === 'win32') {
        // Windows
        await execAsync(`start "${tempFilePath}"`);
      } else {
        // Linux and others
        await execAsync(
          `play "${tempFilePath}" || mpg123 "${tempFilePath}" || mpg321 "${tempFilePath}" || aplay "${tempFilePath}"`,
        );
      }

      // Do not delete the file as we want to cache it
      logger.info('Audio playback completed');

      if (text.toLowerCase().includes('failed to authenticate')) {
        handleIntruder();
      }

      if (text.toLowerCase().includes('please say the secret phrase')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        ws.send(
          JSON.stringify({
            role: 'system',
            content: 'start recording',
          }),
        );
      }
    }
  } catch (error) {
    logger.error('Error in audio playback:', error);
    throw error;
  }
}
