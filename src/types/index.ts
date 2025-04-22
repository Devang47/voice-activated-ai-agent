export type RedisMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type WSMessage = {
  role: string;
  content: string;
  sessionActive: boolean;
};
