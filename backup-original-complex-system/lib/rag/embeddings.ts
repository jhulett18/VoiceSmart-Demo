import { pipeline, Pipeline } from '@xenova/transformers';
import { logger } from '../observability/logger';

interface EmbeddingResult {
  vector: number[];
  tokenCount: number;
  processingTime: number;
}

interface BatchEmbeddingResult {
  vectors: number[][];
  totalTokens: number;
  processingTime: number;
}

class EmbeddingService {
  private pipeline: Pipeline | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  constructor() {
    // Initialize in background
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      logger.info('Initializing embedding model', {
        model: this.modelName
      });

      const startTime = Date.now();
      
      // Create feature extraction pipeline
      this.pipeline = await pipeline('feature-extraction', this.modelName, {
        quantized: true, // Use quantized model for faster inference
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            logger.debug('Downloading embedding model', {
              progress: `${progress.name}: ${Math.round(progress.progress)}%`
            });
          }
        }
      });

      const initTime = Date.now() - startTime;
      this.isInitialized = true;

      logger.info('Embedding model initialized successfully', {
        model: this.modelName,
        initTimeMs: initTime
      });

    } catch (error) {
      logger.error('Failed to initialize embedding model:', error);
      this.pipeline = null;
      this.isInitialized = false;
      throw error;
    }
  }

  // ===================================
  // EMBEDDING OPERATIONS
  // ===================================

  async embed(text: string): Promise<EmbeddingResult> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    const startTime = Date.now();

    try {
      // Clean and prepare text
      const cleanText = this.cleanText(text);
      
      // Get embeddings
      const output = await this.pipeline(cleanText, {
        pooling: 'mean',
        normalize: true
      });

      // Extract vector from output
      const vector = Array.from(output.data) as number[];
      
      const processingTime = Date.now() - startTime;
      const tokenCount = this.estimateTokenCount(cleanText);

      logger.debug('Generated embedding', {
        textLength: cleanText.length,
        vectorDimensions: vector.length,
        tokenCount,
        processingTimeMs: processingTime
      });

      return {
        vector,
        tokenCount,
        processingTime
      };

    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    const startTime = Date.now();

    try {
      // Clean all texts
      const cleanTexts = texts.map(text => this.cleanText(text));
      
      // Process in batches to avoid memory issues
      const batchSize = 32;
      const vectors: number[][] = [];
      let totalTokens = 0;

      for (let i = 0; i < cleanTexts.length; i += batchSize) {
        const batch = cleanTexts.slice(i, i + batchSize);
        
        // Get embeddings for batch
        const outputs = await Promise.all(
          batch.map(text => this.pipeline!(text, {
            pooling: 'mean',
            normalize: true
          }))
        );

        // Extract vectors
        const batchVectors = outputs.map(output => Array.from(output.data) as number[]);
        vectors.push(...batchVectors);

        // Count tokens
        totalTokens += batch.reduce((sum, text) => sum + this.estimateTokenCount(text), 0);

        logger.debug('Processed embedding batch', {
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          totalProcessed: vectors.length
        });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Generated batch embeddings', {
        count: texts.length,
        totalTokens,
        processingTimeMs: processingTime,
        avgTimePerText: Math.round(processingTime / texts.length)
      });

      return {
        vectors,
        totalTokens,
        processingTime
      };

    } catch (error) {
      logger.error('Failed to generate batch embeddings:', error);
      throw error;
    }
  }

  // ===================================
  // TEXT PROCESSING
  // ===================================

  private cleanText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .substring(0, 512); // Limit length to prevent memory issues
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  // ===================================
  // CHUNK PROCESSING
  // ===================================

  chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceSize = sentence.trim().length;
      
      // If adding this sentence would exceed chunk size
      if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-overlap);
        currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
        currentSize = currentChunk.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
        currentSize += sentenceSize;
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async embedDocument(
    text: string,
    metadata: {
      title: string;
      documentType?: string;
      source?: string;
    }
  ): Promise<{
    chunks: Array<{
      content: string;
      vector: number[];
      chunkIndex: number;
      metadata: any;
    }>;
    totalTokens: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    // Split into chunks
    const chunks = this.chunkText(text);
    
    // Generate embeddings for all chunks
    const embeddings = await this.embedBatch(chunks);

    const results = chunks.map((content, index) => ({
      content,
      vector: embeddings.vectors[index],
      chunkIndex: index,
      metadata: {
        ...metadata,
        chunkCount: chunks.length,
        originalLength: text.length
      }
    }));

    const processingTime = Date.now() - startTime;

    logger.info('Embedded document', {
      title: metadata.title,
      originalLength: text.length,
      chunkCount: chunks.length,
      totalTokens: embeddings.totalTokens,
      processingTimeMs: processingTime
    });

    return {
      chunks: results,
      totalTokens: embeddings.totalTokens,
      processingTime
    };
  }

  // ===================================
  // SIMILARITY OPERATIONS
  // ===================================

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  findMostSimilar(
    queryVector: number[],
    vectors: Array<{ vector: number[]; metadata: any }>,
    threshold = 0.7
  ): Array<{ similarity: number; metadata: any }> {
    const similarities = vectors
      .map(item => ({
        similarity: this.cosineSimilarity(queryVector, item.vector),
        metadata: item.metadata
      }))
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return similarities;
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  async isReady(): Promise<boolean> {
    try {
      await this.initialize();
      return this.isInitialized;
    } catch {
      return false;
    }
  }

  getModelInfo(): {
    name: string;
    dimensions: number;
    initialized: boolean;
  } {
    return {
      name: this.modelName,
      dimensions: 384, // all-MiniLM-L6-v2 produces 384-dimensional embeddings
      initialized: this.isInitialized
    };
  }

  async warmup(): Promise<void> {
    try {
      await this.embed('This is a warmup text to initialize the model.');
      logger.info('Embedding service warmed up successfully');
    } catch (error) {
      logger.warn('Failed to warm up embedding service:', error);
    }
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

export { EmbeddingService };
export type { EmbeddingResult, BatchEmbeddingResult };