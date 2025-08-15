#!/usr/bin/env tsx

import { logger } from '../src/lib/observability/logger';
import { getRedisClient } from '../src/lib/memory/redis';
import { getDatabaseClient } from '../src/lib/memory/database';
import { getVectorStore } from '../src/lib/rag/vectorstore';
import { getEmbeddingService } from '../src/lib/rag/embeddings';
import { getDocumentIngestionService } from '../src/lib/rag/document-ingestion';
import { getEnhancedLLMClient } from '../src/lib/llm/enhanced-client';

interface TestResult {
  component: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration?: number;
  details?: any;
}

class ComponentTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    logger.info('Starting component tests');

    await this.testLogger();
    await this.testRedis();
    await this.testDatabase();
    await this.testVectorStore();
    await this.testEmbeddingService();
    await this.testDocumentIngestion();
    await this.testLLMClient();

    this.printResults();
  }

  private async testLogger(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test basic logging functionality
      logger.info('Logger test message');
      logger.debug('Debug message');
      logger.warn('Warning message');
      
      // Test structured logging
      logger.voiceInteraction({
        tenantId: 'test-tenant',
        conversationId: 'test-conversation',
        sessionId: 'test-session',
        event: 'started',
        duration: 100,
        tokenCount: 50,
        costCents: 1
      });

      this.addResult({
        component: 'Logger',
        status: 'pass',
        message: 'All logging methods working correctly',
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.addResult({
        component: 'Logger',
        status: 'fail',
        message: `Logger test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testRedis(): Promise<void> {
    const startTime = Date.now();

    try {
      const redis = getRedisClient();
      
      // Test connection
      const isConnected = await redis.ping();
      if (!isConnected) {
        this.addResult({
          component: 'Redis',
          status: 'skip',
          message: 'Redis not available - using mock fallback',
          duration: Date.now() - startTime
        });
        return;
      }

      // Test basic operations
      const testKey = 'test-key';
      const testValue = 'test-value';
      const tenantId = 'test-tenant';

      await redis.set(tenantId, testKey, testValue, 60);
      const retrieved = await redis.get(tenantId, testKey);
      
      if (retrieved !== testValue) {
        throw new Error('Retrieved value does not match stored value');
      }

      // Test session management
      const sessionData = { userId: 'test-user', startTime: new Date().toISOString() };
      await redis.setSession(tenantId, 'test-session', sessionData, 60);
      const sessionRetrieved = await redis.getSession(tenantId, 'test-session');
      
      if (!sessionRetrieved || JSON.stringify(sessionRetrieved) !== JSON.stringify(sessionData)) {
        throw new Error('Session data not stored/retrieved correctly');
      }

      // Test rate limiting
      const rateLimitResult = await redis.incrementRateLimit(tenantId, 'test-endpoint', 60, 10);
      if (!rateLimitResult.allowed) {
        throw new Error('Rate limit should allow first request');
      }

      // Cleanup
      await redis.del(tenantId, testKey);
      await redis.deleteSession(tenantId, 'test-session');

      this.addResult({
        component: 'Redis',
        status: 'pass',
        message: 'All Redis operations working correctly',
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.addResult({
        component: 'Redis',
        status: 'fail',
        message: `Redis test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testDatabase(): Promise<void> {
    const startTime = Date.now();

    try {
      const db = getDatabaseClient();
      
      // Test connection
      const isConnected = await db.ping();
      if (!isConnected) {
        this.addResult({
          component: 'Database',
          status: 'skip',
          message: 'Database not available',
          duration: Date.now() - startTime
        });
        return;
      }

      const tenantId = 'test-tenant';
      const sessionId = 'test-session';

      // Test conversation creation
      const conversationId = await db.createConversation(tenantId, {
        sessionId,
        metadata: { source: 'test' }
      });

      if (!conversationId) {
        throw new Error('Failed to create conversation');
      }

      // Test message storage
      const messageId = await db.addMessage(tenantId, {
        conversationId,
        type: 'user',
        content: 'Test message',
        isVoice: true,
        processingTimeMs: 100,
        tokenCount: 10,
        costCents: 1
      });

      if (!messageId) {
        throw new Error('Failed to store message');
      }

      // Test message retrieval
      const messages = await db.getMessages(tenantId, conversationId, 10);
      if (messages.length === 0 || messages[0].content !== 'Test message') {
        throw new Error('Failed to retrieve messages correctly');
      }

      // Test cost tracking
      const costTracked = await db.trackCost(tenantId, {
        date: new Date(),
        service: 'test',
        operation: 'test_operation',
        quantity: 1,
        costCents: 1
      });

      if (!costTracked) {
        throw new Error('Failed to track cost');
      }

      this.addResult({
        component: 'Database',
        status: 'pass',
        message: 'All database operations working correctly',
        duration: Date.now() - startTime,
        details: { conversationId, messageId }
      });

    } catch (error) {
      this.addResult({
        component: 'Database',
        status: 'fail',
        message: `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testVectorStore(): Promise<void> {
    const startTime = Date.now();

    try {
      const vectorStore = getVectorStore();
      
      // Test connection
      const isConnected = await vectorStore.ping();
      if (!isConnected) {
        this.addResult({
          component: 'Vector Store',
          status: 'skip',
          message: 'Qdrant not available',
          duration: Date.now() - startTime
        });
        return;
      }

      // Test document count
      const tenantId = 'test-tenant';
      const docCount = await vectorStore.getDocumentCount(tenantId);
      
      // Test adding a document (with mock vector)
      const testVector = Array(384).fill(0).map(() => Math.random());
      const added = await vectorStore.addDocument(tenantId, {
        id: 'test-doc-1',
        content: 'This is a test document for vector storage.',
        metadata: {
          tenantId,
          documentId: 'test-doc',
          chunkIndex: 0,
          title: 'Test Document',
          documentType: 'test'
        }
      }, testVector);

      if (!added) {
        throw new Error('Failed to add document to vector store');
      }

      // Test search
      const searchResults = await vectorStore.search(tenantId, testVector, {
        limit: 5,
        threshold: 0.1
      });

      if (searchResults.length === 0) {
        throw new Error('Search returned no results for added document');
      }

      // Cleanup
      await vectorStore.deleteDocument(tenantId, 'test-doc-1');

      this.addResult({
        component: 'Vector Store',
        status: 'pass',
        message: 'All vector store operations working correctly',
        duration: Date.now() - startTime,
        details: { 
          initialDocCount: docCount,
          searchResultCount: searchResults.length
        }
      });

    } catch (error) {
      this.addResult({
        component: 'Vector Store',
        status: 'fail',
        message: `Vector store test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testEmbeddingService(): Promise<void> {
    const startTime = Date.now();

    try {
      const embeddingService = getEmbeddingService();
      
      // Test if service is ready
      const isReady = await embeddingService.isReady();
      if (!isReady) {
        this.addResult({
          component: 'Embedding Service',
          status: 'skip',
          message: 'Embedding model not loaded yet',
          duration: Date.now() - startTime
        });
        return;
      }

      // Test single embedding
      const testText = 'This is a test sentence for embedding.';
      const embeddingResult = await embeddingService.embed(testText);
      
      if (!embeddingResult.vector || embeddingResult.vector.length !== 384) {
        throw new Error('Invalid embedding vector dimensions');
      }

      // Test batch embedding
      const testTexts = [
        'First test sentence.',
        'Second test sentence.',
        'Third test sentence.'
      ];
      
      const batchResult = await embeddingService.embedBatch(testTexts);
      
      if (batchResult.vectors.length !== testTexts.length) {
        throw new Error('Batch embedding returned wrong number of vectors');
      }

      // Test document embedding with chunking
      const longText = 'This is a longer document that will be chunked into smaller pieces. '.repeat(20);
      const docResult = await embeddingService.embedDocument(longText, {
        title: 'Test Document',
        documentType: 'test'
      });

      if (docResult.chunks.length === 0) {
        throw new Error('Document embedding produced no chunks');
      }

      this.addResult({
        component: 'Embedding Service',
        status: 'pass',
        message: 'All embedding operations working correctly',
        duration: Date.now() - startTime,
        details: {
          singleEmbeddingDimensions: embeddingResult.vector.length,
          batchCount: batchResult.vectors.length,
          documentChunks: docResult.chunks.length,
          totalTokens: docResult.totalTokens
        }
      });

    } catch (error) {
      this.addResult({
        component: 'Embedding Service',
        status: 'fail',
        message: `Embedding service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testDocumentIngestion(): Promise<void> {
    const startTime = Date.now();

    try {
      const docService = getDocumentIngestionService();
      
      // Test health check
      const isHealthy = await docService.isHealthy();
      if (!isHealthy) {
        this.addResult({
          component: 'Document Ingestion',
          status: 'skip',
          message: 'Document ingestion service dependencies not available',
          duration: Date.now() - startTime
        });
        return;
      }

      const tenantId = 'test-tenant';

      // Test document ingestion
      const testDocument = {
        title: 'Test Service Document',
        content: 'This is a test document about our services. We offer excellent customer support and high-quality products.',
        documentType: 'test',
        metadata: { source: 'test' }
      };

      const ingestionResult = await docService.ingestDocument(tenantId, testDocument);
      
      if (!ingestionResult.success) {
        throw new Error(`Document ingestion failed: ${ingestionResult.error}`);
      }

      // Test search
      const searchResults = await docService.searchDocuments(tenantId, {
        query: 'customer support',
        limit: 5
      });

      if (searchResults.length === 0) {
        throw new Error('Search returned no results for ingested document');
      }

      // Test RAG context retrieval
      const ragContext = await docService.getRelevantContext(
        tenantId,
        'What services do you offer?',
        undefined,
        500
      );

      if (!ragContext.context) {
        throw new Error('RAG context retrieval failed');
      }

      // Get stats
      const stats = await docService.getDocumentStats(tenantId);

      // Cleanup
      await docService.deleteDocument(tenantId, ingestionResult.documentId);

      this.addResult({
        component: 'Document Ingestion',
        status: 'pass',
        message: 'All document ingestion operations working correctly',
        duration: Date.now() - startTime,
        details: {
          documentId: ingestionResult.documentId,
          chunkCount: ingestionResult.chunkCount,
          searchResults: searchResults.length,
          ragContextLength: ragContext.context.length,
          stats
        }
      });

    } catch (error) {
      this.addResult({
        component: 'Document Ingestion',
        status: 'fail',
        message: `Document ingestion test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testLLMClient(): Promise<void> {
    const startTime = Date.now();

    try {
      const llmClient = getEnhancedLLMClient();
      
      // Test configuration
      if (!llmClient.isConfigured()) {
        this.addResult({
          component: 'LLM Client',
          status: 'skip',
          message: 'OpenAI API key not configured',
          duration: Date.now() - startTime
        });
        return;
      }

      // Test connection
      const connectionTest = await llmClient.testConnection();
      if (!connectionTest) {
        throw new Error('LLM client connection test failed');
      }

      const tenantId = 'test-tenant';

      // Test basic completion
      const basicRequest = {
        tenantId,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'Say hello in a friendly way.' }
        ],
        useRAG: false
      };

      const basicResponse = await llmClient.completion(basicRequest);
      
      if (!basicResponse.content || basicResponse.usage.totalTokens === 0) {
        throw new Error('Basic LLM completion failed');
      }

      // Test with RAG (if documents are available)
      const ragRequest = {
        tenantId,
        messages: [
          { role: 'system' as const, content: 'You are a business assistant.' },
          { role: 'user' as const, content: 'What services do you offer?' }
        ],
        useRAG: true,
        ragQuery: 'services'
      };

      const ragResponse = await llmClient.completion(ragRequest);
      
      if (!ragResponse.content) {
        throw new Error('RAG-enhanced LLM completion failed');
      }

      // Test cost calculation
      const estimatedCost = llmClient.estimateCost('gpt-4o-mini', 100, 50);
      if (estimatedCost <= 0) {
        throw new Error('Cost estimation failed');
      }

      this.addResult({
        component: 'LLM Client',
        status: 'pass',
        message: 'All LLM client operations working correctly',
        duration: Date.now() - startTime,
        details: {
          basicCompletion: {
            tokens: basicResponse.usage.totalTokens,
            cost: basicResponse.costCents,
            processingTime: basicResponse.processingTime
          },
          ragCompletion: {
            tokens: ragResponse.usage.totalTokens,
            cost: ragResponse.costCents,
            ragSources: ragResponse.ragSources?.length || 0
          },
          estimatedCost
        }
      });

    } catch (error) {
      this.addResult({
        component: 'LLM Client',
        status: 'fail',
        message: `LLM client test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      });
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
    
    const status = result.status.toUpperCase();
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    
    switch (result.status) {
      case 'pass':
        logger.info(`✅ ${result.component}: ${result.message}${duration}`);
        break;
      case 'fail':
        logger.error(`❌ ${result.component}: ${result.message}${duration}`);
        break;
      case 'skip':
        logger.warn(`⚠️ ${result.component}: ${result.message}${duration}`);
        break;
    }
  }

  private printResults(): void {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    
    logger.info('\n' + '='.repeat(60));
    logger.info('COMPONENT TEST RESULTS');
    logger.info('='.repeat(60));
    logger.info(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
    
    if (failed > 0) {
      logger.error('\nFailed components:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => logger.error(`- ${r.component}: ${r.message}`));
    }
    
    if (skipped > 0) {
      logger.warn('\nSkipped components:');
      this.results
        .filter(r => r.status === 'skip')
        .forEach(r => logger.warn(`- ${r.component}: ${r.message}`));
    }
    
    logger.info('='.repeat(60));
    
    // Exit with error code if any tests failed
    if (failed > 0) {
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  try {
    const tester = new ComponentTester();
    await tester.runAllTests();
  } catch (error) {
    logger.error('Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}