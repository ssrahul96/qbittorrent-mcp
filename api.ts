import axios, { AxiosError } from "axios";
import FormData from "form-data";
import { URLSearchParams } from "url";

// Types
interface Cookies {
  readonly [key: string]: string;
}

interface ApiCredentials {
  readonly host: string;
  readonly username: string;
  readonly password: string;
}

interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly data: T;
}

// Constants
const FORM_URLENCODED_HEADERS = {
  Accept: "*/*",
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
} as const;

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
 */
async function loginToQBittorrent(creds: ApiCredentials): Promise<Cookies | null> {
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
      return Object.keys(cookies).length > 0 ? cookies : null;
    }
    return null;
  } catch {
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
  query: string,
  host: string,
  username: string,
  password: string
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  const cookies = await loginToQBittorrent(creds);
  if (!cookies) {
    return "Login failed, unable to get SID";
  }

  try {
    const magnetLinks = parseMagnetLinks(query);
    if (magnetLinks.length === 0) {
      return "Error: No magnet link provided";
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

        const response = await axios.post(`${host}/api/v2/torrents/add`, formData, {
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
          const status = axiosError.response.status;
          results.push(`Failed to add magnet link: status code ${status}`);
        } else {
          const message = error instanceof Error ? error.message : String(error);
          results.push(`Error adding magnet link: ${message}`);
        }
      }
    }

    return results.join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Helper to make authenticated API POST request
 */
async function makePostRequest(
  creds: ApiCredentials,
  endpoint: string,
  params: URLSearchParams
): Promise<ApiResponse> {
  const cookies = await loginToQBittorrent(creds);
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
  creds: ApiCredentials,
  endpoint: string,
  params?: URLSearchParams
): Promise<ApiResponse> {
  const cookies = await loginToQBittorrent(creds);
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
  deleteFiles = false,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({
      hashes,
      deleteFiles: deleteFiles.toString().toLowerCase(),
    });

    const { status, data } = await makePostRequest(creds, "/api/v2/torrents/delete", params);

    if (status === 200) {
      return hashes === "all"
        ? "Successfully deleted all torrents"
        : `Successfully deleted specified torrent(s): ${hashes}`;
    }
    return `Failed to delete torrent, HTTP status code: ${status}, response body: ${JSON.stringify(data)}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return `Error: ${String(error)}`;
  }
}

/**
 * Pause torrent(s)
 */
export async function pauseTorrentApi(
  hashes: string,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({ hashes });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/stop", params);

    if (status === 200) {
      return hashes === "all"
        ? "Successfully paused all torrents"
        : `Successfully paused specified torrent(s): ${hashes}`;
    }
    return `Failed to pause torrent: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Resume torrent(s)
 */
export async function resumeTorrentApi(
  hashes: string,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({ hashes });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/start", params);

    if (status === 200) {
      return hashes === "all"
        ? "Successfully resumed all torrents"
        : `Successfully resumed specified torrent(s): ${hashes}`;
    }
    return `Failed to resume torrent: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Get torrent trackers
 */
export async function getTorrentTrackersUrls(
  hash: string,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({ hash });
    const { status, data } = await makeGetRequest(creds, "/api/v2/torrents/trackers", params);

    if (status === 200) {
      const trackers = data as Array<{ url?: string }>;
      if (!trackers || trackers.length === 0) {
        return "This torrent has no trackers";
      }

      // Extract all URLs, excluding special trackers like DHT, PeX, LSD
      const trackerUrls = trackers
        .map((tracker) => tracker.url)
        .filter((url): url is string => typeof url === "string" && !url.startsWith("** ["));

      if (trackerUrls.length === 0) {
        return "This torrent has no valid tracker URLs";
      }

      return trackerUrls.join(",");
    }
    return `Failed to get torrent trackers: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Set global download speed limit
 */
export async function setGlobalDownloadLimitApi(
  limit: number,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({ limit: limit.toString() });
    const { status } = await makePostRequest(creds, "/api/v2/transfer/setDownloadLimit", params);

    if (status === 200) {
      return `Successfully set speed limit: ${limit}`;
    }
    return `Failed to set speed limit: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Set global upload speed limit
 */
export async function setGlobalUploadLimitApi(
  limit: number,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({ limit: limit.toString() });
    const { status } = await makePostRequest(creds, "/api/v2/transfer/setUploadLimit", params);

    if (status === 200) {
      return `Successfully set speed limit: ${limit}`;
    }
    return `Failed to set speed limit: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Get qBittorrent version
 */
export async function getApplicationVersionApi(
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const { status, data } = await makeGetRequest(creds, "/api/v2/app/version");

    if (status === 200) {
      return String(data).trim();
    }
    return `Failed to get qBittorrent version: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Set file priority
 */
export async function setFilePriorityApi(
  hash: string,
  id: string,
  priority: number,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({
      hash,
      id,
      priority: priority.toString(),
    });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/filePrio", params);

    if (status === 200) {
      return `Successfully set file priority: ${hash}:${id}:${priority}`;
    }
    return `Failed to set file priority: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Set torrent download speed limit
 */
export async function setTorrentDownloadLimitApi(
  hash: string,
  limit: number,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({
      hashes: hash,
      limit: limit.toString(),
    });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/setDownloadLimit", params);

    if (status === 200) {
      return `Successfully set torrent download speed limit: ${hash}:${limit}`;
    }
    return `Failed to set torrent download speed limit: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Set torrent upload speed limit
 */
export async function setTorrentUploadLimitApi(
  hash: string,
  limit: number,
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const params = new URLSearchParams({
      hashes: hash,
      limit: limit.toString(),
    });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/setUploadLimit", params);

    if (status === 200) {
      return `Successfully set torrent upload speed limit: ${hash}:${limit}`;
    }
    return `Failed to set torrent upload speed limit: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Add trackers to torrent
 */
export async function addTrackersToTorrentApi(
  hash: string,
  trackers: readonly string[],
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    // Join trackers with %0A (URL-encoded newline) as required by qBittorrent API
    const trackerUrls = trackers.join("%0A");
    const params = new URLSearchParams({ hash, urls: trackerUrls });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/addTrackers", params);

    if (status === 200) {
      return `Successfully added trackers: ${hash}:${trackers.join(",")}`;
    }
    return `Failed to add trackers: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Add tags to torrent
 */
export async function addTorrentTagsApi(
  hash: string,
  tags: readonly string[],
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    // Join tags with comma as required by qBittorrent API
    const tagsStr = tags.join(",");
    const params = new URLSearchParams({ hashes: hash, tags: tagsStr });
    const { status } = await makePostRequest(creds, "/api/v2/torrents/addTags", params);

    if (status === 200) {
      return `Successfully added torrent tags: ${hash}:${tags.join(",")}`;
    }
    return `Failed to add torrent tags: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

/**
 * Get torrent list
 */
export async function getTorrentListApi(
  host = "",
  username = "",
  password = ""
): Promise<string> {
  const creds: ApiCredentials = { host, username, password };
  try {
    const { status, data } = await makeGetRequest(creds, "/api/v2/torrents/info");

    if (status === 200) {
      return JSON.stringify(data, null, 2);
    }
    return `Failed to get torrent list: status code ${status}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

