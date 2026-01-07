import axios, { AxiosError } from "axios";
import FormData from "form-data";
import { URLSearchParams } from "url";

// Types
interface Cookies {
  readonly [key: string]: string;
}

export interface ApiCredentials {
  readonly host: string;
  readonly username: string;
  readonly password: string;
}

interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly data: T;
}

// Global credentials - initialized at startup
let globalCredentials: ApiCredentials | null = null;

// Session cookie cache to avoid repeated logins
let cachedCookies: Cookies | null = null;
let cookieCacheTime: number = 0;
const COOKIE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize API credentials (must be called before using any API functions)
 */
export function initializeApiCredentials(creds: ApiCredentials): void {
  globalCredentials = creds;
  // Clear cookie cache when credentials change
  cachedCookies = null;
  cookieCacheTime = 0;
}

/**
 * Get the global API credentials
 */
function getCredentials(): ApiCredentials {
  if (!globalCredentials) {
    throw new Error("API credentials not initialized. Call initializeApiCredentials() first.");
  }
  return globalCredentials;
}

/**
 * Extract error message from error object
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Constants
const FORM_URLENCODED_HEADERS = {
  Accept: "*/*",
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
} as const;

/**
 * Generate a random ID for JSON-RPC 2.0 responses
 */
function generateRandomId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a JSON-RPC 2.0 success response
 */
function jsonRpcSuccess(result: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    result,
    id: generateRandomId()
  });
}

/**
 * Create a JSON-RPC 2.0 error response
 */
function jsonRpcError(code: number, message: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code,
      message
    },
    id: generateRandomId()
  });
}

/**
 * Convert cookies object to Cookie header string
 */
function cookiesToString(cookies: Cookies): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

/**
 * Extract cookies from Set-Cookie headers
 */
function extractCookies(setCookieHeaders: string | string[] | undefined): Cookies {
  const cookies: Record<string, string> = {};
  if (!setCookieHeaders) return cookies;

  const headersArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const cookieHeader of headersArray) {
    const parts = cookieHeader.split(";")[0]?.split("=");
    if (parts && parts.length >= 2) {
      const name = parts[0];
      const value = parts[1];
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    }
  }
  return cookies;
}

/**
 * Login to qBittorrent WebUI and get session cookie
 * Uses caching to avoid repeated logins within TTL period
 */
async function loginToQBittorrent(): Promise<Cookies | null> {
  // Return cached cookies if still valid
  const now = Date.now();
  if (cachedCookies && (now - cookieCacheTime) < COOKIE_CACHE_TTL) {
    return cachedCookies;
  }

  const creds = getCredentials();
  try {
    const response = await axios.post(
      `${creds.host}/api/v2/auth/login`,
      new URLSearchParams({ username: creds.username, password: creds.password }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: (status) => status === 200,
      }
    );

    if (response.status === 200) {
      const cookies = extractCookies(response.headers["set-cookie"]);
      if (Object.keys(cookies).length > 0) {
        cachedCookies = cookies;
        cookieCacheTime = now;
        return cookies;
      }
    }
    cachedCookies = null;
    cookieCacheTime = 0;
    return null;
  } catch {
    cachedCookies = null;
    cookieCacheTime = 0;
    return null;
  }
}

/**
 * Parse magnet links from query string
 */
function parseMagnetLinks(query: string): string[] {
  try {
    const data = JSON.parse(query);
    if (Array.isArray(data)) return data;
    if (typeof data === "object" && data.urls) return Array.isArray(data.urls) ? data.urls : [data.urls];
    if (typeof data === "object" && data.magnet_links) return Array.isArray(data.magnet_links) ? data.magnet_links : [data.magnet_links];
    throw new Error("Invalid JSON format");
  } catch {
    return [query.trim()];
  }
}

/**
 * Add torrent via magnet link(s) to qBittorrent
 */
export async function addTorrentApi(
  query: string
): Promise<string> {
  const creds = getCredentials();
  const cookies = await loginToQBittorrent();
  if (!cookies) {
    return jsonRpcError(-32000, "Login failed, unable to get SID");
  }

  try {
    const magnetLinks = parseMagnetLinks(query);
    if (magnetLinks.length === 0) {
      return jsonRpcError(-32602, "Error: No magnet link provided");
    }

    const results: string[] = [];
    const cookieHeader = cookiesToString(cookies);

    for (const magnetLink of magnetLinks) {
      if (!magnetLink.trim()) {
        results.push("Error: Empty magnet link provided");
        continue;
      }

      if (!magnetLink.startsWith("magnet:")) {
        results.push(`Error: Invalid magnet link format: ${magnetLink}`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("urls", magnetLink);
        // formData.append("autoTMM", "false");
        // formData.append("savepath", "");
        // formData.append("rename", "");
        // formData.append("category", "");
        // formData.append("stopped", "false");
        // formData.append("stopCondition", "None");
        // formData.append("contentLayout", "Original");
        // formData.append("dlLimit", "0");
        // formData.append("upLimit", "0");

        const response = await axios.post(`${creds.host}/api/v2/torrents/add`, formData, {
          headers: {
            ...formData.getHeaders(),
            Accept: "*/*",
            Cookie: cookieHeader,
          },
          maxRedirects: 0,
        });

        if (response.status === 200) {
          results.push(`Successfully added magnet link: ${magnetLink.substring(0, 50)}...`);
        } else {
          results.push(`Failed to add magnet link: status code ${response.status}`);
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          results.push(`Failed to add magnet link: status code ${axiosError.response.status}`);
        } else {
          results.push(`Error adding magnet link: ${getErrorMessage(error)}`);
        }
      }
    }

    return jsonRpcSuccess(results.join("\n"));
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Extract filename from URL
 */
function extractFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop() || 'torrent.torrent';
    // If no extension, add .torrent
    if (!fileName.includes('.')) {
      return `${fileName}.torrent`;
    }
    return fileName;
  } catch {
    // If URL parsing fails, try to extract from string
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1] || 'torrent.torrent';
    if (lastPart.includes('?')) {
      return lastPart.split('?')[0] || 'torrent.torrent';
    }
    return lastPart.includes('.') ? lastPart : `${lastPart}.torrent`;
  }
}

/**
 * Add torrent via file to qBittorrent
 */
export async function addTorrentFileApi(
  fileUrl: string,
  fileName?: string
): Promise<string> {
  const creds = getCredentials();
  const cookies = await loginToQBittorrent();
  if (!cookies) {
    return jsonRpcError(-32000, "Login failed, unable to get SID");
  }

  try {
    if (!fileUrl || !fileUrl.trim()) {
      return jsonRpcError(-32602, "Error: No file URL provided");
    }

    // Determine filename: use provided name or extract from URL
    const finalFileName = fileName && fileName.trim() 
      ? fileName.trim() 
      : extractFileNameFromUrl(fileUrl);

    // Download the file from the URL
    let fileContent: Buffer;
    try {
      const downloadResponse = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
      });
      fileContent = Buffer.from(downloadResponse.data);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return jsonRpcError(-32000, `Failed to download file from URL: HTTP status ${axiosError.response.status}`);
      }
      return jsonRpcError(-32603, `Error downloading file from URL: ${getErrorMessage(error)}`);
    }

    if (!fileContent || fileContent.length === 0) {
      return jsonRpcError(-32602, "Error: Downloaded file is empty");
    }

    const cookieHeader = cookiesToString(cookies);
    const formData = new FormData();
    formData.append("torrents", fileContent, {
      filename: finalFileName,
      contentType: "application/x-bittorrent",
    });

    const response = await axios.post(`${creds.host}/api/v2/torrents/add`, formData, {
      headers: {
        ...formData.getHeaders(),
        Accept: "*/*",
        Cookie: cookieHeader,
      },
      maxRedirects: 0,
    });

    if (response.status === 200) {
      return jsonRpcSuccess(`Successfully added torrent file: ${finalFileName} from ${fileUrl}`);
    }
    return jsonRpcError(-32000, `Failed to add torrent file: status code ${response.status}`);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      return jsonRpcError(-32000, `Failed to add torrent file: status code ${axiosError.response.status}`);
    }
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Helper to make authenticated API POST request
 */
async function makePostRequest(
  endpoint: string,
  params: URLSearchParams
): Promise<ApiResponse> {
  const creds = getCredentials();
  const cookies = await loginToQBittorrent();
  if (!cookies) {
    throw new Error("Login failed, unable to get SID");
  }

  const cookieHeader = cookiesToString(cookies);
  const response = await axios.post(`${creds.host}${endpoint}`, params.toString(), {
    headers: {
      ...FORM_URLENCODED_HEADERS,
      Cookie: cookieHeader,
    },
    maxRedirects: 0,
  });
  return { status: response.status, data: response.data };
}

/**
 * Helper to make authenticated API GET request
 */
async function makeGetRequest(
  endpoint: string,
  params?: URLSearchParams
): Promise<ApiResponse> {
  const creds = getCredentials();
  const cookies = await loginToQBittorrent();
  if (!cookies) {
    throw new Error("Login failed, unable to get SID");
  }

  const cookieHeader = cookiesToString(cookies);
  const response = await axios.get(`${creds.host}${endpoint}`, {
    params,
    headers: {
      Accept: "*/*",
      Cookie: cookieHeader,
    },
    maxRedirects: 0,
  });

  return { status: response.status, data: response.data };
}

/**
 * Delete torrent(s) from qBittorrent
 */
export async function deleteTorrentApi(
  hashes: string,
  deleteFiles = false
): Promise<string> {
  try {
    const params = new URLSearchParams({
      hashes,
      deleteFiles: deleteFiles.toString().toLowerCase(),
    });

    const { status, data } = await makePostRequest("/api/v2/torrents/delete", params);

    if (status === 200) {
      const message = hashes === "all"
        ? "Successfully deleted all torrents"
        : `Successfully deleted specified torrent(s): ${hashes}`;
      return jsonRpcSuccess(message);
    }
    return jsonRpcError(-32000, `Failed to delete torrent, HTTP status code: ${status}, response body: ${JSON.stringify(data)}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Pause torrent(s)
 */
export async function pauseTorrentApi(
  hashes: string
): Promise<string> {
  try {
    const params = new URLSearchParams({ hashes });
    const { status } = await makePostRequest("/api/v2/torrents/stop", params);
    if (status === 200) {
      const message = hashes === "all"
        ? "Successfully paused all torrents"
        : `Successfully paused specified torrent(s): ${hashes}`;
      return jsonRpcSuccess(message);
    }
    return jsonRpcError(-32000, `Failed to pause torrent: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Resume torrent(s)
 */
export async function resumeTorrentApi(
  hashes: string
): Promise<string> {
  try {
    const params = new URLSearchParams({ hashes });
    const { status } = await makePostRequest("/api/v2/torrents/start", params);

    if (status === 200) {
      const message = hashes === "all"
        ? "Successfully resumed all torrents"
        : `Successfully resumed specified torrent(s): ${hashes}`;
      return jsonRpcSuccess(message);
    }
    return jsonRpcError(-32000, `Failed to resume torrent: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Get torrent trackers
 */
export async function getTorrentTrackersUrls(
  hash: string
): Promise<string> {
  try {
    const params = new URLSearchParams({ hash });
    const { status, data } = await makeGetRequest("/api/v2/torrents/trackers", params);

    if (status === 200) {
      const trackers = data as Array<{ url?: string }>;
      if (!trackers || trackers.length === 0) {
        return jsonRpcSuccess("This torrent has no trackers");
      }

      // Extract all URLs, excluding special trackers like DHT, PeX, LSD
      const trackerUrls = trackers
        .map((tracker) => tracker.url)
        .filter((url): url is string => typeof url === "string" && !url.startsWith("** ["));

      if (trackerUrls.length === 0) {
        return jsonRpcSuccess("This torrent has no valid tracker URLs");
      }

      return jsonRpcSuccess(trackerUrls.join(","));
    }
    return jsonRpcError(-32000, `Failed to get torrent trackers: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Set global download speed limit
 */
export async function setGlobalDownloadLimitApi(
  limit: number
): Promise<string> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() });
    const { status } = await makePostRequest("/api/v2/transfer/setDownloadLimit", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully set speed limit: ${limit}`);
    }
    return jsonRpcError(-32000, `Failed to set speed limit: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Set global upload speed limit
 */
export async function setGlobalUploadLimitApi(
  limit: number
): Promise<string> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() });
    const { status } = await makePostRequest("/api/v2/transfer/setUploadLimit", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully set speed limit: ${limit}`);
    }
    return jsonRpcError(-32000, `Failed to set speed limit: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Get qBittorrent version
 */
export async function getApplicationVersionApi(): Promise<string> {
  try {
    const { status, data } = await makeGetRequest("/api/v2/app/version");

    if (status === 200) {
      return jsonRpcSuccess(String(data).trim());
    }
    return jsonRpcError(-32000, `Failed to get qBittorrent version: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Set file priority
 */
export async function setFilePriorityApi(
  hash: string,
  id: string,
  priority: number
): Promise<string> {
  try {
    const params = new URLSearchParams({
      hash,
      id,
      priority: priority.toString(),
    });
    const { status } = await makePostRequest("/api/v2/torrents/filePrio", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully set file priority: ${hash}:${id}:${priority}`);
    }
    return jsonRpcError(-32000, `Failed to set file priority: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Set torrent download speed limit
 */
export async function setTorrentDownloadLimitApi(
  hash: string,
  limit: number
): Promise<string> {
  try {
    const params = new URLSearchParams({
      hashes: hash,
      limit: limit.toString(),
    });
    const { status } = await makePostRequest("/api/v2/torrents/setDownloadLimit", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully set torrent download speed limit: ${hash}:${limit}`);
    }
    return jsonRpcError(-32000, `Failed to set torrent download speed limit: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Set torrent upload speed limit
 */
export async function setTorrentUploadLimitApi(
  hash: string,
  limit: number
): Promise<string> {
  try {
    const params = new URLSearchParams({
      hashes: hash,
      limit: limit.toString(),
    });
    const { status } = await makePostRequest("/api/v2/torrents/setUploadLimit", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully set torrent upload speed limit: ${hash}:${limit}`);
    }
    return jsonRpcError(-32000, `Failed to set torrent upload speed limit: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Add trackers to torrent
 */
export async function addTrackersToTorrentApi(
  hash: string,
  trackers: readonly string[]
): Promise<string> {
  try {
    // Join trackers with %0A (URL-encoded newline) as required by qBittorrent API
    const trackerUrls = trackers.join("%0A");
    const params = new URLSearchParams({ hash, urls: trackerUrls });
    const { status } = await makePostRequest("/api/v2/torrents/addTrackers", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully added trackers: ${hash}:${trackers.join(",")}`);
    }
    return jsonRpcError(-32000, `Failed to add trackers: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Add tags to torrent
 */
export async function addTorrentTagsApi(
  hash: string,
  tags: readonly string[]
): Promise<string> {
  try {
    // Join tags with comma as required by qBittorrent API
    const tagsStr = tags.join(",");
    const params = new URLSearchParams({ hashes: hash, tags: tagsStr });
    const { status } = await makePostRequest("/api/v2/torrents/addTags", params);

    if (status === 200) {
      return jsonRpcSuccess(`Successfully added torrent tags: ${hash}:${tags.join(",")}`);
    }
    return jsonRpcError(-32000, `Failed to add torrent tags: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

/**
 * Get torrent list
 */
export async function getTorrentListApi(): Promise<string> {
  try {
    const { status, data } = await makeGetRequest("/api/v2/torrents/info");

    if (status === 200) {
      return jsonRpcSuccess(data);
    }
    return jsonRpcError(-32000, `Failed to get torrent list: status code ${status}`);
  } catch (error) {
    return jsonRpcError(-32603, `Error: ${getErrorMessage(error)}`);
  }
}

