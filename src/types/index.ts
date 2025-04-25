export type RedisMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type WSMessage = {
  role: string;
  content: string;
  sessionActive: boolean;
};

export type WeatherResponse = {
  location: string;
  temperature: {
    value: number;
    unit: string;
  };
  conditions: string;
  humidity: string;
  wind: string;
  last_updated: string;
};

export type EmailResponse = {
  success: boolean;
  message: string;
  details?: {
    to: string;
    subject: string;
    timestamp: string;
  };
  error?: string;
};
export interface WebSearchResponse {
  success: boolean;
  results?: string;
  error?: string;
  details?: {
    query: string;
    timestamp: string;
  };
}
