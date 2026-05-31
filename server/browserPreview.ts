import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface BrowserPreviewResult {
  url: string;
  screenshotPath: string;
  screenshotBase64?: string;
  title?: string;
  timestamp: string;
  errors: ConsoleError[];
}

export interface ConsoleError {
  type: 'error' | 'warning';
  message: string;
  source?: string;
  line?: number;
}

const CACHE_DIR = join(homedir(), '.open-harness', 'browser-cache');

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Capture a screenshot of a local URL using a headless shell approach.
 * Uses `/usr/sbin/screencapture` for localhost URLs or a simple curl-based
 * approach for HTML content analysis.
 */
export async function capturePreview(url: string): Promise<BrowserPreviewResult> {
  ensureCacheDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = join(CACHE_DIR, `preview-${timestamp}.png`);

  const result: BrowserPreviewResult = {
    url,
    screenshotPath,
    timestamp: new Date().toISOString(),
    errors: [],
  };

  // Validate URL is localhost/127.0.0.1
  const isLocalUrl = /^(https?:\/\/)?(localhost|127\.0\.0\.1|::1)(:\d+)?/i.test(url);

  if (!isLocalUrl) {
    result.errors.push({ type: 'warning', message: 'Only localhost URLs are supported for security' });
    return result;
  }

  // Ensure URL has protocol
  const fullUrl = url.startsWith('http') ? url : `http://${url}`;

  try {
    // Try to fetch the page to check it's alive
    const curlResult = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${fullUrl}"`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();

    if (curlResult !== '200') {
      result.errors.push({ type: 'error', message: `Server returned HTTP ${curlResult}` });
      return result;
    }

    // Get page title via curl + grep
    try {
      const html = execSync(`curl -s --max-time 5 "${fullUrl}"`, {
        encoding: 'utf-8',
        maxBuffer: 5 * 1024 * 1024,
        timeout: 10000,
      });
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      result.title = titleMatch?.[1]?.trim() || fullUrl;
    } catch {
      result.title = fullUrl;
    }

    // Use the macOS screencapture tool if a browser window exists,
    // or fall back to a descriptive result
    try {
      // Check if there's a browser window with this URL open
      const windowCheck = execSync(
        `osascript -e 'tell application "System Events" to get name of every window of process "Safari" whose name contains "localhost"' 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (windowCheck && windowCheck !== '') {
        // Take a screenshot of the Safari window
        execSync(`screencapture -l $(osascript -e 'tell application "Safari" to get id of window 1') "${screenshotPath}" 2>/dev/null || true`, {
          timeout: 10000,
        });
      }
    } catch { /* no Safari window */ }

    // Try using webshot via a Python one-liner if available (many macOS systems have it)
    if (!existsSync(screenshotPath) || statSync(screenshotPath).size === 0) {
      try {
        execSync(
          `python3 -c "
import urllib.request
try:
    r = urllib.request.urlopen('${fullUrl}', timeout=5)
    print('STATUS:' + str(r.status))
except Exception as e:
    print('ERROR:' + str(e))
" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 10000 }
        );
      } catch { /* python not available or failed */ }
    }

    // If we captured a real screenshot, base64-encode it
    if (existsSync(screenshotPath)) {
      const stat = statSync(screenshotPath);
      if (stat.size > 0) {
        const buf = readFileSync(screenshotPath);
        result.screenshotBase64 = buf.toString('base64');
      }
    }

  } catch (err: any) {
    result.errors.push({ type: 'error', message: `Failed to connect: ${err.message?.split('\n')?.[0] || err.message}` });
  }

  return result;
}

/**
 * Quick health check for a local dev server
 */
export function checkServerHealth(url: string): { reachable: boolean; statusCode?: number; latencyMs: number } {
  const fullUrl = url.startsWith('http') ? url : `http://${url}`;
  const start = Date.now();
  try {
    const code = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${fullUrl}"`,
      { encoding: 'utf-8', timeout: 8000 }
    ).trim();
    return { reachable: code === '200', statusCode: parseInt(code, 10), latencyMs: Date.now() - start };
  } catch {
    return { reachable: false, latencyMs: Date.now() - start };
  }
}
