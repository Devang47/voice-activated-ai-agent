import Websocket from 'ws';

export const giveIntro = async (ws: Websocket) => {
  ws.send(
    JSON.stringify({
      role: 'assistant',
      content: `
      Introducing LISA: Your Voice-Activated AI Assistant!
Whether you're a busy professional, student, parent, or elderly user, LISA (Lively Interactive Scheduling Assistant) is designed for you. Unlike traditional assistants, LISA focuses on voice-first interaction to cut down screen time and boost productivity. With features like smart email management, intelligent calendar scheduling, task tracking, real-time weather updates, SOS safety activation, medication reminders, and seamless web search, LISA is a true productivity partner—not just another voice assistant.

Built by a talented team — Manas Singhal (Team Leader), Devang Saklani, Robin Rathore, and Pankaj Lamgria. LISA is designed to make technology more human-centered. Together, they've created an assistant that frees you from digital fatigue while keeping you informed, connected, and productive. Just say "Hey LISA" and experience the future of AI assistance!`,
      sessionActive: true,
    }),
  );
  return JSON.stringify({
    success: true,
  });
};
