// Define message types for WebSocket communication
export interface ClientMessage {
  type: string;
  payload: any;
}

export interface ServerMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Voice processing related types
export interface VoiceData {
  audioBuffer: ArrayBuffer;
  sampleRate: number;
}

// Response types
export interface AIResponse {
  text: string;
  action?: string;
  data?: any;
}
