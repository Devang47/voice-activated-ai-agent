import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { logger } from '../utils/logger.ts';
import path from 'path';
import os from 'os';

// Creates a client
const client = new textToSpeech.TextToSpeechClient();
const execAsync = promisify(exec);

// Function to play audio text using system commands
export async function playAudio(text: string): Promise<void> {
  try {
    logger.info(`Synthesizing speech for: "${text}"`);

    // Construct the request
    const request = {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    } as const;

    // Get the audio content
    const [response] = await client.synthesizeSpeech(request);

    // Create a temporary file path
    const tempFilePath = path.join(`tts-${Date.now()}.mp3`);

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
      await execAsync(`cvlc "${tempFilePath}"`);
    }

    // Delete temp file after playing
    // await fs.promises.unlink(tempFilePath);
    logger.info('Audio playback completed and temp file deleted');
  } catch (error) {
    logger.error('Error in audio playback:', error);
    throw error;
  }
}
