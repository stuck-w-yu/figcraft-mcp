import net from 'node:net';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { BackendStatus } from './types.js';

export function isPortOpen(port: number, host = '127.0.0.1', timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      status = true;
      socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', () => {
      socket.destroy();
    });

    socket.on('close', () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
}

export function findCliBinary(customPath?: string): string | null {
  if (customPath && fs.existsSync(customPath)) {
    try {
      fs.accessSync(customPath, fs.constants.X_OK);
      return customPath;
    } catch {
      // not executable
    }
  }

  const envCli = process.env.FIGCRAFT_CLI;
  if (envCli && fs.existsSync(envCli)) {
    try {
      fs.accessSync(envCli, fs.constants.X_OK);
      return envCli;
    } catch {
      // not executable
    }
  }

  try {
    const stdout = execSync('which figcraft-cli', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (stdout && fs.existsSync(stdout)) {
      return stdout;
    }
  } catch {
    // not in PATH
  }

  // Common fallback paths
  const commonPaths = [
    '/usr/bin/figcraft-cli',
    '/usr/local/bin/figcraft-cli',
    path.join(process.env.HOME || '', '.local/bin/figcraft-cli'),
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function detectBackend(
  port = 7979,
  customCli?: string,
  forceHeadless = false,
  forceAttach = false
): Promise<BackendStatus> {
  const cliPath = findCliBinary(customCli);
  const cliFound = cliPath !== null;

  let appListening = false;
  if (!forceHeadless) {
    appListening = await isPortOpen(port);
  }

  if (forceAttach && !appListening) {
    throw new Error(`FigCraft app is not listening on 127.0.0.1:${port}. Start FigCraft with '--control ${port}' first.`);
  }

  const mode: 'attached' | 'headless' = (appListening && !forceHeadless) ? 'attached' : 'headless';

  return {
    cliFound,
    cliPath: cliPath ?? undefined,
    appListening,
    port,
    mode,
  };
}
