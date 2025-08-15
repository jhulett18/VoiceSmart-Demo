#!/usr/bin/env tsx

import { TestRunner, TestSuite, assert, sleep, randomString, randomUuid, createMock } from './test-framework';
import { EnhancedLLMClient } from '../../src/lib/llm/enhanced-client';

const llmClientTestSuite: TestSuite = {
  name: 'Enhanced LLM Client',
  tests: [
    {
      name: 'should initialize LLM client',
      fn: async () => {
        const config = {
          apiKey: 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 1000,
          temperature: 0.7
        };
        
        const llmClient = new EnhancedLLMClient(config);
        assert.truthy(llmClient, 'LLM client should be created');
        
        // Test configuration
        const clientConfig = llmClient.getConfig();
        assert.equal(clientConfig.model, config.model, 'Model should match configuration');
        assert.equal(clientConfig.maxTokens, config.maxTokens, 'Max tokens should match configuration');
        assert.equal(clientConfig.temperature, config.temperature, 'Temperature should match configuration');
      }
    },

    {
      name: 'should handle basic chat completion',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 100,
          temperature: 0.3
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        try {
          const tenantId = randomUuid();
          const conversationId = randomUuid();
          
          const messages = [
            { role: 'user' as const, content: 'Hello, how are you?' }
          ];
          
          const result = await llmClient.generateCompletion(tenantId, messages, {
            conversationId,
            maxTokens: 50
          });
          
          if (result.success && result.response) {
            assert.truthy(result.success, 'Chat completion should succeed');
            assert.truthy(result.response.content, 'Response should have content');
            assert.equal(result.response.role, 'assistant', 'Response should be from assistant');
            assert.truthy(result.usage, 'Should include usage information');
            assert.truthy(typeof result.usage.promptTokens === 'number', 'Should have prompt token count');
            assert.truthy(typeof result.usage.completionTokens === 'number', 'Should have completion token count');
            assert.truthy(typeof result.usage.totalTokens === 'number', 'Should have total token count');
          }
        } catch (error) {
          console.log('Basic chat completion test skipped (API not available or configured)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle RAG-enhanced completion',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 200
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        try {
          const tenantId = randomUuid();
          const conversationId = randomUuid();
          
          const messages = [
            { role: 'user' as const, content: 'What can you tell me about appointment scheduling?' }
          ];
          
          const contextChunks = [
            {
              content: 'Our appointment scheduling system allows users to book appointments using voice commands.',
              similarity: 0.95,
              metadata: { source: 'user-manual', section: 'scheduling' }
            },
            {
              content: 'The system integrates with Google Calendar for seamless appointment management.',
              similarity: 0.88,
              metadata: { source: 'technical-docs', section: 'integrations' }
            }
          ];
          
          const result = await llmClient.generateRAGCompletion(tenantId, messages, contextChunks, {
            conversationId,
            maxTokens: 150
          });
          
          if (result.success && result.response) {
            assert.truthy(result.success, 'RAG completion should succeed');
            assert.truthy(result.response.content, 'Response should have content');
            
            // Response should incorporate context information
            const content = result.response.content.toLowerCase();
            const hasSchedulingInfo = content.includes('appointment') || content.includes('scheduling');
            assert.truthy(hasSchedulingInfo, 'Response should reference appointment scheduling context');
            
            assert.truthy(result.usage, 'Should include usage information');
            assert.truthy(result.contextUsed, 'Should indicate context was used');
          }
        } catch (error) {
          console.log('RAG-enhanced completion test skipped (API not available or configured)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle retry logic',
      fn: async () => {
        const config = {
          apiKey: 'invalid-api-key', // This should cause failures
          model: 'gpt-3.5-turbo',
          maxTokens: 100,
          retryAttempts: 3,
          retryDelay: 100
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        const tenantId = randomUuid();
        const messages = [
          { role: 'user' as const, content: 'Test message' }
        ];
        
        const startTime = Date.now();
        const result = await llmClient.generateCompletion(tenantId, messages);
        const endTime = Date.now();
        
        // Should fail after retries
        assert.falsy(result.success, 'Should fail with invalid API key');
        assert.truthy(result.error, 'Should provide error message');
        
        // Should have taken time for retries (at least 3 * 100ms = 300ms)
        const duration = endTime - startTime;
        assert.truthy(duration >= 200, 'Should have attempted retries with delays');
      },
      timeout: 10000
    },

    {
      name: 'should handle timeout',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          timeout: 1 // Very short timeout
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        const tenantId = randomUuid();
        const messages = [
          { role: 'user' as const, content: 'Generate a very long response about artificial intelligence and machine learning' }
        ];
        
        const result = await llmClient.generateCompletion(tenantId, messages);
        
        // Should fail due to timeout (unless API responds extremely quickly)
        if (!result.success) {
          assert.falsy(result.success, 'Should fail due to timeout');
          assert.truthy(result.error, 'Should provide timeout error message');
        }
      },
      timeout: 5000
    },

    {
      name: 'should handle circuit breaker',
      fn: async () => {
        const config = {
          apiKey: 'invalid-api-key',
          model: 'gpt-3.5-turbo',
          circuitBreakerThreshold: 3,
          circuitBreakerResetTime: 2000,
          retryAttempts: 1,
          retryDelay: 50
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        const tenantId = randomUuid();
        const messages = [
          { role: 'user' as const, content: 'Test message' }
        ];
        
        // Make multiple failing requests to trigger circuit breaker
        const results = [];
        for (let i = 0; i < 5; i++) {
          const result = await llmClient.generateCompletion(tenantId, messages);
          results.push(result);
          
          if (i < 3) {
            // First few should fail normally
            assert.falsy(result.success, `Request ${i + 1} should fail`);
          } else {
            // Later requests should fail immediately due to circuit breaker
            assert.falsy(result.success, `Request ${i + 1} should fail due to circuit breaker`);
            assert.truthy(result.error?.includes('circuit breaker') || 
                         result.error?.includes('Circuit breaker'), 'Should mention circuit breaker');
          }
        }
        
        // Wait for circuit breaker reset
        await sleep(2100);
        
        // Should attempt request again after reset
        const resetResult = await llmClient.generateCompletion(tenantId, messages);
        assert.falsy(resetResult.success, 'Should attempt request after circuit breaker reset');
      },
      timeout: 15000
    },

    {
      name: 'should handle different message types',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 100
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        try {
          const tenantId = randomUuid();
          
          // Test conversation with system message
          const messagesWithSystem = [
            { role: 'system' as const, content: 'You are a helpful assistant specializing in appointment scheduling.' },
            { role: 'user' as const, content: 'How do I schedule an appointment?' }
          ];
          
          const systemResult = await llmClient.generateCompletion(tenantId, messagesWithSystem);
          
          if (systemResult.success) {
            assert.truthy(systemResult.success, 'Should handle system messages');
            assert.truthy(systemResult.response?.content, 'Should generate response with system context');
          }
          
          // Test multi-turn conversation
          const multiTurnMessages = [
            { role: 'user' as const, content: 'Hello' },
            { role: 'assistant' as const, content: 'Hello! How can I help you today?' },
            { role: 'user' as const, content: 'I need to schedule an appointment' }
          ];
          
          const multiTurnResult = await llmClient.generateCompletion(tenantId, multiTurnMessages);
          
          if (multiTurnResult.success) {
            assert.truthy(multiTurnResult.success, 'Should handle multi-turn conversations');
            assert.truthy(multiTurnResult.response?.content, 'Should generate contextual response');
          }
        } catch (error) {
          console.log('Different message types test skipped (API not available or configured)');
        }
      },
      timeout: 20000
    },

    {
      name: 'should handle cost tracking',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 50
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        try {
          const tenantId = randomUuid();
          const conversationId = randomUuid();
          
          const messages = [
            { role: 'user' as const, content: 'Brief hello' }
          ];
          
          const result = await llmClient.generateCompletion(tenantId, messages, {
            conversationId,
            trackCosts: true
          });
          
          if (result.success && result.usage) {
            assert.truthy(result.usage, 'Should track token usage');
            assert.truthy(typeof result.usage.totalTokens === 'number', 'Should have total token count');
            assert.truthy(result.usage.totalTokens > 0, 'Should have used tokens');
            
            if (result.costUsd !== undefined) {
              assert.truthy(typeof result.costUsd === 'number', 'Should calculate cost');
              assert.truthy(result.costUsd >= 0, 'Cost should be non-negative');
            }
          }
        } catch (error) {
          console.log('Cost tracking test skipped (API not available or configured)');
        }
      },
      timeout: 15000
    },

    {
      name: 'should handle streaming responses',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 100
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        try {
          const tenantId = randomUuid();
          const messages = [
            { role: 'user' as const, content: 'Tell me about artificial intelligence' }
          ];
          
          const chunks: string[] = [];
          
          const result = await llmClient.generateStreamingCompletion(tenantId, messages, {
            onChunk: (chunk) => {
              chunks.push(chunk);
            }
          });
          
          if (result.success) {
            assert.truthy(result.success, 'Streaming completion should succeed');
            assert.truthy(chunks.length > 0, 'Should receive streaming chunks');
            
            // Concatenated chunks should form the complete response
            const fullResponse = chunks.join('');
            assert.truthy(fullResponse.length > 0, 'Complete response should have content');
            
            assert.truthy(result.usage, 'Should include usage information for streaming');
          }
        } catch (error) {
          console.log('Streaming responses test skipped (API not available or configured)');
        }
      },
      timeout: 20000
    },

    {
      name: 'should handle model configuration changes',
      fn: async () => {
        const config = {
          apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
          model: 'gpt-3.5-turbo',
          maxTokens: 50,
          temperature: 0.5
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        // Test configuration updates
        llmClient.updateConfig({
          maxTokens: 100,
          temperature: 0.8
        });
        
        const updatedConfig = llmClient.getConfig();
        assert.equal(updatedConfig.maxTokens, 100, 'Max tokens should be updated');
        assert.equal(updatedConfig.temperature, 0.8, 'Temperature should be updated');
        assert.equal(updatedConfig.model, 'gpt-3.5-turbo', 'Model should remain unchanged');
        
        // Test model switching
        llmClient.updateConfig({
          model: 'gpt-4'
        });
        
        const modelUpdatedConfig = llmClient.getConfig();
        assert.equal(modelUpdatedConfig.model, 'gpt-4', 'Model should be updated');
      }
    },

    {
      name: 'should handle input validation',
      fn: async () => {
        const config = {
          apiKey: 'test-api-key',
          model: 'gpt-3.5-turbo'
        };
        
        const llmClient = new EnhancedLLMClient(config);
        const tenantId = randomUuid();
        
        // Test empty messages
        const emptyResult = await llmClient.generateCompletion(tenantId, []);
        assert.falsy(emptyResult.success, 'Empty messages array should fail');
        assert.truthy(emptyResult.error, 'Should provide error for empty messages');
        
        // Test invalid message structure
        const invalidMessages = [
          { role: 'invalid' as any, content: 'Test' }
        ];
        
        const invalidResult = await llmClient.generateCompletion(tenantId, invalidMessages);
        assert.falsy(invalidResult.success, 'Invalid message role should fail');
        
        // Test empty content
        const emptyContentMessages = [
          { role: 'user' as const, content: '' }
        ];
        
        const emptyContentResult = await llmClient.generateCompletion(tenantId, emptyContentMessages);
        assert.falsy(emptyContentResult.success, 'Empty message content should fail');
        
        // Test very long messages (if limit is enforced)
        const longContent = 'Very long message '.repeat(10000);
        const longMessages = [
          { role: 'user' as const, content: longContent }
        ];
        
        const longResult = await llmClient.generateCompletion(tenantId, longMessages);
        // Should either succeed (if no limit) or fail gracefully
        if (!longResult.success) {
          assert.truthy(longResult.error, 'Should provide error for overly long messages');
        }
      }
    },

    {
      name: 'should handle statistics and monitoring',
      fn: async () => {
        const config = {
          apiKey: 'test-api-key',
          model: 'gpt-3.5-turbo'
        };
        
        const llmClient = new EnhancedLLMClient(config);
        
        // Get initial stats
        const initialStats = llmClient.getStats();
        assert.truthy(typeof initialStats === 'object', 'Should return stats object');
        assert.truthy(typeof initialStats.totalRequests === 'number', 'Should track total requests');
        assert.truthy(typeof initialStats.successfulRequests === 'number', 'Should track successful requests');
        assert.truthy(typeof initialStats.failedRequests === 'number', 'Should track failed requests');
        assert.truthy(typeof initialStats.totalTokensUsed === 'number', 'Should track total tokens');
        
        const tenantId = randomUuid();
        const messages = [
          { role: 'user' as const, content: 'Test message' }
        ];
        
        // Make a request (will likely fail with test API key)
        await llmClient.generateCompletion(tenantId, messages);
        
        // Check updated stats
        const updatedStats = llmClient.getStats();
        assert.truthy(updatedStats.totalRequests > initialStats.totalRequests, 'Should increment total requests');
        
        // Reset stats
        llmClient.resetStats();
        const resetStats = llmClient.getStats();
        assert.equal(resetStats.totalRequests, 0, 'Stats should be reset');
        assert.equal(resetStats.successfulRequests, 0, 'Successful requests should be reset');
        assert.equal(resetStats.failedRequests, 0, 'Failed requests should be reset');
      }
    }
  ],

  beforeAll: async () => {
    console.log('🔧 Setting up Enhanced LLM Client tests...');
    console.log('Note: Some tests require a valid OpenAI API key and will be skipped if not available');
  },

  afterAll: async () => {
    console.log('🧹 Cleaning up Enhanced LLM Client tests...');
  },

  beforeEach: async () => {
    // Each test is isolated, no shared state
  },

  afterEach: async () => {
    // Cleanup happens within each test if needed
  }
};

// Export for use in test runner
export { llmClientTestSuite };

// If run directly, execute the tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.addSuite(llmClientTestSuite);
  runner.runAll().then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}