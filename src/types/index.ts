export type RedisMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type WSMessage = {
  role: string;
  content: string;
  sessionActive: boolean;
  sos?: boolean;
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

export type TODO = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
};

export type Reminder = {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
};

export type NewsArticle = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description: string;
};

export type NewsResponse = {
  success: boolean;
  topic: string;
  articles?: NewsArticle[];
  count?: number;
  error?: string;
};

export type WeatherForecastResponse = {
  success: boolean;
  location: string;
  forecast?: Array<{
    date: string;
    temperature: {
      min: number;
      max: number;
      unit: string;
    };
    conditions: string;
    description: string;
    humidity: string;
    wind: string;
    precipitation: string;
  }>;
  days?: number;
  error?: string;
};
