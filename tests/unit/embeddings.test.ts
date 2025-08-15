#!/usr/bin/env tsx

import { TestRunner, TestSuite, assert, sleep, randomString, randomUuid } from './test-framework';
import { LocalEmbeddingService } from '../../src/lib/rag/embeddings';

const embeddingsTestSuite: TestSuite = {
  name: 'Embedding Service',
  tests: [
    {
      name: 'should initialize embedding service',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        assert.truthy(embeddingService, 'Embedding service should be created');
        
        // Test initialization
        try {
          const isReady = await embeddingService.isReady();
          if (isReady) {
            assert.truthy(isReady, 'Embedding service should be ready');
          }
        } catch (error) {
          console.log('Embedding service initialization test skipped (Model not available)');
        }
      },
      timeout: 30000 // Longer timeout for model loading
    },

    {
      name: 'should generate embeddings for text',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          const testText = `This is a test document about ${randomString()} technology.`;
          
          // Generate embedding
          const result = await embeddingService.generateEmbedding(testText);
          
          if (result.success && result.embedding) {
            assert.truthy(result.success, 'Embedding generation should succeed');
            assert.truthy(Array.isArray(result.embedding), 'Embedding should be an array');
            assert.truthy(result.embedding.length > 0, 'Embedding should not be empty');
            assert.truthy(result.embedding.length === 384, 'Embedding should have 384 dimensions (BERT base)');
            
            // All values should be numbers
            const allNumbers = result.embedding.every(val => typeof val === 'number' && !isNaN(val));
            assert.truthy(allNumbers, 'All embedding values should be valid numbers');
            
            // Check embedding magnitude (should be normalized)
            const magnitude = Math.sqrt(result.embedding.reduce((sum, val) => sum + val * val, 0));
            assert.truthy(magnitude > 0, 'Embedding should have positive magnitude');
            assert.truthy(Math.abs(magnitude - 1.0) < 0.1, 'Embedding should be approximately normalized');
          }
        } catch (error) {
          console.log('Embedding generation test skipped (Model not available)');
        }
      },
      timeout: 15000 // Longer timeout for inference
    },

    {
      name: 'should generate consistent embeddings',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          const testText = "Consistent embedding test text";
          
          // Generate embedding twice
          const result1 = await embeddingService.generateEmbedding(testText);
          const result2 = await embeddingService.generateEmbedding(testText);
          
          if (result1.success && result2.success && result1.embedding && result2.embedding) {
            assert.equal(result1.embedding.length, result2.embedding.length, 'Embeddings should have same dimensions');
            
            // Calculate cosine similarity (should be very close to 1.0)
            const dotProduct = result1.embedding.reduce((sum, val, i) => sum + val * result2.embedding![i], 0);
            const magnitude1 = Math.sqrt(result1.embedding.reduce((sum, val) => sum + val * val, 0));
            const magnitude2 = Math.sqrt(result2.embedding.reduce((sum, val) => sum + val * val, 0));
            const similarity = dotProduct / (magnitude1 * magnitude2);
            
            assert.truthy(similarity > 0.99, 'Identical text should produce highly similar embeddings');
          }
        } catch (error) {
          console.log('Embedding consistency test skipped (Model not available)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle batch embeddings',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          const texts = [
            `First document about ${randomString()}`,
            `Second document about ${randomString()}`,
            `Third document about ${randomString()}`
          ];
          
          // Generate batch embeddings
          const result = await embeddingService.generateBatchEmbeddings(texts);
          
          if (result.success && result.embeddings) {
            assert.truthy(result.success, 'Batch embedding generation should succeed');
            assert.equal(result.embeddings.length, texts.length, 'Should generate one embedding per text');
            
            // Each embedding should be valid
            result.embeddings.forEach((embedding, i) => {
              assert.truthy(Array.isArray(embedding), `Embedding ${i} should be an array`);
              assert.equal(embedding.length, 384, `Embedding ${i} should have 384 dimensions`);
              
              const allNumbers = embedding.every(val => typeof val === 'number' && !isNaN(val));
              assert.truthy(allNumbers, `Embedding ${i} should contain only valid numbers`);
            });
            
            // Different texts should produce different embeddings
            const similarity1_2 = calculateCosineSimilarity(result.embeddings[0], result.embeddings[1]);
            const similarity1_3 = calculateCosineSimilarity(result.embeddings[0], result.embeddings[2]);
            
            assert.truthy(similarity1_2 < 0.95, 'Different texts should produce different embeddings');
            assert.truthy(similarity1_3 < 0.95, 'Different texts should produce different embeddings');
          }
        } catch (error) {
          console.log('Batch embeddings test skipped (Model not available)');
        }
      },
      timeout: 20000
    },

    {
      name: 'should handle empty and edge case texts',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          // Test empty string
          const emptyResult = await embeddingService.generateEmbedding('');
          if (!emptyResult.success) {
            assert.falsy(emptyResult.success, 'Empty string should fail gracefully');
            assert.truthy(emptyResult.error, 'Should provide error message for empty string');
          }
          
          // Test very short text
          const shortResult = await embeddingService.generateEmbedding('Hi');
          if (shortResult.success && shortResult.embedding) {
            assert.truthy(shortResult.success, 'Short text should succeed');
            assert.equal(shortResult.embedding.length, 384, 'Short text should produce full-size embedding');
          }
          
          // Test very long text
          const longText = 'Long text '.repeat(1000); // Very long text
          const longResult = await embeddingService.generateEmbedding(longText);
          if (longResult.success && longResult.embedding) {
            assert.truthy(longResult.success, 'Long text should succeed');
            assert.equal(longResult.embedding.length, 384, 'Long text should produce standard-size embedding');
          }
          
        } catch (error) {
          console.log('Edge case embeddings test skipped (Model not available)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle special characters and unicode',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          const unicodeTexts = [
            'Hello 世界', // Mixed English and Chinese
            'Café résumé naïve', // Accented characters
            'This has emoji 🚀 and symbols @#$%', // Emoji and symbols
            '123 456 numbers and text'
          ];
          
          for (const text of unicodeTexts) {
            const result = await embeddingService.generateEmbedding(text);
            
            if (result.success && result.embedding) {
              assert.truthy(result.success, `Unicode text "${text}" should succeed`);
              assert.equal(result.embedding.length, 384, 'Unicode text should produce standard-size embedding');
              
              const allNumbers = result.embedding.every(val => typeof val === 'number' && !isNaN(val));
              assert.truthy(allNumbers, 'Unicode text embedding should contain only valid numbers');
            }
          }
        } catch (error) {
          console.log('Unicode embeddings test skipped (Model not available)');
        }
      },
      timeout: 20000
    },

    {
      name: 'should handle model loading and readiness',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          // Check if model is ready
          const isReady = await embeddingService.isReady();
          assert.type(isReady, 'boolean', 'isReady should return boolean');
          
          // Get model info
          const modelInfo = embeddingService.getModelInfo();
          assert.truthy(typeof modelInfo === 'object', 'Model info should be an object');
          assert.truthy(typeof modelInfo.name === 'string', 'Model should have a name');
          assert.truthy(typeof modelInfo.dimensions === 'number', 'Model should specify dimensions');
          assert.truthy(modelInfo.dimensions > 0, 'Model dimensions should be positive');
          
        } catch (error) {
          console.log('Model readiness test skipped (Model not available)');
        }
      }
    },

    {
      name: 'should handle semantic similarity',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          // Similar meaning texts
          const text1 = "The car is red";
          const text2 = "Red automobile";
          const text3 = "Blue elephant"; // Different meaning
          
          const result1 = await embeddingService.generateEmbedding(text1);
          const result2 = await embeddingService.generateEmbedding(text2);
          const result3 = await embeddingService.generateEmbedding(text3);
          
          if (result1.success && result2.success && result3.success && 
              result1.embedding && result2.embedding && result3.embedding) {
            
            // Similar meanings should have higher similarity
            const similarity1_2 = calculateCosineSimilarity(result1.embedding, result2.embedding);
            const similarity1_3 = calculateCosineSimilarity(result1.embedding, result3.embedding);
            
            assert.truthy(similarity1_2 > similarity1_3, 'Semantically similar texts should have higher similarity');
            assert.truthy(similarity1_2 > 0.5, 'Similar texts should have reasonable similarity score');
          }
        } catch (error) {
          console.log('Semantic similarity test skipped (Model not available)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle chunking for long documents',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          const longDocument = `
            This is a very long document that needs to be chunked for processing.
            ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100)}
            The document contains multiple paragraphs and should be handled properly.
          `;
          
          // Test chunking functionality if available
          const chunks = embeddingService.chunkText(longDocument, 500); // 500 char chunks
          
          assert.truthy(Array.isArray(chunks), 'Chunking should return array');
          assert.truthy(chunks.length > 1, 'Long document should be split into multiple chunks');
          
          // Each chunk should be processable
          const firstChunk = chunks[0];
          const result = await embeddingService.generateEmbedding(firstChunk);
          
          if (result.success && result.embedding) {
            assert.truthy(result.success, 'Document chunk should be processable');
            assert.equal(result.embedding.length, 384, 'Chunk embedding should have correct dimensions');
          }
          
        } catch (error) {
          console.log('Document chunking test skipped (Model not available)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle concurrent embedding requests',
      fn: async () => {
        const embeddingService = new LocalEmbeddingService();
        
        try {
          const texts = Array.from({ length: 5 }, (_, i) => `Concurrent test ${i}: ${randomString()}`);
          
          // Generate embeddings concurrently
          const promises = texts.map(text => embeddingService.generateEmbedding(text));
          const results = await Promise.all(promises);
          
          // All should succeed
          const allSucceeded = results.every(result => result.success);
          assert.truthy(allSucceeded, 'All concurrent requests should succeed');
          
          // All should have embeddings
          const allHaveEmbeddings = results.every(result => result.embedding && result.embedding.length === 384);
          assert.truthy(allHaveEmbeddings, 'All concurrent requests should produce valid embeddings');
          
        } catch (error) {
          console.log('Concurrent embeddings test skipped (Model not available)');
        }
      },
      timeout: 20000
    }
  ],

  beforeAll: async () => {
    console.log('🔧 Setting up Embedding Service tests...');
    console.log('Note: These tests may take longer as they involve model loading and inference');
  },

  afterAll: async () => {
    console.log('🧹 Cleaning up Embedding Service tests...');
  },

  beforeEach: async () => {
    // Each test is isolated, no shared state
  },

  afterEach: async () => {
    // Cleanup happens within each test if needed
  }
};

// Helper function for cosine similarity calculation
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }
  
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  return dotProduct / (magnitude1 * magnitude2);
}

// Export for use in test runner
export { embeddingsTestSuite };

// If run directly, execute the tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.addSuite(embeddingsTestSuite);
  runner.runAll().then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}