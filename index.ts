import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import * as z from 'zod';
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
  initializeApiCredentials,
  type ApiCredentials,
} from "./api.ts";

// Constants
const DEFAULT_CREDENTIALS: ApiCredentials = {
  host: process.env.QBITTORRENT_HOST || "http://127.0.0.1:8080",
  username: process.env.QBITTORRENT_USERNAME || "admin",
  password: process.env.QBITTORRENT_PASSWORD || "adminadmin",
};

const DEFAULT_PORT = 8000;

/**
 * Helper to create tool handler response
 */
function createToolResponse(result: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: result,
      },
    ],
  };
}

const getServer = () => {
  // Create an MCP server with implementation details
  const server = new McpServer(
    {
      name: 'qbittorrent',
      version: '0.1.0'
    },
    { capabilities: { logging: {} } }
  );

  // Register tools using registerTool with Zod schemas
  server.registerTool(
  "add_torrent",
  {
    description:
      "Add torrent via magnet link to qBittorrent\n\nArgs:\n  query: Magnet link string (e.g., \"magnet:?xt=urn:btih:...\")\n\nReturns:\n  Status and message of the add operation result",
    inputSchema: {
      query: z.string().describe(
        "Magnet link string starting with 'magnet:'"
      ),
    },
  },
  async ({ query }) => {
    const result = await addTorrentApi(query);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await deleteTorrentApi(hashes, delete_files);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await pauseTorrentApi(hashes);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await resumeTorrentApi(hashes);
    return createToolResponse(result);
  }
);

  server.registerTool(
  "get_torrent_trackers",
  {
    description:
      "Get torrent trackers\n\nArgs:\n  hash: Torrent hash value\n\nReturns:\n  String containing tracker information",
    inputSchema: {
      hash: z.string().describe("Torrent hash value"),
    },
  },
  async ({ hash }) => {
    const result = await getTorrentTrackersUrls(hash);
    return createToolResponse(result);
  }
);

  server.registerTool(
  "set_global_download_limit",
  {
    description:
      "Set global download speed limit\n\nArgs:\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting the speed limit",
    inputSchema: {
      limit: z.number().describe("Speed limit value in bytes/second"),
    },
  },
  async ({ limit }) => {
    const result = await setGlobalDownloadLimitApi(limit);
    return createToolResponse(result);
  }
);

  server.registerTool(
  "set_global_upload_limit",
  {
    description:
      "Set global upload speed limit\n\nArgs:\n  limit: Speed limit value in bytes/second\n\nReturns:\n  Result message of setting the speed limit",
    inputSchema: {
      limit: z.number().describe("Speed limit value in bytes/second"),
    },
  },
  async ({ limit }) => {
    const result = await setGlobalUploadLimitApi(limit);
    return createToolResponse(result);
  }
);

  server.registerTool(
  "get_application_version",
  {
    description: "Get qBittorrent version\n\nReturns:\n  qBittorrent version",
    inputSchema: {},
  },
  async () => {
    const result = await getApplicationVersionApi();
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await setFilePriorityApi(hash, id, priority);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await setTorrentDownloadLimitApi(hash, limit);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await setTorrentUploadLimitApi(hash, limit);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await addTrackersToTorrentApi(hash, trackerList);
    return createToolResponse(result);
  }
);

  server.registerTool(
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
    const result = await addTorrentTagsApi(hash, tagList);
    return createToolResponse(result);
  }
);

  server.registerTool(
  "get_torrent_list",
  {
    description: "Get torrent list",
    inputSchema: {},
  },
  async () => {
    const result = await getTorrentListApi();
    return createToolResponse(result);
  }
);

  return server;
};

// Initialize API credentials before creating the Express app
initializeApiCredentials(DEFAULT_CREDENTIALS);

const app = createMcpExpressApp({ host: '0.0.0.0' });

app.post('/mcp', async (req: Request, res: Response) => {
  const server = getServer();
  try {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
});

app.get('/mcp', async (_req: Request, res: Response) => {
  console.log('Received GET MCP request');
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.'
      },
      id: null
    })
  );
});

app.delete('/mcp', async (_req: Request, res: Response) => {
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.'
      },
      id: null
    })
  );
});

// Start the server
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : DEFAULT_PORT;
app.listen(PORT, error => {
  if (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  console.log(`qBittorrent MCP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});

