import { createClient, RedisClientType } from 'redis';
import { type RedisMessage } from './types/index.ts';
import { logger } from './utils/logger.ts';

/**
 * Redis storage configuration and helper methods
 */
export class RedisStorage {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor(
    private host: string = process.env.REDIS_HOST || 'localhost',
    private port: number = parseInt(process.env.REDIS_PORT || '6379'),
    private password: string = process.env.REDIS_PASSWORD || '',
  ) {
    this.client = createClient({
      url: `redis://${this.host}:${this.port}`,
      password: this.password,
      socket: {
        reconnectStrategy: (retries) => {
          // Reconnect with exponential backoff
          const delay = Math.min(retries * 50, 2000);
          return delay;
        },

        keepAlive: 10000,
        connectTimeout: 10000,
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis server
   */
  public async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.client.connect();
      this.isConnected = true;
      return;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Ensure Redis connection is active before performing operations
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Disconnect from Redis server
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
      } catch (error) {
        console.error('Failed to disconnect from Redis:', error);
        throw error;
      }
    }
  }

  /**
   * Store data in Redis
   * @param key - The key to store data under
   * @param value - The data to store (will be JSON stringified)
   */
  public async addMessage(key: string, value: RedisMessage[]): Promise<void> {
    try {
      await this.ensureConnection();

      const messages = (await this.getMessages(key)) || [];
      messages.push(...value);

      await this.client.set(key, JSON.stringify(messages));
    } catch (error) {
      console.error(`Failed to set data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve data from Redis
   * @param key - The key to retrieve data from
   */
  public async getMessages(key: string): Promise<RedisMessage[] | null> {
    try {
      await this.ensureConnection();

      const value = await this.client.get(key);

      if (!value) return null;

      return JSON.parse(value) as RedisMessage[];
    } catch (error) {
      console.error(`Failed to get data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete data from Redis
   * @param key - The key to delete
   */
  public async delete(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();

      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists in Redis
   * @param key - The key to check
   */
  public async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();

      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error(`Failed to check if key ${key} exists:`, error);
      throw error;
    }
  }
}

// Export a default instance
export default new RedisStorage();
