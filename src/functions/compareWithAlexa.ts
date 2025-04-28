import Websocket from 'ws';

export const compareWithAlexa = async (ws: Websocket) => {
  ws.send(
    JSON.stringify({
      role: 'assistant',
      content: `
While Alexa, Siri, and Google Assistant cover basic tasks, LISA is in a league of its own. It offers full professional capabilities like composing emails, managing calendars, scheduling meetings, and conducting web searches with summaries—features others only offer in limited forms. LISA also prioritizes user safety with an SOS feature for emergencies, provides elderly care through medication tracking and family notifications, and delivers career-focused tools like project management and meeting summaries. Plus, it seamlessly integrates with major apps, reduces screen time by 37%, and communicates in a natural, human-like way.

Unlike other assistants that feel robotic or generic, LISA learns your preferences, adapts to your routines, and enhances both personal and professional life with intelligence and intuition. If you're looking for more than a basic assistant—a true productivity partner—LISA is the clear and only choice.`,
      sessionActive: true,
    }),
  );
  return JSON.stringify({
    success: true,
  });
};
