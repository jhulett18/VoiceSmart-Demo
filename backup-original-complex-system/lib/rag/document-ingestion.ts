import { v4 as uuidv4 } from 'uuid';
import { getDatabaseClient } from '../memory/database';
import { getVectorStore } from './vectorstore';
import { getEmbeddingService } from './embeddings';
import { logger } from '../observability/logger';

interface DocumentInput {
  title: string;
  content: string;
  sourceUrl?: string;
  documentType?: string;
  metadata?: Record<string, any>;
}

interface IngestionResult {
  documentId: string;
  chunkCount: number;
  totalTokens: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

interface SearchQuery {
  query: string;
  documentType?: string;
  limit?: number;
  threshold?: number;
}

interface SearchResult {
  content: string;
  score: number;
  source: {
    documentId: string;
    title: string;
    chunkIndex: number;
    documentType?: string;
    sourceUrl?: string;
  };
  metadata: Record<string, any>;
}

class DocumentIngestionService {
  private db = getDatabaseClient();
  private vectorStore = getVectorStore();
  private embeddingService = getEmbeddingService();

  // ===================================
  // DOCUMENT INGESTION
  // ===================================

  async ingestDocument(tenantId: string, document: DocumentInput): Promise<IngestionResult> {
    const startTime = Date.now();
    const documentId = uuidv4();

    try {
      logger.info('Starting document ingestion', {
        tenantId,
        documentId,
        title: document.title,
        contentLength: document.content.length
      });

      // 1. Store document in database
      await this.db.query(
        tenantId,
        `INSERT INTO documents (id, tenant_id, title, content, source_url, document_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          documentId,
          tenantId,
          document.title,
          document.content,
          document.sourceUrl || null,
          document.documentType || 'general',
          JSON.stringify(document.metadata || {})
        ]
      );

      // 2. Generate embeddings and chunks
      const embeddingResult = await this.embeddingService.embedDocument(
        document.content,
        {
          title: document.title,
          documentType: document.documentType,
          source: document.sourceUrl
        }
      );

      // 3. Store chunks in database and vector store
      const vectorDocuments = [];
      const vectors = [];

      for (const chunk of embeddingResult.chunks) {
        const chunkId = `${documentId}_chunk_${chunk.chunkIndex}`;
        
        // Store chunk in database
        await this.db.query(
          tenantId,
          `INSERT INTO document_chunks (id, document_id, tenant_id, chunk_index, content, vector_id, token_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            documentId,
            tenantId,
            chunk.chunkIndex,
            chunk.content,
            chunkId,
            Math.ceil(chunk.content.length / 4) // Rough token estimate
          ]
        );

        // Prepare for vector store
        vectorDocuments.push({
          id: chunkId,
          content: chunk.content,
          metadata: {
            documentId,
            chunkIndex: chunk.chunkIndex,
            title: document.title,
            source: document.sourceUrl,
            documentType: document.documentType,
            ...document.metadata
          }
        });

        vectors.push(chunk.vector);
      }

      // 4. Add to vector store
      const vectorStoreSuccess = await this.vectorStore.addDocuments(
        tenantId,
        vectorDocuments,
        vectors
      );

      if (!vectorStoreSuccess) {
        throw new Error('Failed to add documents to vector store');
      }

      // 5. Update document as indexed
      await this.db.query(
        tenantId,
        `UPDATE documents 
         SET is_indexed = true, indexed_at = NOW(), chunk_count = $1
         WHERE id = $2`,
        [embeddingResult.chunks.length, documentId]
      );

      const processingTime = Date.now() - startTime;

      logger.info('Document ingestion completed', {
        tenantId,
        documentId,
        chunkCount: embeddingResult.chunks.length,
        totalTokens: embeddingResult.totalTokens,
        processingTimeMs: processingTime
      });

      return {
        documentId,
        chunkCount: embeddingResult.chunks.length,
        totalTokens: embeddingResult.totalTokens,
        processingTime,
        success: true
      };

    } catch (error) {
      logger.error('Document ingestion failed', {
        tenantId,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Cleanup on failure
      await this.cleanupFailedIngestion(tenantId, documentId);

      return {
        documentId,
        chunkCount: 0,
        totalTokens: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async ingestMultipleDocuments(
    tenantId: string,
    documents: DocumentInput[]
  ): Promise<IngestionResult[]> {
    logger.info('Starting batch document ingestion', {
      tenantId,
      documentCount: documents.length
    });

    const results: IngestionResult[] = [];

    // Process documents sequentially to avoid overwhelming the system
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      
      logger.info('Processing document', {
        tenantId,
        progress: `${i + 1}/${documents.length}`,
        title: document.title
      });

      const result = await this.ingestDocument(tenantId, document);
      results.push(result);

      // Brief pause between documents
      if (i < documents.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successful = results.filter(r => r.success).length;
    const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);

    logger.info('Batch document ingestion completed', {
      tenantId,
      totalDocuments: documents.length,
      successful,
      failed: documents.length - successful,
      totalTokens,
      totalTimeMs: totalTime
    });

    return results;
  }

  // ===================================
  // DOCUMENT SEARCH
  // ===================================

  async searchDocuments(tenantId: string, query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      logger.debug('Starting document search', {
        tenantId,
        query: query.query,
        documentType: query.documentType,
        limit: query.limit
      });

      // 1. Generate query embedding
      const queryEmbedding = await this.embeddingService.embed(query.query);

      // 2. Search vector store
      const filter = query.documentType ? { documentType: query.documentType } : {};
      
      const vectorResults = await this.vectorStore.search(
        tenantId,
        queryEmbedding.vector,
        {
          limit: query.limit || 5,
          threshold: query.threshold || 0.6,
          filter
        }
      );

      // 3. Enrich with database metadata
      const results: SearchResult[] = [];

      for (const vectorResult of vectorResults) {
        const metadata = vectorResult.metadata;
        
        results.push({
          content: vectorResult.content,
          score: vectorResult.score,
          source: {
            documentId: metadata.documentId,
            title: metadata.title,
            chunkIndex: metadata.chunkIndex,
            documentType: metadata.documentType,
            sourceUrl: metadata.source
          },
          metadata
        });
      }

      const processingTime = Date.now() - startTime;

      logger.debug('Document search completed', {
        tenantId,
        query: query.query,
        resultCount: results.length,
        processingTimeMs: processingTime
      });

      return results;

    } catch (error) {
      logger.error('Document search failed', {
        tenantId,
        query: query.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async getRelevantContext(
    tenantId: string,
    query: string,
    documentType?: string,
    maxTokens = 2000
  ): Promise<{
    context: string;
    sources: Array<{ title: string; documentId: string; chunkIndex: number }>;
    tokenCount: number;
  }> {
    const searchResults = await this.searchDocuments(tenantId, {
      query,
      documentType,
      limit: 10,
      threshold: 0.6
    });

    let context = '';
    let tokenCount = 0;
    const sources: Array<{ title: string; documentId: string; chunkIndex: number }> = [];

    for (const result of searchResults) {
      const chunkTokens = Math.ceil(result.content.length / 4);
      
      if (tokenCount + chunkTokens > maxTokens) {
        break;
      }

      context += result.content + '\n\n';
      tokenCount += chunkTokens;
      
      sources.push({
        title: result.source.title,
        documentId: result.source.documentId,
        chunkIndex: result.source.chunkIndex
      });
    }

    return {
      context: context.trim(),
      sources,
      tokenCount
    };
  }

  // ===================================
  // DOCUMENT MANAGEMENT
  // ===================================

  async deleteDocument(tenantId: string, documentId: string): Promise<boolean> {
    try {
      logger.info('Deleting document', { tenantId, documentId });

      // 1. Delete from vector store
      await this.vectorStore.deleteDocumentsByFilter(tenantId, { documentId });

      // 2. Delete chunks from database
      await this.db.query(
        tenantId,
        'DELETE FROM document_chunks WHERE document_id = $1',
        [documentId]
      );

      // 3. Delete document from database
      const result = await this.db.query(
        tenantId,
        'DELETE FROM documents WHERE id = $1',
        [documentId]
      );

      const success = (result?.rowCount || 0) > 0;

      logger.info('Document deletion completed', {
        tenantId,
        documentId,
        success
      });

      return success;
    } catch (error) {
      logger.error('Document deletion failed', {
        tenantId,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async getDocuments(tenantId: string, limit = 50): Promise<any[]> {
    const result = await this.db.query(
      tenantId,
      `SELECT id, title, document_type, source_url, is_indexed, chunk_count, created_at
       FROM documents 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    return result?.rows || [];
  }

  async getDocumentStats(tenantId: string): Promise<{
    totalDocuments: number;
    indexedDocuments: number;
    totalChunks: number;
    documentTypes: Record<string, number>;
  }> {
    const [docStats, chunkStats, typeStats] = await Promise.all([
      this.db.query(
        tenantId,
        'SELECT COUNT(*) as total, COUNT(CASE WHEN is_indexed THEN 1 END) as indexed FROM documents'
      ),
      this.db.query(
        tenantId,
        'SELECT COUNT(*) as total FROM document_chunks'
      ),
      this.db.query(
        tenantId,
        'SELECT document_type, COUNT(*) as count FROM documents GROUP BY document_type'
      )
    ]);

    const documentTypes: Record<string, number> = {};
    for (const row of typeStats?.rows || []) {
      documentTypes[row.document_type] = parseInt(row.count);
    }

    return {
      totalDocuments: parseInt(docStats?.rows[0]?.total || '0'),
      indexedDocuments: parseInt(docStats?.rows[0]?.indexed || '0'),
      totalChunks: parseInt(chunkStats?.rows[0]?.total || '0'),
      documentTypes
    };
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  private async cleanupFailedIngestion(tenantId: string, documentId: string): Promise<void> {
    try {
      // Delete any created chunks
      await this.db.query(
        tenantId,
        'DELETE FROM document_chunks WHERE document_id = $1',
        [documentId]
      );

      // Delete document record
      await this.db.query(
        tenantId,
        'DELETE FROM documents WHERE id = $1',
        [documentId]
      );

      // Delete from vector store
      await this.vectorStore.deleteDocumentsByFilter(tenantId, { documentId });

    } catch (error) {
      logger.error('Cleanup after failed ingestion failed', {
        tenantId,
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const [dbHealthy, vectorHealthy, embeddingReady] = await Promise.all([
        this.db.ping(),
        this.vectorStore.ping(),
        this.embeddingService.isReady()
      ]);

      return dbHealthy && vectorHealthy && embeddingReady;
    } catch {
      return false;
    }
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let documentIngestionInstance: DocumentIngestionService | null = null;

export function getDocumentIngestionService(): DocumentIngestionService {
  if (!documentIngestionInstance) {
    documentIngestionInstance = new DocumentIngestionService();
  }
  return documentIngestionInstance;
}

export { DocumentIngestionService };
export type { DocumentInput, IngestionResult, SearchQuery, SearchResult };