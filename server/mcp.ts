/**
 * MCP (Model Context Protocol) stdio transport
 * Manages MCP server processes, tool discovery, and invocation
 */
import { spawn, ChildProcess } from 'child_process';

// ── Types ──────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  running: boolean;
  toolCount: number;
  resourceCount: number;
  tools?: MCPTool[];
  error?: string;
}

interface MCPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

function createMcpStderrLogger(name: string): (chunk: Buffer) => void {
  let multilineJson: { label: string; lines: number; started: boolean } | null = null;
  const isMultilineJsonBanner = (line: string) =>
    /^(Initialize request|Read profile|Read profile response|.* payload):/i.test(line);
  const isJsonPayloadLine = (line: string) =>
    /^[{}[\],]+$/.test(line) ||
    /^"?[\w.-]+"?\s*:/.test(line) ||
    /^"[^"]*"\s*,?$/.test(line) ||
    /^(true|false|null|\d+)\s*,?$/.test(line);
  const finish = () => {
    if (!multilineJson) return;
    console.error(`[MCP:${name}] ${multilineJson.label} (${multilineJson.lines} JSON lines)`);
    multilineJson = null;
  };

  return (chunk: Buffer) => {
    for (const rawLine of chunk.toString().split('\n')) {
      const line = rawLine.trim().replace(/^[->]\s+/, '');
      if (!line) continue;
      if (multilineJson) {
        if (isJsonPayloadLine(line)) {
          multilineJson.started = true;
          multilineJson.lines++;
          continue;
        }
        if (multilineJson.started) finish();
        else multilineJson = null;
      }
      if (isMultilineJsonBanner(line)) {
        multilineJson = { label: line.replace(/:$/, ''), lines: 0, started: false };
        continue;
      }
      console.error(`[MCP:${name}] ${line}`);
    }
  };
}

// ── MCP Client ────────────────────────────────────────

class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number | string, { resolve: (value: any) => void; reject: (err: Error) => void }>();
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private connected = false;
  private buffer = '';
  public lastError?: string;
  private reconnectAttempts = 0;
  public readonly maxRetries = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly id: string,
    public readonly name: string,
    private command: string,
    private args: string[] = [],
    private env: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    if (this.process && !this.process.killed) {
      return; // already connected
    }

    return new Promise((resolve, reject) => {
      try {
        // Parse command — handle both stdio:// and direct commands
        const cmd = this.command.replace(/^stdio:\/\//, '');
        const fullCmd = cmd.includes(' ') ? cmd.split(' ') : [cmd];
        const command = fullCmd[0];
        const args = [...fullCmd.slice(1), ...this.args];

        this.process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.env },
          detached: false,
        });

        this.process.on('error', (err) => {
          this.lastError = err.message;
          this.connected = false;
          reject(err);
        });

        this.process.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            this.lastError = `Process exited with code ${code}`;
          }
          this.connected = false;
          this.process = null;
        });

        // Read JSON-RPC messages from stdout
        this.process.stdout!.on('data', (chunk: Buffer) => {
          this.buffer += chunk.toString();
          this.processBuffer();
        });

        const logStderr = createMcpStderrLogger(this.name);
        this.process.stderr!.on('data', logStderr);

        // Initialize the connection
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'openharness', version: '1.0.0' },
        }).then(() => {
          this.connected = true;
          // Send initialized notification
          this.sendNotification('notifications/initialized', {});
          // Discover tools and resources
          this.discover().then(() => resolve()).catch(() => resolve());
        }).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.connected = false;
  }

  /** Attempt to reconnect if the process died and we haven't exceeded max retries. */
  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxRetries) {
      console.log(`[MCP] ${this.name}: max reconnection attempts (${this.maxRetries}) reached, giving up`);
      return false;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    console.log(`[MCP] ${this.name}: reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxRetries})`);
    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.connect();
          console.log(`[MCP] ${this.name}: reconnected successfully`);
          this.reconnectAttempts = 0;
          resolve(true);
        } catch (err) {
          console.warn(`[MCP] ${this.name}: reconnect attempt ${this.reconnectAttempts} failed: ${err}`);
          resolve(await this.reconnect());
        }
      }, delay);
    });
  }

  getTools(): MCPTool[] { return this.tools; }
  getResources(): MCPResource[] { return this.resources; }
  isConnected(): boolean { return this.connected; }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', { uri });
  }

  // ── Private ──

  private async discover(): Promise<void> {
    try {
      const toolsResult = await this.sendRequest('tools/list', {});
      this.tools = toolsResult?.tools || [];
    } catch { /* server may not support tools */ }

    try {
      const resourcesResult = await this.sendRequest('resources/list', {});
      this.resources = resourcesResult?.resources || [];
    } catch { /* server may not support resources */ }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        return reject(new Error(`MCP server ${this.name} not running`));
      }
      const id = ++this.requestId;
      const msg: MCPMessage = { jsonrpc: '2.0', id, method, params };

      this.pending.set(id, { resolve, reject });

      const body = JSON.stringify(msg);
      const data = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
      this.process.stdin.write(data);

      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private sendNotification(method: string, params: any): void {
    if (!this.process?.stdin?.writable) return;
    const msg: MCPMessage = { jsonrpc: '2.0', method, params };
    const body = JSON.stringify(msg);
    const data = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    this.process.stdin.write(data);
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      // Look for Content-Length header
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (this.buffer.length < bodyEnd) break; // incomplete message

      const body = this.buffer.slice(bodyStart, bodyEnd);
      this.buffer = this.buffer.slice(bodyEnd);

      try {
        const msg = JSON.parse(body) as MCPMessage;
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      } catch { /* skip malformed */ }
    }
  }
}

// ── HTTP MCP Transport ─────────────────────────────────
// For Docker MCP gateway running on a TCP port (streamable HTTP)

class MCPHttpTransport {
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private connected = false;
  private requestId = 0;
  public lastError?: string;
  private reconnectAttempts = 0;
  public readonly maxRetries = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly id: string,
    public readonly name: string,
    private baseUrl: string,
    private headers: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'openharness', version: '1.0.0' },
      });
      this.connected = true;
      // Send initialized notification (fire-and-forget for HTTP)
      this.sendNotification('notifications/initialized', {}).catch(() => {});
      await this.discover();
    } catch (err: any) {
      this.lastError = err.message;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.connected = false;
  }

  /** Attempt to reconnect if transport is down and we haven't exceeded max retries. */
  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxRetries) {
      console.log(`[MCP:http] ${this.name}: max reconnection attempts (${this.maxRetries}) reached, giving up`);
      return false;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    console.log(`[MCP:http] ${this.name}: reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxRetries})`);
    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.connect();
          console.log(`[MCP:http] ${this.name}: reconnected successfully`);
          this.reconnectAttempts = 0;
          resolve(true);
        } catch (err) {
          console.warn(`[MCP:http] ${this.name}: reconnect attempt ${this.reconnectAttempts} failed: ${err}`);
          resolve(await this.reconnect());
        }
      }, delay);
    });
  }

  getTools(): MCPTool[] { return this.tools; }
  getResources(): MCPResource[] { return this.resources; }
  isConnected(): boolean { return this.connected; }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', { uri });
  }

  // ── Private ──

  private async discover(): Promise<void> {
    try {
      const toolsResult = await this.sendRequest('tools/list', {});
      this.tools = toolsResult?.tools || [];
    } catch { /* no tools */ }
    try {
      const resourcesResult = await this.sendRequest('resources/list', {});
      this.resources = resourcesResult?.resources || [];
    } catch { /* no resources */ }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    const id = ++this.requestId;
    const msg = { jsonrpc: '2.0', id, method, params };
    const response = await fetch(this.baseUrl + '/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(msg),
    });
    if (!response.ok) {
      throw new Error('MCP HTTP ' + response.status + ': ' + await response.text().catch(() => ''));
    }
    const data = await response.json() as any;
    if (data.error) throw new Error(data.error.message || 'MCP error');
    return data.result;
  }

  private async sendNotification(method: string, params: any): Promise<void> {
    const msg = { jsonrpc: '2.0', method, params };
    await fetch(this.baseUrl + '/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(msg),
    }).catch(() => {});
  }
}

// ── Stdio MCP Client ────────────────────────────────────
// Connects to a running MCP server/gateway child process via stdin/stdout

class StdioMCPClient {
  private requestId = 0;
  private pending = new Map<number | string, { resolve: (value: any) => void; reject: (err: Error) => void }>();
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private connected = false;
  private buffer = '';
  public lastError?: string;
  private reconnectAttempts = 0;
  public readonly maxRetries = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly id: string,
    public readonly name: string,
    private process: ChildProcess,
    private respawnCommand?: string,
    private respawnArgs?: string[],
  ) {
    // Monitor the initial process for exit so connected flag stays accurate
    if (this.process) {
      this.process.on('exit', (code: number | null) => {
        this.connected = false;
        this.lastError = `Process exited with code ${code}`;
      });
    }
  }

  async connect(): Promise<void> {
    // If the existing process is dead and we have respawn info, create a new one
    if ((!this.process || this.process.killed || !this.process.stdout) && this.respawnCommand) {
      // spawn is imported at module level
      console.log(`[MCP:stdio] ${this.name}: respawning process: ${this.respawnCommand} ${(this.respawnArgs || []).join(' ')}`);
      this.process = spawn(this.respawnCommand, this.respawnArgs || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        detached: false,
      });
      this.process.on('exit', (code) => {
        console.log(`[MCP:stdio] ${this.name}: process exited with code ${code}`);
        this.connected = false;
        this.lastError = `Process exited with code ${code}`;
      });
    }

    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdout || !this.process.stdin) {
        return reject(new Error('Child process has no stdin/stdout pipes and no respawn info'));
      }

      // Clean up old listeners before adding new ones
      this.process.stdout.removeAllListeners('data');
      this.process.stdout.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      const logStderr = createMcpStderrLogger(this.name);
      this.process.stderr?.on('data', logStderr);

      this.process.on('error', (err) => {
        this.lastError = err.message;
        this.connected = false;
        reject(err);
      });

      // Initialize
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'openharness', version: '1.0.0' },
      }).then(() => {
        this.connected = true;
        this.sendNotification('notifications/initialized', {});
        this.discover().then(() => resolve()).catch(() => resolve());
      }).catch(reject);
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.connected = false;
    // Don't kill the process — it's managed by the caller
  }

  /** Attempt to reconnect if the process died and we haven't exceeded max retries. */
  async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxRetries) {
      console.log(`[MCP:stdio] ${this.name}: max reconnection attempts (${this.maxRetries}) reached, giving up`);
      return false;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    console.log(`[MCP:stdio] ${this.name}: reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxRetries})`);
    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.connect();
          console.log(`[MCP:stdio] ${this.name}: reconnected successfully`);
          this.reconnectAttempts = 0;
          resolve(true);
        } catch (err) {
          console.warn(`[MCP:stdio] ${this.name}: reconnect attempt ${this.reconnectAttempts} failed: ${err}`);
          resolve(await this.reconnect());
        }
      }, delay);
    });
  }

  getTools(): MCPTool[] { return this.tools; }
  getResources(): MCPResource[] { return this.resources; }
  isConnected(): boolean { return this.connected; }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', { uri });
  }

  // ── Private ──

  private async discover(): Promise<void> {
    try { const r = await this.sendRequest('tools/list', {}); this.tools = r?.tools || []; } catch {}
    try { const r = await this.sendRequest('resources/list', {}); this.resources = r?.resources || []; } catch {}
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process.stdin?.writable) return reject(new Error('Process stdin not writable'));
      const id = ++this.requestId;
      const msg = { jsonrpc: '2.0', id, method, params };
      this.pending.set(id, { resolve, reject });
      // Docker MCP gateway uses newline-delimited JSON, not Content-Length framing
      this.process.stdin.write(JSON.stringify(msg) + '\n');
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('Timeout: ' + method)); } }, 30000);
    });
  }

  private sendNotification(method: string, params: any): void {
    if (!this.process.stdin?.writable) return;
    const msg = { jsonrpc: '2.0', method, params };
    this.process.stdin.write(JSON.stringify(msg) + '\n');
  }

  private processBuffer(): void {
    // Docker MCP gateway sends newline-delimited JSON
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || 'MCP error'));
          else resolve(msg.result);
        }
      } catch {}
    }
  }
}

// ── MCP Manager (singleton) ────────────────────────────

class MCPManager {
  private clients = new Map<string, MCPClient>();

  async startServer(id: string, name: string, command: string, env: Record<string, string> = {}): Promise<MCPClient> {
    // Stop existing if any
    const existing = this.clients.get(id);
    if (existing) await existing.disconnect();

    const client = new MCPClient(id, name, command, [], env);
    await client.connect();
    this.clients.set(id, client);
    return client;
  }

  async stopServer(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }

  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  getStatus(): MCPServerStatus[] {
    return Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      running: c.isConnected(),
      toolCount: c.getTools().length,
      tools: c.getTools(),
      resourceCount: c.getResources().length,
      error: c.lastError,
    }));
  }

  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<any> {
    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) throw new Error(`MCP server ${serverId} not running`);
    return client.callTool(toolName, args);
  }

  async startHttpServer(id: string, name: string, baseUrl: string, headers: Record<string, string> = {}): Promise<MCPHttpTransport> {
    const existing = this.clients.get(id);
    if (existing) await existing.disconnect();

    const transport = new MCPHttpTransport(id, name, baseUrl, headers);
    await transport.connect();
    this.clients.set(id, transport as any);
    return transport;
  }

  // Connect to a running MCP gateway child process via stdio
  async startStdioClient(
    id: string,
    name: string,
    childProcess: ChildProcess,
    respawnCommand?: string,
    respawnArgs?: string[],
  ): Promise<MCPClient> {
    const existing = this.clients.get(id);
    if (existing) await existing.disconnect();

    // Create a stdio-connected client that uses the existing process
    // and knows how to respawn if the process dies
    const client = new StdioMCPClient(id, name, childProcess, respawnCommand, respawnArgs);
    await client.connect();
    this.clients.set(id, client as any);
    return client as any;
  }

  async stopAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }

  // ── Watchdog ──────────────────────────────────────────
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private isWatchdogRunning = false;

  /**
   * Start a periodic watchdog that checks connection health and
   * attempts to reconnect any disconnected clients.
   * Checks every 30s. Uses incremental backoff per-client.
   */
  startWatchdog(intervalMs: number = 30_000): void {
    if (this.isWatchdogRunning) return;
    this.isWatchdogRunning = true;
    console.log(`[MCP:watchdog] Starting health checks every ${intervalMs}ms`);
    const tick = async () => {
      if (!this.isWatchdogRunning) return;
      for (const [id, client] of this.clients) {
        const c = client as any;
        if (!c.isConnected && typeof c.isConnected === 'undefined') continue;
        const connected = typeof c.isConnected === 'function' ? c.isConnected() : c.isConnected;
        if (!connected && c.reconnect) {
          try {
            await c.reconnect();
          } catch (err) {
            console.warn(`[MCP:watchdog] Reconnect failed for ${id}:`, err);
          }
        }
      }
      this.watchdogTimer = setTimeout(tick, intervalMs);
    };
    this.watchdogTimer = setTimeout(tick, intervalMs);
  }

  /** Stop the watchdog timer. */
  stopWatchdog(): void {
    this.isWatchdogRunning = false;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Get status with reconnection metadata for the UI.
   */
  getVerboseStatus(): Array<MCPServerStatus & {
    reconnectAttempts: number;
    maxRetries: number;
  }> {
    return Array.from(this.clients.entries()).map(([id, client]) => {
      const c = client as any;
      const connected = typeof c.isConnected === 'function' ? c.isConnected() : c.isConnected;
      return {
        id,
        name: c.name || id,
        running: !!connected,
        toolCount: c.getTools ? c.getTools().length : 0,
        tools: c.getTools ? c.getTools() : [],
        resourceCount: c.getResources ? c.getResources().length : 0,
        error: c.lastError,
        reconnectAttempts: c.reconnectAttempts ?? 0,
        maxRetries: c.maxRetries ?? 3,
      };
    });
  }

}

// Export singleton
export const mcpManager = new MCPManager();
