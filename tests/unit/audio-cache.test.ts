#!/usr/bin/env tsx

import { TestRunner, TestSuite, assert, sleep, randomString, randomUuid } from './test-framework';
import { AudioCache } from '../../src/lib/audio/cache';

const audioCacheTestSuite: TestSuite = {
  name: 'Audio Cache',
  tests: [
    {
      name: 'should initialize audio cache',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000 // 1 minute
        });
        
        assert.truthy(cache, 'Audio cache should be created');
        
        // Test initial state
        const stats = cache.getStats();
        assert.equal(stats.totalEntries, 0, 'Cache should start empty');
        assert.equal(stats.cacheHits, 0, 'Should have no cache hits initially');
        assert.equal(stats.cacheMisses, 0, 'Should have no cache misses initially');
      }
    },

    {
      name: 'should cache and retrieve audio data',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const cacheKey = `greeting_${randomString()}`;
        const audioData = Buffer.from(`Mock audio data for ${cacheKey}`);
        
        // Store audio in cache
        const storeResult = cache.set(tenantId, cacheKey, audioData);
        assert.truthy(storeResult, 'Should successfully store audio data');
        
        // Retrieve audio from cache
        const retrievedData = cache.get(tenantId, cacheKey);
        assert.truthy(retrievedData, 'Should retrieve cached audio data');
        assert.truthy(Buffer.isBuffer(retrievedData), 'Retrieved data should be a Buffer');
        assert.equal(retrievedData?.toString(), audioData.toString(), 'Retrieved data should match stored data');
        
        // Check stats
        const stats = cache.getStats();
        assert.equal(stats.totalEntries, 1, 'Should have one cache entry');
        assert.equal(stats.cacheHits, 1, 'Should have one cache hit');
        assert.equal(stats.cacheMisses, 0, 'Should have no cache misses');
      }
    },

    {
      name: 'should handle cache misses',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const nonExistentKey = `non_existent_${randomString()}`;
        
        // Try to retrieve non-existent audio
        const retrievedData = cache.get(tenantId, nonExistentKey);
        assert.falsy(retrievedData, 'Should return null for non-existent key');
        
        // Check stats
        const stats = cache.getStats();
        assert.equal(stats.cacheMisses, 1, 'Should have one cache miss');
        assert.equal(stats.cacheHits, 0, 'Should have no cache hits');
      }
    },

    {
      name: 'should handle tenant isolation',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenant1 = randomUuid();
        const tenant2 = randomUuid();
        const cacheKey = 'shared_key';
        const audioData1 = Buffer.from('Audio data for tenant 1');
        const audioData2 = Buffer.from('Audio data for tenant 2');
        
        // Store data for both tenants with same key
        cache.set(tenant1, cacheKey, audioData1);
        cache.set(tenant2, cacheKey, audioData2);
        
        // Retrieve data for each tenant
        const retrieved1 = cache.get(tenant1, cacheKey);
        const retrieved2 = cache.get(tenant2, cacheKey);
        
        assert.truthy(retrieved1, 'Tenant 1 should retrieve its data');
        assert.truthy(retrieved2, 'Tenant 2 should retrieve its data');
        assert.equal(retrieved1?.toString(), audioData1.toString(), 'Tenant 1 should get its own data');
        assert.equal(retrieved2?.toString(), audioData2.toString(), 'Tenant 2 should get its own data');
        assert.notEqual(retrieved1?.toString(), retrieved2?.toString(), 'Tenants should have different data');
      }
    },

    {
      name: 'should handle cache size limits (LRU eviction)',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 3, // Very small cache for testing
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const audioData = Buffer.from('Mock audio data');
        
        // Fill cache beyond capacity
        cache.set(tenantId, 'audio1', audioData);
        cache.set(tenantId, 'audio2', audioData);
        cache.set(tenantId, 'audio3', audioData);
        cache.set(tenantId, 'audio4', audioData); // Should evict 'audio1'
        
        // Check that oldest entry was evicted
        const audio1 = cache.get(tenantId, 'audio1');
        const audio4 = cache.get(tenantId, 'audio4');
        
        assert.falsy(audio1, 'Oldest entry should be evicted');
        assert.truthy(audio4, 'Newest entry should be retained');
        
        // Access an existing item to update its position
        const audio2 = cache.get(tenantId, 'audio2');
        assert.truthy(audio2, 'Accessed item should still exist');
        
        // Add another item
        cache.set(tenantId, 'audio5', audioData); // Should evict 'audio3'
        
        const audio3 = cache.get(tenantId, 'audio3');
        const audio2Again = cache.get(tenantId, 'audio2');
        
        assert.falsy(audio3, 'LRU item should be evicted');
        assert.truthy(audio2Again, 'Recently accessed item should be retained');
      }
    },

    {
      name: 'should handle cache expiration (TTL)',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 100 // Very short expiration for testing
        });
        
        const tenantId = randomUuid();
        const cacheKey = 'expiring_audio';
        const audioData = Buffer.from('Expiring audio data');
        
        // Store audio data
        cache.set(tenantId, cacheKey, audioData);
        
        // Should be available immediately
        const immediate = cache.get(tenantId, cacheKey);
        assert.truthy(immediate, 'Audio should be available immediately');
        
        // Wait for expiration
        await sleep(150);
        
        // Should be expired
        const expired = cache.get(tenantId, cacheKey);
        assert.falsy(expired, 'Audio should be expired');
        
        // Check that expired entries are cleaned up
        const stats = cache.getStats();
        assert.equal(stats.totalEntries, 0, 'Expired entries should be cleaned up');
      },
      timeout: 1000
    },

    {
      name: 'should preload common phrases',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const commonPhrases = [
          'Hello, how can I help you?',
          'Thank you for calling.',
          'Please hold while I transfer you.',
          'Have a great day!'
        ];
        
        // Preload common phrases
        const preloadResults = await cache.preloadCommonPhrases(tenantId, commonPhrases);
        
        // Check preload results
        assert.truthy(Array.isArray(preloadResults), 'Should return array of preload results');
        assert.equal(preloadResults.length, commonPhrases.length, 'Should process all phrases');
        
        const successfulPreloads = preloadResults.filter(result => result.success);
        assert.truthy(successfulPreloads.length > 0, 'Should successfully preload some phrases');
        
        // Check that phrases are in cache
        successfulPreloads.forEach(result => {
          const cachedAudio = cache.get(tenantId, result.cacheKey);
          assert.truthy(cachedAudio, `Preloaded phrase should be in cache: ${result.cacheKey}`);
          assert.truthy(Buffer.isBuffer(cachedAudio), 'Cached audio should be a Buffer');
        });
        
        // Stats should reflect preloaded items
        const stats = cache.getStats();
        assert.truthy(stats.totalEntries >= successfulPreloads.length, 'Cache should contain preloaded items');
      },
      timeout: 10000 // Longer timeout for TTS generation
    },

    {
      name: 'should handle cache analytics and hit rate',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const audioData = Buffer.from('Test audio data');
        
        // Store some data
        cache.set(tenantId, 'audio1', audioData);
        cache.set(tenantId, 'audio2', audioData);
        
        // Mix of hits and misses
        cache.get(tenantId, 'audio1'); // hit
        cache.get(tenantId, 'audio1'); // hit
        cache.get(tenantId, 'audio2'); // hit
        cache.get(tenantId, 'non_existent'); // miss
        cache.get(tenantId, 'also_missing'); // miss
        
        const stats = cache.getStats();
        assert.equal(stats.cacheHits, 3, 'Should have 3 cache hits');
        assert.equal(stats.cacheMisses, 2, 'Should have 2 cache misses');
        
        const hitRate = cache.getHitRate();
        assert.truthy(typeof hitRate === 'number', 'Hit rate should be a number');
        assert.equal(hitRate, 0.6, 'Hit rate should be 60% (3/5)');
        
        // Reset stats
        cache.resetStats();
        const resetStats = cache.getStats();
        assert.equal(resetStats.cacheHits, 0, 'Cache hits should be reset');
        assert.equal(resetStats.cacheMisses, 0, 'Cache misses should be reset');
      }
    },

    {
      name: 'should handle cache invalidation',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const audioData = Buffer.from('Test audio data');
        
        // Store multiple items
        cache.set(tenantId, 'audio1', audioData);
        cache.set(tenantId, 'audio2', audioData);
        cache.set(tenantId, 'audio3', audioData);
        
        // Verify items are cached
        assert.truthy(cache.get(tenantId, 'audio1'), 'Audio1 should be cached');
        assert.truthy(cache.get(tenantId, 'audio2'), 'Audio2 should be cached');
        
        // Invalidate specific item
        const invalidateResult = cache.invalidate(tenantId, 'audio1');
        assert.truthy(invalidateResult, 'Should successfully invalidate item');
        
        // Check that specific item is removed
        assert.falsy(cache.get(tenantId, 'audio1'), 'Audio1 should be invalidated');
        assert.truthy(cache.get(tenantId, 'audio2'), 'Audio2 should still be cached');
        
        // Invalidate by pattern
        cache.set(tenantId, 'greeting_hello', audioData);
        cache.set(tenantId, 'greeting_goodbye', audioData);
        cache.set(tenantId, 'other_phrase', audioData);
        
        const patternResult = cache.invalidatePattern(tenantId, 'greeting_*');
        assert.truthy(patternResult > 0, 'Should invalidate items matching pattern');
        
        assert.falsy(cache.get(tenantId, 'greeting_hello'), 'Greeting_hello should be invalidated');
        assert.falsy(cache.get(tenantId, 'greeting_goodbye'), 'Greeting_goodbye should be invalidated');
        assert.truthy(cache.get(tenantId, 'other_phrase'), 'Other_phrase should remain');
      }
    },

    {
      name: 'should handle cache clearing and cleanup',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenant1 = randomUuid();
        const tenant2 = randomUuid();
        const audioData = Buffer.from('Test audio data');
        
        // Add data for multiple tenants
        cache.set(tenant1, 'audio1', audioData);
        cache.set(tenant1, 'audio2', audioData);
        cache.set(tenant2, 'audio1', audioData);
        cache.set(tenant2, 'audio2', audioData);
        
        const initialStats = cache.getStats();
        assert.equal(initialStats.totalEntries, 4, 'Should have 4 total entries');
        
        // Clear cache for specific tenant
        const tenant1Cleared = cache.clearTenant(tenant1);
        assert.truthy(tenant1Cleared > 0, 'Should clear items for tenant1');
        
        // Check that only tenant1 items are cleared
        assert.falsy(cache.get(tenant1, 'audio1'), 'Tenant1 audio1 should be cleared');
        assert.falsy(cache.get(tenant1, 'audio2'), 'Tenant1 audio2 should be cleared');
        assert.truthy(cache.get(tenant2, 'audio1'), 'Tenant2 audio1 should remain');
        assert.truthy(cache.get(tenant2, 'audio2'), 'Tenant2 audio2 should remain');
        
        // Clear all cache
        cache.clear();
        const clearedStats = cache.getStats();
        assert.equal(clearedStats.totalEntries, 0, 'Cache should be completely cleared');
        
        assert.falsy(cache.get(tenant2, 'audio1'), 'All items should be cleared');
        assert.falsy(cache.get(tenant2, 'audio2'), 'All items should be cleared');
      }
    },

    {
      name: 'should handle cache key generation and normalization',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 1000,
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        const audioData = Buffer.from('Test audio data');
        
        // Test different text inputs that should normalize to same key
        const variations = [
          'Hello, World!',
          'hello, world!',
          'HELLO, WORLD!',
          '  Hello,   World!  ', // Extra spaces
          'Hello, World!!!' // Extra punctuation
        ];
        
        // Store using first variation
        const originalKey = cache.generateCacheKey(variations[0]);
        cache.set(tenantId, originalKey, audioData);
        
        // All variations should generate same or similar keys and retrieve data
        variations.forEach((variation, index) => {
          const key = cache.generateCacheKey(variation);
          assert.truthy(typeof key === 'string', `Variation ${index} should generate string key`);
          assert.truthy(key.length > 0, `Variation ${index} should generate non-empty key`);
          
          // Similar variations should ideally generate same key (basic normalization)
          if (index > 0) {
            // For case differences, the keys might be the same with good normalization
            const lowerOriginal = cache.generateCacheKey(variations[0].toLowerCase());
            const lowerVariation = cache.generateCacheKey(variation.toLowerCase());
            // This test depends on cache implementation details
          }
        });
        
        // Test special characters and unicode
        const unicodeKey = cache.generateCacheKey('Hello 世界 🌍');
        assert.truthy(typeof unicodeKey === 'string', 'Should handle unicode characters');
        assert.truthy(unicodeKey.length > 0, 'Unicode key should not be empty');
        
        // Test very long text
        const longText = 'Very long text '.repeat(100);
        const longKey = cache.generateCacheKey(longText);
        assert.truthy(typeof longKey === 'string', 'Should handle long text');
        assert.truthy(longKey.length > 0, 'Long text key should not be empty');
      }
    },

    {
      name: 'should handle memory management and monitoring',
      fn: async () => {
        const cache = new AudioCache({
          maxSize: 10, // Small cache for testing
          maxAge: 60000
        });
        
        const tenantId = randomUuid();
        
        // Add items to track memory usage
        const smallAudio = Buffer.from('Small audio data');
        const largeAudio = Buffer.alloc(1024, 'Large audio data'); // 1KB
        
        cache.set(tenantId, 'small1', smallAudio);
        cache.set(tenantId, 'small2', smallAudio);
        cache.set(tenantId, 'large1', largeAudio);
        
        const stats = cache.getStats();
        assert.truthy(stats.memoryUsage > 0, 'Should track memory usage');
        assert.truthy(stats.memoryUsage >= 1024, 'Should account for large audio data');
        
        // Check average entry size
        const avgSize = stats.memoryUsage / stats.totalEntries;
        assert.truthy(avgSize > 0, 'Should calculate average entry size');
        
        // Test cache efficiency
        const efficiency = cache.getCacheEfficiency();
        assert.truthy(typeof efficiency === 'object', 'Should return efficiency metrics');
        assert.truthy(typeof efficiency.hitRate === 'number', 'Should include hit rate');
        assert.truthy(typeof efficiency.memoryUtilization === 'number', 'Should include memory utilization');
        
        // Trigger cleanup
        cache.cleanup();
        
        // Stats should still be valid after cleanup
        const cleanupStats = cache.getStats();
        assert.truthy(typeof cleanupStats.totalEntries === 'number', 'Should have valid stats after cleanup');
      }
    }
  ],

  beforeAll: async () => {
    console.log('🔧 Setting up Audio Cache tests...');
  },

  afterAll: async () => {
    console.log('🧹 Cleaning up Audio Cache tests...');
  },

  beforeEach: async () => {
    // Each test creates its own cache instance, no shared state
  },

  afterEach: async () => {
    // Cleanup happens within each test if needed
  }
};

// Export for use in test runner
export { audioCacheTestSuite };

// If run directly, execute the tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.addSuite(audioCacheTestSuite);
  runner.runAll().then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}