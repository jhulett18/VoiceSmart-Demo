#!/usr/bin/env tsx

import { getDocumentIngestionService } from '../src/lib/rag/document-ingestion';
import { defaultTenants, seedDocumentsForTenant } from '../data/documents/seed-documents';
import { logger } from '../src/lib/observability/logger';

async function seedDocuments() {
  try {
    logger.info('Starting document seeding process');

    const documentService = getDocumentIngestionService();

    // Check if service is healthy
    const isHealthy = await documentService.isHealthy();
    if (!isHealthy) {
      logger.error('Document service is not healthy. Please check your configuration.');
      process.exit(1);
    }

    logger.info('Document service is healthy, proceeding with seeding');

    for (const tenant of defaultTenants) {
      logger.info(`Seeding documents for ${tenant.name}`, {
        tenantId: tenant.id,
        businessType: tenant.businessType
      });

      try {
        // Get documents for this business type
        const documents = await seedDocumentsForTenant(tenant.id, tenant.businessType);

        // Check if documents already exist
        const stats = await documentService.getDocumentStats(tenant.id);
        if (stats.totalDocuments > 0) {
          logger.info(`Tenant ${tenant.name} already has documents, skipping`, {
            existingDocuments: stats.totalDocuments
          });
          continue;
        }

        // Ingest documents
        const results = await documentService.ingestMultipleDocuments(tenant.id, documents);

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

        logger.info(`Completed seeding for ${tenant.name}`, {
          tenantId: tenant.id,
          successful,
          failed,
          totalTokens,
          totalTime: results.reduce((sum, r) => sum + r.processingTime, 0)
        });

        if (failed > 0) {
          logger.warn(`Some documents failed to ingest for ${tenant.name}`, {
            failedCount: failed,
            errors: results.filter(r => !r.success).map(r => r.error)
          });
        }

      } catch (error) {
        logger.error(`Failed to seed documents for ${tenant.name}:`, error);
      }

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Log final statistics
    logger.info('Document seeding completed');

    for (const tenant of defaultTenants) {
      try {
        const stats = await documentService.getDocumentStats(tenant.id);
        logger.info(`Final stats for ${tenant.name}:`, {
          tenantId: tenant.id,
          totalDocuments: stats.totalDocuments,
          indexedDocuments: stats.indexedDocuments,
          totalChunks: stats.totalChunks,
          documentTypes: stats.documentTypes
        });
      } catch (error) {
        logger.error(`Failed to get stats for ${tenant.name}:`, error);
      }
    }

    logger.info('All document seeding operations completed successfully');

  } catch (error) {
    logger.error('Document seeding failed:', error);
    process.exit(1);
  }
}

// Test search functionality after seeding
async function testSearch() {
  try {
    logger.info('Testing search functionality');

    const documentService = getDocumentIngestionService();

    for (const tenant of defaultTenants) {
      const testQueries = {
        dental: ['dental cleaning', 'insurance coverage', 'appointment scheduling'],
        auto: ['oil change cost', 'warranty information', 'brake repair'],
        fitness: ['gym membership', 'personal training', 'class schedule']
      };

      const queries = testQueries[tenant.businessType];

      for (const query of queries) {
        try {
          const results = await documentService.searchDocuments(tenant.id, {
            query,
            limit: 3
          });

          logger.info(`Search test for "${query}" in ${tenant.name}:`, {
            tenantId: tenant.id,
            query,
            resultCount: results.length,
            topScore: results[0]?.score || 0
          });

        } catch (error) {
          logger.error(`Search test failed for "${query}" in ${tenant.name}:`, error);
        }
      }
    }

    logger.info('Search testing completed');

  } catch (error) {
    logger.error('Search testing failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';

  switch (command) {
    case 'seed':
      await seedDocuments();
      break;
    case 'test':
      await testSearch();
      break;
    case 'both':
      await seedDocuments();
      await testSearch();
      break;
    default:
      logger.info('Usage: tsx scripts/seed-documents.ts [seed|test|both]');
      process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Script execution failed:', error);
    process.exit(1);
  });
}