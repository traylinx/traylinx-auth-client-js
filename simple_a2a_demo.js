#!/usr/bin/env node
/**
 * Simple A2A Extension Demo (JavaScript)
 */

const TraylinxAuthClient = require('./src/client');
const {
    detectAuthMode
} = require('./src/index');

async function demoA2AExtension() {
    console.log("🚀 TraylinxAuth A2A Extension Demo (JavaScript)\n");
    
    // Create a mock client for demonstration
    const client = new TraylinxAuthClient();
    client.agentUserId = "demo-agent-123";
    client.agentSecretToken = "demo-token-456";
    client.tokenExpiration = Date.now() + 3600000; // 1 hour from now
    
    console.log("🔹 1. Generate A2A Headers (Bearer Token Format)");
    const a2aHeaders = await client.getA2AHeaders();
    console.log("   A2A Headers:", a2aHeaders);
    console.log("   ✅ Perfect for A2A SDK integration!\n");
    
    console.log("🔹 2. Generate Legacy Headers (Custom Format)");
    const legacyHeaders = await client.getAgentRequestHeaders();
    console.log("   Legacy Headers:", legacyHeaders);
    console.log("   ✅ Existing code still works!\n");
    
    console.log("🔹 3. Dual Authentication Detection");
    
    // Test Bearer token detection
    const bearerRequest = {
        "Authorization": "Bearer demo-token-456",
        "X-Agent-User-Id": "demo-agent-123"
    };
    let mode = client.detectAuthMode(bearerRequest);
    console.log(`   Bearer Token Request: Mode=${mode} (validation would check with auth service)`);
    
    // Test custom header detection
    const customRequest = {
        "X-Agent-Secret-Token": "demo-token-456",
        "X-Agent-User-Id": "demo-agent-123"
    };
    mode = client.detectAuthMode(customRequest);
    console.log(`   Custom Header Request: Mode=${mode} (validation would check with auth service)`);
    
    // Test case-insensitive headers
    const mixedCaseRequest = {
        "AUTHORIZATION": "Bearer demo-token-456",
        "x-agent-user-id": "demo-agent-123"
    };
    mode = client.detectAuthMode(mixedCaseRequest);
    console.log(`   Mixed Case Request: Mode=${mode} (validation would check with auth service)`);
    console.log("   ✅ Handles both formats seamlessly!\n");
    
    console.log("🔹 4. Migration Path");
    console.log("   Phase 1: Enable dual validation on servers");
    console.log("   Phase 2: Migrate clients to use getA2AHeaders()");
    console.log("   Phase 3: Monitor with detectAuthMode()");
    console.log("   Phase 4: Switch to A2A-only when ready");
    console.log("   ✅ Smooth migration guaranteed!\n");
    
    console.log("🔹 5. Usage Examples");
    console.log("   // Consumer Agent (calling others)");
    console.log("   const headers = await client.getA2AHeaders();");
    console.log("   const response = await axios.post(url, data, { headers });");
    console.log();
    console.log("   // Provider Agent (receiving calls)");
    console.log("   app.use(requireDualAuth);");
    console.log("   app.post('/api/endpoint', (req, res) => {");
    console.log("       return processRequest(req, res);");
    console.log("   });");
    console.log("   ✅ Simple and powerful!\n");
    
    console.log("🎉 Demo Complete!");
    console.log("\n📋 Key Benefits:");
    console.log("✅ Drop-in A2A compatibility");
    console.log("✅ Full backward compatibility");
    console.log("✅ Dual authentication support");
    console.log("✅ Case-insensitive headers");
    console.log("✅ Smooth migration path");
    console.log("✅ Zero breaking changes");
}

// Run demo
demoA2AExtension().catch(console.error);