import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import { randomUUID } from "crypto";
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

interface ToolHandler {
  (args: Record<string, unknown>, credentials: ApiCredentials): Promise<string>;
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
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

// Helper functions
function createTextResponse(text: string, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    ...(isError && { isError: true }),
  };
}

// Initialize MCP server
const server = new Server(
  {
    name: "qbittorrent",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add_torrent",
        description:
          "Add torrent file(s) to qBittorrent\n\nArgs:\n  query: Query string containing torrent file path(s), supports the following formats:\n         1. JSON string: \"{\\\"file_paths\\\": [\\\"path/to/file1.torrent\\\", \\\"path/to/file2.torrent\\\"]}\"\n         2. JSON string: \"[\\\"path/to/file1.torrent\\\", \\\"path/to/file2.torrent\\\"]\"\n         3. Single file path: \"path/to/file.torrent\"\n\nReturns:\n  Status and message of the add operation result",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Query string containing torrent file path(s), supports JSON array, JSON object with file_paths, or single file path",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "delete_torrent",
        description:
          "Delete torrent(s) from qBittorrent\n\nArgs:\n  hashes: Hash value(s) of torrent(s) to delete, multiple hashes separated by |, or use 'all' to delete all torrents\n  delete_files: If True, also delete downloaded files\n\nReturns:\n  Result message of the delete operation",
        inputSchema: {
          type: "object",
          properties: {
            hashes: {
              type: "string",
              description:
                "Hash value(s) of torrent(s) to delete, multiple hashes separated by |, or use 'all' to delete all torrents",
            },
            delete_files: {
              type: "boolean",
              description: "If True, also delete downloaded files",
              default: false,
            },
          },
          required: ["hashes"],
        },
      },
      {
        name: "pause_torrent",
        description:
          "Pause torrent(s)\n\nArgs:\n  hashes: Hash value(s) of torrent(s) to pause, multiple hashes separated by |, or use 'all' to pause all torrents\n\nReturns:\n  Result message of the pause operation",
        inputSchema: {
          type: "object",
          properties: {
            hashes: {
              type: "string",
              description:
                "Hash value(s) of torrent(s) to pause, multiple hashes separated by |, or use 'all' to pause all torrents",
            },
          },
          required: ["hashes"],
        },
      },
      {
        name: "resume_torrent",
        description:
          "Resume torrent(s)\n\nArgs:\n  hashes: Hash value(s) of torrent(s) to resume, multiple hashes separated by |, or use 'all' to resume all torrents\n\nReturns:\n  Result message of the resume operation",
        inputSchema: {
          type: "object",
          properties: {
            hashes: {
              type: "string",
              description:
                "Hash value(s) of torrent(s) to resume, multiple hashes separated by |, or use 'all' to resume all torrents",
            },
          },
          required: ["hashes"],
        },
      },
      {
        name: "get_torrent_trackers",
        description:
          "Get torrent trackers\n\nArgs:\n  hash: Torrent hash value\n\nReturns:\n  String containing tracker information",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "Torrent hash value",
            },
          },
          required: ["hash"],
        },
      },
      {
        name: "set_global_download_limit",
        description:
          "Set global download speed limit\n\nArgs:\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting the speed limit",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Speed limit value in bytes/second",
            },
          },
          required: ["limit"],
        },
      },
      {
        name: "set_global_upload_limit",
        description:
          "Set global upload speed limit\n\nArgs:\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting the speed limit",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Speed limit value in bytes/second",
            },
          },
          required: ["limit"],
        },
      },
      {
        name: "get_application_version",
        description:
          "Get qBittorrent version\n\nReturns:\n  qBittorrent version",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_file_priority",
        description:
          "Set file priority\n\nArgs:\n  hash: Torrent hash value\n  id: Corresponds to file position inside the array returned by torrent contents API, e.g. id=0 for first file, id=1 for second file, etc.\n  priority:\n  Value\tDescription\n  0\tDo not download\n  1\tNormal priority\n  6\tHigh priority\n  7\tMaximal priority\n\nReturns:\n  Result message of setting file priority",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "Torrent hash value",
            },
            id: {
              type: "string",
              description:
                "Corresponds to file position inside the array returned by torrent contents API",
            },
            priority: {
              type: "number",
              description: "Priority value (0, 1, 6, or 7)",
            },
          },
          required: ["hash", "id", "priority"],
        },
      },
      {
        name: "set_torrent_download_limit",
        description:
          "Set torrent download speed limit\n\nArgs:\n  hash: Torrent hash value\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting torrent download speed limit",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "Torrent hash value",
            },
            limit: {
              type: "number",
              description: "Speed limit value in bytes/second",
            },
          },
          required: ["hash", "limit"],
        },
      },
      {
        name: "set_torrent_upload_limit",
        description:
          "Set torrent upload speed limit\n\nArgs:\n  hash: Torrent hash value\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting torrent upload speed limit",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "Torrent hash value",
            },
            limit: {
              type: "number",
              description: "Speed limit value in bytes/second",
            },
          },
          required: ["hash", "limit"],
        },
      },
      {
        name: "add_trackers_to_torrent",
        description:
          "Add trackers to torrent\n\nArgs:\n  hash: Torrent hash value\n  trackers: Tracker URL(s), multiple URLs separated by %0A\n\nReturns:\n  Result message of adding trackers",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "Torrent hash value",
            },
            trackers: {
              type: "string",
              description:
                "Tracker URL(s), multiple URLs separated by %0A or newline",
            },
          },
          required: ["hash", "trackers"],
        },
      },
      {
        name: "add_torrent_tags",
        description:
          "Add tags to torrent\n\nArgs:\n  hash: Torrent hash value\n  tags: List of tags, multiple tags separated by commas\n\nReturns:\n  Result message of adding torrent tags",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "Torrent hash value",
            },
            tags: {
              type: "string",
              description: "List of tags, multiple tags separated by commas",
            },
          },
          required: ["hash", "tags"],
        },
      },
      {
        name: "get_torrent_list",
        description: "Get torrent list",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Tool handlers map
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  add_torrent: async (args, creds) =>
    addTorrentApi(args.query as string, creds.host, creds.username, creds.password),

  delete_torrent: async (args, creds) =>
    deleteTorrentApi(
      args.hashes as string,
      (args.delete_files as boolean) ?? false,
      creds.host,
      creds.username,
      creds.password
    ),

  pause_torrent: async (args, creds) =>
    pauseTorrentApi(args.hashes as string, creds.host, creds.username, creds.password),

  resume_torrent: async (args, creds) =>
    resumeTorrentApi(args.hashes as string, creds.host, creds.username, creds.password),

  get_torrent_trackers: async (args, creds) =>
    getTorrentTrackersUrls(args.hash as string, creds.host, creds.username, creds.password),

  set_global_download_limit: async (args, creds) =>
    setGlobalDownloadLimitApi(
      args.limit as number,
      creds.host,
      creds.username,
      creds.password
    ),

  set_global_upload_limit: async (args, creds) =>
    setGlobalUploadLimitApi(args.limit as number, creds.host, creds.username, creds.password),

  get_application_version: async (_args, creds) =>
    getApplicationVersionApi(creds.host, creds.username, creds.password),

  set_file_priority: async (args, creds) =>
    setFilePriorityApi(
      args.hash as string,
      args.id as string,
      args.priority as number,
      creds.host,
      creds.username,
      creds.password
    ),

  set_torrent_download_limit: async (args, creds) =>
    setTorrentDownloadLimitApi(
      args.hash as string,
      args.limit as number,
      creds.host,
      creds.username,
      creds.password
    ),

  set_torrent_upload_limit: async (args, creds) =>
    setTorrentUploadLimitApi(
      args.hash as string,
      args.limit as number,
      creds.host,
      creds.username,
      creds.password
    ),

  add_trackers_to_torrent: async (args, creds) => {
    const trackersStr = (args.trackers as string) || "";
    const trackerList = trackersStr
      .replace(/%0A/g, "\n")
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return addTrackersToTorrentApi(
      args.hash as string,
      trackerList,
      creds.host,
      creds.username,
      creds.password
    );
  },

  add_torrent_tags: async (args, creds) => {
    const tagsStr = (args.tags as string) || "";
    const tagList = tagsStr
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return addTorrentTagsApi(
      args.hash as string,
      tagList,
      creds.host,
      creds.username,
      creds.password
    );
  },

  get_torrent_list: async (_args, creds) =>
    getTorrentListApi(creds.host, creds.username, creds.password),
};

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const result = await handler(args, DEFAULT_CREDENTIALS);
    return createTextResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createTextResponse(`Error: ${message}`, true);
  }
});

// HTTP request handler
async function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  transport: StreamableHTTPServerTransport
): Promise<void> {
  // Handle both root / and /mcp paths
  const url = req.url || "/";
  if (url !== "/" && url !== "/mcp" && !url.startsWith("/mcp/")) {
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
    await transport.handleRequest(req, res);
    return;
  }

  // Handle POST requests
  if (req.method === "POST") {
    await transport.handleRequest(req, res);
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
  await server.connect(transport);

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

