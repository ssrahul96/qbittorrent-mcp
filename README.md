# qBittorrent MCP Service

qBittorrent MCP is a Node.js-based service that provides functional interfaces for interacting with the qBittorrent WebUI API using the Model Context Protocol (MCP).

## Feature List

This service provides the following features:

### Torrent Management
- `add_torrent`: Add torrent file(s) to qBittorrent
- `delete_torrent`: Delete specified torrent(s) (optionally delete files as well)
- `pause_torrent`: Pause torrent download
- `resume_torrent`: Resume torrent download
- `get_torrent_list`: Get list of all torrents

### Trackers and Tags
- `get_torrent_trackers`: Get tracker list for a torrent
- `add_trackers_to_torrent`: Add new trackers to a torrent
- `add_torrent_tags`: Add tags to a torrent

### Speed and Priority Control
- `set_global_download_limit`: Set global download speed limit
- `set_global_upload_limit`: Set global upload speed limit
- `set_torrent_download_limit`: Set download speed limit for a specific torrent
- `set_torrent_upload_limit`: Set upload speed limit for a specific torrent
- `set_file_priority`: Set download priority for a specific file

### System Information
- `get_application_version`: Get qBittorrent application version

## Configuration

The service uses the following environment variables for configuration:
- `QBITTORRENT_HOST`: qBittorrent WebUI host address (default: `http://127.0.0.1:8080`)
- `QBITTORRENT_USERNAME`: qBittorrent WebUI username (default: `admin`)
- `QBITTORRENT_PASSWORD`: qBittorrent WebUI password (default: `adminadmin`)

## Installation

### Using npm

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build TypeScript:
   ```bash
   npm run build
   ```

3. Set environment variables (optional, defaults are provided):
   ```bash
   export QBITTORRENT_HOST="http://127.0.0.1:8080"
   export QBITTORRENT_USERNAME="admin"
   export QBITTORRENT_PASSWORD="adminadmin"
   ```

4. Run the MCP service:
   ```bash
   npm start
   ```

### Development Mode

For development with auto-reload:

```bash
npm run dev
```

## Usage in Cursor

To use this MCP server in Cursor IDE:

1. **Build the project** (if not already built):
   ```bash
   npm install
   npm run build
   ```

2. **Open Cursor Settings**:
   - Press `Cmd+,` (macOS) or `Ctrl+,` (Windows/Linux) to open settings
   - Search for "MCP" or "Model Context Protocol"
   - Or navigate to: Settings → Features → Model Context Protocol

3. **Add the MCP Server**:
   - Click "Add MCP Server" or edit the MCP servers configuration
   - Add the following configuration (update the path to match your system):

   ```json
   {
     "mcpServers": {
       "qbittorrent": {
         "command": "node",
         "args": [
           "/Users/rs882b/repos/personal/qbittorrent-mcp/dist/index.js"
         ],
         "env": {
           "QBITTORRENT_HOST": "http://127.0.0.1:8080",
           "QBITTORRENT_USERNAME": "admin",
           "QBITTORRENT_PASSWORD": "adminadmin"
         }
       }
     }
   }
   ```

   **Important**: Update the path in `args` to match your actual project location.

4. **Restart Cursor** or reload the window to activate the MCP server.

5. **Verify it's working**:
   - Open the Cursor chat/composer
   - The qBittorrent tools should now be available
   - Try asking: "List all my torrents" or "Get qBittorrent version"

### Alternative: Using npm script

You can also use npm to run the server:

```json
{
  "mcpServers": {
    "qbittorrent": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/Users/rs882b/repos/personal/qbittorrent-mcp",
      "env": {
        "QBITTORRENT_HOST": "http://127.0.0.1:8080",
        "QBITTORRENT_USERNAME": "admin",
        "QBITTORRENT_PASSWORD": "adminadmin"
      }
    }
  }
}
```

## Usage with Other MCP Clients

The MCP server runs on stdio by default. To use it with other MCP clients, configure it in your MCP client configuration:

```json
{
  "mcpServers": {
    "qbittorrent": {
      "command": "node",
      "args": ["/path/to/qbittorrent-mcp/dist/index.js"],
      "env": {
        "QBITTORRENT_HOST": "http://127.0.0.1:8080",
        "QBITTORRENT_USERNAME": "admin",
        "QBITTORRENT_PASSWORD": "adminadmin"
      }
    }
  }
}
```

Or using npm:

```json
{
  "mcpServers": {
    "qbittorrent": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/qbittorrent-mcp",
      "env": {
        "QBITTORRENT_HOST": "http://127.0.0.1:8080",
        "QBITTORRENT_USERNAME": "admin",
        "QBITTORRENT_PASSWORD": "adminadmin"
      }
    }
  }
}
```

## Development

The service is divided into two main files:
- `index.ts`: Defines MCP service interfaces and configuration parameters
- `api.ts`: Implements interaction logic with qBittorrent WebUI

### Project Structure

```
qbittorrent-mcp/
├── index.ts          # MCP server setup and tool definitions
├── api.ts            # qBittorrent API functions
├── client.ts         # Optional test client
├── package.json      # Node.js dependencies
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## Docker

Build and run with Docker:

```bash
docker build -t qbittorrent-mcp .
docker run -e QBITTORRENT_HOST=http://your-host:8080 \
           -e QBITTORRENT_USERNAME=admin \
           -e QBITTORRENT_PASSWORD=yourpassword \
           qbittorrent-mcp
```

## Requirements

- Node.js 20 or higher
- TypeScript 5.6 or higher
- qBittorrent with WebUI enabled
