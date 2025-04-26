import textToSpeech from '@google-cloud/text-to-speech';
import Speaker from 'speaker';
import stream from 'stream';
import { logger } from '../utils/logger.ts';

// Creates a client
const client = new textToSpeech.TextToSpeechClient();

// Function to play audio buffer directly
const playAudioBuffer = (audioBuffer: Buffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a readable stream from the buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(audioBuffer);

      // MP3 needs to be decoded first, so we'll use PCM format instead
      bufferStream
        .pipe(
          new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 24000,
          }),
        )
        .on('finish', () => {
          logger.info('Audio playback finished');
          resolve();
        })
        .on('error', (err) => {
          logger.error(`Speaker error: ${err}`);
          reject(err);
        });
    } catch (error) {
      logger.error(`Error setting up audio playback: ${error}`);
      reject(error);
    }
  });
};

export async function playAudio(text: string) {
  const request = {
    input: { text: text },
    voice: { languageCode: 'en-IN', ssmlGender: 'FEMALE' },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 24000,
    },
  } as const;

  const [response] = await client.synthesizeSpeech(request);
  console.log('Text to audio conversion completed. Playing audio...');

  try {
    await playAudioBuffer(response.audioContent as Buffer);
  } catch (error) {
    console.error('Failed to play audio:', error);
  }
}
