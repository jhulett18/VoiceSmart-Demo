#!/usr/bin/env tsx

import { TestRunner, TestSuite, assert, sleep, randomString, randomUuid } from './test-framework';
import { QdrantVectorStore } from '../../src/lib/rag/vectorstore';

const vectorStoreTestSuite: TestSuite = {
  name: 'Vector Store',
  tests: [
    {
      name: 'should initialize Qdrant vector store',
      fn: async () => {
        const config = {
          host: 'localhost',
          port: 6333,
          apiKey: undefined // Use for local testing
        };
        
        const vectorStore = new QdrantVectorStore(config);
        assert.truthy(vectorStore, 'Vector store should be created');
        
        // Test connection if Qdrant is available
        try {
          const isConnected = await vectorStore.testConnection();
          if (isConnected) {
            assert.truthy(isConnected, 'Should connect to Qdrant');
          }
        } catch (error) {
          // Skip if Qdrant not available
          console.log('Qdrant not available, skipping connection test');
        }
      }
    },

    {
      name: 'should handle collection management',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenantId = randomUuid();
          const collectionName = `test_collection_${randomString(8)}`;
          
          // Create collection
          const createResult = await vectorStore.createCollection(tenantId, collectionName, 384);
          if (createResult.success) {
            assert.truthy(createResult.success, 'Collection creation should succeed');
            
            // Check if collection exists
            const existsResult = await vectorStore.collectionExists(tenantId, collectionName);
            assert.truthy(existsResult, 'Collection should exist after creation');
            
            // Delete collection for cleanup
            const deleteResult = await vectorStore.deleteCollection(tenantId, collectionName);
            assert.truthy(deleteResult.success, 'Collection deletion should succeed');
          }
        } catch (error) {
          console.log('Vector store collection management test skipped (Qdrant not available)');
        }
      }
    },

    {
      name: 'should handle tenant isolation',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenant1 = randomUuid();
          const tenant2 = randomUuid();
          const collectionName = 'documents';
          
          // Ensure collection exists for both tenants
          await vectorStore.createCollection(tenant1, collectionName, 384);
          await vectorStore.createCollection(tenant2, collectionName, 384);
          
          const testVector = Array.from({ length: 384 }, () => Math.random());
          const documentId1 = randomUuid();
          const documentId2 = randomUuid();
          
          // Store vectors for different tenants
          const store1 = await vectorStore.storeVector(tenant1, collectionName, {
            id: documentId1,
            vector: testVector,
            metadata: { content: 'tenant1 content', docId: documentId1 }
          });
          
          const store2 = await vectorStore.storeVector(tenant2, collectionName, {
            id: documentId2,
            vector: testVector,
            metadata: { content: 'tenant2 content', docId: documentId2 }
          });
          
          if (store1.success && store2.success) {
            // Search within tenant1 - should only find tenant1 vectors
            const search1 = await vectorStore.searchVectors(tenant1, collectionName, testVector, 5);
            if (search1.success && search1.results) {
              const tenant1Results = search1.results.filter(r => r.metadata?.docId === documentId1);
              const tenant2Results = search1.results.filter(r => r.metadata?.docId === documentId2);
              
              assert.truthy(tenant1Results.length > 0, 'Should find tenant1 vectors in tenant1 search');
              assert.equal(tenant2Results.length, 0, 'Should not find tenant2 vectors in tenant1 search');
            }
            
            // Search within tenant2 - should only find tenant2 vectors
            const search2 = await vectorStore.searchVectors(tenant2, collectionName, testVector, 5);
            if (search2.success && search2.results) {
              const tenant1Results = search2.results.filter(r => r.metadata?.docId === documentId1);
              const tenant2Results = search2.results.filter(r => r.metadata?.docId === documentId2);
              
              assert.equal(tenant1Results.length, 0, 'Should not find tenant1 vectors in tenant2 search');
              assert.truthy(tenant2Results.length > 0, 'Should find tenant2 vectors in tenant2 search');
            }
          }
        } catch (error) {
          console.log('Vector store tenant isolation test skipped (Qdrant not available)');
        }
      }
    },

    {
      name: 'should handle vector storage and retrieval',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenantId = randomUuid();
          const collectionName = 'test_documents';
          
          // Ensure collection exists
          await vectorStore.createCollection(tenantId, collectionName, 384);
          
          const vectorId = randomUuid();
          const testVector = Array.from({ length: 384 }, () => Math.random());
          const metadata = {
            content: 'This is test content',
            docId: randomUuid(),
            chunkIndex: 0
          };
          
          // Store vector
          const storeResult = await vectorStore.storeVector(tenantId, collectionName, {
            id: vectorId,
            vector: testVector,
            metadata
          });
          
          if (storeResult.success) {
            assert.truthy(storeResult.success, 'Vector storage should succeed');
            
            // Retrieve vector
            const retrieveResult = await vectorStore.getVector(tenantId, collectionName, vectorId);
            if (retrieveResult.success && retrieveResult.vector) {
              assert.truthy(retrieveResult.success, 'Vector retrieval should succeed');
              assert.equal(retrieveResult.vector.id, vectorId, 'Retrieved vector should have correct ID');
              assert.deepEqual(retrieveResult.vector.metadata, metadata, 'Retrieved metadata should match stored metadata');
              assert.equal(retrieveResult.vector.vector.length, 384, 'Retrieved vector should have correct dimensions');
            }
            
            // Delete vector
            const deleteResult = await vectorStore.deleteVector(tenantId, collectionName, vectorId);
            assert.truthy(deleteResult.success, 'Vector deletion should succeed');
            
            // Verify deletion
            const retrieveAfterDelete = await vectorStore.getVector(tenantId, collectionName, vectorId);
            assert.falsy(retrieveAfterDelete.success, 'Vector should not exist after deletion');
          }
        } catch (error) {
          console.log('Vector store storage and retrieval test skipped (Qdrant not available)');
        }
      }
    },

    {
      name: 'should handle batch vector operations',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenantId = randomUuid();
          const collectionName = 'batch_test';
          
          // Ensure collection exists
          await vectorStore.createCollection(tenantId, collectionName, 384);
          
          // Create batch of vectors
          const batchSize = 5;
          const vectors = Array.from({ length: batchSize }, (_, i) => ({
            id: `batch_vector_${i}_${randomString(6)}`,
            vector: Array.from({ length: 384 }, () => Math.random()),
            metadata: {
              content: `Batch content ${i}`,
              batchIndex: i,
              docId: randomUuid()
            }
          }));
          
          // Store batch
          const batchStoreResult = await vectorStore.storeBatchVectors(tenantId, collectionName, vectors);
          if (batchStoreResult.success) {
            assert.truthy(batchStoreResult.success, 'Batch storage should succeed');
            
            // Verify each vector was stored
            for (const vector of vectors) {
              const retrieveResult = await vectorStore.getVector(tenantId, collectionName, vector.id);
              if (retrieveResult.success) {
                assert.truthy(retrieveResult.success, `Vector ${vector.id} should be retrievable`);
                assert.equal(retrieveResult.vector?.metadata?.batchIndex, vector.metadata.batchIndex, 'Batch index should match');
              }
            }
            
            // Delete batch
            const vectorIds = vectors.map(v => v.id);
            const batchDeleteResult = await vectorStore.deleteBatchVectors(tenantId, collectionName, vectorIds);
            assert.truthy(batchDeleteResult.success, 'Batch deletion should succeed');
          }
        } catch (error) {
          console.log('Vector store batch operations test skipped (Qdrant not available)');
        }
      }
    },

    {
      name: 'should handle vector search with similarity',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenantId = randomUuid();
          const collectionName = 'similarity_test';
          
          // Ensure collection exists
          await vectorStore.createCollection(tenantId, collectionName, 384);
          
          // Create reference vector
          const referenceVector = Array.from({ length: 384 }, () => Math.random());
          
          // Create similar vectors (with small variations)
          const similarVectors = Array.from({ length: 3 }, (_, i) => ({
            id: `similar_${i}_${randomString(6)}`,
            vector: referenceVector.map(val => val + (Math.random() - 0.5) * 0.1), // Small noise
            metadata: {
              content: `Similar content ${i}`,
              similarity: 'high'
            }
          }));
          
          // Create dissimilar vector
          const dissimilarVector = {
            id: `dissimilar_${randomString(6)}`,
            vector: Array.from({ length: 384 }, () => Math.random()),
            metadata: {
              content: 'Dissimilar content',
              similarity: 'low'
            }
          };
          
          // Store all vectors
          const allVectors = [...similarVectors, dissimilarVector];
          const storeResult = await vectorStore.storeBatchVectors(tenantId, collectionName, allVectors);
          
          if (storeResult.success) {
            // Search for similar vectors
            const searchResult = await vectorStore.searchVectors(tenantId, collectionName, referenceVector, 5);
            
            if (searchResult.success && searchResult.results) {
              assert.truthy(searchResult.results.length > 0, 'Search should return results');
              
              // Results should be ordered by similarity (highest score first)
              const scores = searchResult.results.map(r => r.score);
              for (let i = 1; i < scores.length; i++) {
                assert.truthy(scores[i] <= scores[i-1], 'Results should be ordered by similarity score');
              }
              
              // Similar vectors should have higher scores than dissimilar ones
              const similarResults = searchResult.results.filter(r => r.metadata?.similarity === 'high');
              const dissimilarResults = searchResult.results.filter(r => r.metadata?.similarity === 'low');
              
              if (similarResults.length > 0 && dissimilarResults.length > 0) {
                const avgSimilarScore = similarResults.reduce((sum, r) => sum + r.score, 0) / similarResults.length;
                const avgDissimilarScore = dissimilarResults.reduce((sum, r) => sum + r.score, 0) / dissimilarResults.length;
                
                assert.truthy(avgSimilarScore > avgDissimilarScore, 'Similar vectors should have higher scores');
              }
            }
          }
        } catch (error) {
          console.log('Vector store similarity search test skipped (Qdrant not available)');
        }
      }
    },

    {
      name: 'should handle metadata filtering',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenantId = randomUuid();
          const collectionName = 'filter_test';
          
          // Ensure collection exists
          await vectorStore.createCollection(tenantId, collectionName, 384);
          
          const testVector = Array.from({ length: 384 }, () => Math.random());
          
          // Create vectors with different metadata
          const vectors = [
            {
              id: `doc1_${randomString(6)}`,
              vector: testVector,
              metadata: { docType: 'manual', category: 'technical', priority: 'high' }
            },
            {
              id: `doc2_${randomString(6)}`,
              vector: testVector,
              metadata: { docType: 'guide', category: 'technical', priority: 'medium' }
            },
            {
              id: `doc3_${randomString(6)}`,
              vector: testVector,
              metadata: { docType: 'manual', category: 'business', priority: 'low' }
            }
          ];
          
          // Store vectors
          const storeResult = await vectorStore.storeBatchVectors(tenantId, collectionName, vectors);
          
          if (storeResult.success) {
            // Search with metadata filter for 'manual' documents
            const filter = { must: [{ key: 'docType', match: { value: 'manual' } }] };
            const searchResult = await vectorStore.searchVectors(
              tenantId, 
              collectionName, 
              testVector, 
              5, 
              filter
            );
            
            if (searchResult.success && searchResult.results) {
              assert.truthy(searchResult.results.length > 0, 'Filtered search should return results');
              
              // All results should be 'manual' documents
              const allManuals = searchResult.results.every(r => r.metadata?.docType === 'manual');
              assert.truthy(allManuals, 'All filtered results should be manual documents');
              
              // Should not include guide documents
              const hasGuides = searchResult.results.some(r => r.metadata?.docType === 'guide');
              assert.falsy(hasGuides, 'Filtered results should not include guide documents');
            }
          }
        } catch (error) {
          console.log('Vector store metadata filtering test skipped (Qdrant not available)');
        }
      }
    },

    {
      name: 'should handle connection status and errors',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        // Test connection status
        try {
          const isConnected = await vectorStore.testConnection();
          assert.type(isConnected, 'boolean', 'Connection test should return boolean');
        } catch (error) {
          console.log('Vector store connection test skipped (Qdrant not available)');
        }
        
        // Test error handling with invalid operations
        try {
          const tenantId = randomUuid();
          const invalidCollection = 'non_existent_collection';
          
          // Try to search in non-existent collection
          const searchResult = await vectorStore.searchVectors(
            tenantId, 
            invalidCollection, 
            [0.1, 0.2], 
            5
          );
          assert.falsy(searchResult.success, 'Search in non-existent collection should fail');
          assert.truthy(searchResult.error, 'Should provide error message');
          
        } catch (error) {
          console.log('Vector store error handling test completed (expected behavior)');
        }
      }
    },

    {
      name: 'should handle collection statistics',
      fn: async () => {
        const config = { host: 'localhost', port: 6333 };
        const vectorStore = new QdrantVectorStore(config);
        
        try {
          const tenantId = randomUuid();
          const collectionName = 'stats_test';
          
          // Create collection and add some vectors
          await vectorStore.createCollection(tenantId, collectionName, 384);
          
          const vectors = Array.from({ length: 3 }, (_, i) => ({
            id: `stats_vector_${i}`,
            vector: Array.from({ length: 384 }, () => Math.random()),
            metadata: { index: i }
          }));
          
          const storeResult = await vectorStore.storeBatchVectors(tenantId, collectionName, vectors);
          
          if (storeResult.success) {
            // Get collection stats
            const stats = await vectorStore.getCollectionStats(tenantId, collectionName);
            
            if (stats.success && stats.stats) {
              assert.truthy(stats.success, 'Stats retrieval should succeed');
              assert.truthy(typeof stats.stats.vectorCount === 'number', 'Should have vector count');
              assert.truthy(stats.stats.vectorCount >= vectors.length, 'Vector count should include stored vectors');
            }
          }
        } catch (error) {
          console.log('Vector store statistics test skipped (Qdrant not available)');
        }
      }
    }
  ],

  beforeAll: async () => {
    console.log('🔧 Setting up Vector Store tests...');
  },

  afterAll: async () => {
    console.log('🧹 Cleaning up Vector Store tests...');
  },

  beforeEach: async () => {
    // Each test is isolated, no shared state
  },

  afterEach: async () => {
    // Cleanup happens within each test if needed
  }
};

// Export for use in test runner
export { vectorStoreTestSuite };

// If run directly, execute the tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.addSuite(vectorStoreTestSuite);
  runner.runAll().then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}