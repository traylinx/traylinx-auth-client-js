#!/usr/bin/env node
/**
 * Test script for TraylinxAuth A2A Extension (JavaScript)
 */

const TraylinxAuthClient = require('./src/client');
const {
    getA2ARequestHeaders,
    validateDualAuthRequest,
    detectAuthMode
} = require('./src/index');

async function testA2AHeaders() {
    console.log("Testing A2A header generation...");
    
    // Mock client for testing
    const client = new TraylinxAuthClient();
    client.agentUserId = "test-agent-123";
    client.agentSecretToken = "test-token-456";
    client.tokenExpiration = Date.now() + 3600000; // 1 hour from now
    
    // Test A2A headers
    const headers = await client.getA2AHeaders();
    console.log(`A2A Headers:`, headers);
    
    if (!headers.Authorization || !headers.Authorization.startsWith("Bearer ")) {
        throw new Error("Authorization header missing or invalid");
    }
    if (headers['X-Agent-User-Id'] !== "test-agent-123") {
        throw new Error("X-Agent-User-Id header incorrect");
    }
    
    console.log("✅ A2A headers test passed");
}

function testDualValidation() {
    console.log("\nTesting dual authentication validation...");
    
    const client = new TraylinxAuthClient();
    
    // Test Bearer token format
    const bearerHeaders = {
        "Authorization": "Bearer test-token",
        "X-Agent-User-Id": "test-agent"
    };
    let mode = client.detectAuthMode(bearerHeaders);
    console.log(`Bearer token mode: ${mode}`);
    if (mode !== "bearer") {
        throw new Error("Bearer token detection failed");
    }
    
    // Test custom header format
    const customHeaders = {
        "X-Agent-Secret-Token": "test-token",
        "X-Agent-User-Id": "test-agent"
    };
    mode = client.detectAuthMode(customHeaders);
    console.log(`Custom header mode: ${mode}`);
    if (mode !== "custom") {
        throw new Error("Custom header detection failed");
    }
    
    // Test no auth
    const noAuthHeaders = {
        "Content-Type": "application/json"
    };
    mode = client.detectAuthMode(noAuthHeaders);
    console.log(`No auth mode: ${mode}`);
    if (mode !== "none") {
        throw new Error("No auth detection failed");
    }
    
    console.log("✅ Dual validation test passed");
}

function testCaseInsensitive() {
    console.log("\nTesting case-insensitive header handling...");
    
    const client = new TraylinxAuthClient();
    
    // Test mixed case headers
    const mixedHeaders = {
        "AUTHORIZATION": "Bearer test-token",
        "x-agent-user-id": "test-agent"
    };
    const mode = client.detectAuthMode(mixedHeaders);
    console.log(`Mixed case mode: ${mode}`);
    if (mode !== "bearer") {
        throw new Error("Case-insensitive detection failed");
    }
    
    console.log("✅ Case-insensitive test passed");
}

async function testBackwardCompatibility() {
    console.log("\nTesting backward compatibility...");
    
    const client = new TraylinxAuthClient();
    client.agentUserId = "test-agent-123";
    client.agentSecretToken = "test-token-456";
    client.tokenExpiration = Date.now() + 3600000; // 1 hour from now
    
    // Test existing method still works
    const legacyHeaders = await client.getAgentRequestHeaders();
    console.log(`Legacy headers:`, legacyHeaders);
    
    if (!legacyHeaders['X-Agent-Secret-Token']) {
        throw new Error("X-Agent-Secret-Token missing from legacy headers");
    }
    if (!legacyHeaders['X-Agent-User-Id']) {
        throw new Error("X-Agent-User-Id missing from legacy headers");
    }
    if (legacyHeaders.Authorization) {
        throw new Error("Authorization header should not be in legacy headers");
    }
    
    console.log("✅ Backward compatibility test passed");
}

async function runTests() {
    console.log("🚀 Testing TraylinxAuth A2A Extension (JavaScript)\n");
    
    try {
        await testA2AHeaders();
        testDualValidation();
        testCaseInsensitive();
        await testBackwardCompatibility();
        
        console.log("\n🎉 All tests passed! A2A extension is working correctly.");
        console.log("\n📋 Summary:");
        console.log("✅ A2A Bearer token headers generation");
        console.log("✅ Dual authentication mode detection");
        console.log("✅ Case-insensitive header handling");
        console.log("✅ Backward compatibility maintained");
        
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        process.exit(1);
    }
}

// Run tests
runTests();