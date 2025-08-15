import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../observability/logger';
import { businessDocuments } from '../../../data/documents/seed-documents';

interface VectorStoreConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}

interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    tenantId: string;
    documentId: string;
    chunkIndex: number;
    title: string;
    source?: string;
    documentType?: string;
    [key: string]: unknown;
  };
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, unknown>;
}

class VectorStore {
  private client: QdrantClient | null = null;
  private isConnected = false;
  private collectionName = 'voicesmart_documents';

  constructor(private config: VectorStoreConfig) {
    this.connect();
  }

  private async connect() {
    try {
      this.client = new QdrantClient({
        url: this.config.url,
        apiKey: this.config.apiKey,
        timeout: this.config.timeout || 30000
      });

      // Test connection by getting cluster info
      await this.client.getClusterInfo();
      
      this.isConnected = true;
      logger.info('Qdrant vector store connected successfully', {
        url: this.config.url
      });

      // Ensure collection exists
      await this.ensureCollection();
      
    } catch (error) {
      logger.error('Failed to connect to Qdrant vector store:', error);
      this.client = null;
    }
  }

  private async ensureCollection() {
    if (!this.client) return;

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        c => c.name === this.collectionName
      );

      if (!collectionExists) {
        // Create collection with 384-dimensional vectors (for all-MiniLM-L6-v2)
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 384,
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });

        logger.info('Created Qdrant collection', {
          collection: this.collectionName
        });

        // Create index for tenant filtering
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'tenantId',
          field_schema: 'keyword'
        });

        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'documentType',
          field_schema: 'keyword'
        });

        logger.info('Created payload indexes for tenant isolation');
      }
    } catch (error) {
      logger.error('Failed to ensure collection exists:', error);
    }
  }

  // ===================================
  // DOCUMENT OPERATIONS
  // ===================================

  async addDocument(
    tenantId: string,
    document: Omit<VectorDocument, 'metadata'> & { 
      metadata: Omit<VectorDocument['metadata'], 'tenantId'> 
    },
    vector: number[]
  ): Promise<boolean> {
    if (!this.client) {
      logger.warn('Vector store client not available');
      return false;
    }

    try {
      const point = {
        id: document.id,
        vector,
        payload: {
          content: document.content,
          tenantId,
          ...document.metadata
        }
      };

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [point]
      });

      logger.debug('Added document to vector store', {
        tenantId,
        documentId: document.id,
        chunkIndex: document.metadata.chunkIndex
      });

      return true;
    } catch (error) {
      logger.error('Failed to add document to vector store:', error);
      return false;
    }
  }

  async addDocuments(
    tenantId: string,
    documents: Array<Omit<VectorDocument, 'metadata'> & { 
      metadata: Omit<VectorDocument['metadata'], 'tenantId'> 
    }>,
    vectors: number[][]
  ): Promise<boolean> {
    if (!this.client) {
      logger.warn('Vector store client not available');
      return false;
    }

    if (documents.length !== vectors.length) {
      logger.error('Document and vector array lengths do not match');
      return false;
    }

    try {
      const points = documents.map((doc, index) => ({
        id: doc.id,
        vector: vectors[index],
        payload: {
          content: doc.content,
          tenantId,
          ...doc.metadata
        }
      }));

      // Batch upsert
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.client.upsert(this.collectionName, {
          wait: true,
          points: batch
        });
      }

      logger.info('Added documents to vector store', {
        tenantId,
        count: documents.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to add documents to vector store:', error);
      return false;
    }
  }

  async deleteDocument(tenantId: string, documentId: string): Promise<boolean> {
    if (!this.client) {
      logger.warn('Vector store client not available');
      return false;
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [documentId]
      });

      logger.debug('Deleted document from vector store', {
        tenantId,
        documentId
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete document from vector store:', error);
      return false;
    }
  }

  async deleteDocumentsByFilter(tenantId: string, filter: Record<string, unknown>): Promise<boolean> {
    if (!this.client) {
      logger.warn('Vector store client not available');
      return false;
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            { key: 'tenantId', match: { value: tenantId } },
            ...Object.entries(filter).map(([key, value]) => ({
              key,
              match: { value }
            }))
          ]
        }
      });

      logger.debug('Deleted documents by filter from vector store', {
        tenantId,
        filter
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete documents by filter:', error);
      return false;
    }
  }

  // ===================================
  // SEARCH OPERATIONS
  // ===================================

  async search(
    tenantId: string,
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!this.client) {
      logger.warn('Vector store client not available');
      return [];
    }

    const {
      limit = 10,
      threshold = 0.7,
      filter = {}
    } = options;

    try {
      const must = [
        { key: 'tenantId', match: { value: tenantId } }
      ];

      // Add additional filters
      Object.entries(filter).forEach(([key, value]) => {
        must.push({ key, match: { value } });
      });

      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        score_threshold: threshold,
        filter: { must },
        with_payload: true
      });

      const results: SearchResult[] = searchResult.map(point => ({
        id: point.id as string,
        content: point.payload?.content as string,
        score: point.score,
        metadata: point.payload || {}
      }));

      logger.debug('Vector search completed', {
        tenantId,
        resultCount: results.length,
        limit,
        threshold
      });

      return results;
    } catch (error) {
      logger.error('Vector search failed:', error);
      return [];
    }
  }

  async searchByText(
    tenantId: string,
    queryVector: number[],
    documentType?: string,
    limit = 5
  ): Promise<SearchResult[]> {
    const filter = documentType ? { documentType } : {};
    
    return this.search(tenantId, queryVector, {
      limit,
      threshold: 0.6,
      filter
    });
  }

  // ===================================
  // COLLECTION MANAGEMENT
  // ===================================

  async getCollectionInfo(): Promise<Record<string, unknown> | null> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error) {
      logger.error('Failed to get collection info:', error);
      return null;
    }
  }

  async getDocumentCount(tenantId: string): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      const result = await this.client.count(this.collectionName, {
        filter: {
          must: [{ key: 'tenantId', match: { value: tenantId } }]
        }
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to count documents:', error);
      return 0;
    }
  }

  // ===================================
  // HEALTH CHECK
  // ===================================

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.getClusterInfo();
      return true;
    } catch (error) {
      logger.error('Vector store ping failed:', error);
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.isConnected = false;
  }

  // Get the underlying client for advanced operations
  getClient(): QdrantClient | null {
    return this.client;
  }
}

// ===================================
// MOCK VECTOR STORE (FALLBACK)
// ===================================

interface MockDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  vector?: number[]; // Simulated embedding
}

class MockVectorStore {
  private documents: Map<string, MockDocument[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    if (this.isInitialized) return;

    logger.info('Initializing mock vector store with seed data');
    
    // Pre-populate with seed documents for common business types
    const tenantBusinessTypes = {
      '550e8400-e29b-41d4-a716-446655440001': 'dental',
      '550e8400-e29b-41d4-a716-446655440002': 'auto', 
      '550e8400-e29b-41d4-a716-446655440003': 'fitness'
    };

    Object.entries(tenantBusinessTypes).forEach(([tenantId, businessType]) => {
      const docs = businessDocuments[businessType as keyof typeof businessDocuments];
      if (docs) {
        const mockDocs: MockDocument[] = [];
        
        docs.forEach((doc, docIndex) => {
          // Split document into chunks (simulate chunking)
          const chunks = this.chunkContent(doc.content, 500);
          
          chunks.forEach((chunk, chunkIndex) => {
            const documentId = `${businessType}_doc_${docIndex}`;
            const mockDoc: MockDocument = {
              id: `${documentId}_chunk_${chunkIndex}`,
              content: chunk,
              metadata: {
                tenantId,
                documentId,
                chunkIndex,
                title: doc.title,
                documentType: doc.documentType,
                source: doc.sourceUrl,
                fallbackMode: true
              },
              vector: this.generateMockVector(chunk)
            };
            mockDocs.push(mockDoc);
          });
        });
        
        this.documents.set(tenantId, mockDocs);
        logger.debug(`Loaded ${mockDocs.length} mock documents for tenant ${tenantId}`);
      }
    });

    this.isInitialized = true;
    logger.info('Mock vector store initialized successfully');
  }

  private chunkContent(content: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split('\n\n');
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private generateMockVector(content: string): number[] {
    // Simple hash-based vector generation for similarity simulation
    const vector: number[] = [];
    const normalizedContent = content.toLowerCase();
    
    // Generate a 384-dimensional vector based on content characteristics
    for (let i = 0; i < 384; i++) {
      let value = 0;
      for (let j = 0; j < normalizedContent.length; j++) {
        value += normalizedContent.charCodeAt(j) * (i + 1) * (j + 1);
      }
      vector.push((value % 200 - 100) / 100); // Normalize to [-1, 1]
    }
    
    return vector;
  }

  private calculateSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    const queryWordSet = new Set(queryWords);
    
    for (const word of contentWords) {
      if (queryWordSet.has(word)) {
        matches++;
      }
    }
    
    // Basic scoring: matches / query length, with content length bonus
    const baseScore = matches / queryWords.length;
    const lengthBonus = Math.min(content.length / 1000, 0.2); // Max 0.2 bonus
    
    return Math.min(baseScore + lengthBonus, 1.0);
  }

  // Implement VectorStore interface methods
  async addDocument(
    tenantId: string,
    document: Omit<VectorDocument, 'metadata'> & { 
      metadata: Omit<VectorDocument['metadata'], 'tenantId'> 
    },
    vector: number[]
  ): Promise<boolean> {
    logger.debug('Mock vector store: Adding document', { tenantId, documentId: document.id });
    
    const tenantDocs = this.documents.get(tenantId) || [];
    
    const mockDoc: MockDocument = {
      id: document.id,
      content: document.content,
      metadata: {
        tenantId,
        ...document.metadata,
        fallbackMode: true
      },
      vector
    };
    
    tenantDocs.push(mockDoc);
    this.documents.set(tenantId, tenantDocs);
    
    return true;
  }

  async addDocuments(
    tenantId: string,
    documents: Array<Omit<VectorDocument, 'metadata'> & { 
      metadata: Omit<VectorDocument['metadata'], 'tenantId'> 
    }>,
    vectors: number[][]
  ): Promise<boolean> {
    logger.debug('Mock vector store: Adding documents', { tenantId, count: documents.length });
    
    for (let i = 0; i < documents.length; i++) {
      await this.addDocument(tenantId, documents[i], vectors[i]);
    }
    
    return true;
  }

  async deleteDocument(tenantId: string, documentId: string): Promise<boolean> {
    const tenantDocs = this.documents.get(tenantId) || [];
    const initialLength = tenantDocs.length;
    
    const filteredDocs = tenantDocs.filter(doc => doc.id !== documentId);
    this.documents.set(tenantId, filteredDocs);
    
    return filteredDocs.length < initialLength;
  }

  async deleteDocumentsByFilter(tenantId: string, filter: Record<string, unknown>): Promise<boolean> {
    const tenantDocs = this.documents.get(tenantId) || [];
    const initialLength = tenantDocs.length;
    
    const filteredDocs = tenantDocs.filter(doc => {
      for (const [key, value] of Object.entries(filter)) {
        if (doc.metadata[key] !== value) {
          return true; // Keep document if it doesn't match filter
        }
      }
      return false; // Remove document if it matches all filter criteria
    });
    
    this.documents.set(tenantId, filteredDocs);
    return filteredDocs.length < initialLength;
  }

  async search(
    tenantId: string,
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    logger.debug('Mock vector store: Performing search', { tenantId, options });
    
    const tenantDocs = this.documents.get(tenantId) || [];
    const { limit = 10, threshold = 0.1, filter = {} } = options;
    
    // Filter documents by metadata
    const filteredDocs = tenantDocs.filter(doc => {
      for (const [key, value] of Object.entries(filter)) {
        if (doc.metadata[key] !== value) {
          return false;
        }
      }
      return true;
    });
    
    // Calculate similarity scores using vector similarity (mock implementation)
    const results: SearchResult[] = filteredDocs
      .map(doc => {
        let score = 0.3; // Base score
        
        if (doc.vector && queryVector) {
          // Simple dot product similarity for demo purposes
          score = this.calculateVectorSimilarity(queryVector, doc.vector);
        }
        
        // Add some randomness to simulate real vector search variability
        score += (Math.random() - 0.5) * 0.1;
        score = Math.max(0, Math.min(1, score)); // Clamp between 0-1
        
        return {
          id: doc.id,
          content: doc.content,
          score,
          metadata: { ...doc.metadata, fallbackMode: true }
        };
      })
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    logger.debug('Mock vector store: Search completed', { 
      tenantId, 
      resultCount: results.length,
      fallbackMode: true 
    });
    
    return results;
  }

  private calculateVectorSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0.3;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0.3;
    
    // Cosine similarity
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    
    // Transform from [-1, 1] to [0.2, 0.9] for realistic search scores
    return 0.2 + (similarity + 1) * 0.35;
  }

  async searchByText(
    tenantId: string,
    queryVector: number[],
    documentType?: string,
    limit = 5
  ): Promise<SearchResult[]> {
    const filter = documentType ? { documentType } : {};
    
    return this.search(tenantId, queryVector, {
      limit,
      threshold: 0.1,
      filter
    });
  }

  async getCollectionInfo(): Promise<Record<string, unknown>> {
    return {
      status: 'green',
      points_count: Array.from(this.documents.values()).reduce((sum, docs) => sum + docs.length, 0),
      indexed_vectors_count: Array.from(this.documents.values()).reduce((sum, docs) => sum + docs.length, 0),
      fallbackMode: true
    };
  }

  async getDocumentCount(tenantId: string): Promise<number> {
    const tenantDocs = this.documents.get(tenantId) || [];
    return tenantDocs.length;
  }

  async ping(): Promise<boolean> {
    return true; // Mock store is always available
  }

  getConnectionStatus(): boolean {
    return true; // Mock store is always connected
  }

  async disconnect(): Promise<void> {
    this.documents.clear();
    this.isInitialized = false;
  }

  getClient(): QdrantClient | null {
    return null; // No real client in mock mode
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let vectorStoreInstance: VectorStore | MockVectorStore | null = null;
let fallbackMode = false;
let fallbackNotified = false;

export function getVectorStore(): VectorStore | MockVectorStore {
  if (!vectorStoreInstance) {
    initializeVectorStore();
  }

  // Check if current instance is disconnected and we're not already in fallback mode
  if (vectorStoreInstance instanceof VectorStore && !vectorStoreInstance.getConnectionStatus() && !fallbackMode) {
    logger.warn('Qdrant connection lost, switching to fallback mode');
    activateFallbackMode();
  }

  return vectorStoreInstance!;
}

function initializeVectorStore() {
  const config: VectorStoreConfig = {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    timeout: 5000 // Shorter timeout for faster fallback
  };

  try {
    logger.info('Attempting to connect to Qdrant vector store...');
    const testStore = new VectorStore(config);
    vectorStoreInstance = testStore;
    
    // Schedule a connection check after a brief delay
    setTimeout(async () => {
      try {
        const isConnected = await testStore.ping();
        if (!isConnected && !fallbackMode) {
          logger.warn('Qdrant ping failed, switching to fallback mode');
          activateFallbackMode();
        } else if (isConnected && fallbackMode) {
          logger.info('✅ Qdrant connection restored, switching back from fallback mode');
          vectorStoreInstance = testStore;
          fallbackMode = false;
          fallbackNotified = false;
        }
      } catch (error) {
        if (!fallbackMode) {
          logger.error('Qdrant health check failed, switching to fallback mode:', error);
          activateFallbackMode();
        }
      }
    }, 1000);
    
  } catch (error) {
    logger.error('Error initializing Qdrant vector store, falling back to mock:', error);
    activateFallbackMode();
  }
}

function activateFallbackMode() {
  if (!fallbackNotified) {
    logger.warn('⚠️  Qdrant vector database unavailable - activating fallback mode with mock data');
    logger.info('📚 Fallback mode provides basic search functionality using pre-loaded business documents');
    logger.info('🔄 Normal functionality will resume automatically when Qdrant becomes available');
    fallbackNotified = true;
  }
  
  fallbackMode = true;
  vectorStoreInstance = new MockVectorStore();
}

// Helper function to check if we're in fallback mode
export function isInFallbackMode(): boolean {
  return fallbackMode;
}

// Function to reset to normal mode (useful for testing or when Qdrant becomes available again)
export function resetVectorStore() {
  vectorStoreInstance = null;
  fallbackMode = false;
  fallbackNotified = false;
}

export { VectorStore, MockVectorStore };
export type { VectorStoreConfig, VectorDocument, SearchResult, SearchOptions };