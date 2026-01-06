import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";
import { randomUUID } from "crypto";
import * as z from "zod";
import {
  addTorrentApi,
  deleteTorrentApi,
  pauseTorrentApi,
  resumeTorrentApi,
  getTorrentTrackersUrls,
  setGlobalDownloadLimitApi,
  setGlobalUploadLimitApi,
  getApplicationVersionApi,
  setFilePriorityApi,
  setTorrentDownloadLimitApi,
  setTorrentUploadLimitApi,
  addTrackersToTorrentApi,
  addTorrentTagsApi,
  getTorrentListApi,
} from "./api.ts";

// Types
interface ApiCredentials {
  host: string;
  username: string;
  password: string;
}


// Constants
const DEFAULT_CREDENTIALS: ApiCredentials = {
  host: process.env.QBITTORRENT_HOST || "http://127.0.0.1:8080",
  username: process.env.QBITTORRENT_USERNAME || "admin",
  password: process.env.QBITTORRENT_PASSWORD || "adminadmin",
};

const DEFAULT_PORT = 8000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Expose-Headers": "Content-Type, Mcp-Session-Id",
} as const;


// Initialize MCP server
const mcpServer = new McpServer({
  name: "qbittorrent",
  version: "0.1.0",
});

// Register tools using registerTool with Zod schemas
mcpServer.registerTool(
  "add_torrent",
  {
    description:
      "Add torrent file(s) to qBittorrent\n\nArgs:\n  query: Query string containing torrent file path(s), supports the following formats:\n         1. JSON string: \"{\\\"file_paths\\\": [\\\"path/to/file1.torrent\\\", \\\"path/to/file2.torrent\\\"]}\"\n         2. JSON string: \"[\\\"path/to/file1.torrent\\\", \\\"path/to/file2.torrent\\\"]\"\n         3. Single file path: \"path/to/file.torrent\"\n\nReturns:\n  Status and message of the add operation result",
    inputSchema: {
      query: z.string().describe(
        "Query string containing torrent file path(s), supports JSON array, JSON object with file_paths, or single file path"
      ),
    },
  },
  async ({ query }) => {
    const result = await addTorrentApi(
      query,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "delete_torrent",
  {
    description:
      "Delete torrent(s) from qBittorrent\n\nArgs:\n  hashes: Hash value(s) of torrent(s) to delete, multiple hashes separated by |, or use 'all' to delete all torrents\n  delete_files: If True, also delete downloaded files\n\nReturns:\n  Result message of the delete operation",
    inputSchema: {
      hashes: z.string().describe(
        "Hash value(s) of torrent(s) to delete, multiple hashes separated by |, or use 'all' to delete all torrents"
      ),
      delete_files: z.boolean().default(false).describe("If True, also delete downloaded files"),
    },
  },
  async ({ hashes, delete_files }) => {
    const result = await deleteTorrentApi(
      hashes,
      delete_files,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "pause_torrent",
  {
    description:
      "Pause torrent(s)\n\nArgs:\n  hashes: Hash value(s) of torrent(s) to pause, multiple hashes separated by |, or use 'all' to pause all torrents\n\nReturns:\n  Result message of the pause operation",
    inputSchema: {
      hashes: z.string().describe(
        "Hash value(s) of torrent(s) to pause, multiple hashes separated by |, or use 'all' to pause all torrents"
      ),
    },
  },
  async ({ hashes }) => {
    const result = await pauseTorrentApi(
      hashes,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "resume_torrent",
  {
    description:
      "Resume torrent(s)\n\nArgs:\n  hashes: Hash value(s) of torrent(s) to resume, multiple hashes separated by |, or use 'all' to resume all torrents\n\nReturns:\n  Result message of the resume operation",
    inputSchema: {
      hashes: z.string().describe(
        "Hash value(s) of torrent(s) to resume, multiple hashes separated by |, or use 'all' to resume all torrents"
      ),
    },
  },
  async ({ hashes }) => {
    const result = await resumeTorrentApi(
      hashes,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "get_torrent_trackers",
  {
    description:
      "Get torrent trackers\n\nArgs:\n  hash: Torrent hash value\n\nReturns:\n  String containing tracker information",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
    },
  },
  async ({ hash }) => {
    const result = await getTorrentTrackersUrls(
      hash,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "set_global_download_limit",
  {
    description:
      "Set global download speed limit\n\nArgs:\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting the speed limit",
    inputSchema: {
      limit: z.number().describe("Speed limit value in bytes/second"),
    },
  },
  async ({ limit }) => {
    const result = await setGlobalDownloadLimitApi(
      limit,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "set_global_upload_limit",
  {
    description:
      "Set global upload speed limit\n\nArgs:\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting the speed limit",
    inputSchema: {
      limit: z.number().describe("Speed limit value in bytes/second"),
    },
  },
  async ({ limit }) => {
    const result = await setGlobalUploadLimitApi(
      limit,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "get_application_version",
  {
    description: "Get qBittorrent version\n\nReturns:\n  qBittorrent version",
    inputSchema: {},
  },
  async () => {
    const result = await getApplicationVersionApi(
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "set_file_priority",
  {
    description:
      "Set file priority\n\nArgs:\n  hash: Torrent hash value\n  id: Corresponds to file position inside the array returned by torrent contents API, e.g. id=0 for first file, id=1 for second file, etc.\n  priority:\n  Value\tDescription\n  0\tDo not download\n  1\tNormal priority\n  6\tHigh priority\n  7\tMaximal priority\n\nReturns:\n  Result message of setting file priority",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
      id: z.string().describe(
        "Corresponds to file position inside the array returned by torrent contents API"
      ),
      priority: z.number().describe("Priority value (0, 1, 6, or 7)"),
    },
  },
  async ({ hash, id, priority }) => {
    const result = await setFilePriorityApi(
      hash,
      id,
      priority,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "set_torrent_download_limit",
  {
    description:
      "Set torrent download speed limit\n\nArgs:\n  hash: Torrent hash value\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting torrent download speed limit",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
      limit: z.number().describe("Speed limit value in bytes/second"),
    },
  },
  async ({ hash, limit }) => {
    const result = await setTorrentDownloadLimitApi(
      hash,
      limit,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "set_torrent_upload_limit",
  {
    description:
      "Set torrent upload speed limit\n\nArgs:\n  hash: Torrent hash value\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting torrent upload speed limit",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
      limit: z.number().describe("Speed limit value in bytes/second"),
    },
  },
  async ({ hash, limit }) => {
    const result = await setTorrentUploadLimitApi(
      hash,
      limit,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "add_trackers_to_torrent",
  {
    description:
      "Add trackers to torrent\n\nArgs:\n  hash: Torrent hash value\n  trackers: Tracker URL(s), multiple URLs separated by %0A\n\nReturns:\n  Result message of adding trackers",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
      trackers: z.string().describe("Tracker URL(s), multiple URLs separated by %0A or newline"),
    },
  },
  async ({ hash, trackers }) => {
    const trackerList = trackers
      .replace(/%0A/g, "\n")
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const result = await addTrackersToTorrentApi(
      hash,
      trackerList,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "add_torrent_tags",
  {
    description:
      "Add tags to torrent\n\nArgs:\n  hash: Torrent hash value\n  tags: List of tags, multiple tags separated by commas\n\nReturns:\n  Result message of adding torrent tags",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
      tags: z.string().describe("List of tags, multiple tags separated by commas"),
    },
  },
  async ({ hash, tags }) => {
    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const result = await addTorrentTagsApi(
      hash,
      tagList,
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

mcpServer.registerTool(
  "get_torrent_list",
  {
    description: "Get torrent list",
    inputSchema: {},
  },
  async () => {
    const result = await getTorrentListApi(
      DEFAULT_CREDENTIALS.host,
      DEFAULT_CREDENTIALS.username,
      DEFAULT_CREDENTIALS.password
    );
    return {
      content: [
        {
          type: "text" as const,
          text: result,
        },
      ],
    };
  }
);

// HTTP request handler
async function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  transport: StreamableHTTPServerTransport
): Promise<void> {
  // Handle both root / and /mcp paths (strip query parameters for matching)
  const url = req.url || "/";
  const urlPath = url.split("?")[0] || "/";
  if (urlPath !== "/" && urlPath !== "/mcp" && !urlPath.startsWith("/mcp/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    res.end();
    return;
  }

  // Set CORS headers for all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle GET requests (for SSE)
  if (req.method === "GET") {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Transport error on GET:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  // Handle POST requests
  if (req.method === "POST") {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Transport error on POST:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  // Method not allowed
  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

// Graceful shutdown handler
function setupGracefulShutdown(
  httpServer: http.Server,
  transport: StreamableHTTPServerTransport
): void {
  const shutdown = async (signal: string) => {
    console.error(`${signal} received, shutting down gracefully`);
    httpServer.close(() => {
      transport.close().then(() => {
        process.exit(0);
      });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Start the server
async function main(): Promise<void> {
  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : DEFAULT_PORT;

  // Create Streamable HTTP transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
  });

  // Connect server to transport
  await mcpServer.connect(transport);

  // Create HTTP server
  const httpServer = http.createServer((req, res) => {
    handleHttpRequest(req, res, transport).catch((error) => {
      console.error("Request handling error:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  });

  // Handle server errors
  httpServer.on("error", (error: Error) => {
    console.error("HTTP server error:", error);
  });

  // Setup graceful shutdown
  setupGracefulShutdown(httpServer, transport);

  // Start listening
  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`qBittorrent MCP server running on HTTP port ${port}`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

