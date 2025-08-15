#!/usr/bin/env node

// Simple test script to demonstrate Qdrant fallback functionality
const { exec } = require('child_process');
const http = require('http');

console.log('🧪 Testing Qdrant Fallback Functionality\n');

// Test function to make API requests
function testSearch(tenantId, query) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            tenantId,
            query,
            limit: 3
        });

        const options = {
            hostname: 'localhost',
            port: 3001,
            path: `/api/rag?tenantId=${tenantId}&query=${encodeURIComponent(query)}&limit=3`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function runTests() {
    console.log('📋 Test Plan:');
    console.log('1. Test with Qdrant running (normal mode)');
    console.log('2. Stop Qdrant service');
    console.log('3. Test fallback mode with mock data');
    console.log('4. Verify user notifications\n');

    // Test with known tenant ID (dental clinic)
    const tenantId = '550e8400-e29b-41d4-a716-446655440001';
    
    try {
        console.log('🔍 Testing search functionality...');
        
        const response = await testSearch(tenantId, 'dental cleaning');
        
        console.log('📊 Search Results:');
        console.log(`- Query: "dental cleaning"`);
        console.log(`- Result count: ${response.resultCount}`);
        console.log(`- Fallback mode: ${response.fallbackMode ? '✅ YES' : '❌ NO'}`);
        
        if (response.notice) {
            console.log(`- Notice: ${response.notice}`);
        }
        
        if (response.results && response.results.length > 0) {
            console.log('\n📄 Sample Results:');
            response.results.slice(0, 2).forEach((result, index) => {
                console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
                console.log(`   Source: ${result.source.title}`);
                console.log(`   Fallback: ${result.fallbackMode ? 'Yes' : 'No'}`);
                console.log(`   Excerpt: ${result.relevantExcerpt}\n`);
            });
        }
        
        // Test different query
        console.log('🔍 Testing second query...');
        const response2 = await testSearch(tenantId, 'appointment scheduling');
        
        console.log('📊 Second Search Results:');
        console.log(`- Query: "appointment scheduling"`);
        console.log(`- Result count: ${response2.resultCount}`);
        console.log(`- Fallback mode: ${response2.fallbackMode ? '✅ YES' : '❌ NO'}`);
        
        console.log('\n✅ Fallback test completed successfully!');
        console.log('\n💡 How to test fallback mode:');
        console.log('1. Stop Qdrant: docker-compose stop qdrant');
        console.log('2. Restart the app: npm run dev');
        console.log('3. Run search queries - they should work with mock data');
        console.log('4. Restart Qdrant: docker-compose start qdrant');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure the Next.js dev server is running:');
        console.log('   npm run dev');
    }
}

runTests();