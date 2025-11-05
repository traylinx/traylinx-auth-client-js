#!/usr/bin/env node
/**
 * Example: Using TraylinxAuth A2A Extension (JavaScript)
 * 
 * This example demonstrates how to use the enhanced TraylinxAuth client
 * with A2A (Agent2Agent) Protocol support in JavaScript/Node.js.
 */

const express = require('express');
const TraylinxAuthClient = require('./src/client');
const {
    getA2ARequestHeaders,
    validateDualAuthRequest,
    requireDualAuth,
    detectAuthMode
} = require('./src/index');

// Example 1: Consumer Agent (Calling other agents)
async function exampleConsumerAgent() {
    console.log("🔹 Example 1: Consumer Agent");
    
    // Initialize client
    const client = new TraylinxAuthClient(
        "your-client-id",
        "your-client-secret",
        "https://auth.makakoo.com/api"
    );
    
    // Get A2A-compatible headers (Bearer token format)
    const a2aHeaders = await client.getA2AHeaders();
    console.log("A2A Headers:", a2aHeaders);
    
    // Get legacy headers (custom format) - still works!
    const legacyHeaders = await client.getAgentRequestHeaders();
    console.log("Legacy Headers:", legacyHeaders);
    
    console.log("✅ Consumer agent example complete\n");
}

// Example 2: Provider Agent (Receiving requests)
function exampleProviderAgent() {
    console.log("🔹 Example 2: Provider Agent");
    
    const app = express();
    app.use(express.json());
    
    // Endpoint that accepts both Bearer tokens AND custom headers
    app.post('/api/process', requireDualAuth, (req, res) => {
        // Detect which auth mode was used
        const authMode = detectAuthMode(req.headers);
        
        res.json({
            message: "Data processed successfully",
            authMode: authMode,
            agentId: req.headers['x-agent-user-id']
        });
    });
    
    // Endpoint that only accepts A2A Bearer tokens
    app.post('/api/a2a-only', async (req, res) => {
        // Manual validation for A2A-only endpoints
        const isValid = await validateDualAuthRequest(req.headers);
        if (!isValid) {
            return res.status(401).json({ error: "A2A authentication required" });
        }
        
        const authMode = detectAuthMode(req.headers);
        if (authMode !== "bearer") {
            return res.status(400).json({ error: "Bearer token required for this endpoint" });
        }
        
        res.json({
            message: "A2A-only endpoint accessed",
            authMode: authMode
        });
    });
    
    console.log("Express app configured with dual authentication support");
    console.log("- /api/process: Accepts both Bearer tokens and custom headers");
    console.log("- /api/a2a-only: Requires Bearer tokens only");
    console.log("✅ Provider agent example complete\n");
    
    return app;
}

// Example 3: Migration Scenarios
async function exampleMigrationScenarios() {
    console.log("🔹 Example 3: Migration Scenarios");
    
    const client = new TraylinxAuthClient();
    
    // Scenario 1: Existing agent with custom headers
    console.log("Scenario 1: Legacy agent calling new A2A-enabled service");
    const legacyHeaders = {
        "X-Agent-Secret-Token": "legacy-token-123",
        "X-Agent-User-Id": "agent-456"
    };
    const isValid1 = await client.validateA2ARequest(legacyHeaders);
    const mode1 = client.detectAuthMode(legacyHeaders);
    console.log(`  Legacy headers valid: ${isValid1}, Mode: ${mode1}`);
    
    // Scenario 2: New A2A agent with Bearer tokens
    console.log("Scenario 2: A2A agent calling legacy service");
    const a2aHeaders = {
        "Authorization": "Bearer a2a-token-789",
        "X-Agent-User-Id": "agent-456"
    };
    const isValid2 = await client.validateA2ARequest(a2aHeaders);
    const mode2 = client.detectAuthMode(a2aHeaders);
    console.log(`  A2A headers valid: ${isValid2}, Mode: ${mode2}`);
    
    // Scenario 3: Mixed case headers (real-world scenario)
    console.log("Scenario 3: Mixed case headers from different HTTP clients");
    const mixedHeaders = {
        "AUTHORIZATION": "Bearer mixed-token-abc",
        "x-agent-user-id": "agent-456"
    };
    const isValid3 = await client.validateA2ARequest(mixedHeaders);
    const mode3 = client.detectAuthMode(mixedHeaders);
    console.log(`  Mixed case headers valid: ${isValid3}, Mode: ${mode3}`);
    
    console.log("✅ Migration scenarios example complete\n");
}

// Example 4: Best Practices
function exampleBestPractices() {
    console.log("🔹 Example 4: Best Practices");
    
    console.log("1. Use environment variables for configuration:");
    console.log("   export TRAYLINX_CLIENT_ID='your-client-id'");
    console.log("   export TRAYLINX_CLIENT_SECRET='your-client-secret'");
    console.log("   export TRAYLINX_API_BASE_URL='https://auth.makakoo.com/api'");
    console.log("   export TRAYLINX_AGENT_USER_ID='your-agent-id'");
    
    console.log("\n2. For new A2A agents, use Bearer token format:");
    console.log("   const headers = await client.getA2AHeaders();");
    
    console.log("\n3. For backward compatibility, use dual validation:");
    console.log("   app.use(requireDualAuth); // Accepts both formats");
    
    console.log("\n4. For gradual migration:");
    console.log("   - Start with dual validation on servers");
    console.log("   - Migrate clients to Bearer tokens over time");
    console.log("   - Eventually switch to A2A-only validation");
    
    console.log("\n5. Monitor auth modes for migration progress:");
    console.log("   const authMode = detectAuthMode(req.headers);");
    console.log("   // Log metrics to track Bearer vs custom usage");
    
    console.log("✅ Best practices example complete\n");
}

// Example 5: Real-world usage with axios
async function exampleRealWorldUsage() {
    console.log("🔹 Example 5: Real-world Usage with Axios");
    
    const axios = require('axios');
    const client = new TraylinxAuthClient();
    
    try {
        // Making A2A request to another agent
        const headers = await client.getA2AHeaders();
        
        const response = await axios.post('https://weather-agent.com/api/forecast', {
            location: 'New York',
            days: 7
        }, {
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            }
        });
        
        console.log("Weather forecast received:", response.data);
        
    } catch (error) {
        console.error("Error calling weather agent:", error.message);
    }
    
    console.log("✅ Real-world usage example complete\n");
}

async function runExamples() {
    console.log("🚀 TraylinxAuth A2A Extension Examples (JavaScript)\n");
    
    try {
        await exampleConsumerAgent();
        exampleProviderAgent();
        await exampleMigrationScenarios();
        exampleBestPractices();
        await exampleRealWorldUsage();
        
        console.log("🎉 All examples complete!");
        console.log("\n📚 Next Steps:");
        console.log("1. Set up your environment variables");
        console.log("2. Start with dual authentication on your servers");
        console.log("3. Gradually migrate clients to use getA2AHeaders()");
        console.log("4. Monitor usage with detectAuthMode()");
        console.log("5. Eventually switch to A2A-only endpoints when ready");
        
    } catch (error) {
        console.error("Error running examples:", error.message);
    }
}

// Run examples if this file is executed directly
if (require.main === module) {
    runExamples();
}

module.exports = {
    exampleConsumerAgent,
    exampleProviderAgent,
    exampleMigrationScenarios,
    exampleBestPractices,
    exampleRealWorldUsage
};