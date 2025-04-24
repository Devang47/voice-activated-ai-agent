import { WebSocketServer } from 'ws';
import { Gpio } from 'onoff';

const PORT = 8080;
const LED_PIN = 17;
const led = new Gpio(LED_PIN, 'out');

const wss = new WebSocketServer({ port: PORT });
console.log(`🟢 Pi server running on ws://<Pi-IP>:${PORT}`);

let ledState = 0;

wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  ws.send('🤖 Connected to Raspberry Pi');

  ws.on('message', (message) => {
    const msg = message.toString();
    console.log(`📩 Received: ${msg}`);

    if (msg === 'toggle-led') {
      ledState = ledState ^ 1; // toggle 0 ↔ 1
      //led.writeSync(ledState);
      console.log(`💡 LED is now ${ledState ? 'ON' : 'OFF'}`);
      ws.send(`LED is now ${ledState ? 'ON' : 'OFF'}`);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });
});

process.on('SIGINT', () => {
  led.writeSync(0);
  led.unexport();
  process.exit();
});
