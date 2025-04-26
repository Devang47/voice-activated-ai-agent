import recorder from 'node-record-lpcm16';
import speech from '@google-cloud/speech';

// Creates a client
const client = new speech.SpeechClient();

const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-IN';

let recordingInstance = null;
let recognizeStream = null;

const createRequest: any = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    speechContexts: [
      {
        phrases: [
          'lisa',
          'devang',
          'saklani',
          'arpit',
          'sushant',
          'chamoli',
          'devangsaklani@gamil.com',
        ],
        boost: 10.0,
      },
    ],
  },
  interimResults: false,
};

export const startRecording = () => {
  stopRecording();

  console.log('Start speaking...');

  recognizeStream = client
    .streamingRecognize(createRequest)
    .on('error', (error) => {
      console.error('Recognition error:', error);
      stopRecording();
    })
    .on('data', (data) => {
      if (
        data.results[0] &&
        data.results[0].alternatives[0] &&
        data.results[0].isFinal
      ) {
        console.log(
          `Final Transcription: ${data.results[0].alternatives[0].transcript}`,
        );
      }
    });

  recordingInstance = recorder
    .record({
      sampleRateHertz: sampleRateHertz,
      threshold: 0,
      verbose: false,
      recordProgram: 'arecord',
      silence: '15.0',
      bufferSize: 2048,
    })
    .stream()
    .on('error', (error) => {
      console.error('Recording error:', error);
      stopRecording();
    })
    .pipe(recognizeStream);

  return recordingInstance;
};

export const stopRecording = () => {
  if (recordingInstance) {
    recordingInstance.unpipe();
    recordingInstance.destroy();
    recordingInstance = null;
  }

  if (recognizeStream) {
    recognizeStream.end();
    recognizeStream.removeAllListeners();
    recognizeStream = null;
  }
};
