#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import os from 'node:os';
import { detectBackend } from './detector.js';
import { FigcraftBackend } from './backend.js';
import type { FigcraftMcpOptions, BackendStatus } from './types.js';

const VERSION = '0.1.0';

function parseArgs(args: string[]): FigcraftMcpOptions {
  const options: FigcraftMcpOptions = {
    port: parseInt(process.env.FIGCRAFT_PORT || '7979', 10),
    headless: false,
    attachOnly: false,
    timeout: parseInt(process.env.FIGCRAFT_TIMEOUT || '300', 10),
    rootPath: process.env.FIGCRAFT_ROOT || path.join(os.homedir(), 'dev/design'),
    cliPath: process.env.FIGCRAFT_CLI,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-V') {
      process.stdout.write(`figcraft-mcp v${VERSION}\n`);
      process.exit(0);
    } else if (arg === '--port' || arg === '-p') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val) || val <= 0 || val >= 65536) {
        process.stderr.write(`Invalid port: ${args[i]}\n`);
        process.exit(1);
      }
      options.port = val;
    } else if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--attach') {
      options.attachOnly = true;
    } else if (arg === '--timeout') {
      options.timeout = parseInt(args[++i], 10);
    } else if (arg === '--root') {
      options.rootPath = args[++i];
    } else if (arg === '--cli') {
      options.cliPath = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(`
FigCraft MCP Server (TypeScript / Node.js) v${VERSION}
Connects LLM agents to FigCraft design files and live sessions.

Usage:
  figcraft-mcp [options]

Options:
  -p, --port <number>       FigCraft desktop app control port (default: 7979 or FIGCRAFT_PORT)
      --headless            Force headless mode (in-process engine session; no window)
      --attach              Force attach mode (fail if FigCraft app is not running)
      --root <path>         Confine automation read/write path (default: ~/dev/design)
      --timeout <seconds>   RPC timeout in seconds (default: 300)
      --cli <path>          Path to figcraft-cli binary
  -v, --verbose             Print debug logs to stderr
  -h, --help                Show this help message
  -V, --version             Show version

Environment Variables:
  FIGCRAFT_PORT             Default control port (default: 7979)
  FIGCRAFT_ROOT             Default automation directory (default: ~/dev/design)
  FIGCRAFT_CLI              Path to figcraft-cli executable
  FIGCRAFT_TIMEOUT          Default RPC timeout in seconds
\n`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  let backendStatus: BackendStatus;
  try {
    backendStatus = await detectBackend(
      options.port,
      options.cliPath,
      options.headless,
      options.attachOnly
    );
  } catch (err: any) {
    process.stderr.write(`[figcraft-mcp] Initialization error: ${err.message}\n`);
    process.exit(1);
  }

  process.stderr.write(
    `[figcraft-mcp] Starting server in '${backendStatus.mode}' mode ` +
    `(cli: ${backendStatus.cliPath}, port: ${backendStatus.port})\n`
  );

  const backend = new FigcraftBackend(backendStatus, options);

  const cleanup = () => {
    backend.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await backend.start();
  } catch (err: any) {
    process.stderr.write(`[figcraft-mcp] Failed to start backend: ${err.message}\n`);
    process.exit(1);
  }

  const server = new Server(
    {
      name: 'figcraft-mcp',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const res = await backend.listTools();
      return { tools: res.tools || [] };
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to list tools: ${err.message}`);
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const res = await backend.callTool(request.params.name, request.params.arguments || {});
      return {
        content: res.content || [],
        isError: res.isError ?? false,
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${request.params.name}': ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const res = await backend.listResources();
      return { resources: res.resources || [] };
    } catch (err: any) {
      return { resources: [] };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const res = await backend.readResource(request.params.uri);
      return res;
    } catch (err: any) {
      throw new McpError(ErrorCode.InvalidRequest, `Resource read failed: ${err.message}`);
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      const res = await backend.listPrompts();
      return { prompts: res.prompts || [] };
    } catch (err: any) {
      return { prompts: [] };
    }
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      const res = await backend.getPrompt(request.params.name, request.params.arguments);
      return res;
    } catch (err: any) {
      throw new McpError(ErrorCode.InvalidRequest, `Prompt get failed: ${err.message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[figcraft-mcp] Ready on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(`[figcraft-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
