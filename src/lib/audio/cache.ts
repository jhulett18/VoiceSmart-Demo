'use client';

import { LRUCache } from 'lru-cache';
import { logger } from '../observability/logger';

interface CachedAudio {
  data: ArrayBuffer;
  contentType: string;
  duration?: number;
  size: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  metadata: {
    text: string;
    voice?: string;
    language?: string;
    tenantId: string;
    [key: string]: any;
  };
}

interface AudioCacheConfig {
  maxSize: number; // Maximum number of cached items
  maxMemoryMB: number; // Maximum memory usage in MB
  ttl?: number; // Time to live in milliseconds
  preloadCommonPhrases?: boolean;
}

interface AudioCacheStats {
  size: number;
  memoryUsageMB: number;
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  oldestItem?: Date;
  newestItem?: Date;
}

class AudioCache {
  private cache: LRUCache<string, CachedAudio>;
  private stats = {
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0
  };
  private config: AudioCacheConfig;

  constructor(config: AudioCacheConfig) {
    this.config = {
      ttl: 24 * 60 * 60 * 1000, // 24 hours default
      preloadCommonPhrases: true,
      ...config
    };

    this.cache = new LRUCache<string, CachedAudio>({
      max: this.config.maxSize,
      maxSize: this.config.maxMemoryMB * 1024 * 1024, // Convert MB to bytes
      sizeCalculation: (value) => value.size,
      ttl: this.config.ttl,
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: (value, key) => {
        logger.debug('Audio cache item disposed', {
          key,
          size: value.size,
          accessCount: value.accessCount
        });
      }
    });

    logger.info('Audio cache initialized', {
      maxSize: this.config.maxSize,
      maxMemoryMB: this.config.maxMemoryMB,
      ttlMs: this.config.ttl
    });

    if (this.config.preloadCommonPhrases) {
      this.preloadCommonPhrases();
    }
  }

  // ===================================
  // CACHE OPERATIONS
  // ===================================

  get(text: string, tenantId: string, voice?: string): CachedAudio | null {
    this.stats.totalRequests++;
    
    const key = this.generateKey(text, tenantId, voice);
    const cached = this.cache.get(key);

    if (cached) {
      this.stats.totalHits++;
      cached.lastAccessed = new Date();
      cached.accessCount++;

      logger.debug('Audio cache hit', {
        key,
        text: text.substring(0, 50) + '...',
        accessCount: cached.accessCount,
        size: cached.size
      });

      return cached;
    } else {
      this.stats.totalMisses++;

      logger.debug('Audio cache miss', {
        key,
        text: text.substring(0, 50) + '...'
      });

      return null;
    }
  }

  set(
    text: string,
    tenantId: string,
    audioData: ArrayBuffer,
    contentType: string,
    voice?: string,
    metadata?: Record<string, any>
  ): boolean {
    try {
      const key = this.generateKey(text, tenantId, voice);
      const size = audioData.byteLength;

      // Check if audio data is too large for cache
      const maxItemSize = (this.config.maxMemoryMB * 1024 * 1024) * 0.1; // 10% of total cache size
      if (size > maxItemSize) {
        logger.warn('Audio too large for cache', {
          size,
          maxItemSize,
          text: text.substring(0, 50) + '...'
        });
        return false;
      }

      const cachedAudio: CachedAudio = {
        data: audioData,
        contentType,
        size,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        metadata: {
          text,
          voice,
          language: 'en-US', // Default language
          tenantId,
          ...metadata
        }
      };

      this.cache.set(key, cachedAudio);

      logger.debug('Audio cached', {
        key,
        text: text.substring(0, 50) + '...',
        size,
        contentType
      });

      return true;
    } catch (error) {
      logger.error('Failed to cache audio:', error);
      return false;
    }
  }

  has(text: string, tenantId: string, voice?: string): boolean {
    const key = this.generateKey(text, tenantId, voice);
    return this.cache.has(key);
  }

  delete(text: string, tenantId: string, voice?: string): boolean {
    const key = this.generateKey(text, tenantId, voice);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.resetStats();
    logger.info('Audio cache cleared');
  }

  // ===================================
  // BULK OPERATIONS
  // ===================================

  preloadCommonPhrases(): void {
    const commonPhrases = this.getCommonPhrases();

    logger.info('Preloading common phrases', {
      count: commonPhrases.length
    });

    // Note: In a real implementation, these would be generated
    // using the TTS service and cached. For now, we'll just
    // mark them as available for caching when first requested.
    
    commonPhrases.forEach(phrase => {
      // Store placeholder entries that indicate these should be prioritized
      const key = this.generateKey(phrase.text, phrase.tenantId);
      // We'll implement actual preloading when TTS service is called
    });
  }

  warmup(phrases: Array<{ text: string; tenantId: string; voice?: string }>): void {
    logger.info('Warming up audio cache', {
      phraseCount: phrases.length
    });

    // This would typically call TTS service for each phrase
    // For now, we'll just log the intent
    phrases.forEach(phrase => {
      logger.debug('Warmup phrase queued', {
        text: phrase.text.substring(0, 30) + '...',
        tenantId: phrase.tenantId
      });
    });
  }

  // ===================================
  // ANALYTICS & MONITORING
  // ===================================

  getStats(): AudioCacheStats {
    const values = Array.from(this.cache.values());
    const memoryUsageMB = values.reduce((sum, item) => sum + item.size, 0) / (1024 * 1024);
    
    let oldestItem: Date | undefined;
    let newestItem: Date | undefined;

    if (values.length > 0) {
      oldestItem = values.reduce((oldest, item) => 
        item.createdAt < oldest ? item.createdAt : oldest, values[0].createdAt);
      newestItem = values.reduce((newest, item) => 
        item.createdAt > newest ? item.createdAt : newest, values[0].createdAt);
    }

    return {
      size: this.cache.size,
      memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
      hitRate: this.stats.totalRequests > 0 ? 
        Math.round((this.stats.totalHits / this.stats.totalRequests) * 100) / 100 : 0,
      totalRequests: this.stats.totalRequests,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      oldestItem,
      newestItem
    };
  }

  getMostAccessedItems(limit = 10): Array<{
    text: string;
    accessCount: number;
    size: number;
    tenantId: string;
  }> {
    const items = Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return items.map(item => ({
      text: item.metadata.text,
      accessCount: item.accessCount,
      size: item.size,
      tenantId: item.metadata.tenantId
    }));
  }

  getItemsByTenant(tenantId: string): Array<{
    text: string;
    size: number;
    accessCount: number;
    createdAt: Date;
  }> {
    const items = Array.from(this.cache.values())
      .filter(item => item.metadata.tenantId === tenantId)
      .sort((a, b) => b.accessCount - a.accessCount);

    return items.map(item => ({
      text: item.metadata.text,
      size: item.size,
      accessCount: item.accessCount,
      createdAt: item.createdAt
    }));
  }

  // ===================================
  // CACHE MANAGEMENT
  // ===================================

  cleanup(): void {
    const initialSize = this.cache.size;
    const cutoffDate = new Date(Date.now() - (this.config.ttl || 24 * 60 * 60 * 1000));

    // Remove old, rarely accessed items
    for (const [key, value] of this.cache.entries()) {
      if (value.createdAt < cutoffDate && value.accessCount < 2) {
        this.cache.delete(key);
      }
    }

    const removedCount = initialSize - this.cache.size;
    if (removedCount > 0) {
      logger.info('Audio cache cleanup completed', {
        removedItems: removedCount,
        remainingItems: this.cache.size
      });
    }
  }

  evictLeastUsed(count: number): number {
    const items = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.accessCount - b.accessCount)
      .slice(0, count);

    let evicted = 0;
    for (const [key] of items) {
      if (this.cache.delete(key)) {
        evicted++;
      }
    }

    logger.debug('Evicted least used items', {
      requestedCount: count,
      actuallyEvicted: evicted
    });

    return evicted;
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  private generateKey(text: string, tenantId: string, voice?: string): string {
    // Create a stable cache key
    const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
    const voiceKey = voice || 'default';
    return `${tenantId}:${voiceKey}:${btoa(normalizedText)}`;
  }

  private resetStats(): void {
    this.stats = {
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0
    };
  }

  private getCommonPhrases(): Array<{ text: string; tenantId: string }> {
    // Common phrases that are likely to be used frequently
    return [
      // Universal greetings and responses
      { text: "Hello! How can I help you today?", tenantId: "*" },
      { text: "Thank you for calling. How may I assist you?", tenantId: "*" },
      { text: "I'd be happy to help you with that.", tenantId: "*" },
      { text: "Is there anything else I can help you with?", tenantId: "*" },
      { text: "Thank you for your call. Have a great day!", tenantId: "*" },
      { text: "I'm sorry, I didn't quite understand that. Could you please repeat?", tenantId: "*" },
      
      // Dental clinic specific
      { text: "Thank you for calling BrightSmile Dental Clinic.", tenantId: "550e8400-e29b-41d4-a716-446655440001" },
      { text: "We recommend cleanings every six months.", tenantId: "550e8400-e29b-41d4-a716-446655440001" },
      { text: "We accept most major insurance plans.", tenantId: "550e8400-e29b-41d4-a716-446655440001" },
      
      // Auto repair specific
      { text: "Thank you for calling ProFix Auto Repair.", tenantId: "550e8400-e29b-41d4-a716-446655440002" },
      { text: "All our repairs come with a 12-month warranty.", tenantId: "550e8400-e29b-41d4-a716-446655440002" },
      { text: "We offer free estimates for major repairs.", tenantId: "550e8400-e29b-41d4-a716-446655440002" },
      
      // Fitness gym specific
      { text: "Welcome to PulsePoint Fitness Gym!", tenantId: "550e8400-e29b-41d4-a716-446655440003" },
      { text: "We offer a free 3-day trial for new members.", tenantId: "550e8400-e29b-41d4-a716-446655440003" },
      { text: "Our personal trainers can help you reach your fitness goals.", tenantId: "550e8400-e29b-41d4-a716-446655440003" }
    ];
  }

  // ===================================
  // AUDIO PROCESSING UTILITIES
  // ===================================

  async processAudioForCaching(audioBlob: Blob): Promise<{
    data: ArrayBuffer;
    contentType: string;
    duration?: number;
  }> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Detect audio format
      const contentType = audioBlob.type || 'audio/wav';
      
      // For now, we'll store audio as-is
      // In a production system, you might want to:
      // 1. Convert to a standard format (e.g., MP3)
      // 2. Compress audio
      // 3. Extract duration information
      
      return {
        data: arrayBuffer,
        contentType,
        duration: this.estimateAudioDuration(arrayBuffer, contentType)
      };
    } catch (error) {
      logger.error('Failed to process audio for caching:', error);
      throw error;
    }
  }

  private estimateAudioDuration(data: ArrayBuffer, contentType: string): number | undefined {
    // This is a rough estimation - in production you'd use proper audio analysis
    if (contentType.includes('wav')) {
      // Very rough WAV duration estimation
      return data.byteLength / (44100 * 2 * 2); // Assuming 44.1kHz, 16-bit, stereo
    }
    
    // For other formats, we can't easily estimate without proper decoding
    return undefined;
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let audioCacheInstance: AudioCache | null = null;

export function getAudioCache(): AudioCache {
  if (!audioCacheInstance) {
    const config: AudioCacheConfig = {
      maxSize: parseInt(process.env.AUDIO_CACHE_SIZE || '100'),
      maxMemoryMB: parseInt(process.env.AUDIO_CACHE_MEMORY_MB || '50'),
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      preloadCommonPhrases: process.env.ENABLE_VOICE_CACHING !== 'false'
    };

    audioCacheInstance = new AudioCache(config);
  }

  return audioCacheInstance;
}

export { AudioCache };
export type { CachedAudio, AudioCacheConfig, AudioCacheStats };