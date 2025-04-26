import Websocket from 'ws';

export const giveIntro = async (ws: Websocket) => {
  ws.send("Hello! I'm your AI assistant. How can I help you today?");
};
