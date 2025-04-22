import { WebSocket } from 'ws';
import { inactivityMessage, inactivityTimeoutDuration } from './constants.js';
import { randomUUID } from 'crypto';
// import OpenAI from 'openai';
import Groq from 'groq-sdk';

let inactivityTimer: NodeJS.Timeout | null = null;
let sessionActive = true;

export const startInactivityTimer = (ws: WebSocket) => {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  inactivityTimer = setTimeout(() => {
    if (sessionActive) {
      sessionActive = false;
      ws.send(JSON.stringify(inactivityMessage));

      setTimeout(() => {
        ws.close();
      }, 1000);
    }
  }, inactivityTimeoutDuration);
};

class SessionManager {
  private static instance: SessionManager;
  private sessionId: string | null = null;

  // Singleton pattern
  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public create(): string {
    this.sessionId = randomUUID();
    return this.sessionId;
  }

  public get(): string {
    return this.sessionId;
  }
}

export const sessionManager = SessionManager.getInstance();

let client: Groq | null = null;
export const getOpenAiClient = () => {
  if (client) return client;

  try {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    // client = new OpenAI({
    //   apiKey: process.env.GROQ_API_KEY,
    //   baseURL: 'https://api.groq.com/openai/v1',
    // });
    return client;
  } catch (error) {
    console.error('Failed to initialize AI client:', error);
    throw new Error(
      'Could not initialize AI client. Please check your API keys.',
    );
  }
};
