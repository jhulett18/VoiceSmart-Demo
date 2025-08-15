import { NextRequest, NextResponse } from 'next/server';
import { getDocumentIngestionService } from '@/lib/rag/document-ingestion';
import { isInFallbackMode } from '@/lib/rag/vectorstore';
import { logger } from '@/lib/observability/logger';
import { z } from 'zod';

// Validation schemas
const IngestDocumentSchema = z.object({
  tenantId: z.string().uuid(),
  documents: z.array(z.object({
    title: z.string().min(1),
    content: z.string().min(10),
    sourceUrl: z.string().url().optional(),
    documentType: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }))
});

const SearchDocumentsSchema = z.object({
  tenantId: z.string().uuid(),
  query: z.string().min(1),
  documentType: z.string().optional(),
  limit: z.number().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional()
});

const DeleteDocumentSchema = z.object({
  tenantId: z.string().uuid(),
  documentId: z.string().uuid()
});

const documentService = getDocumentIngestionService();

// ===================================
// DOCUMENT INGESTION
// ===================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, documents } = IngestDocumentSchema.parse(body);

    logger.info('RAG ingestion request', {
      tenantId,
      documentCount: documents.length
    });

    // Check service health
    const isHealthy = await documentService.isHealthy();
    if (!isHealthy) {
      return NextResponse.json(
        { 
          error: 'Document ingestion service unavailable',
          message: 'Please try again later or check system status'
        },
        { status: 503 }
      );
    }

    // Process documents
    const results = await documentService.ingestMultipleDocuments(tenantId, documents);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const inFallbackMode = isInFallbackMode();

    const response = {
      success: failed.length === 0,
      totalDocuments: documents.length,
      successfulIngestions: successful.length,
      failedIngestions: failed.length,
      fallbackMode: inFallbackMode,
      ...(inFallbackMode && {
        notice: "Documents processed in fallback mode - functionality may be limited"
      }),
      results: results.map(r => ({
        documentId: r.documentId,
        success: r.success,
        chunkCount: r.chunkCount,
        totalTokens: r.totalTokens,
        processingTimeMs: r.processingTime,
        error: r.error
      })),
      totalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
      totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
    };

    logger.info('RAG ingestion completed', {
      tenantId,
      successful: successful.length,
      failed: failed.length,
      totalTokens: response.totalTokens
    });

    return NextResponse.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    logger.error('RAG ingestion error:', error);
    return NextResponse.json(
      { 
        error: 'Document ingestion failed',
        message: 'An unexpected error occurred during document processing'
      },
      { status: 500 }
    );
  }
}

// ===================================
// DOCUMENT SEARCH
// ===================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const queryData = {
      tenantId: searchParams.get('tenantId'),
      query: searchParams.get('query'),
      documentType: searchParams.get('documentType') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      threshold: searchParams.get('threshold') ? parseFloat(searchParams.get('threshold')!) : undefined
    };

    const { tenantId, query, documentType, limit, threshold } = SearchDocumentsSchema.parse(queryData);

    logger.debug('RAG search request', {
      tenantId,
      query,
      documentType,
      limit,
      threshold
    });

    // Check service health
    const isHealthy = await documentService.isHealthy();
    if (!isHealthy) {
      return NextResponse.json(
        { 
          error: 'Document search service unavailable',
          message: 'Please try again later or check system status'
        },
        { status: 503 }
      );
    }

    // Perform search
    const results = await documentService.searchDocuments(tenantId, {
      query,
      documentType,
      limit,
      threshold
    });

    const inFallbackMode = isInFallbackMode();
    
    const response = {
      query,
      resultCount: results.length,
      fallbackMode: inFallbackMode,
      ...(inFallbackMode && {
        notice: "Using fallback mode with pre-loaded business documents due to vector database unavailability"
      }),
      results: results.map(r => ({
        content: r.content,
        score: r.score,
        source: r.source,
        relevantExcerpt: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
        fallbackMode: r.metadata?.fallbackMode || false
      }))
    };

    logger.debug('RAG search completed', {
      tenantId,
      query,
      resultCount: results.length
    });

    return NextResponse.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid search parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }

    logger.error('RAG search error:', error);
    return NextResponse.json(
      { 
        error: 'Document search failed',
        message: 'An unexpected error occurred during search'
      },
      { status: 500 }
    );
  }
}

// ===================================
// DOCUMENT DELETION
// ===================================

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, documentId } = DeleteDocumentSchema.parse(body);

    logger.info('RAG deletion request', {
      tenantId,
      documentId
    });

    const success = await documentService.deleteDocument(tenantId, documentId);

    if (success) {
      logger.info('RAG deletion completed', {
        tenantId,
        documentId
      });

      return NextResponse.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } else {
      return NextResponse.json(
        { 
          error: 'Document not found or deletion failed',
          message: 'The specified document could not be deleted'
        },
        { status: 404 }
      );
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid deletion request',
          details: error.errors
        },
        { status: 400 }
      );
    }

    logger.error('RAG deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Document deletion failed',
        message: 'An unexpected error occurred during deletion'
      },
      { status: 500 }
    );
  }
}