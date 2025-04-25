import type { WebSocket } from 'ws';
import { inactivityMessage, inactivityTimeoutDuration } from './constants.js';
import { randomUUID } from 'crypto';
// import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { logger } from '../utils/logger.js';

let inactivityTimer: NodeJS.Timeout | null = null;
let sessionActive = true;

export const startInactivityTimer = (ws: WebSocket) => {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  // Reset authentication timer when there's activity
  sessionManager.resetAuthTimer();

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
  private authenticated = false;
  private authTimer: NodeJS.Timeout | null = null;
  private authTimeout = 120000; // 2 minutes in milliseconds

  // Singleton pattern
  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public create(): string {
    this.sessionId = randomUUID();
    this.authenticated = false;
    return this.sessionId;
  }

  public get(): string {
    return this.sessionId;
  }

  public authenticate(): void {
    this.authenticated = true;

    // Set authentication timeout
    if (this.authTimer) {
      clearTimeout(this.authTimer);
    }

    this.authTimer = setTimeout(() => {
      this.authenticated = false;
      logger.info('Authentication expired');
    }, this.authTimeout);
  }

  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  public resetAuthTimer(): void {
    if (this.authenticated && this.authTimer) {
      clearTimeout(this.authTimer);
      this.authTimer = setTimeout(() => {
        this.authenticated = false;
        logger.info('Authentication expired');
      }, this.authTimeout);
    }
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
