import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createInterface, Interface } from "readline";
import dotenv from "dotenv";

dotenv.config(); // load environment variables from .env

class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private rl: Interface | null = null;

  async connectToServer() {
    const serverPath = process.env.SERVER_PATH || "./dist/index.js";
    const serverCommand = process.env.SERVER_COMMAND || "node";

    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: [serverPath],
      env: process.env as Record<string, string>,
    });

    this.client = new Client(
      {
        name: "qbittorrent-client",
        version: "0.1.0",
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);

    // List available tools
    const response = await this.client.listTools();
    const tools = response.tools;
    console.log(
      "\nConnected to server with tools:",
      tools.map((tool) => tool.name)
    );
  }

  async processQuery(query: string): Promise<string> {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    // List available tools
    const toolsResponse = await this.client.listTools();
    const availableTools = toolsResponse.tools;

    // For simplicity, we'll just call the first matching tool
    // In a real implementation, you might want to use an LLM to determine which tool to call
    const results: string[] = [];
    const queryLower = query.toLowerCase();

    // Try to parse the query and call appropriate tools
    // This is a simplified version - you might want to enhance this
    for (const tool of availableTools) {
      try {
        // Simple heuristic: if query mentions the tool name, try calling it
        if (queryLower.includes(tool.name.toLowerCase())) {
          // This is a simplified approach - you'd need proper argument parsing
          const result = await this.client.callTool({
            name: tool.name,
            arguments: {},
          });
          results.push(`[${tool.name}]: ${JSON.stringify(result)}`);
        }
      } catch {
        // Ignore errors for tools that don't match
      }
    }

    if (results.length === 0) {
      const toolNames = availableTools.map((t) => t.name).join(", ");
      return `No matching tools found. Available tools: ${toolNames}`;
    }

    return results.join("\n");
  }

  async chatLoop(): Promise<void> {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\nMCP Client Started!");
    console.log("Type your queries or 'quit' to exit.");

    const askQuestion = (): void => {
      if (!this.rl) return;

      this.rl.question("\nQuery: ", async (query) => {
        if (query.toLowerCase() === "quit") {
          this.rl?.close();
          await this.cleanup();
          return;
        }

        try {
          const response = await this.processQuery(query);
          console.log(`\n${response}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`\nError: ${message}`);
        }

        askQuestion();
      });
    };

    askQuestion();
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      // Stdio transport cleanup is handled automatically
      this.transport = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}

async function main(): Promise<void> {
  const client = new MCPClient();
  try {
    await client.connectToServer();
    await client.chatLoop();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.cleanup();
  }
}

// Run main if this file is executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

