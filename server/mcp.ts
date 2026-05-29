/**
 * MCP (Model Context Protocol) stdio transport
 * Manages MCP server processes, tool discovery, and invocation
 */
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { createInterface } from 'readline';

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

        this.process.stderr!.on('data', (chunk: Buffer) => {
          // Log MCP server stderr but don't crash
          console.error(`[MCP:${this.name}] ${chunk.toString().trim()}`);
        });

        // Initialize the connection
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'open-harness', version: '1.0.0' },
        }).then((result) => {
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
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.connected = false;
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

      const data = `Content-Length: ${JSON.stringify(msg).length}\r\n\r\n${JSON.stringify(msg)}`;
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
    const data = `Content-Length: ${JSON.stringify(msg).length}\r\n\r\n${JSON.stringify(msg)}`;
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

  constructor(
    public readonly id: string,
    public readonly name: string,
    private baseUrl: string,
    private headers: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    try {
      const result = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'open-harness', version: '1.0.0' },
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
    this.connected = false;
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

  constructor(
    public readonly id: string,
    public readonly name: string,
    private process: ChildProcess,
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process.stdout || !this.process.stdin) {
        return reject(new Error('Child process has no stdin/stdout pipes'));
      }

      this.process.stdout.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      this.process.stderr?.on('data', (chunk: Buffer) => {
        console.error('[MCP:' + this.name + '] ' + chunk.toString().trim());
      });

      this.process.on('error', (err) => {
        this.lastError = err.message;
        this.connected = false;
        reject(err);
      });

      // Initialize
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'open-harness', version: '1.0.0' },
      }).then((result) => {
        this.connected = true;
        this.sendNotification('notifications/initialized', {});
        this.discover().then(() => resolve()).catch(() => resolve());
      }).catch(reject);
    });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // Don't kill the process — it's managed by the caller
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
  async startStdioClient(id: string, name: string, childProcess: ChildProcess): Promise<MCPClient> {
    const existing = this.clients.get(id);
    if (existing) await existing.disconnect();

    // Create a stdio-connected client that uses the existing process
    const client = new StdioMCPClient(id, name, childProcess);
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
}

// Export singleton
export const mcpManager = new MCPManager();
