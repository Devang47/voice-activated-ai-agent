import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { logger } from '../utils/logger.ts';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';
import { handleIntruder } from './photo.ts';

// Creates a client
const client = new textToSpeech.TextToSpeechClient();
const execAsync = promisify(exec);

// Function to play audio text using system commands
export async function playAudio(text: string, ws: WebSocket): Promise<void> {
  try {
    if (process.env.ENV && process.env.ENV === 'development') {
      logger.info('Skipping audio playback in development mode');

      if (text.includes('Please say the secret phrase')) {
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              role: 'system',
              content: 'start recording',
            }),
          );
        }, 500);
      } else if (text.includes('Failed to authenticate')) {
        handleIntruder();
      }
    } else {
      // Construct the request
      const request = {
        input: { text },
        voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
      } as const;

      // Get the audio content
      const [response] = await client.synthesizeSpeech(request);

      // Create a temporary file path
      const tempFilePath = path.join('wav', `tts-${Date.now()}.mp3`);

      // Write to temp file
      await fs.promises.writeFile(
        tempFilePath,
        response.audioContent as Buffer,
        'binary',
      );

      logger.info(`Audio file saved to ${tempFilePath}, playing...`);

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

      if (text.includes('Please say the secret phrase')) {
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              role: 'system',
              content: 'start recording',
            }),
          );
        }, 500);
      } else if (text.includes('Failed to authenticate')) {
        handleIntruder();
      }

      // Delete temp file after playing
      await fs.promises.unlink(tempFilePath);
      logger.info('Audio playback completed and temp file deleted');
    }
  } catch (error) {
    logger.error('Error in audio playback:', error);
    throw error;
  }
}
