import WebSocket from 'ws';
import recorder from 'node-record-lpcm16';

const sampleRateHertz = 16000;

let recordingInstance = null;
let recognizeStream = null;

export const startRecording = (ws: WebSocket) => {
  stopRecording();

  console.log('Start speaking...');
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
    .on('data', function (data) {
      ws.send(data, { binary: true });
    });

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
