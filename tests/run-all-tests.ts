#!/usr/bin/env tsx

import { TestRunner } from './unit/test-framework';
import { redisTestSuite } from './unit/redis.test';
import { databaseTestSuite } from './unit/database.test';
import { vectorStoreTestSuite } from './unit/vectorstore.test';
import { embeddingsTestSuite } from './unit/embeddings.test';
import { ragTestSuite } from './unit/rag.test';
import { llmClientTestSuite } from './unit/llm-client.test';
import { websocketTestSuite } from './unit/websocket.test';
import { audioCacheTestSuite } from './unit/audio-cache.test';

async function runAllTests() {
  console.log('🚀 Starting VoiceSmart-Demo Unit Test Suite');
  console.log('=' * 60);
  
  const runner = new TestRunner();
  
  // Add all test suites
  runner.addSuite(redisTestSuite);
  runner.addSuite(databaseTestSuite);
  runner.addSuite(vectorStoreTestSuite);
  runner.addSuite(embeddingsTestSuite);
  runner.addSuite(ragTestSuite);
  runner.addSuite(llmClientTestSuite);
  runner.addSuite(websocketTestSuite);
  runner.addSuite(audioCacheTestSuite);
  
  // Run all tests
  const summary = await runner.runAll();
  
  console.log('\n🏁 Test Suite Complete');
  console.log('=' * 60);
  
  if (summary.failed > 0) {
    console.error(`❌ Tests failed: ${summary.failed}/${summary.totalTests}`);
    process.exit(1);
  } else {
    console.log(`✅ All tests passed: ${summary.passed}/${summary.totalTests}`);
    console.log(`⏱️  Total time: ${summary.duration}ms`);
    
    if (summary.skipped > 0) {
      console.log(`⚠️  Tests skipped: ${summary.skipped} (likely due to missing dependencies)`);
    }
    
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { runAllTests };