import Redis from 'ioredis';
import { logger } from '../observability/logger';

interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private config: RedisConfig) {
    this.connect();
  }

  private async connect() {
    try {
      if (this.config.url) {
        // Use connection URL (e.g., from Upstash)
        this.client = new Redis(this.config.url, {
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          lazyConnect: true,
          ...this.config
        });
      } else {
        // Use individual config options
        this.client = new Redis({
          host: this.config.host || 'localhost',
          port: this.config.port || 6379,
          password: this.config.password,
          db: this.config.db || 0,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          lazyConnect: true,
          ...this.config
        });
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      // Test connection
      await this.client.ping();
      
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.client = null;
    }
  }

  private getTenantKey(tenantId: string, key: string): string {
    return `tenant:${tenantId}:${key}`;
  }

  // ===================================
  // TENANT-ISOLATED OPERATIONS
  // ===================================

  async set(tenantId: string, key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) {
      logger.warn('Redis client not available, operation skipped');
      return false;
    }

    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      if (ttlSeconds) {
        await this.client.setex(tenantKey, ttlSeconds, value);
      } else {
        await this.client.set(tenantKey, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  async get(tenantId: string, key: string): Promise<string | null> {
    if (!this.client) {
      logger.warn('Redis client not available, returning null');
      return null;
    }

    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      return await this.client.get(tenantKey);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async del(tenantId: string, key: string): Promise<boolean> {
    if (!this.client) {
      logger.warn('Redis client not available, operation skipped');
      return false;
    }

    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      const result = await this.client.del(tenantKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(tenantId: string, key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      const result = await this.client.exists(tenantKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async expire(tenantId: string, key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      const result = await this.client.expire(tenantKey, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  // ===================================
  // SESSION MANAGEMENT
  // ===================================

  async setSession(tenantId: string, sessionId: string, sessionData: object, ttlSeconds = 3600): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.set(tenantId, sessionKey, JSON.stringify(sessionData), ttlSeconds);
  }

  async getSession(tenantId: string, sessionId: string): Promise<object | null> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.get(tenantId, sessionKey);
    
    if (sessionData) {
      try {
        return JSON.parse(sessionData);
      } catch (error) {
        logger.error('Failed to parse session data:', error);
        return null;
      }
    }
    
    return null;
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.del(tenantId, sessionKey);
  }

  async extendSession(tenantId: string, sessionId: string, ttlSeconds = 3600): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.expire(tenantId, sessionKey, ttlSeconds);
  }

  // ===================================
  // CONVERSATION CACHE
  // ===================================

  async setConversationContext(
    tenantId: string, 
    conversationId: string, 
    context: object, 
    ttlSeconds = 1800
  ): Promise<boolean> {
    const contextKey = `conversation:${conversationId}:context`;
    return await this.set(tenantId, contextKey, JSON.stringify(context), ttlSeconds);
  }

  async getConversationContext(tenantId: string, conversationId: string): Promise<object | null> {
    const contextKey = `conversation:${conversationId}:context`;
    const contextData = await this.get(tenantId, contextKey);
    
    if (contextData) {
      try {
        return JSON.parse(contextData);
      } catch (error) {
        logger.error('Failed to parse conversation context:', error);
        return null;
      }
    }
    
    return null;
  }

  // ===================================
  // RATE LIMITING
  // ===================================

  async incrementRateLimit(
    tenantId: string, 
    identifier: string, 
    windowSeconds: number, 
    limit: number
  ): Promise<{ count: number; ttl: number; allowed: boolean }> {
    if (!this.client) {
      return { count: 0, ttl: 0, allowed: true };
    }

    try {
      const rateLimitKey = `rate_limit:${identifier}`;
      const tenantKey = this.getTenantKey(tenantId, rateLimitKey);
      
      const pipeline = this.client.pipeline();
      pipeline.incr(tenantKey);
      pipeline.expire(tenantKey, windowSeconds);
      pipeline.ttl(tenantKey);
      
      const results = await pipeline.exec();
      
      if (!results || results.length < 3) {
        throw new Error('Pipeline execution failed');
      }

      const count = results[0][1] as number;
      const ttl = results[2][1] as number;
      
      return {
        count,
        ttl: ttl > 0 ? ttl : windowSeconds,
        allowed: count <= limit
      };
    } catch (error) {
      logger.error('Redis rate limit error:', error);
      return { count: 0, ttl: 0, allowed: true };
    }
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis PING error:', error);
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  // Get the underlying Redis client for advanced operations
  getClient(): Redis | null {
    return this.client;
  }
}

// ===================================
// MOCK REDIS CLIENT (FALLBACK)
// ===================================

interface MockCacheEntry {
  value: string;
  expires?: Date;
}

class MockRedisClient {
  private cache: Map<string, MockCacheEntry> = new Map();
  private isConnected = true;

  constructor() {
    logger.warn('⚠️  Redis unavailable - using in-memory cache fallback');
    logger.info('💨 Session and cache data will be stored temporarily in memory');
    logger.info('🔄 Normal functionality will resume automatically when Redis becomes available');
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanupExpiredEntries(), 60000); // Every minute
  }

  private getTenantKey(tenantId: string, key: string): string {
    return `tenant:${tenantId}:${key}`;
  }

  private cleanupExpiredEntries() {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires && entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  // ===================================
  // TENANT-ISOLATED OPERATIONS
  // ===================================

  async set(tenantId: string, key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      const entry: MockCacheEntry = {
        value,
        expires: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : undefined
      };
      
      this.cache.set(tenantKey, entry);
      
      logger.debug('Mock Redis: SET operation', { 
        tenantId, 
        key, 
        ttl: ttlSeconds,
        fallbackMode: true 
      });
      
      return true;
    } catch (error) {
      logger.error('Mock Redis SET error:', error);
      return false;
    }
  }

  async get(tenantId: string, key: string): Promise<string | null> {
    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      const entry = this.cache.get(tenantKey);
      
      if (!entry) return null;
      
      // Check if expired
      if (entry.expires && entry.expires < new Date()) {
        this.cache.delete(tenantKey);
        return null;
      }
      
      return entry.value;
    } catch (error) {
      logger.error('Mock Redis GET error:', error);
      return null;
    }
  }

  async del(tenantId: string, key: string): Promise<boolean> {
    try {
      const tenantKey = this.getTenantKey(tenantId, key);
      return this.cache.delete(tenantKey);
    } catch (error) {
      logger.error('Mock Redis DEL error:', error);
      return false;
    }
  }

  async exists(tenantId: string, key: string): Promise<boolean> {
    const tenantKey = this.getTenantKey(tenantId, key);
    const entry = this.cache.get(tenantKey);
    
    if (!entry) return false;
    
    // Check if expired
    if (entry.expires && entry.expires < new Date()) {
      this.cache.delete(tenantKey);
      return false;
    }
    
    return true;
  }

  async expire(tenantId: string, key: string, ttlSeconds: number): Promise<boolean> {
    const tenantKey = this.getTenantKey(tenantId, key);
    const entry = this.cache.get(tenantKey);
    
    if (!entry) return false;
    
    entry.expires = new Date(Date.now() + ttlSeconds * 1000);
    return true;
  }

  // ===================================
  // SESSION MANAGEMENT
  // ===================================

  async setSession(tenantId: string, sessionId: string, sessionData: object, ttlSeconds = 3600): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.set(tenantId, sessionKey, JSON.stringify(sessionData), ttlSeconds);
  }

  async getSession(tenantId: string, sessionId: string): Promise<object | null> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.get(tenantId, sessionKey);
    
    if (sessionData) {
      try {
        return JSON.parse(sessionData);
      } catch (error) {
        logger.error('Failed to parse session data:', error);
        return null;
      }
    }
    
    return null;
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.del(tenantId, sessionKey);
  }

  async extendSession(tenantId: string, sessionId: string, ttlSeconds = 3600): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.expire(tenantId, sessionKey, ttlSeconds);
  }

  // ===================================
  // CONVERSATION CACHE
  // ===================================

  async setConversationContext(
    tenantId: string, 
    conversationId: string, 
    context: object, 
    ttlSeconds = 1800
  ): Promise<boolean> {
    const contextKey = `conversation:${conversationId}:context`;
    return await this.set(tenantId, contextKey, JSON.stringify(context), ttlSeconds);
  }

  async getConversationContext(tenantId: string, conversationId: string): Promise<object | null> {
    const contextKey = `conversation:${conversationId}:context`;
    const contextData = await this.get(tenantId, contextKey);
    
    if (contextData) {
      try {
        return JSON.parse(contextData);
      } catch (error) {
        logger.error('Failed to parse conversation context:', error);
        return null;
      }
    }
    
    return null;
  }

  // ===================================
  // RATE LIMITING (Simplified for fallback)
  // ===================================

  async incrementRateLimit(
    tenantId: string, 
    identifier: string, 
    windowSeconds: number, 
    limit: number
  ): Promise<{ count: number; ttl: number; allowed: boolean }> {
    // Simplified rate limiting for fallback mode
    const rateLimitKey = `rate_limit:${identifier}`;
    const tenantKey = this.getTenantKey(tenantId, rateLimitKey);
    
    const entry = this.cache.get(tenantKey);
    let count = 1;
    
    if (entry) {
      if (entry.expires && entry.expires > new Date()) {
        count = parseInt(entry.value) + 1;
      } else {
        count = 1;
      }
    }
    
    const expires = new Date(Date.now() + windowSeconds * 1000);
    this.cache.set(tenantKey, {
      value: count.toString(),
      expires
    });
    
    return {
      count,
      ttl: windowSeconds,
      allowed: count <= limit
    };
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  async ping(): Promise<boolean> {
    return true; // Mock is always available
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.cache.clear();
    this.isConnected = false;
  }

  getClient(): Redis | null {
    return null; // No real client in mock mode
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let redisInstance: RedisClient | MockRedisClient | null = null;
let fallbackMode = false;
let fallbackNotified = false;

export function getRedisClient(): RedisClient | MockRedisClient {
  if (!redisInstance) {
    initializeRedisClient();
  }

  // Check if current instance is disconnected and we're not already in fallback mode
  if (redisInstance instanceof RedisClient && !redisInstance.getConnectionStatus() && !fallbackMode) {
    logger.warn('Redis connection lost, switching to fallback mode');
    activateRedisFallbackMode();
  }

  return redisInstance!;
}

function initializeRedisClient() {
  const config: RedisConfig = {
    url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0')
  };

  try {
    logger.info('Attempting to connect to Redis...');
    const testClient = new RedisClient(config);
    redisInstance = testClient;
    
    // Schedule a connection check after a brief delay
    setTimeout(async () => {
      try {
        const isConnected = await testClient.ping();
        if (!isConnected && !fallbackMode) {
          logger.warn('Redis ping failed, switching to fallback mode');
          activateRedisFallbackMode();
        } else if (isConnected && fallbackMode) {
          logger.info('✅ Redis connection restored, switching back from fallback mode');
          redisInstance = testClient;
          fallbackMode = false;
          fallbackNotified = false;
        }
      } catch (error) {
        if (!fallbackMode) {
          logger.error('Redis health check failed, switching to fallback mode:', error);
          activateRedisFallbackMode();
        }
      }
    }, 1000);
    
  } catch (error) {
    logger.error('Error initializing Redis client, falling back to mock:', error);
    activateRedisFallbackMode();
  }
}

function activateRedisFallbackMode() {
  if (!fallbackNotified) {
    logger.warn('⚠️  Redis unavailable - activating fallback mode with in-memory cache');
    logger.info('💨 Sessions and cache will be stored temporarily in memory');
    logger.info('🔄 Normal functionality will resume automatically when Redis becomes available');
    fallbackNotified = true;
  }
  
  fallbackMode = true;
  redisInstance = new MockRedisClient();
}

// Helper function to check if we're in fallback mode
export function isInRedisFallbackMode(): boolean {
  return fallbackMode;
}

// Function to reset to normal mode (useful for testing)
export function resetRedisClient() {
  redisInstance = null;
  fallbackMode = false;
  fallbackNotified = false;
}

export { RedisClient };
export type { RedisConfig };