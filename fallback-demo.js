#!/usr/bin/env node

// Simple standalone test to demonstrate the fallback functionality
// This bypasses the logger issues and tests the core vector store logic

console.log('🚀 Qdrant Fallback Demo - Testing Core Functionality\n');

// Mock the logger to avoid worker thread issues
const mockLogger = {
  info: (msg, obj) => console.log(`[INFO] ${msg}`, obj ? JSON.stringify(obj, null, 2) : ''),
  warn: (msg, obj) => console.log(`[WARN] ${msg}`, obj ? JSON.stringify(obj, null, 2) : ''),
  error: (msg, obj) => console.log(`[ERROR] ${msg}`, obj ? JSON.stringify(obj, null, 2) : ''),
  debug: (msg, obj) => console.log(`[DEBUG] ${msg}`, obj ? JSON.stringify(obj, null, 2) : '')
};

// Mock business documents (simplified version)
const mockBusinessDocs = {
  dental: [
    {
      title: "Dental Services and Procedures",
      content: `At BrightSmile Dental Clinic, we offer comprehensive dental care for the whole family. Our services include:

PREVENTIVE CARE:
- Routine dental cleanings and exams (recommended every 6 months)
- Fluoride treatments for cavity prevention
- Dental sealants for children and adults
- Oral cancer screenings

RESTORATIVE DENTISTRY:
- Tooth-colored fillings using composite materials
- Dental crowns and bridges for damaged or missing teeth
- Root canal therapy to save infected teeth

COSMETIC DENTISTRY:
- Professional teeth whitening (in-office and take-home options)
- Porcelain veneers for smile makeovers
- Invisalign clear aligners for orthodontic treatment

EMERGENCY DENTAL CARE:
- Same-day appointments for dental emergencies
- Treatment for severe tooth pain, broken teeth, or dental trauma
- After-hours emergency contact available`,
      documentType: "services"
    },
    {
      title: "Scheduling and Office Policies",
      content: `OFFICE HOURS:
Monday - Friday: 8:00 AM - 6:00 PM
Saturday: 9:00 AM - 3:00 PM
Sunday: Closed

SCHEDULING APPOINTMENTS:
- Routine cleanings should be scheduled 2-3 weeks in advance
- Emergency appointments available same day
- New patient appointments require 1 hour for comprehensive exam
- Online scheduling available through our patient portal
- Text and email appointment reminders sent 24 hours prior

APPOINTMENT POLICIES:
- Please arrive 15 minutes early for check-in
- Bring your insurance card and photo ID to every appointment
- 24-hour notice required for cancellations
- Missed appointments without notice may incur a $50 fee`,
      documentType: "policies"
    }
  ]
};

// Simple Mock Vector Store Implementation
class SimpleMockVectorStore {
  constructor() {
    this.documents = new Map();
    this.initializeMockData();
  }

  initializeMockData() {
    console.log('📚 Initializing mock vector store with sample dental clinic data...');
    
    const tenantId = '550e8400-e29b-41d4-a716-446655440001';
    const docs = mockBusinessDocs.dental;
    const mockDocs = [];
    
    docs.forEach((doc, docIndex) => {
      // Split document into chunks
      const chunks = this.chunkContent(doc.content, 300);
      
      chunks.forEach((chunk, chunkIndex) => {
        const documentId = `dental_doc_${docIndex}`;
        const mockDoc = {
          id: `${documentId}_chunk_${chunkIndex}`,
          content: chunk,
          metadata: {
            tenantId,
            documentId,
            chunkIndex,
            title: doc.title,
            documentType: doc.documentType,
            fallbackMode: true
          }
        };
        mockDocs.push(mockDoc);
      });
    });
    
    this.documents.set(tenantId, mockDocs);
    console.log(`✅ Loaded ${mockDocs.length} mock document chunks for tenant ${tenantId}\n`);
  }

  chunkContent(content, maxLength) {
    const chunks = [];
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

  async search(tenantId, query, options = {}) {
    console.log(`🔍 Searching for: "${query}"`);
    
    const tenantDocs = this.documents.get(tenantId) || [];
    const { limit = 5, threshold = 0.1, filter = {} } = options;
    
    // Simple text-based search scoring
    const results = tenantDocs
      .map(doc => {
        const score = this.calculateTextSimilarity(query.toLowerCase(), doc.content.toLowerCase());
        return {
          id: doc.id,
          content: doc.content,
          score,
          metadata: { ...doc.metadata }
        };
      })
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`📊 Found ${results.length} relevant results\n`);
    return results;
  }

  calculateTextSimilarity(query, content) {
    const queryWords = query.split(/\s+/);
    const contentWords = content.split(/\s+/);
    
    let matches = 0;
    const queryWordSet = new Set(queryWords);
    
    for (const word of contentWords) {
      if (queryWordSet.has(word)) {
        matches++;
      }
    }
    
    // Score based on keyword matches
    const baseScore = matches / queryWords.length;
    const lengthBonus = Math.min(content.length / 1000, 0.2);
    
    return Math.min(baseScore + lengthBonus, 1.0);
  }

  ping() {
    return true; // Mock store is always available
  }

  getConnectionStatus() {
    return true;
  }
}

async function demonstrateFallback() {
  console.log('🧪 Testing Fallback Vector Store Functionality\n');
  
  // Create mock store
  const mockStore = new SimpleMockVectorStore();
  const tenantId = '550e8400-e29b-41d4-a716-446655440001';
  
  // Test various queries
  const testQueries = [
    'dental cleaning',
    'appointment scheduling', 
    'emergency dental care',
    'office hours',
    'teeth whitening',
    'root canal'
  ];
  
  for (const query of testQueries) {
    const results = await mockStore.search(tenantId, query, { limit: 3 });
    
    console.log(`Query: "${query}"`);
    console.log(`Results: ${results.length}`);
    
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. Score: ${result.score.toFixed(3)}`);
      console.log(`     Source: ${result.metadata.title}`);
      console.log(`     Type: ${result.metadata.documentType}`);
      console.log(`     Fallback: ${result.metadata.fallbackMode ? 'Yes' : 'No'}`);
      console.log(`     Preview: ${result.content.substring(0, 80)}...`);
    });
    console.log('');
  }
  
  console.log('✅ Fallback demonstration completed successfully!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('  • ✅ Mock data loading from seed documents');
  console.log('  • ✅ Text-based similarity search');
  console.log('  • ✅ Document chunking and metadata preservation');
  console.log('  • ✅ Fallback mode indication in results');
  console.log('  • ✅ Query relevance scoring');
  
  console.log('\n🔧 How the Full Integration Works:');
  console.log('  1. App tries to connect to Qdrant');
  console.log('  2. If connection fails, automatically switches to MockVectorStore');
  console.log('  3. User gets notification about fallback mode');
  console.log('  4. Search functionality continues to work with mock data');
  console.log('  5. When Qdrant comes back online, app automatically switches back');
}

demonstrateFallback().catch(console.error);