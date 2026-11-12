import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import type { BackendStatus, FigcraftMcpOptions } from './types.js';

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  id?: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class FigcraftBackend {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number | string, {
    resolve: (res: any) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(
    private readonly status: BackendStatus,
    private readonly options: FigcraftMcpOptions
  ) {}

  public async start(): Promise<void> {
    const cliPath = this.status.cliPath;
    if (!cliPath) {
      throw new Error('figcraft-cli binary not found. Please install FigCraft or set FIGCRAFT_CLI.');
    }

    const args = ['mcp'];

    if (this.status.mode === 'attached') {
      args.push('--attach', String(this.status.port));
    } else {
      if (this.options.rootPath) {
        args.push('--automation-write-root', this.options.rootPath);
      }
    }

    if (this.options.timeout) {
      args.push('--timeout', String(this.options.timeout));
    }

    this.log(`Spawning ${cliPath} with args: ${args.join(' ')}`);

    this.child = spawn(cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FIGCRAFT_NO_SYSTEM_FONTS: process.env.FIGCRAFT_NO_SYSTEM_FONTS ?? '0',
      },
    });

    const rl = readline.createInterface({ input: this.child.stdout });

    rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed: JsonRpcResponse = JSON.parse(trimmed);
        if (parsed.id !== undefined && this.pending.has(parsed.id)) {
          const entry = this.pending.get(parsed.id)!;
          this.pending.delete(parsed.id);
          clearTimeout(entry.timer);

          if (parsed.error) {
            entry.reject(new Error(parsed.error.message || `RPC Error ${parsed.error.code}`));
          } else {
            entry.resolve(parsed.result);
          }
        }
      } catch {
        this.log(`Failed to parse backend line: ${trimmed}`);
      }
    });

    this.child.stderr.on('data', (chunk: Buffer | string) => {
      const msg = chunk.toString();
      process.stderr.write(`[figcraft-backend] ${msg}`);
    });

    this.child.on('error', (err: Error) => {
      this.log(`Backend process error: ${err.message}`);
      this.cleanupPending(err);
    });

    this.child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      this.log(`Backend process exited (code=${code}, signal=${signal})`);
      this.cleanupPending(new Error(`FigCraft backend process exited with code ${code}`));
      this.child = null;
    });

    // Initialize backend handshake
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'figcraft-mcp-ts',
        version: '0.1.0',
      },
    });
  }

  public request<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.child || !this.child.stdin.writable) {
        return reject(new Error('FigCraft backend process is not running'));
      }

      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout waiting for response to '${method}' (id=${id})`));
        }
      }, (this.options.timeout || 300) * 1000);

      this.pending.set(id, { resolve, reject, timer });

      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }) + '\n';

      this.child.stdin.write(payload);
    });
  }

  public async listTools(): Promise<any> {
    return this.request('tools/list');
  }

  public async callTool(name: string, args: Record<string, any>): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
  }

  public async listResources(): Promise<any> {
    return this.request('resources/list');
  }

  public async readResource(uri: string): Promise<any> {
    return this.request('resources/read', { uri });
  }

  public async listPrompts(): Promise<any> {
    return this.request('prompts/list');
  }

  public async getPrompt(name: string, args?: Record<string, any>): Promise<any> {
    return this.request('prompts/get', { name, arguments: args });
  }

  public close(): void {
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        // ignore
      }
      this.child = null;
    }
    this.cleanupPending(new Error('Backend closed'));
  }

  private cleanupPending(err: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }

  private log(msg: string): void {
    if (this.options.verbose) {
      process.stderr.write(`[figcraft-mcp] ${msg}\n`);
    }
  }
}
